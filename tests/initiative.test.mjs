import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import {
    INITIATIVE_DECIMALS,
    INITIATIVE_FORMULA,
    initiativeConfig,
    initiativeModifier
} from "../module/systems/initiative.mjs";

const ROOT = resolve(import.meta.dirname, "..");
const read = p => readFileSync(resolve(ROOT, p), "utf8");

/**
 * Foundry's CONFIG.Combat.initiative.formula defaults to null, and the
 * manifest declared no `initiative` field either, so the combat tracker had no
 * formula to roll with at all.
 */
describe("the initiative formula", () => {
    it("is 2d6 and a modifier, per the house rule", () => {
        expect(INITIATIVE_FORMULA).toMatch(/^2d6\s*\+/);
        expect(INITIATIVE_DECIMALS).toBe(0);
    });

    /**
     * A roll term that resolves to undefined fails the whole roll, so the
     * formula reads one derived number rather than reaching down a path that
     * only exists after derived data has run.
     */
    it("reads a single flat value, not a path into attributes", () => {
        expect(INITIATIVE_FORMULA).toContain("@initiative");
        expect(INITIATIVE_FORMULA).not.toContain("attributes");
        expect(INITIATIVE_FORMULA).not.toContain("effectiveMod");
    });

    it("hands Foundry the shape it wants", () => {
        expect(initiativeConfig()).toEqual({ formula: INITIATIVE_FORMULA, decimals: 0 });
    });
});

describe("the initiative modifier", () => {
    it("prefers the effective modifier, which wounds and encumbrance move", () => {
        expect(initiativeModifier({ attributes: { dex: { mod: 2, effectiveMod: -1 } } })).toBe(-1);
    });

    it("falls back to the plain modifier before derived data has run", () => {
        expect(initiativeModifier({ attributes: { dex: { mod: 2 } } })).toBe(2);
    });

    /** An effective modifier of zero is a value, not an absence. */
    it("treats a zero effective modifier as zero, not as missing", () => {
        expect(initiativeModifier({ attributes: { dex: { mod: 3, effectiveMod: 0 } } })).toBe(0);
    });

    it("gives anything without a DEX a modifier of zero", () => {
        expect(initiativeModifier({ attributes: {} })).toBe(0);
        expect(initiativeModifier({})).toBe(0);
        expect(initiativeModifier()).toBe(0);
    });

    /** Never NaN: a NaN term takes the whole roll down. */
    it("never yields something that would break the roll", () => {
        for (const mod of ["", "abc", null, undefined, NaN, Infinity, {}]) {
            const value = initiativeModifier({ attributes: { dex: { effectiveMod: mod } } });
            expect(Number.isFinite(value), `${String(mod)} produced ${value}`).toBe(true);
        }
    });
});

describe("the system wires it up", () => {
    it("configures the combat tracker during init", () => {
        const entry = read("glog2d6.mjs");
        const init = /Hooks\.once\('init'[\s\S]*?\n\}\);/.exec(entry)[0];
        expect(init).toContain("CONFIG.Combat.initiative = initiativeConfig()");
    });

    /**
     * If this sat inside prepareDerivedData's try block, any unrelated
     * derivation throwing would leave the actor unable to roll initiative.
     */
    it("derives the value outside the block that can throw", () => {
        const actor = read("module/actor/actor.mjs");
        const derived = /prepareDerivedData\(\)\s*\{[\s\S]*?\n    \}/.exec(actor)[0];
        const [beforeCatch, afterCatch] = derived.split("} catch (error) {");

        expect(beforeCatch, "the derivation is inside the try").not.toContain("initiativeModifier");
        expect(afterCatch, "the derivation never runs").toContain("this.system.initiative = initiativeModifier");
    });

    /** So it exists even for an actor whose derivation has never run. */
    it("declares the field on every actor type", () => {
        const template = JSON.parse(read("template.json"));
        expect(template.Actor.templates.base.initiative).toBe(0);
    });
});
