import { describe, expect, it } from "vitest";

import {
    ARMOR_TYPES,
    ITEM_SHEET_CONFIG,
    ITEM_SHEET_TYPES,
    WEAPON_TYPES,
    armorBreakageChoices,
    armorDefaults,
    autoFieldsChanged,
    autoFieldsFor,
    deriveSystemUpdate,
    isReputationFeature,
    itemSheetChoices,
    itemSheetTemplate,
    itemSheetTemplates,
    weaponDefaults,
    weaponTypeOptions,
    weaponTypeTags
} from "../module/item/item-sheet-config.mjs";

describe("template resolution", () => {
    it("maps every declared type to its own template", () => {
        for (const type of ITEM_SHEET_TYPES) {
            expect(itemSheetTemplate(type)).toBe(`systems/glog2d6/templates/item/item-${type}-sheet.hbs`);
        }
    });

    it("falls back to the gear sheet for unknown types", () => {
        expect(itemSheetTemplate("mystery")).toBe("systems/glog2d6/templates/item/item-gear-sheet.hbs");
        expect(itemSheetTemplate(undefined)).toBe("systems/glog2d6/templates/item/item-gear-sheet.hbs");
    });

    it("lists one preloadable template per type", () => {
        expect(itemSheetTemplates()).toHaveLength(ITEM_SHEET_TYPES.length);
        expect(new Set(itemSheetTemplates()).size).toBe(ITEM_SHEET_TYPES.length);
    });

    it("covers every item subtype declared in system.json", async () => {
        const manifest = await import("../system.json", { with: { type: "json" } });
        const declared = Object.keys(manifest.default.documentTypes.Item);
        expect([...ITEM_SHEET_TYPES].sort()).toEqual(declared.sort());
    });
});

describe("weapon type tags", () => {
    it("normalises legacy string values into an array", () => {
        expect(weaponTypeTags("melee")).toEqual(["melee"]);
    });

    it("passes arrays through, dropping unknown tags", () => {
        expect(weaponTypeTags(["melee", "thrown", "nonsense"])).toEqual(["melee", "thrown"]);
    });

    it("treats missing data as untagged", () => {
        expect(weaponTypeTags(undefined)).toEqual([]);
        expect(weaponTypeTags(null)).toEqual([]);
        expect(weaponTypeTags("")).toEqual([]);
    });

    it("gives every tag a distinct checkbox value", () => {
        const options = weaponTypeOptions([]);
        expect(options.map(o => o.value)).toEqual(Object.keys(WEAPON_TYPES));
        expect(new Set(options.map(o => o.value)).size).toBe(options.length);
    });

    it("emits an explosive option that actually stores 'explosive'", () => {
        const explosive = weaponTypeOptions(["explosive"]).find(o => o.label === "Explosive");
        expect(explosive.value).toBe("explosive");
        expect(explosive.checked).toBe(true);
    });

    it("checks only the tags the weapon carries", () => {
        const checked = weaponTypeOptions(["ranged", "firearm"]).filter(o => o.checked).map(o => o.value);
        expect(checked).toEqual(["ranged", "firearm"]);
    });
});

describe("derived stat blocks", () => {
    it("scales armor by type", () => {
        expect(armorDefaults("light")).toEqual({ armorBonus: 1, encumbrancePenalty: 0 });
        expect(armorDefaults("medium")).toEqual({ armorBonus: 2, encumbrancePenalty: 1 });
        expect(armorDefaults("heavy")).toEqual({ armorBonus: 3, encumbrancePenalty: 2 });
    });

    it("falls back to light armor for an unknown type", () => {
        expect(armorDefaults("adamantine")).toEqual(armorDefaults("light"));
    });

    it("uses the melee size table for melee weapons", () => {
        expect(weaponDefaults(["melee"], "heavy"))
            .toEqual({ damage: "1d10", slots: 2, attackPenalty: 1, encumbrancePenalty: 1 });
        expect(weaponDefaults("melee", "light"))
            .toEqual({ damage: "1", slots: 1, attackPenalty: 0, encumbrancePenalty: 0 });
    });

    it("uses the ranged profile when nothing is melee", () => {
        expect(weaponDefaults(["ranged"], "heavy"))
            .toEqual({ damage: "1d6", slots: 1, attackPenalty: 0, encumbrancePenalty: 0 });
        expect(weaponDefaults(["firearm"], "heavy").damage).toBe("1d6");
    });

    it("keeps the size table for a melee weapon that is also thrown", () => {
        expect(weaponDefaults(["melee", "thrown"], "heavy").slots).toBe(2);
    });

    it("defaults an untagged weapon to the melee size table", () => {
        expect(weaponDefaults([], "medium").damage).toBe("1d6");
    });

    it("returns fresh objects rather than the frozen constants", () => {
        const stats = armorDefaults("light");
        stats.armorBonus = 99;
        expect(armorDefaults("light").armorBonus).toBe(1);
    });
});

describe("derived update pipeline", () => {
    it("flattens derived values into a document update", () => {
        expect(deriveSystemUpdate("armor", { type: "heavy" })).toEqual({
            "system.armorBonus": 3,
            "system.encumbrancePenalty": 2
        });
    });

    it("returns null for types with no derived stats", () => {
        expect(deriveSystemUpdate("gear", {})).toBeNull();
        expect(deriveSystemUpdate("note", {})).toBeNull();
    });

    it("declares the fields that govern each derived block", () => {
        expect(autoFieldsFor("weapon")).toEqual(["system.weaponType", "system.size"]);
        expect(autoFieldsFor("armor")).toEqual(["system.type"]);
        expect(autoFieldsFor("spell")).toEqual([]);
    });

    it("detects a changed governing field", () => {
        expect(autoFieldsChanged("armor", { type: "light" }, { type: "heavy" })).toBe(true);
        expect(autoFieldsChanged("armor", { type: "light" }, { type: "light" })).toBe(false);
    });

    it("compares weapon type tag arrays structurally", () => {
        expect(autoFieldsChanged("weapon", { weaponType: ["melee"], size: "medium" },
            { weaponType: ["melee"], size: "medium" })).toBe(false);
        expect(autoFieldsChanged("weapon", { weaponType: ["melee"], size: "medium" },
            { weaponType: ["melee", "thrown"], size: "medium" })).toBe(true);
    });

    it("treats a legacy string tag as equal to its single-element array", () => {
        expect(autoFieldsChanged("weapon", { weaponType: "melee" }, { weaponType: ["melee"] })).toBe(false);
    });
});

describe("breakage tracks", () => {
    it("derives armor conditions from maxLevel", () => {
        expect(armorBreakageChoices(1)).toEqual({ 0: "Fine", 1: "Damaged 1", 2: "Broken" });
        expect(armorBreakageChoices(2)).toEqual({ 0: "Fine", 1: "Damaged 1", 2: "Damaged 2", 3: "Broken" });
    });

    it("tolerates missing or nonsense maxLevel", () => {
        expect(armorBreakageChoices(undefined)).toEqual(armorBreakageChoices(1));
        expect(armorBreakageChoices(0)).toEqual(armorBreakageChoices(1));
        expect(armorBreakageChoices("2")).toEqual(armorBreakageChoices(2));
    });
});

describe("render context slices", () => {
    it("stringifies the selected breakage level so selectOptions can match it", () => {
        const context = itemSheetChoices("weapon", { system: { breakage: { level: 2 } } });
        expect(context.breakageLevel).toBe("2");
    });

    it("defaults breakage level to Fine when absent", () => {
        expect(itemSheetChoices("armor", { system: {} }).breakageLevel).toBe("0");
    });

    it("offers the armor type list", () => {
        expect(itemSheetChoices("armor", { system: { type: "medium" } }).armorTypes).toEqual(ARMOR_TYPES);
    });

    it("shows the reputation picker only for 'Reputation for ...' features", () => {
        expect(itemSheetChoices("feature", { name: "Reputation for Violence" }).isReputationFeature).toBe(true);
        expect(itemSheetChoices("feature", { name: "reputation for honesty" }).isReputationFeature).toBe(true);
        expect(itemSheetChoices("feature", { name: "Tracker" }).isReputationFeature).toBe(false);
        expect(itemSheetChoices("feature", {}).isReputationFeature).toBe(false);
    });

    it("returns an empty slice for types without choices", () => {
        expect(itemSheetChoices("shield", { system: {} })).toEqual({});
        expect(itemSheetChoices("nonexistent", { system: {} })).toEqual({});
    });

    it("never throws on an item with no system data", () => {
        for (const type of ITEM_SHEET_TYPES) {
            expect(() => itemSheetChoices(type, {})).not.toThrow();
        }
    });
});

describe("reputation feature naming", () => {
    it("only matches the reputation naming convention", () => {
        expect(isReputationFeature("Reputation for Cruelty")).toBe(true);
        expect(isReputationFeature("Reputation")).toBe(false);
        expect(isReputationFeature(undefined)).toBe(false);
        expect(isReputationFeature(42)).toBe(false);
    });
});

describe("configuration integrity", () => {
    it("keeps derive and autoFields together", () => {
        for (const [type, config] of Object.entries(ITEM_SHEET_CONFIG)) {
            expect(Boolean(config.derive), `${type} derive/autoFields mismatch`)
                .toBe(Boolean(config.autoFields?.length));
        }
    });

    it("only names top-level system fields in autoFields", () => {
        for (const type of ITEM_SHEET_TYPES) {
            for (const field of autoFieldsFor(type)) {
                expect(field, `${type}.${field}`).toMatch(/^system\.[A-Za-z]+$/);
            }
        }
    });
});
