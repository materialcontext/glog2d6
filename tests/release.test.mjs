import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import {
    RELEASE_PATHS,
    VERSION_FILES,
    applyVersionToManifest,
    bumpLevelFromLabels,
    downloadUrl,
    nextVersion,
    parseVersion,
    repoFromUrl
} from "../tools/release.mjs";

const ROOT = resolve(import.meta.dirname, "..");
const readJson = name => JSON.parse(readFileSync(resolve(ROOT, name), "utf8"));

describe("version arithmetic", () => {
    it("parses semver", () => {
        expect(parseVersion("1.0.330")).toEqual([1, 0, 330]);
        expect(parseVersion(" 2.13.4 ")).toEqual([2, 13, 4]);
    });

    it("rejects anything that is not semver", () => {
        for (const bad of ["1.0", "v1.0.0", "1.0.0-beta", "", null, undefined]) {
            expect(() => parseVersion(bad), String(bad)).toThrow();
        }
    });

    it("bumps patch by default", () => {
        expect(nextVersion("1.0.330")).toBe("1.0.331");
        expect(nextVersion("1.0.330", "patch")).toBe("1.0.331");
    });

    it("resets lower components on minor and major", () => {
        expect(nextVersion("1.0.330", "minor")).toBe("1.1.0");
        expect(nextVersion("1.4.330", "major")).toBe("2.0.0");
    });

    it("rejects an unknown level", () => {
        expect(() => nextVersion("1.0.0", "huge")).toThrow(/Unknown bump level/);
    });
});

describe("bump level from PR labels", () => {
    it("defaults to patch, this project's normal cadence", () => {
        expect(bumpLevelFromLabels([])).toBe("patch");
        expect(bumpLevelFromLabels([{ name: "bug" }, { name: "ui" }])).toBe("patch");
    });

    it("reads an explicit level", () => {
        expect(bumpLevelFromLabels([{ name: "release:minor" }])).toBe("minor");
        expect(bumpLevelFromLabels([{ name: "release:major" }])).toBe("major");
        expect(bumpLevelFromLabels([{ name: "release:patch" }])).toBe("patch");
    });

    it("takes the largest level when several are set", () => {
        expect(bumpLevelFromLabels([{ name: "release:patch" }, { name: "release:major" }])).toBe("major");
        expect(bumpLevelFromLabels([{ name: "release:patch" }, { name: "release:minor" }])).toBe("minor");
    });

    it("suppresses the release entirely", () => {
        expect(bumpLevelFromLabels([{ name: "skip-release" }])).toBeNull();
        expect(bumpLevelFromLabels([{ name: "no-release" }])).toBeNull();
        // A skip beats an explicit level.
        expect(bumpLevelFromLabels([{ name: "release:major" }, { name: "skip-release" }])).toBeNull();
    });

    it("accepts bare strings and ignores case and padding", () => {
        expect(bumpLevelFromLabels(["Release:Minor"])).toBe("minor");
        expect(bumpLevelFromLabels([" skip-release "])).toBeNull();
    });

    it("survives malformed label data", () => {
        expect(bumpLevelFromLabels([null, undefined, {}, { name: "" }])).toBe("patch");
        expect(bumpLevelFromLabels(undefined)).toBe("patch");
    });
});

describe("manifest URLs", () => {
    it("recovers owner/repo from a releases URL", () => {
        expect(repoFromUrl("https://github.com/materialcontext/glog2d6/releases/download/release/system.json"))
            .toBe("materialcontext/glog2d6");
        expect(repoFromUrl("https://example.com/whatever")).toBeNull();
        expect(repoFromUrl(undefined)).toBeNull();
    });

    it("pins the download to one version's tag", () => {
        expect(downloadUrl("materialcontext/glog2d6", "1.2.3"))
            .toBe("https://github.com/materialcontext/glog2d6/releases/download/v1.2.3/glog2d6.zip");
    });

    it("moves version and download but leaves the manifest URL alone", () => {
        const before = readJson("system.json");
        const after = applyVersionToManifest(before, "9.9.9");

        expect(after.version).toBe("9.9.9");
        expect(after.download).toBe(downloadUrl("materialcontext/glog2d6", "9.9.9"));
        // Every existing install polls this URL; moving it orphans them.
        expect(after.manifest).toBe(before.manifest);
    });

    it("leaves everything else in the manifest untouched", () => {
        const before = readJson("system.json");
        const after = applyVersionToManifest(before, "9.9.9");

        for (const key of Object.keys(before)) {
            if (["version", "download"].includes(key)) continue;
            expect(after[key], key).toEqual(before[key]);
        }
    });

    it("does not mutate the manifest it was given", () => {
        const before = readJson("system.json");
        applyVersionToManifest(before, "9.9.9");
        expect(before.version).not.toBe("9.9.9");
    });

    it("fails loudly when the repo cannot be determined", () => {
        expect(() => applyVersionToManifest({ manifest: "", download: "" }, "1.0.0"))
            .toThrow(/owner\/repo/);
    });
});

describe("the shipped file list", () => {
    it("names only paths that exist", () => {
        for (const path of RELEASE_PATHS) {
            expect(existsSync(resolve(ROOT, path)), `${path} is listed for release but missing`).toBe(true);
        }
    });

    it("covers every directory the entry point imports from", () => {
        const entry = readFileSync(resolve(ROOT, "glog2d6.mjs"), "utf8");
        const roots = new Set([...entry.matchAll(/from\s+["']\.\/([^/"']+)\//g)].map(m => m[1]));
        expect(roots.size).toBeGreaterThan(0);
        for (const dir of roots) {
            expect(RELEASE_PATHS, `glog2d6.mjs imports from ${dir}/`).toContain(dir);
        }
    });

    it("ships the manifest and the data template", () => {
        expect(RELEASE_PATHS).toContain("system.json");
        expect(RELEASE_PATHS).toContain("template.json");
    });

    it("ships no test or tooling files", () => {
        for (const path of ["tests", "tools", "node_modules", "package.json", "vitest.config.js", ".github"]) {
            expect(RELEASE_PATHS, path).not.toContain(path);
        }
    });
});

describe("version files", () => {
    it("agree with each other today", () => {
        const version = readJson("system.json").version;
        expect(readJson("package.json").version).toBe(version);
    });

    it("leaves the content migration version out of the bump", () => {
        // CONTENT_VERSION gates world data migrations; bumping it every release
        // would re-run every migration against every world.
        expect(VERSION_FILES).not.toContain("scripts/initialize-content.mjs");
        const content = readFileSync(resolve(ROOT, "scripts/initialize-content.mjs"), "utf8");
        expect(content).toMatch(/CONTENT_VERSION\s*=/);
    });
});

describe("the CLI the workflow calls", () => {
    const run = args => execFileSync("node", [resolve(ROOT, "tools/release.mjs"), ...args], {
        cwd: ROOT, encoding: "utf8"
    }).trim();

    it("reports the current version", () => {
        expect(run(["version"])).toBe(readJson("system.json").version);
    });

    it("lists the shipped paths one per line", () => {
        expect(run(["files"]).split("\n")).toEqual([...RELEASE_PATHS]);
    });

    it("computes the next version without touching the tree on a dry run", () => {
        const before = readFileSync(resolve(ROOT, "system.json"), "utf8");
        expect(run(["bump", "--level", "minor", "--dry-run"]))
            .toBe(nextVersion(readJson("system.json").version, "minor"));
        expect(readFileSync(resolve(ROOT, "system.json"), "utf8")).toBe(before);
    });

    it("exits non-zero on an unknown command", () => {
        expect(() => run(["nonsense"])).toThrow();
    });
});

describe("the release workflow", () => {
    const workflow = readFileSync(resolve(ROOT, ".github/workflows/release.yml"), "utf8");

    it("fires on a merged pull request", () => {
        expect(workflow).toMatch(/pull_request:/);
        expect(workflow).toMatch(/types:\s*\[closed\]/);
        expect(workflow).toMatch(/github\.event\.pull_request\.merged == true/);
    });

    it("needs permission to push the bump and cut the release", () => {
        expect(workflow).toMatch(/contents:\s*write/);
    });

    it("runs the test suite before releasing", () => {
        expect(workflow).toMatch(/npm run test:run/);
        expect(workflow.indexOf("npm run test:run")).toBeLessThan(workflow.indexOf("gh release create"));
    });

    it("builds the zip from the release module's file list", () => {
        expect(workflow).toMatch(/tools\/release\.mjs files/);
    });

    it("keeps the rolling release tag updated for existing installs", () => {
        expect(workflow).toMatch(/rolling|release tag/i);
        expect(workflow).toContain("--clobber");
    });
});
