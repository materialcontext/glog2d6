import { readFileSync, globSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import {
    ROLL_TYPES,
    SKILL_ATTRS,
    TRAUMA_DC,
    isComplete,
    mayRollFor,
    requestDamage,
    rollSpec,
    rollType,
    rollTypeOptions,
    succeeded,
    traumaBonus,
    usesField
} from "../module/systems/roll-requests.mjs";
import { initiativeModifier } from "../module/systems/initiative.mjs";

const ROOT = resolve(import.meta.dirname, "..");
const read = p => readFileSync(resolve(ROOT, p), "utf8");

const actor = (over = {}) => ({
    id: "a1",
    name: "Mareth",
    system: {
        attributes: { str: { effectiveMod: 1 }, dex: { effectiveMod: 2 }, con: { effectiveMod: 3 }, wis: { effectiveMod: 0 } },
        saves: { con: { bonus: 1 } },
        skills: { sneak: { bonus: 2 } },
        ...over.system
    },
    items: over.items ?? []
});

const feature = (name, active = true) => ({ type: "feature", name, system: { active } });

/**
 * Recon used to be a boolean (`isRecon`) that forked the request lifecycle
 * into a second system. A type now names what rolls it, so the fork is a
 * lookup and a new kind of request is a new entry.
 */
describe("the catalogue", () => {
    it("gives every type a name and a list of what it asks for", () => {
        for (const [key, config] of Object.entries(ROLL_TYPES)) {
            expect(config.name, `${key} has no name`).toBeTruthy();
            expect(Array.isArray(config.fields), `${key} does not say what it asks for`).toBe(true);
        }
    });

    it("lets a type name its own roller instead of a formula", () => {
        expect(ROLL_TYPES.recon.rolls).toBe("recon");
        expect(ROLL_TYPES.recon.formula).toBeUndefined();
        expect(ROLL_TYPES.attribute.formula).toBe("2d6 + @mod");
    });

    it("offers the types in the order they are declared", () => {
        expect(rollTypeOptions().map(t => t.key)).toEqual(Object.keys(ROLL_TYPES));
    });

    it("knows nothing about a type that does not exist", () => {
        expect(rollType("nonsense")).toBeNull();
        expect(rollSpec("nonsense", actor())).toBeNull();
        expect(usesField("nonsense", "attribute")).toBe(false);
    });

    it("says which inputs a type wants", () => {
        expect(usesField("skill", "skill")).toBe(true);
        expect(usesField("skill", "attribute")).toBe(false);
        expect(usesField("trauma", "damage")).toBe(true);
        expect(usesField("recon", "location")).toBe(true);
    });
});

describe("what a request rolls", () => {
    it("checks an attribute with its modifier", () => {
        expect(rollSpec("attribute", actor(), { attribute: "dex" }))
            .toEqual({ formula: "2d6 + @mod", data: { mod: 2 } });
    });

    it("adds a save bonus on top of the attribute", () => {
        expect(rollSpec("save", actor(), { attribute: "con" }).data).toEqual({ mod: 3, save: 1 });
    });

    /** A skill rolls off the attribute the skill belongs to, not the named one. */
    it("rolls a skill off its own attribute", () => {
        expect(rollSpec("skill", actor(), { skill: "sneak" }).data).toEqual({ mod: 2, skill: 2 });
        expect(SKILL_ATTRS.sneak).toBe("dex");
    });

    it("falls back to charisma for a skill nobody has mapped", () => {
        expect(rollSpec("skill", actor(), { skill: "haggling" }).data.mod).toBe(0);
    });

    /** Shared with the combat tracker, so the two cannot drift apart. */
    it("rolls initiative the way the tracker does", () => {
        const one = actor();
        expect(rollSpec("initiative", one).data)
            .toEqual({ initiative: initiativeModifier(one.system) });
    });

    it("rolls a trauma save off constitution", () => {
        expect(rollSpec("trauma", actor()).data).toEqual({ con: 3, trauma: 0 });
    });

    it("has no formula for a type that rolls itself", () => {
        expect(rollSpec("recon", actor())).toBeNull();
    });

    it("reads a missing attribute as no modifier rather than failing", () => {
        expect(rollSpec("attribute", actor(), { attribute: "int" }).data).toEqual({ mod: 0 });
        expect(rollSpec("attribute", {}, { attribute: "dex" }).data).toEqual({ mod: 0 });
    });
});

describe("the trauma bonus", () => {
    it("is given by Tough", () => {
        expect(traumaBonus(actor({ items: [feature("Tough")] }))).toBe(1);
    });

    it("is given by anything a GM wrote that says trauma", () => {
        expect(traumaBonus(actor({ items: [feature("Trauma Hardened")] }))).toBe(1);
    });

    it("is not given by a feature that is switched off", () => {
        expect(traumaBonus(actor({ items: [feature("Tough", false)] }))).toBe(0);
        expect(traumaBonus(actor())).toBe(0);
    });
});

describe("whether a roll was enough", () => {
    /** A trauma save is always against 10; the GM does not get to nudge it. */
    it("holds a trauma save to its own target", () => {
        expect(succeeded("trauma", TRAUMA_DC)).toBe(true);
        expect(succeeded("trauma", TRAUMA_DC - 1)).toBe(false);
        expect(succeeded("trauma", 9, { target: 2 })).toBe(false);
    });

    it("uses the target the GM named for anything else", () => {
        expect(succeeded("attribute", 9, { target: 8 })).toBe(true);
        expect(succeeded("attribute", 7, { target: 8 })).toBe(false);
    });

    /** No target means the roll is reported, not judged. */
    it("says nothing when nobody named a target", () => {
        expect(succeeded("attribute", 12)).toBeUndefined();
        expect(succeeded("recon", 12)).toBeUndefined();
    });
});

describe("the damage a save is made against", () => {
    it("is what the GM typed", () => {
        expect(requestDamage({ damage: 7 })).toBe(7);
        expect(requestDamage({ damage: "7" })).toBe(7);
    });

    it("is never below one, whatever arrives", () => {
        expect(requestDamage({ damage: 0 })).toBe(1);
        expect(requestDamage({ damage: -3 })).toBe(1);
        expect(requestDamage({ damage: "lots" })).toBe(1);
        expect(requestDamage({})).toBe(1);
        expect(requestDamage()).toBe(1);
    });
});

describe("when a request is finished", () => {
    it("is once everyone asked has rolled", () => {
        expect(isComplete({ actorIds: ["a", "b"], results: new Map([["a", {}]]) })).toBe(false);
        expect(isComplete({ actorIds: ["a", "b"], results: new Map([["a", {}], ["b", {}]]) })).toBe(true);
    });
});

/**
 * Requests are executed on the GM's client, because that is where the request
 * lives. Asking `isOwner` there would ask about the GM, who owns everything.
 */
describe("who may answer a request", () => {
    const owner = { id: "u2", isGM: false };
    const other = { id: "u3", isGM: false };
    const gm = { id: "u1", isGM: true };
    const owned = { testUserPermission: (user, level) => user.id === "u2" && level === "OWNER" };

    it("is the actor's owner", () => {
        expect(mayRollFor(owned, owner)).toBe(true);
    });

    it("is not somebody else's player", () => {
        expect(mayRollFor(owned, other)).toBe(false);
    });

    it("is always the GM", () => {
        expect(mayRollFor({}, gm)).toBe(true);
    });

    it("is nobody, where there is nobody or nothing", () => {
        expect(mayRollFor(null, owner)).toBe(false);
        expect(mayRollFor(owned, null)).toBe(false);
    });
});

describe("the system wires it up", () => {
    // The comments still name the flag, because what it cost is worth
    // remembering; the code is what must not carry it.
    const stripComments = source => source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
    const code = globSync("module/**/*.mjs", { cwd: ROOT }).map(f => stripComments(read(f))).join("\n");

    it("has no special case left for recon", () => {
        expect(code).not.toContain("isRecon");
    });

    it("runs every kind of request through one lifecycle", () => {
        const recon = read("module/systems/recon-system.mjs");
        expect(recon).not.toContain("class ReconSystem");
        expect(recon).not.toContain("initReconSystem");
        expect(read("glog2d6.mjs")).not.toContain("initReconSystem");
    });

    /**
     * The old buttons carried no class the handler bound to, and a player's
     * click ran against their own client, where the request does not exist.
     */
    it("sends a player's click to the GM, who holds the request", () => {
        const gm = read("module/systems/gm-roll-system.mjs");
        expect(gm).toMatch(/if \(game\.user\.isGM\) return game\.glog2d6\.gmRollSystem\.execute/);
        expect(gm).toContain("game.socket.emit(SOCKET, { type: EXECUTE_REQUEST");
        expect(gm).toContain("userId: game.user.id");
    });

    it("asks about the clicking user's ownership, not the running client's", () => {
        const gm = read("module/systems/gm-roll-system.mjs");
        expect(gm).toContain("mayRollFor(actor, user)");
        expect(gm).not.toContain("actor?.isOwner) throw");
    });
});
