import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { JSDOM } from "jsdom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
    applyDamage,
    fumbleBreakage,
    applyDamageButton,
    contestAgainst,
    contestLine,
    damageButton,
    opponentActor
} from "../module/systems/contest-flow.mjs";
import { CONTEST, OUTCOMES } from "../module/systems/contest.mjs";
import { RELAY, onlyTheGMCan } from "../module/systems/gm-relay.mjs";

const ROOT = resolve(import.meta.dirname, "..");
const read = p => readFileSync(resolve(ROOT, p), "utf8");

function makeActor(id, name, over = {}) {
    return {
        id,
        name,
        isOwner: true,
        hasPlayerOwner: false,
        system: {
            hp: { value: 10, max: 10 },
            attributes: { str: { mod: 2 } },
            defense: { meleeTotal: 4, rangedTotal: 2, total: 3, armor: 2, dexBonus: 1 },
            ...over.system
        },
        items: { get: () => null },
        async update(changes) { Object.assign(this.updates ??= {}, changes); },
        ...over
    };
}

function target(...actors) {
    game.user = { id: "u1", isGM: true, targets: new Set(actors.map(actor => ({ actor }))) };
}

let relayed;

beforeEach(() => {
    relayed = [];
    game.user = { id: "u1", isGM: true, targets: new Set() };
    game.actors = { get: () => null };

    // The real relay, with the GM's side of each message recorded.
    onlyTheGMCan(RELAY.CALL_TRAUMA, (data) => { relayed.push(["trauma", data]); });
    onlyTheGMCan(RELAY.APPLY_DAMAGE, (data) => { relayed.push(["damage", data]); });
});

afterEach(() => vi.restoreAllMocks());

describe("who the roll is against", () => {
    const mareth = makeActor("a", "Mareth");
    const wolf = makeActor("n1", "Dire Wolf");

    it("is whoever is targeted", () => {
        target(wolf);
        expect(opponentActor(mareth)).toBe(wolf);
    });

    /** Targeting your own token is targeting nobody. */
    it("is never yourself", () => {
        target(mareth);
        expect(opponentActor(mareth)).toBeNull();
    });

    it("is nobody when nobody is targeted", () => {
        target();
        expect(opponentActor(mareth)).toBeNull();
        game.user = {};
        expect(opponentActor(mareth)).toBeNull();
    });
});

/**
 * The same contest from either end. The attacker's own roll builder supplies
 * the attack side, so a defender is measured against exactly the attack that
 * actor would have rolled.
 */
describe("resolving a roll against a target", () => {
    const wolf = makeActor("n1", "Dire Wolf", {
        system: { defense: { meleeTotal: 3, rangedTotal: 1 }, attributes: { str: { mod: 1 } } }
    });
    const mareth = makeActor("a", "Mareth");
    const roll = (total, over = {}) => ({ total, isCriticalHit: false, isCriticalFailure: false, ...over });

    it("stands the defender on six plus their defense", () => {
        target(wolf);
        const contest = contestAgainst({ mode: CONTEST.ATTACK, actor: mareth, roll: roll(10), weaponType: "melee", strMod: 2 });

        expect(contest.target).toBe(9);
        expect(contest.outcome).toBe(OUTCOMES.HIT);
        expect(contest.baseDamage).toBe(3);
        expect(contest.defender).toBe(wolf);
    });

    it("reads the defense the weapon is coming at", () => {
        target(wolf);
        expect(contestAgainst({ mode: CONTEST.ATTACK, actor: mareth, roll: roll(8), weaponType: "ranged" }).target).toBe(7);
    });

    it("stands the attacker on six plus what they would have added", () => {
        target(wolf);
        const contest = contestAgainst({
            mode: CONTEST.DEFENSE, actor: mareth, roll: roll(5),
            weaponType: "melee", strMod: 1, attackData: { atk: 2, bonus: 1, penalty: 1 }
        });

        expect(contest.target).toBe(8);
        expect(contest.outcome).toBe(OUTCOMES.HIT);
        expect(contest.baseDamage).toBe(4);
        expect(contest.attacker).toBe(wolf);
    });

    /**
     * Reading a missing attack as zero would present as a real contest
     * against a target of six, which is worse than not contesting at all.
     */
    it("leaves a defence alone when the attacker's attack cannot be read", () => {
        target(wolf);
        expect(contestAgainst({ mode: CONTEST.DEFENSE, actor: mareth, roll: roll(5), attackData: null })).toBeNull();
    });

    it("leaves an untargeted roll alone, as it has always been", () => {
        target();
        expect(contestAgainst({ mode: CONTEST.ATTACK, actor: mareth, roll: roll(11) })).toBeNull();
    });
});

describe("what the card says", () => {
    const wolf = makeActor("n1", "Dire Wolf");
    const contest = { outcome: OUTCOMES.HIT, label: "Hit", hit: true, crit: false, target: 9, baseDamage: 3, mode: CONTEST.ATTACK, defender: wolf, attacker: makeActor("a", "Mareth") };

    it("names the outcome and what it was against", () => {
        const text = new JSDOM(contestLine(contest)).window.document.body.textContent;
        expect(text).toContain("Dire Wolf (9)");
        expect(text).toContain("HIT");
        expect(text).toContain("Base damage: 3");
    });

    it("says nothing at all without a contest", () => {
        expect(contestLine(null)).toBe("");
    });

    it("carries the margin into the damage button", () => {
        const doc = new JSDOM(damageButton(contest, { actorId: "a", weaponId: "w1" })).window.document;
        expect(doc.querySelector(".damage-roll-btn").dataset).toMatchObject({
            actorId: "a", weaponId: "w1", baseDamage: "3", targetId: "n1"
        });
    });

    it("offers no damage for a miss", () => {
        expect(damageButton({ ...contest, hit: false }, { actorId: "a", weaponId: "w1" })).toBe("");
    });

    /** A bare-handed blow has nothing to roll: the margin is all of it. */
    it("offers the margin straight to be spent when there is no weapon", () => {
        const button = new JSDOM(damageButton(contest, { actorId: "a" })).window.document
            .querySelector(".apply-damage-btn");

        expect(button.dataset).toMatchObject({ targetId: "n1", damage: "3", attackerId: "a" });
    });

    it("offers the damage to be applied, with the blow attached", () => {
        const markup = applyDamageButton({ targetId: "n1", amount: 7, dieTotal: 4, crit: false, attackerId: "a", weaponId: "w1" });
        const button = new JSDOM(markup).window.document.querySelector(".apply-damage-btn");

        expect(button.dataset).toMatchObject({ targetId: "n1", damage: "7", dieTotal: "4", attackerId: "a", weaponId: "w1" });
        expect(button.textContent).toContain("Apply Damage (7)");
    });
});

/**
 * "HIT" on a defence card reads as though the defender hit something, when
 * what happened is that they were hit.
 */
describe("what a defence card says", () => {
    const defending = { outcome: OUTCOMES.HIT, label: "Hit", hit: true, crit: false, target: 11, baseDamage: 2, mode: CONTEST.DEFENSE, attacker: makeActor("n1", "Dire Wolf"), defender: makeActor("a", "Mareth") };
    const text = contest => new JSDOM(contestLine(contest)).window.document.body.textContent;

    it("puts the attacker where the subject belongs", () => {
        expect(text(defending)).toContain("THEY HIT");
        expect(text({ ...defending, outcome: OUTCOMES.MISS, hit: false })).toContain("THEY MISS");
    });

    it("says plainly when the blow was a critical one", () => {
        expect(text({ ...defending, outcome: OUTCOMES.CRITICAL, crit: true }))
            .toContain("CRITICAL HIT AGAINST YOU");
    });

    it("still reads from the attacker's end on an attack card", () => {
        expect(text({ ...defending, mode: CONTEST.ATTACK })).toContain("HIT");
        expect(text({ ...defending, mode: CONTEST.ATTACK })).not.toContain("THEY");
    });
});

/** A fumbled attack costs the weapon a step on the breakage track. */
describe("fumbling", () => {
    const armed = makeActor("a", "Mareth", { items: [{ type: "weapon", system: { equipped: true } }] });
    const barehanded = makeActor("b", "Cedric", { items: [{ type: "weapon", system: { equipped: false } }] });

    beforeEach(() => { onlyTheGMCan(RELAY.BREAK_WEAPON, (data) => relayed.push(["break", data])); });

    it("breaks the attacker's weapon a little", async () => {
        await fumbleBreakage({ fumble: true, attacker: armed });
        expect(relayed).toEqual([["break", { actorId: "a" }]]);
    });

    /**
     * The weapon belongs to the attacker, who may be a monster the client
     * that rolled has no business editing.
     */
    it("asks the GM rather than writing it here", () => {
        expect(read("module/systems/contest-flow.mjs")).toContain("askTheGM(RELAY.BREAK_WEAPON");
        expect(read("module/dice/actor-rolls.mjs")).toContain("await fumbleBreakage(contest)");
    });

    it("breaks nothing on a hit, or for empty hands", async () => {
        await fumbleBreakage({ fumble: false, attacker: armed });
        await fumbleBreakage({ fumble: true, attacker: barehanded });
        await fumbleBreakage(null);
        expect(relayed).toEqual([]);
    });
});

describe("spending the damage", () => {
    it("takes it off the target", async () => {
        const wolf = makeActor("n1", "Dire Wolf");
        game.actors = { get: () => wolf };

        const result = await applyDamage({ targetId: "n1", amount: 4 });

        expect(wolf.updates).toEqual({ "system.hp.value": 6 });
        expect(result.dropped).toBe(false);
        expect(relayed).toEqual([]);
    });

    it("asks for a trauma save when it takes a character down", async () => {
        const mareth = makeActor("a", "Mareth", { hasPlayerOwner: true, system: { hp: { value: 3 } } });
        game.actors = { get: () => mareth };

        await applyDamage({ targetId: "a", amount: 8, attackerId: "n1", weaponId: "w1" });

        expect(mareth.updates).toEqual({ "system.hp.value": 0 });
        expect(relayed).toEqual([["trauma", {
            actorIds: ["a"],
            params: { damage: 5, attacker: "n1", weapon: "w1" }
        }]]);
    });

    /** The GM's own creatures keep no ledger, so they are simply down. */
    it("asks for nothing when the GM's monster drops", async () => {
        const wolf = makeActor("n1", "Dire Wolf", { system: { hp: { value: 3 } } });
        game.actors = { get: () => wolf };

        await applyDamage({ targetId: "n1", amount: 8 });

        expect(wolf.updates).toEqual({ "system.hp.value": 0 });
        expect(relayed).toEqual([]);
    });

    /**
     * A critical hit does not subtract: it puts them on the floor, and twice
     * the weapon die is what the wound is rolled on.
     */
    it("puts a critical hit's target on the floor at double the die", async () => {
        const mareth = makeActor("a", "Mareth", { hasPlayerOwner: true, system: { hp: { value: 40 } } });
        game.actors = { get: () => mareth };

        await applyDamage({ targetId: "a", amount: 6, dieTotal: 5, crit: true, attackerId: "n1" });

        expect(mareth.updates).toEqual({ "system.hp.value": 0 });
        expect(relayed[0][1].params.damage).toBe(10);
    });

    it("hands hit points it cannot write to the GM", async () => {
        const wolf = makeActor("n1", "Dire Wolf", { isOwner: false });
        game.actors = { get: () => wolf };

        await applyDamage({ targetId: "n1", amount: 4 });

        expect(wolf.updates).toBeUndefined();
        expect(relayed).toEqual([["damage", {
            targetId: "n1", amount: 4, dieTotal: 0, crit: false, attackerId: "", weaponId: ""
        }]]);
    });

    it("does nothing about a target that is not there", async () => {
        game.actors = { get: () => null };
        expect(await applyDamage({ targetId: "gone", amount: 4 })).toBeNull();
    });
});

describe("the system wires it up", () => {
    const rolls = read("module/dice/actor-rolls.mjs");

    it("contests an attack and a defense through the same resolver", () => {
        expect(rolls).toContain("mode: CONTEST.ATTACK");
        expect(rolls).toContain("mode: CONTEST.DEFENSE");
    });

    /** The margin used to be the literal string "{{roll.total}}". */
    it("stopped interpolating a template tag into a plain string", () => {
        expect(rolls).not.toContain("{{roll.total}}");
        expect(read("glog2d6.mjs")).not.toContain("dataset.attackResult");
        expect(read("glog2d6.mjs")).toContain("parseInt(button.dataset.baseDamage)");
    });

    it("measures a defender against the attack that actor would have rolled", () => {
        expect(rolls).toContain("attacker.rolls._buildAttackData()");
        expect(rolls).toContain("attackData: attacker?.data ?? null");
    });

    /** Passing the type where the weapon goes read `"melee".system`. */
    it("asks for an unarmed attack by type, not as a weapon", () => {
        expect(read("module/actor/handlers/sheet-roll-handler.mjs"))
            .not.toMatch(/rollAttack\(attackType\)/);
    });
});
