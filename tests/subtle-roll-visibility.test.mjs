import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import { SUBTLE_HIDDEN_CLASS, hidesSubtleMessage } from "../module/dice/subtle-roll-visibility.mjs";

const ROOT = resolve(import.meta.dirname, "..");
const read = p => readFileSync(resolve(ROOT, p), "utf8");

const notice = { glog2d6: { subtleNotice: true } };
const result = { glog2d6: { subtleRoll: { revealed: false } } };
const revealed = { glog2d6: { subtleRoll: { revealed: true } } };

const player = { isGM: false };
const gm = { isGM: true };

/**
 * A subtle check posts two messages for two audiences. Everyone was being
 * shown both: the player got the notice and then an empty box they may not
 * read, and the GM got a notice restating the result beneath it.
 */
describe("which half of a subtle roll a viewer sees", () => {
    it("shows the player the notice and not the result", () => {
        expect(hidesSubtleMessage(notice, player)).toBe(false);
        expect(hidesSubtleMessage(result, player)).toBe(true);
    });

    it("shows the GM the result and not the notice", () => {
        expect(hidesSubtleMessage(result, gm)).toBe(false);
        expect(hidesSubtleMessage(notice, gm)).toBe(true);
    });

    /** One message each, rather than two for everybody. */
    it("leaves exactly one half standing for each viewer", () => {
        for (const viewer of [player, gm]) {
            const shown = [notice, result].filter(f => !hidesSubtleMessage(f, viewer));
            expect(shown).toHaveLength(1);
        }
    });

    /**
     * Revealing posts a fresh public message rather than unsealing this one,
     * so unhiding it afterwards would show the same roll twice.
     */
    it("keeps the blind result hidden even once it has been revealed", () => {
        expect(hidesSubtleMessage(revealed, player)).toBe(true);
    });

    it("never touches an ordinary message", () => {
        for (const viewer of [player, gm]) {
            expect(hidesSubtleMessage({}, viewer)).toBe(false);
            expect(hidesSubtleMessage({ glog2d6: {} }, viewer)).toBe(false);
            expect(hidesSubtleMessage({ other: { thing: true } }, viewer)).toBe(false);
            expect(hidesSubtleMessage(undefined, viewer)).toBe(false);
        }
    });

    /** A missing viewer must not silently hide a GM's result. */
    it("treats an unknown viewer as not a GM", () => {
        expect(hidesSubtleMessage(result)).toBe(true);
        expect(hidesSubtleMessage(notice)).toBe(false);
    });
});

describe("the system wires it up", () => {
    const entry = read("glog2d6.mjs");

    it("decides before it does anything else with the message", () => {
        const hook = /Hooks\.on\("renderChatMessageHTML"[\s\S]*?\n\}\);/.exec(entry)[0];
        expect(hook.indexOf("hidesSubtleMessage")).toBeLessThan(hook.indexOf("$(html)"));
    });

    it("tags the public notice so it can be told apart", () => {
        expect(read("module/actor/actor.mjs")).toContain("subtleNotice: true");
    });

    it("has a rule that can actually beat Foundry's own", () => {
        const css = read("glog2d6.css");
        const rule = new RegExp(`\\.${SUBTLE_HIDDEN_CLASS}\\s*\\{[^}]*\\}`).exec(css)?.[0] ?? "";
        expect(rule).toMatch(/display:\s*none\s*!important/);
    });
});
