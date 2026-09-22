import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import {
    INITIATIVE_ATTRIBUTES,
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
    const of = attributes => initiativeModifier({ attributes });

    /** Quickness or noticing first, whichever serves you. */
    it("takes the better of DEX and WIS", () => {
        expect(INITIATIVE_ATTRIBUTES).toEqual(["dex", "wis"]);
        expect(of({ dex: { mod: 1 }, wis: { mod: 3 } })).toBe(3);
        expect(of({ dex: { mod: 3 }, wis: { mod: 1 } })).toBe(3);
        expect(of({ dex: { mod: 2 }, wis: { mod: 2 } })).toBe(2);
    });

    it("takes the better even when both are negative", () => {
        expect(of({ dex: { mod: -3 }, wis: { mod: -1 } })).toBe(-1);
    });

    it("prefers each attribute's effective modifier, which wounds and encumbrance move", () => {
        expect(of({ dex: { mod: 3, effectiveMod: -1 }, wis: { mod: 0 } })).toBe(0);
        expect(of({ dex: { mod: 0 }, wis: { mod: 0, effectiveMod: 2 } })).toBe(2);
    });

    it("falls back to the plain modifier before derived data has run", () => {
        expect(of({ dex: { mod: 2 }, wis: { mod: 1 } })).toBe(2);
    });

    /** An effective modifier of zero is a value, not an absence. */
    it("treats a zero effective modifier as zero, not as missing", () => {
        expect(of({ dex: { mod: 3, effectiveMod: 0 }, wis: { mod: -2 } })).toBe(0);
    });

    /**
     * Counting an absent attribute as zero would quietly floor a clumsy,
     * oblivious character at +0 instead of letting their penalty stand.
     */
    it("ignores an attribute the actor does not have, rather than scoring it zero", () => {
        expect(of({ dex: { mod: -1 } })).toBe(-1);
        expect(of({ wis: { mod: -2 } })).toBe(-2);
    });

    it("gives something with neither attribute a modifier of zero", () => {
        expect(of({})).toBe(0);
        expect(initiativeModifier({})).toBe(0);
        expect(initiativeModifier()).toBe(0);
    });

    /** Never NaN: a NaN term takes the whole roll down. */
    it("never yields something that would break the roll", () => {
        for (const mod of ["", "abc", null, NaN, Infinity, {}]) {
            const value = of({ dex: { effectiveMod: mod }, wis: { effectiveMod: mod } });
            expect(Number.isFinite(value), `${String(mod)} produced ${value}`).toBe(true);
        }
    });
});

/** Two initiative rolls in one system must not disagree about the rule. */
describe("the GM roll agrees with the tracker", () => {
    it("uses the same modifier, not its own reading of DEX", () => {
        const requests = read("module/systems/roll-requests.mjs");
        const entry = /initiative: \{[\s\S]*?\n    \},\n/.exec(requests)[0];

        expect(entry).toMatch(/initiativeModifier\(actor\??\.system\)/);
        expect(entry).not.toContain("attributes.dex");
        expect(requests).toContain('from "./initiative.mjs"');
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
