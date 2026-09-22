import { describe, expect, it } from "vitest";

import {
    CONTEST,
    OUTCOMES,
    STATIC_BASE,
    addsStrength,
    attackModifier,
    criticalExcess,
    defenseModifier,
    callsForTraumaSave,
    excessDamage,
    isRangedType,
    resolveContest,
    staticTarget,
    takesWounds
} from "../module/systems/contest.mjs";

const attack = over => resolveContest({ mode: CONTEST.ATTACK, ...over });
const defend = over => resolveContest({ mode: CONTEST.DEFENSE, ...over });

describe("the number a still actor presents", () => {
    it("is six plus what they would have added", () => {
        expect(staticTarget(3)).toBe(STATIC_BASE + 3);
        expect(staticTarget(0)).toBe(6);
        expect(staticTarget(-2)).toBe(4);
    });

    it("is six when there is nothing to read", () => {
        expect(staticTarget(undefined)).toBe(6);
        expect(staticTarget("nonsense")).toBe(6);
    });
});

/**
 * The same arithmetic the dice do: every term of the attack formula, with the
 * penalty the one that subtracts.
 */
describe("what an attack adds", () => {
    it("sums the bonuses and subtracts the penalty", () => {
        expect(attackModifier({ atk: 3, bonus: 1, dual: 1, archery: 0, penalty: 2 })).toBe(3);
    });

    it("is nothing at all for an actor with nothing", () => {
        expect(attackModifier({})).toBe(0);
        expect(attackModifier()).toBe(0);
    });
});

describe("what a defense adds", () => {
    const system = { defense: { meleeTotal: 4, rangedTotal: 2, total: 3 } };

    it("depends on what is coming at it", () => {
        expect(defenseModifier(system, "melee")).toBe(4);
        expect(defenseModifier(system, "ranged")).toBe(2);
        expect(defenseModifier(system, "firearm")).toBe(2);
    });

    /** Thrown weapons are thrown from over there. */
    it("counts a thrown weapon as ranged", () => {
        expect(isRangedType("thrown")).toBe(true);
        expect(defenseModifier(system, "thrown")).toBe(2);
    });

    it("falls back to the plain total, then to nothing", () => {
        expect(defenseModifier({ defense: { total: 3 } }, "melee")).toBe(3);
        expect(defenseModifier({}, "melee")).toBe(0);
        expect(defenseModifier(undefined)).toBe(0);
    });
});

/**
 * Either side can roll it, and the outcome must not depend on which did.
 * A defender on 4 against an attacker who adds 3 is hit either way: the
 * attacker needs 4+ to beat 6+0... so both ends are checked against the same
 * pair of numbers below.
 */
describe("a contest rolled from either end", () => {
    it("agrees with itself, whoever picked up the dice", () => {
        // Attacker adds 3 and rolls 9; defender adds 2 and rolls 5.
        // Attacking: 9 vs 6+2=8 -> hit by 1. Defending: 5 vs 6+3=9 -> hit by 4.
        expect(attack({ rollTotal: 9, opponentModifier: 2 }).hit).toBe(true);
        expect(defend({ rollTotal: 5, opponentModifier: 3 }).hit).toBe(true);

        // A defender who rolls well enough escapes.
        expect(defend({ rollTotal: 10, opponentModifier: 3 }).hit).toBe(false);
        expect(attack({ rollTotal: 7, opponentModifier: 4 }).hit).toBe(false);
    });

    it("lands on a tie, because the attacker met the number", () => {
        expect(attack({ rollTotal: 8, opponentModifier: 2 }).outcome).toBe(OUTCOMES.HIT);
        expect(defend({ rollTotal: 9, opponentModifier: 3 }).outcome).toBe(OUTCOMES.HIT);
    });

    it("carries the margin into the damage", () => {
        expect(attack({ rollTotal: 12, opponentModifier: 2 }).baseDamage).toBe(4);
        expect(defend({ rollTotal: 4, opponentModifier: 3 }).baseDamage).toBe(5);
    });

    it("adds the attacker's strength in the hand but not at a distance", () => {
        expect(attack({ rollTotal: 10, opponentModifier: 2, strMod: 2 }).baseDamage).toBe(4);
        expect(attack({ rollTotal: 10, opponentModifier: 2, strMod: 2, weaponType: "ranged" }).baseDamage).toBe(2);
        expect(addsStrength("thrown")).toBe(true);
    });

    it("gives a miss no damage at all", () => {
        expect(attack({ rollTotal: 3, opponentModifier: 4, strMod: 3 }).baseDamage).toBe(0);
    });
});

/**
 * Doubles speak before the total does, and from whichever end rolled them.
 */
describe("doubles", () => {
    it("are a critical hit for the attacker, however badly they rolled", () => {
        const result = attack({ rollTotal: 2, opponentModifier: 9, doubleSixes: true });
        expect(result.outcome).toBe(OUTCOMES.CRITICAL);
        expect(result.hit).toBe(true);
    });

    it("are a fumble for the attacker, however well they rolled", () => {
        const result = attack({ rollTotal: 20, opponentModifier: 0, snakeEyes: true });
        expect(result.outcome).toBe(OUTCOMES.FUMBLE);
        expect(result.hit).toBe(false);
        expect(result.baseDamage).toBe(0);
    });

    /** Read from the other end, the meaning of each flips. */
    it("are a clean escape for the defender on sixes", () => {
        const result = defend({ rollTotal: 2, opponentModifier: 9, doubleSixes: true });
        expect(result.outcome).toBe(OUTCOMES.FUMBLE);
        expect(result.hit).toBe(false);
    });

    it("are a critical hit against the defender on snake eyes", () => {
        const result = defend({ rollTotal: 12, opponentModifier: 0, snakeEyes: true });
        expect(result.outcome).toBe(OUTCOMES.CRITICAL);
        expect(result.hit).toBe(true);
    });

    /** A forced hit from behind cannot produce negative damage. */
    it("never turns a forced hit into damage owed back", () => {
        expect(defend({ rollTotal: 12, opponentModifier: 0, snakeEyes: true, strMod: 1 }).baseDamage).toBe(1);
    });
});

describe("a critical hit", () => {
    it("carries twice the die into the wound", () => {
        expect(criticalExcess(4)).toBe(8);
        expect(criticalExcess(0)).toBe(1);
        expect(criticalExcess(2.5)).toBe(5);
    });
});

describe("damage past what was left", () => {
    it("is what a wound is rolled on", () => {
        expect(excessDamage(9, 4)).toBe(5);
        expect(excessDamage(4, 4)).toBe(0);
        expect(excessDamage(2, 4)).toBe(0);
    });

    /**
     * Damage that brings you exactly to zero leaves you at zero and no worse.
     * What wounds you is damage with nowhere left to go.
     */
    it("calls for a trauma save only when there is damage past the end", () => {
        expect(callsForTraumaSave(5, 4)).toBe(true);
        expect(callsForTraumaSave(4, 4)).toBe(false);
        expect(callsForTraumaSave(3, 4)).toBe(false);
    });

    /** Already at zero is the same question with nothing remaining. */
    it("calls for one on any damage at all once they are at zero", () => {
        expect(callsForTraumaSave(1, 0)).toBe(true);
        expect(callsForTraumaSave(0, 0)).toBe(false);
    });
});

/** The GM's own creatures have no ledger to keep a wound in. */
describe("who takes wounds", () => {
    it("is anyone a player owns", () => {
        expect(takesWounds({ hasPlayerOwner: true })).toBe(true);
    });

    it("is not the GM's monsters", () => {
        expect(takesWounds({ hasPlayerOwner: false })).toBe(false);
        expect(takesWounds(null)).toBe(false);
    });
});
