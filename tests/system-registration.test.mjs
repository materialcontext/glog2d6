import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = resolve(import.meta.dirname, "..");
const ENTRY = readFileSync(resolve(ROOT, "glog2d6.mjs"), "utf8");

const INIT = ENTRY.indexOf("Hooks.once('init'");
const READY = ENTRY.indexOf('Hooks.once("ready"');

/**
 * Sheet registration has to happen in `init`.
 *
 * Modules discover a system's sheets by reading CONFIG.Actor.sheetClasses and
 * registering a `render<SheetClassName>` hook for each one. Tokenizer does this
 * on `ready`; registering our sheets on `ready` too makes it a race decided by
 * package load order, and losing it means the module never hears our sheets
 * render -- which is why clicking the character portrait did nothing.
 */
describe("sheet registration timing", () => {
    it("finds both lifecycle hooks", () => {
        expect(INIT).toBeGreaterThan(-1);
        expect(READY).toBeGreaterThan(INIT);
    });

    it("registers every sheet during init, not ready", () => {
        const calls = [...ENTRY.matchAll(/\.registerSheet\(/g)].map(m => m.index);

        expect(calls.length).toBeGreaterThanOrEqual(3);
        for (const index of calls) {
            expect(index, "a registerSheet call sits after the ready hook").toBeLessThan(READY);
            expect(index, "a registerSheet call sits before the init hook").toBeGreaterThan(INIT);
        }
    });

    it("unregisters core's sheets during init too", () => {
        const calls = [...ENTRY.matchAll(/unregisterCoreSheets\(foundry/g)].map(m => m.index);

        expect(calls).toHaveLength(2);
        for (const index of calls) {
            expect(index).toBeGreaterThan(INIT);
            expect(index).toBeLessThan(READY);
        }
    });
});

describe("the portrait modules hook onto", () => {
    const actorTemplates = [
        "templates/actor/character-header.hbs",
        "templates/actor/actor-hireling-sheet.hbs"
    ];

    it.each(actorTemplates)("%s marks the portrait with data-edit=\"img\"", file => {
        // Tokenizer locates the avatar with [data-edit="img"] (getAvatarKey
        // defaults to "img" for every system but yzecoriolis).
        const source = readFileSync(resolve(ROOT, file), "utf8");
        const portrait = /<img[^>]*data-edit="img"[^>]*>/.exec(source);
        expect(portrait, `${file} has no [data-edit="img"] portrait`).not.toBeNull();
    });

    it("keeps the actor portrait clickable", () => {
        const css = readFileSync(resolve(ROOT, "glog2d6.css"), "utf8");
        const rule = /\.character-portrait\s*\{[^}]*\}/.exec(css)?.[0] ?? "";
        expect(rule).toContain("cursor: pointer");
        expect(rule).not.toMatch(/pointer-events:\s*none/);
    });
});
