import { readFileSync, globSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = resolve(import.meta.dirname, "..");
const read = p => readFileSync(resolve(ROOT, p), "utf8");

const ENTRY = read("glog2d6.mjs");
const INIT = /Hooks\.once\('init'[\s\S]*?\n\}\);/.exec(ENTRY)[0];

/**
 * The GM could call for a recon check and nobody's button did anything, while
 * every other GM roll worked. The difference was where the wiring was
 * registered.
 *
 * Two rules, learned separately and both needed:
 *
 * 1. Chat wiring must be registered before init's first `await`. Foundry fires
 *    init with `Hooks.callAll`, which does not await its callbacks, so
 *    everything past an `await` runs a tick later and may not run at all.
 *
 * 2. Within each setup function, the registration must come before anything
 *    that reads `game.socket` or `game.user`. Those belong to a connected
 *    game, not to init; when one was missing the whole function threw and took
 *    the still-unregistered buttons with it.
 */
describe("chat wiring", () => {
    const setups = ["initGMRolls", "initReconSystem"];

    it.each(setups)("%s is called before init can yield", name => {
        const call = INIT.indexOf(`${name}()`);
        const firstAwait = INIT.indexOf("await ");

        expect(call, `${name} is never called from init`).toBeGreaterThan(-1);
        expect(firstAwait, "no await in init -- this guard has gone slack").toBeGreaterThan(-1);
        expect(call, `${name} sits behind an await`).toBeLessThan(firstAwait);
    });

    const sources = {
        initGMRolls: "module/systems/gm-roll-system.mjs",
        initReconSystem: "module/systems/recon-system.mjs"
    };

    /**
     * Only statements that run *during* setup matter. A `game.user` inside a
     * click handler is fine -- that runs at click time, in a connected game --
     * so this looks at the function's own top-level lines, which are the ones
     * indented exactly four spaces.
     */
    const topLevelLines = (file, name) => {
        const source = read(file);
        const body = source.slice(source.indexOf(`export function ${name}()`));
        return body.split("\n")
            .slice(1)
            .filter(line => /^ {4}\S/.test(line))
            // Comments talk about `game.user` precisely because it matters here.
            .map(line => line.replace(/\/\/.*$/, ""))
            .join("\n");
    };

    it.each(Object.entries(sources))("%s touches no live game state while setting up", (name, file) => {
        const lines = topLevelLines(file, name);

        for (const fragile of ["game.socket", "game.user"]) {
            expect(lines, `${name} reads ${fragile} synchronously during init`)
                .not.toContain(fragile);
        }
    });

    it.each(Object.entries(sources))("%s registers its chat wiring", (name, file) => {
        expect(topLevelLines(file, name)).toContain('Hooks.on("renderChatMessageHTML"');
    });

    /** Neither belongs to init; both are claimed once the game is connected. */
    it.each(Object.entries(sources))("%s claims the socket and the user on ready", (name, file) => {
        const source = read(file);
        if (!source.includes("game.socket.on")) return;
        expect(source).toMatch(/Hooks\.once\("ready"[\s\S]*game\.socket\.on/);
    });

    /**
     * It was bound in the entry point and again in initGMRolls, so a click ran
     * execute twice and the second raised "Invalid roll state" at the player.
     */
    it("binds each chat button exactly once", () => {
        const files = [
            "glog2d6.mjs",
            ...globSync("module/**/*.mjs", { cwd: ROOT })
        ];
        const bindings = {};

        for (const file of files) {
            const source = read(file);
            for (const [, selector] of source.matchAll(/\.find\('\.?\[?([\w-]+)[^']*'\)\s*\.click/g)) {
                (bindings[selector] ??= []).push(file);
            }
        }

        const doubled = Object.entries(bindings).filter(([, files]) => files.length > 1);
        expect(doubled, `bound more than once: ${JSON.stringify(doubled)}`).toEqual([]);
    });
});
