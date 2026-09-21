import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import {
    DEFAULT_WOUND_TABLE,
    anatomyTags,
    damageSource,
    describeSource,
    unknownSource,
    weaponTags,
    withTable,
    woundTableFor,
    woundTableRef
} from "../module/systems/damage-source.mjs";
import { BODY_PARTS, BODY_PART_BIAS, bodyPartTable } from "../module/systems/wounds.mjs";

const ROOT = resolve(import.meta.dirname, "..");
const read = p => readFileSync(resolve(ROOT, p), "utf8");

const wolf = { id: "n1", name: "Dire Wolf", system: { woundTable: "Beast Maulings" } };
const brigand = { id: "n2", name: "Brigand", system: {} };
const axe = { id: "i1", name: "Bearded Axe", type: "weapon", system: { weaponType: ["melee"] } };
const gun = { id: "i2", name: "Arquebus", type: "weapon", system: { weaponType: ["firearm"], woundTable: "Gunshot" } };

describe("weapon tags", () => {
    it("reads them off a weapon", () => {
        expect(weaponTags(axe)).toEqual(["melee"]);
        expect(weaponTags({ type: "weapon", system: { weaponType: "firearm" } })).toEqual(["firearm"]);
    });

    /** A sword with a blank type field is a melee weapon. */
    it("calls an untyped weapon melee", () => {
        expect(weaponTags({ type: "weapon", system: {} })).toEqual(["melee"]);
    });

    /** Anything that is not a weapon contributes no bias rather than a made-up one. */
    it("has nothing to say about anything else", () => {
        expect(weaponTags({ type: "gear", system: { weaponType: "melee" } })).toEqual([]);
        expect(weaponTags(null)).toEqual([]);
    });
});

describe("which table a blow draws from", () => {
    it("prefers the weapon's, so a weapon wounds the same whoever swings it", () => {
        expect(woundTableFor(damageSource({ actor: wolf, item: gun }))).toBe("Gunshot");
    });

    it("falls back to the attacker's, for creatures that wound by their nature", () => {
        expect(woundTableFor(damageSource({ actor: wolf }))).toBe("Beast Maulings");
        expect(woundTableFor(damageSource({ actor: wolf, item: axe }))).toBe("Beast Maulings");
    });

    it("takes one named outright when neither declares any", () => {
        expect(woundTableFor(damageSource({ actor: brigand, table: "Falling" }))).toBe("Falling");
    });

    it("lands on the world default when nobody has an opinion", () => {
        expect(woundTableFor(damageSource({ actor: brigand, item: axe }))).toBe(DEFAULT_WOUND_TABLE);
        expect(woundTableFor(unknownSource())).toBe(DEFAULT_WOUND_TABLE);
    });

    it("ignores a blank or whitespace reference", () => {
        expect(woundTableRef({ system: { woundTable: "   " } })).toBeNull();
        expect(woundTableRef({ system: {} })).toBeNull();
        expect(woundTableRef(null)).toBeNull();
    });
});

/**
 * The bug: anatomy was biased by the victim's own equipped weapon, so being
 * shot while holding a sword rolled melee anatomy.
 */
describe("what biases the anatomy", () => {
    it("is the weapon that hit you", () => {
        expect(anatomyTags(damageSource({ actor: brigand, item: gun }))).toEqual(["firearm"]);
        expect(bodyPartTable(anatomyTags(damageSource({ actor: brigand, item: gun }))))
            .toEqual(BODY_PART_BIAS.firearm);
    });

    /** A creature with no weapon biases nothing rather than guessing. */
    it("is nothing at all when the source is unknown", () => {
        expect(anatomyTags(unknownSource())).toEqual([]);
        expect(bodyPartTable(anatomyTags(unknownSource()))).toEqual(BODY_PARTS);
    });

    it("can be stated outright, for damage with no weapon behind it", () => {
        expect(anatomyTags(damageSource({ tags: ["explosive"] }))).toEqual(["explosive"]);
    });

    /**
     * The unarmed bias was defined but unreachable: the lookup order left it
     * out, so fists rolled unweighted.
     */
    it("reaches the unarmed bias now that it is looked up", () => {
        expect(bodyPartTable(["unarmed"])).toEqual(BODY_PART_BIAS.unarmed);
        expect(bodyPartTable(["unarmed"])).not.toEqual(BODY_PARTS);
    });
});

/**
 * Precedence inside `damageSource` answers what an attacker is like; naming a
 * table outright is the GM saying what this particular blow was.
 */
describe("a table named outright", () => {
    it("wins over both the weapon's and the attacker's", () => {
        expect(woundTableFor(withTable(damageSource({ actor: wolf, item: gun }), "Falling"))).toBe("Falling");
    });

    it("leaves the blow alone when nothing was named", () => {
        const blow = damageSource({ actor: wolf });
        expect(withTable(blow, "")).toBe(blow);
        expect(withTable(blow, "   ")).toBe(blow);
        expect(withTable(blow, null)).toBe(blow);
    });

    it("changes nothing else about the blow", () => {
        expect(withTable(damageSource({ actor: wolf, item: gun }), "Falling"))
            .toMatchObject({ actorName: "Dire Wolf", itemName: "Arquebus", tags: ["firearm"] });
    });
});

describe("naming the blow", () => {
    it("names both when it can", () => {
        expect(describeSource(damageSource({ actor: brigand, item: axe }))).toBe("Brigand's Bearded Axe");
    });

    it("names whichever it has", () => {
        expect(describeSource(damageSource({ actor: wolf }))).toBe("Dire Wolf");
        expect(describeSource(damageSource({ item: axe }))).toBe("Bearded Axe");
    });

    it("says nothing about damage from nowhere", () => {
        expect(describeSource(unknownSource())).toBeNull();
    });
});

describe("the system wires it up", () => {
    it("stopped reading the victim's own weapon", () => {
        const trauma = read("module/actor/systems/actor-trauma-system.mjs");
        expect(trauma).not.toContain("_equippedWeaponTags");
        expect(trauma).toContain("anatomyTags(this.source)");
    });

    it("draws from the table the source names, not one fixed name", () => {
        const trauma = read("module/actor/systems/actor-trauma-system.mjs");
        expect(trauma).toContain("woundTableFor(this.source");
    });

    it("gives weapons and actors somewhere to declare one", () => {
        const template = JSON.parse(read("template.json"));
        expect(template.Item.weapon).toHaveProperty("woundTable");
        expect(template.Actor.templates.base).toHaveProperty("woundTable");

        expect(read("templates/item/item-weapon-sheet.hbs")).toContain('name="system.woundTable"');
        expect(read("templates/actor/actor-npc-sheet.hbs")).toContain('name="system.woundTable"');
    });
});
