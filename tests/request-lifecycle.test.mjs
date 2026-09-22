import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { JSDOM } from "jsdom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { GMRollSystem, ROLL_TYPES, blowFrom } from "../module/systems/gm-roll-system.mjs";
import { woundTableFor } from "../module/systems/damage-source.mjs";

const ROOT = resolve(import.meta.dirname, "..");
const read = p => readFileSync(resolve(ROOT, p), "utf8");

const gm = { id: "gm", isGM: true };
const player = { id: "p1", isGM: false };

function makeActor(id, name, { ownedBy = null, items = [], system = {} } = {}) {
    return {
        id,
        name,
        isOwner: true,
        items,
        system: {
            attributes: { con: { effectiveMod: 1 }, dex: { effectiveMod: 2 }, wis: { effectiveMod: 0 } },
            ...system
        },
        testUserPermission: (user) => user.id === ownedBy,
        createRoll(formula, data) {
            const roll = new Roll(formula, data);
            roll.total = this.nextTotal ?? 7;
            return roll;
        }
    };
}

let messages;
let created;

beforeEach(() => {
    messages = new Map();
    created = [];

    const realCreate = ChatMessage.create;
    vi.spyOn(ChatMessage, "create").mockImplementation(async (data) => {
        const id = `m${messages.size + 1}`;
        const message = { id, ...data, async update(changes) { Object.assign(this, changes); } };
        messages.set(id, message);
        created.push(message);
        return message;
    });
    void realCreate;

    game.user = gm;
    game.messages = { get: id => messages.get(id) };
});

afterEach(() => vi.restoreAllMocks());

function world(...actors) {
    const byId = new Map(actors.map(a => [a.id, a]));
    game.actors = { get: id => byId.get(id) };
    return byId;
}

/**
 * One lifecycle now serves every kind of request. The interesting parts are
 * the edges: who may answer, what the message says while it fills in, and
 * what the party is told once it is done.
 */
describe("a request, from called for to finished", () => {
    it("asks each actor with a button of their own", async () => {
        world(makeActor("a", "Mareth"), makeActor("b", "Cedric"));
        const system = new GMRollSystem();

        await system.create("attribute", ["a", "b"], { attribute: "dex" });

        expect(created).toHaveLength(1);
        const doc = new JSDOM(created[0].content).window.document;
        const buttons = [...doc.querySelectorAll("[data-roll-id]")];
        expect(buttons.map(b => b.dataset.actorId)).toEqual(["a", "b"]);
        expect(doc.body.textContent).toContain("0/2");
    });

    it("replaces a button with a result as each one rolls", async () => {
        world(makeActor("a", "Mareth"), makeActor("b", "Cedric"));
        const system = new GMRollSystem();
        const id = await system.create("attribute", ["a", "b"], { attribute: "dex" });

        await system.execute(id, "a");

        const doc = new JSDOM(created[0].content).window.document;
        expect([...doc.querySelectorAll("[data-roll-id]")].map(b => b.dataset.actorId)).toEqual(["b"]);
        expect(doc.body.textContent).toContain("Mareth: 7");
        expect(doc.body.textContent).toContain("1/2");
    });

    it("tells the party the totals once everyone has rolled", async () => {
        const actors = world(makeActor("a", "Mareth"), makeActor("b", "Cedric"));
        actors.get("b").nextTotal = 11;
        const system = new GMRollSystem();
        const id = await system.create("attribute", ["a", "b"], { attribute: "dex" });

        await system.execute(id, "a");
        await system.execute(id, "b");

        const summary = created.at(-1).content;
        expect(summary).toContain("Attribute Check - Results");
        // Best first, so the winner is not hunted for.
        expect(summary.indexOf("Cedric")).toBeLessThan(summary.indexOf("Mareth"));
        expect(system.rolls.size, "a finished request is not kept").toBe(0);
    });

    it("refuses a second roll from the same actor", async () => {
        world(makeActor("a", "Mareth"));
        const system = new GMRollSystem();
        const id = await system.create("attribute", ["a"], { attribute: "dex" });

        await system.execute(id, "a");
        await expect(system.execute(id, "a")).rejects.toThrow(/Invalid roll state/);
    });

    /**
     * The request lives on the GM's client, so ownership has to be asked
     * about the user who clicked rather than about whoever is running it.
     */
    it("lets an actor's owner answer, and nobody else", async () => {
        world(makeActor("a", "Mareth", { ownedBy: "p1" }));
        const system = new GMRollSystem();
        const id = await system.create("attribute", ["a"], { attribute: "dex" });

        await expect(system.execute(id, "a", { id: "p2", isGM: false })).rejects.toThrow(/No permission/);
        await expect(system.execute(id, "a", player)).resolves.toMatchObject({ actorName: "Mareth" });
    });

    it("is the GM's to call for", async () => {
        world(makeActor("a", "Mareth"));
        game.user = player;
        await expect(new GMRollSystem().create("attribute", ["a"], {})).rejects.toThrow(/GM only/);
    });

    it("refuses a kind of request nobody has heard of", async () => {
        world(makeActor("a", "Mareth"));
        await expect(new GMRollSystem().create("nonsense", ["a"], {})).rejects.toThrow(/Unknown type/);
    });
});

/**
 * The GM calls for the save; a failure offers the wound rather than imposing
 * one, and carries the blow with it.
 */
describe("a trauma save the GM called for", () => {
    const failed = { actorId: "a", actorName: "Mareth", total: 6, success: false };
    const passed = { actorId: "a", actorName: "Mareth", total: 11, success: true };
    const request = { params: { damage: 5, attacker: "n1", woundTable: "Beast Maulings" } };

    it("offers the wound when the save fails", () => {
        const doc = new JSDOM(ROLL_TYPES.trauma.row(failed, request)).window.document;
        const button = doc.querySelector(".apply-wound-btn");

        expect(button).not.toBeNull();
        expect(button.dataset).toMatchObject({
            actorId: "a", damage: "5", attacker: "n1", woundTable: "Beast Maulings"
        });
    });

    it("offers nothing when the save passes", () => {
        expect(ROLL_TYPES.trauma.row(passed, request)).not.toContain("apply-wound-btn");
        expect(ROLL_TYPES.trauma.row(passed, request)).toContain("Mareth: 11");
    });

    it("offers a wound for damage the GM did not type, rather than none", () => {
        const doc = new JSDOM(ROLL_TYPES.trauma.row(failed, { params: {} })).window.document;
        expect(doc.querySelector(".apply-wound-btn").dataset.damage).toBe("1");
    });

    /** The buttons are the outcome; a table of totals under them is noise. */
    it("has nothing to add once everyone has rolled", () => {
        expect(ROLL_TYPES.trauma.onComplete).toBeNull();
    });

    it("holds the save to its own target rather than the GM's", async () => {
        world(makeActor("a", "Mareth"));
        const system = new GMRollSystem();
        const id = await system.create("trauma", ["a"], { damage: 3, target: 2 });

        expect((await system.execute(id, "a")).success).toBe(false);
    });
});

describe("the blow a trauma save was called for", () => {
    const wolf = { id: "n1", name: "Dire Wolf", system: { woundTable: "Beast Maulings" } };
    const brigand = { id: "n2", name: "Brigand", system: {} };

    beforeEach(() => world(wolf, brigand));

    it("draws from the attacker's own table", () => {
        expect(woundTableFor(blowFrom({ attacker: "n1" }))).toBe("Beast Maulings");
    });

    /** Naming one outright is the GM saying what this particular blow was. */
    it("draws from the one the GM named, over the attacker's", () => {
        expect(woundTableFor(blowFrom({ attacker: "n1", woundTable: "Falling" }))).toBe("Falling");
    });

    it("names the attacker, so the wound card can say what hit you", () => {
        expect(blowFrom({ attacker: "n2" })).toMatchObject({ actorId: "n2", actorName: "Brigand" });
    });

    it("is damage from nowhere in particular when the GM named nobody", () => {
        expect(blowFrom({})).toMatchObject({ actorId: null, tags: [] });
        expect(blowFrom()).toMatchObject({ actorId: null });
    });
});

describe("a recon check", () => {
    const result = {
        actorId: "a", actorName: "Mareth", encounter: 1, encounterType: "Active Encounter",
        recon: 6, success: true, effects: ["Surprise", "Stalker: Ambush +1"],
        features: ["Stalker"], hasTracker: false
    };

    it("rolls itself rather than a formula the system writes", () => {
        expect(ROLL_TYPES.recon.roll).toBeTypeOf("function");
        expect(ROLL_TYPES.recon.formula).toBeUndefined();
    });

    it("reads as a recon result, not as a total", () => {
        const text = new JSDOM(ROLL_TYPES.recon.row(result)).window.document.body.textContent;
        expect(text).toContain("Active Encounter");
        expect(text).toContain("Surprise gained!");
        expect(text).toContain("Stalker");
    });

    /**
     * The summary was written long ago and never posted: the old recon system
     * deleted the request on the last roll instead of completing it.
     */
    it("tells the party what it found once everyone has looked", () => {
        const content = ROLL_TYPES.recon.onComplete({ results: new Map([["a", result]]) });
        expect(content).toContain("Recon Results");
        expect(content).toContain("Active Encounter");
        expect(content).toContain("Mareth");
    });
});

describe("the system wires it up", () => {
    it("reaches the apply-wound button with the blow that earned it", () => {
        const entry = read("glog2d6.mjs");
        expect(entry).toContain("blowFrom({");
        expect(entry).toContain("attacker: button.dataset.attacker");
        expect(entry).toContain("woundTable: button.dataset.woundTable");
    });

    /** A trauma save a character calls on themselves is the same save. */
    it("rolls a self-called trauma save from the same catalogue", () => {
        const trauma = read("module/actor/systems/actor-trauma-system.mjs");
        expect(trauma).toContain('rollSpec("trauma", this.actor)');
        expect(trauma).toContain('succeeded("trauma", roll.total)');
        expect(trauma).not.toContain("roll.total >= 10");
    });

    /**
     * A critical defence failure called for a trauma save with a *sentence*
     * where the damage goes, which reached the wound button as
     * `data-damage="Critical Defense Failure"`.
     */
    it("takes a number for the damage and puts the reason where it reads", () => {
        expect(read("module/actor/actor.mjs"))
            .toContain('rollTraumaSave(1, 0, "Critical Defense Failure")');
        expect(read("module/actor/systems/actor-trauma-system.mjs"))
            .toContain("requestDamage({ damage: excessDamage })");
    });

    /** The button was patched in a tenth of a second after the message. */
    it("puts the wound button in the card rather than racing it", () => {
        const trauma = read("module/actor/systems/actor-trauma-system.mjs");
        expect(trauma).not.toContain("_addApplyWoundButton");
        expect(trauma).not.toMatch(/setTimeout\([\s\S]{0,80}message\.update/);
    });
});
