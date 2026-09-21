import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import {
    WOUND_ITEM_TYPE,
    WOUND_STATES,
    aggregateWoundEffects,
    woundFromItem,
    woundItemData,
    woundsFromItems
} from "../module/systems/wounds.mjs";

const ROOT = resolve(import.meta.dirname, "..");
const read = p => readFileSync(resolve(ROOT, p), "utf8");

const item = (over = {}) => ({
    id: "w1",
    name: "Hobbled",
    img: "hobbled.webp",
    type: WOUND_ITEM_TYPE,
    system: {
        typeId: "hobbled",
        description: "Movement reduced to 10'.",
        damage: 2,
        severity: 3,
        state: WOUND_STATES.TREATED,
        bodyPart: "Leg",
        maimedResult: "",
        dateAcquired: "2026-01-01T00:00:00.000Z",
        effects: { movementReduction: 10 },
        ...over
    }
});

/**
 * Wounds became documents so a GM can author one, drop it in a compendium and
 * point a roll table at it. The rules never cared where a wound was stored, so
 * documents are translated at the edge rather than taught to every rule.
 */
describe("a wound as a document", () => {
    it("flattens into the shape the rules speak", () => {
        expect(woundFromItem(item())).toMatchObject({
            id: "w1",
            name: "Hobbled",
            typeId: "hobbled",
            bodyPart: "Leg",
            state: WOUND_STATES.TREATED,
            effects: { movementReduction: 10 }
        });
    });

    it("survives an item with nothing filled in", () => {
        const bare = woundFromItem({ id: "x", name: "Something", type: WOUND_ITEM_TYPE });
        expect(bare.state).toBe(WOUND_STATES.UNTREATED);
        expect(bare.effects).toEqual({});
    });

    it("has nothing to say about a missing item", () => {
        expect(woundFromItem(null)).toBeNull();
        expect(woundFromItem(undefined)).toBeNull();
    });

    it("takes only the wounds off an actor's items", () => {
        const items = [item(), { id: "a", type: "weapon" }, { id: "b", type: "feature" }];
        expect(woundsFromItems(items).map(w => w.id)).toEqual(["w1"]);
        expect(woundsFromItems([])).toEqual([]);
        expect(woundsFromItems()).toEqual([]);
    });

    it("round-trips back into document data", () => {
        const data = woundItemData(woundFromItem(item()));
        expect(data.type).toBe(WOUND_ITEM_TYPE);
        expect(data.name).toBe("Hobbled");
        expect(data.system).toMatchObject({
            typeId: "hobbled",
            bodyPart: "Leg",
            severity: 3,
            state: WOUND_STATES.TREATED,
            effects: { movementReduction: 10 }
        });
    });

    it("gives a wound made from nothing a name, an icon and a state", () => {
        const data = woundItemData({});
        expect(data.name).toBe("Wound");
        expect(data.img).toBeTruthy();
        expect(data.system.state).toBe(WOUND_STATES.UNTREATED);
        expect(data.system.dateAcquired).toBeTruthy();
    });

    it("refuses a state that is not one of the three", () => {
        expect(woundItemData({ state: "nonsense" }).system.state).toBe(WOUND_STATES.UNTREATED);
    });

    /** Effects are copied, not referenced, so editing one wound cannot move another. */
    it("copies the effects rather than sharing them", () => {
        const effects = { movementReduction: 10 };
        const data = woundItemData({ effects });
        effects.movementReduction = 99;
        expect(data.system.effects.movementReduction).toBe(10);
    });
});

/**
 * The point of embedding effects on the wound: a carried wound keeps saying
 * what it did on the day it was inflicted.
 */
describe("a carried wound outlives its table", () => {
    const definitions = [{ id: "hobbled", effects: { movementReduction: 999 } }];

    it("uses its own effects, not the table's current ones", () => {
        const wounds = [woundFromItem(item())];
        expect(aggregateWoundEffects(wounds, definitions).movement).toBe(10);
    });

    it("falls back to the table when the wound embedded nothing", () => {
        const wounds = [woundFromItem(item({ effects: {} }))];
        expect(aggregateWoundEffects(wounds, definitions).movement).toBe(999);
    });

    it("copes with the table being gone entirely", () => {
        const wounds = [woundFromItem(item())];
        expect(aggregateWoundEffects(wounds, []).movement).toBe(10);
    });
});

describe("the system knows about the type", () => {
    it("declares it in the template and the manifest", () => {
        const template = JSON.parse(read("template.json"));
        expect(template.Item.types).toContain(WOUND_ITEM_TYPE);
        expect(template.Item.wound.state).toBe(WOUND_STATES.UNTREATED);

        expect(JSON.parse(read("system.json")).documentTypes.Item).toHaveProperty(WOUND_ITEM_TYPE);
    });

    /** Wounds live on the actor as documents now. */
    it("no longer keeps an embedded list", () => {
        const template = JSON.parse(read("template.json"));
        expect(template.Actor.character.wounds).not.toHaveProperty("list");
        expect(template.Actor.character.wounds.count).toBe(0);
    });

    it("stores and deletes them as documents", () => {
        const trauma = read("module/actor/systems/actor-trauma-system.mjs");
        expect(trauma).toContain("createEmbeddedDocuments");
        expect(trauma, "still writing the old embedded list").not.toContain("system.wounds.list");
    });

    it("counts them off the actor's items", () => {
        expect(read("module/actor/actor.mjs")).toMatch(/wounds\.count = this\.items\.filter/);
    });
});
