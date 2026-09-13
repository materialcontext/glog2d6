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
/**
 * Sheet registration has to happen in `init`, and synchronously.
 *
 * Two separate constraints, each learned the hard way:
 *
 * 1. It must be `init`, not `ready`. Modules discover a system's sheets by
 *    reading CONFIG.Actor.sheetClasses and registering a `render<SheetClass>`
 *    hook for each. Tokenizer does that on `ready`; registering on `ready` too
 *    makes it a race decided by package load order, and losing it means the
 *    module never hears our sheets render -- which is why clicking the
 *    character portrait did nothing.
 *
 * 2. It must come before the hook's first `await`. Foundry fires init with
 *    `Hooks.callAll`, which does NOT await its callbacks, so everything after
 *    an `await` in an async hook runs a tick later, once core has moved past
 *    init and settled the sheet registry. Registering from there is a race
 *    against however long the data files take to fetch -- a fresh world wins
 *    it, a world with real content and a dozen modules loses, and the loser
 *    gets an empty registry and core's fallback sheet on every actor, with no
 *    error anywhere.
 */
describe("sheet registration timing", () => {
    const initBody = /Hooks\.once\('init'[\s\S]*?\n\}\);/.exec(ENTRY)[0];
    const registrar = /\nfunction registerDocumentSheets\(\) \{[\s\S]*?\n\}/.exec(ENTRY)?.[0];

    it("finds both lifecycle hooks", () => {
        expect(INIT).toBeGreaterThan(-1);
        expect(READY).toBeGreaterThan(INIT);
    });

    it("registers every sheet from one place", () => {
        expect(registrar, "registerDocumentSheets is gone").toBeTruthy();

        const calls = [...ENTRY.matchAll(/\.registerSheet\(/g)].map(m => m.index);
        expect(calls.length).toBeGreaterThanOrEqual(3);
        for (const index of calls) {
            const offset = ENTRY.indexOf(registrar);
            expect(index, "a registerSheet call sits outside registerDocumentSheets")
                .toBeGreaterThan(offset);
            expect(index).toBeLessThan(offset + registrar.length);
        }
    });

    it("calls it from init, not from ready", () => {
        const call = ENTRY.indexOf("registerDocumentSheets();");
        expect(call).toBeGreaterThan(INIT);
        expect(call).toBeLessThan(READY);
    });

    /**
     * The regression that emptied the registry on every established world.
     */
    it("calls it before init can yield", () => {
        const call = initBody.indexOf("registerDocumentSheets();");
        const firstAwait = initBody.indexOf("await ");

        expect(call, "init never registers the sheets").toBeGreaterThan(-1);
        expect(firstAwait, "no await in init -- this guard has gone slack")
            .toBeGreaterThan(-1);
        expect(call, "sheet registration sits behind an await in init")
            .toBeLessThan(firstAwait);
    });

    it("never yields inside the registrar itself", () => {
        expect(registrar).not.toMatch(/\bawait\b/);
        expect(registrar).not.toMatch(/\basync\b/);
    });

    it("unregisters core's sheets from the same synchronous block", () => {
        const calls = [...registrar.matchAll(/unregisterCoreSheets\(foundry/g)];
        expect(calls).toHaveLength(2);
    });
});

describe("the portrait modules hook onto", () => {
    const actorTemplates = [
        "templates/actor/parts/band.hbs",
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
