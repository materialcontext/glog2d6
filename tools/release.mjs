#!/usr/bin/env node
/**
 * What a release is, in one place.
 *
 * Two things live here: every file that carries the system version, and every
 * path that ships inside the distributable zip. The release workflow calls this
 * rather than duplicating either list in YAML, so adding a version field or a
 * new content directory is a one-line change with a test behind it.
 *
 * The logic is pure; only `main()` touches disk.
 *
 * Usage:
 *   node tools/release.mjs bump [--level patch|minor|major] [--dry-run]
 *   node tools/release.mjs level   # reads PR_LABELS / INPUT_LEVEL from the env
 *   node tools/release.mjs files
 *   node tools/release.mjs version
 */

import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

/**
 * Everything the system needs at runtime, relative to the repo root.
 *
 * `scripts/` is runtime code and ships; build tooling lives in `tools/`
 * and does not.
 */
export const RELEASE_PATHS = Object.freeze([
    "system.json",
    "template.json",
    "glog2d6.mjs",
    "glog2d6.css",
    "data",
    "lang",
    "module",
    "scripts",
    "templates"
]);

/**
 * Files that carry the system version.
 *
 * `scripts/initialize-content.mjs` deliberately is NOT here: its
 * `CONTENT_VERSION` gates world data migrations and must only move when a
 * migration is actually added. Bumping it on every release would re-run
 * migrations against every world, every time.
 */
export const VERSION_FILES = Object.freeze(["system.json", "package.json", "package-lock.json"]);

const BUMP_LEVELS = Object.freeze(["major", "minor", "patch"]);
const SKIP_LABELS = Object.freeze(["skip-release", "no-release"]);
const LABEL_PREFIX = "release:";

/* -------------------------------------------- */
/*  Versions                                    */
/* -------------------------------------------- */

/**
 * @param {string} version
 * @returns {[number, number, number]}
 */
export function parseVersion(version) {
    const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(String(version ?? "").trim());
    if (!match) throw new Error(`Not a semver version: ${JSON.stringify(version)}`);
    return [Number(match[1]), Number(match[2]), Number(match[3])];
}

/**
 * @param {string} current
 * @param {"major"|"minor"|"patch"} level
 * @returns {string}
 */
export function nextVersion(current, level = "patch") {
    if (!BUMP_LEVELS.includes(level)) throw new Error(`Unknown bump level: ${level}`);
    const [major, minor, patch] = parseVersion(current);
    if (level === "major") return `${major + 1}.0.0`;
    if (level === "minor") return `${major}.${minor + 1}.0`;
    return `${major}.${minor}.${patch + 1}`;
}

/**
 * Read the bump level off a merged PR's labels.
 *
 * `release:major` / `release:minor` / `release:patch` choose the level;
 * `skip-release` (or `no-release`) suppresses the release entirely. Anything
 * else means a patch, which is this project's normal cadence.
 *
 * @param {Array<string|{name: string}>} labels
 * @returns {"major"|"minor"|"patch"|null}  null means "do not release"
 */
export function bumpLevelFromLabels(labels = []) {
    const names = labels
        .map(label => (typeof label === "string" ? label : label?.name))
        .filter(Boolean)
        .map(name => name.trim().toLowerCase());

    if (names.some(name => SKIP_LABELS.includes(name))) return null;

    for (const level of BUMP_LEVELS) {
        if (names.includes(`${LABEL_PREFIX}${level}`)) return level;
    }
    return "patch";
}

/* -------------------------------------------- */
/*  Manifest                                    */
/* -------------------------------------------- */

/**
 * Pull `owner/repo` out of a GitHub releases URL.
 *
 * @param {string} url
 * @returns {string|null}
 */
export function repoFromUrl(url) {
    const match = /^https:\/\/github\.com\/([^/]+\/[^/]+)\/releases\//.exec(String(url ?? ""));
    return match ? match[1] : null;
}

/**
 * The zip URL for one specific release. Foundry reads `download` out of the
 * manifest it just fetched, so it must point at that exact version -- not at
 * the rolling tag, which would hand the user a different build than the
 * manifest describes.
 *
 * @param {string} repo    "owner/name"
 * @param {string} version
 * @returns {string}
 */
export function downloadUrl(repo, version) {
    return `https://github.com/${repo}/releases/download/v${version}/glog2d6.zip`;
}

/**
 * Apply a version to the system manifest.
 *
 * `manifest` keeps pointing at the rolling `release` tag: that is the URL every
 * existing install polls for updates, and it must not move.
 *
 * @param {object} manifest  Parsed system.json
 * @param {string} version
 * @returns {object} A new manifest object
 */
export function applyVersionToManifest(manifest, version) {
    const repo = repoFromUrl(manifest.manifest) ?? repoFromUrl(manifest.download);
    if (!repo) throw new Error("Cannot determine owner/repo from system.json manifest or download URL");

    return { ...manifest, version, download: downloadUrl(repo, version) };
}

/**
 * Apply a version to an npm lockfile, which records it in two places.
 *
 * @param {object} lockfile  Parsed package-lock.json
 * @param {string} version
 * @returns {object} A new lockfile object
 */
export function applyVersionToLockfile(lockfile, version) {
    const root = lockfile.packages?.[""];
    return {
        ...lockfile,
        version,
        ...(root ? { packages: { ...lockfile.packages, "": { ...root, version } } } : {})
    };
}

/* -------------------------------------------- */
/*  CLI                                         */
/* -------------------------------------------- */

function readJson(relativePath) {
    return JSON.parse(readFileSync(resolve(ROOT, relativePath), "utf8"));
}

function writeJson(relativePath, value) {
    writeFileSync(resolve(ROOT, relativePath), `${JSON.stringify(value, null, 4)}\n`);
}

function currentVersion() {
    return readJson("system.json").version;
}

function bump({ level, dryRun }) {
    const version = nextVersion(currentVersion(), level);

    const manifest = applyVersionToManifest(readJson("system.json"), version);
    const pkg = { ...readJson("package.json"), version };
    // npm tolerates a stale lockfile version, but leaving it behind means every
    // `npm install` a contributor runs shows up as a spurious diff.
    const lock = applyVersionToLockfile(readJson("package-lock.json"), version);

    if (!dryRun) {
        writeJson("system.json", manifest);
        writeJson("package.json", pkg);
        writeJson("package-lock.json", lock);
    }

    return version;
}

function main(argv) {
    const [command = "version", ...rest] = argv;
    const flag = name => {
        const index = rest.indexOf(`--${name}`);
        return index === -1 ? undefined : rest[index + 1];
    };

    switch (command) {
        case "level": {
            // Emitted as GitHub Actions step outputs.
            const override = (process.env.INPUT_LEVEL ?? "").trim();
            let level;
            try {
                level = override || bumpLevelFromLabels(JSON.parse(process.env.PR_LABELS || "[]"));
            } catch {
                level = "patch";
            }
            console.log(`level=${level ?? ""}`);
            console.log(`release=${level ? "true" : "false"}`);
            return;
        }
        case "files":
            console.log(RELEASE_PATHS.join("\n"));
            return;
        case "version":
            console.log(currentVersion());
            return;
        case "bump":
            console.log(bump({
                level: flag("level") ?? "patch",
                dryRun: rest.includes("--dry-run")
            }));
            return;
        default:
            console.error(`Unknown command: ${command}`);
            process.exitCode = 1;
    }
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) {
    main(process.argv.slice(2));
}
