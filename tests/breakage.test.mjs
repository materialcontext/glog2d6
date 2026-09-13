import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import Handlebars from "handlebars";
import { describe, expect, it } from "vitest";

import {
    BREAKABLE_TYPES,
    BREAKAGE_LABELS,
    BREAKAGE_LEVELS,
    BREAKAGE_MAX_LEVEL,
    BreakageCalculator,
    breakageMigration
} from "../module/systems/breakage-calculator.mjs";

describe("the condition track", () => {
    it("tops out at 2 for every breakable type", () => {
        expect(BREAKAGE_MAX_LEVEL).toBe(2);
        expect(BREAKAGE_LEVELS).toEqual({ FINE: 0, DAMAGED: 1, BROKEN: 2 });
        expect(BREAKABLE_TYPES).toEqual(["weapon", "armor", "shield"]);
    });

    it("labels each level once", () => {
        expect(BREAKAGE_LABELS).toEqual({ 0: "Fine", 1: "Damaged", 2: "Broken" });
    });

    it("classifies levels consistently", () => {
        expect(BreakageCalculator.isFine(0)).toBe(true);
        expect(BreakageCalculator.isDamaged(1)).toBe(true);
        expect(BreakageCalculator.isBroken(2)).toBe(true);

        expect(BreakageCalculator.isBroken(0)).toBe(false);
        expect(BreakageCalculator.isBroken(1)).toBe(false);
        expect(BreakageCalculator.isDamaged(2)).toBe(false);
    });

    it("treats a string level the same as a number", () => {
        // <select> submits strings; template.json types do no coercion.
        expect(BreakageCalculator.normalizeLevel("2")).toBe(2);
        expect(BreakageCalculator.isBroken("2")).toBe(true);
        expect(BreakageCalculator.isDamaged("1")).toBe(true);
        expect(BreakageCalculator.isFine("0")).toBe(true);
    });

    it("clamps junk and out-of-range levels", () => {
        expect(BreakageCalculator.normalizeLevel(undefined)).toBe(0);
        expect(BreakageCalculator.normalizeLevel(null)).toBe(0);
        expect(BreakageCalculator.normalizeLevel("nonsense")).toBe(0);
        expect(BreakageCalculator.normalizeLevel(-3)).toBe(0);
        expect(BreakageCalculator.normalizeLevel(7)).toBe(2);
        expect(BreakageCalculator.normalizeLevel(1.8)).toBe(1);
    });

    it("advances one step and stops at broken", () => {
        expect(BreakageCalculator.nextLevel(0)).toBe(1);
        expect(BreakageCalculator.nextLevel(1)).toBe(2);
        expect(BreakageCalculator.nextLevel(2)).toBe(2);
        expect(BreakageCalculator.nextLevel(undefined)).toBe(1);
    });

    it("names the level", () => {
        expect(BreakageCalculator.label(0)).toBe("Fine");
        expect(BreakageCalculator.label("1")).toBe("Damaged");
        expect(BreakageCalculator.label(9)).toBe("Broken");
    });
});

describe("weapon damage", () => {
    it("is unchanged when fine", () => {
        expect(BreakageCalculator.calculateWeaponDamage("1d10", 0)).toBe("1d10");
    });

    it("steps the die down when damaged", () => {
        expect(BreakageCalculator.calculateWeaponDamage("1d10", 1)).toBe("1d8");
        expect(BreakageCalculator.calculateWeaponDamage("1d6+1", 1)).toBe("1d4+1");
        expect(BreakageCalculator.calculateWeaponDamage("2d6", 1)).toBe("2d4");
    });

    it("has no lower die to step to", () => {
        expect(BreakageCalculator.calculateWeaponDamage("1", 1)).toBe("1");
    });

    it("is zero when broken", () => {
        expect(BreakageCalculator.calculateWeaponDamage("1d10", 2)).toBe("0");
        expect(BreakageCalculator.calculateWeaponDamage("1d10", "2")).toBe("0");
    });
});

describe("armor and shield protection", () => {
    it("is unchanged when fine", () => {
        expect(BreakageCalculator.calculateArmorBonus(3, 0)).toBe(3);
    });

    it("loses a point when damaged", () => {
        expect(BreakageCalculator.calculateArmorBonus(3, 1)).toBe(2);
        expect(BreakageCalculator.calculateArmorBonus(1, 1)).toBe(0);
    });

    it("is worth nothing when broken, matching a broken weapon", () => {
        // Previously `max(0, bonus - level)` left broken heavy armor at +1.
        expect(BreakageCalculator.calculateArmorBonus(3, 2)).toBe(0);
        expect(BreakageCalculator.calculateArmorBonus(9, 2)).toBe(0);
    });

    it("never goes negative", () => {
        expect(BreakageCalculator.calculateArmorBonus(0, 1)).toBe(0);
        expect(BreakageCalculator.calculateArmorBonus(undefined, 0)).toBe(0);
    });
});

describe("world migration", () => {
    const item = (type, breakage) => ({ type, system: breakage ? { breakage } : {} });

    it("moves legacy armor from maxLevel 1 to the shared track", () => {
        expect(breakageMigration(item("armor", { level: 1, maxLevel: 1 }))).toEqual({
            "system.breakage.level": 1,
            "system.breakage.maxLevel": 2
        });
    });

    it("keeps existing levels, which already meant the same thing", () => {
        // Old armor sheets offered 0/1/2 with 2 as Broken, so levels map 1:1.
        expect(breakageMigration(item("armor", { level: 2, maxLevel: 1 }))["system.breakage.level"]).toBe(2);
    });

    it("gives a shield the condition block it never had", () => {
        expect(breakageMigration(item("shield"))).toEqual({
            "system.breakage.level": 0,
            "system.breakage.maxLevel": 2
        });
    });

    it("clamps a level that escaped the old range", () => {
        expect(breakageMigration(item("weapon", { level: 5, maxLevel: 2 }))["system.breakage.level"]).toBe(2);
    });

    it("leaves already-correct items alone", () => {
        expect(breakageMigration(item("weapon", { level: 0, maxLevel: 2 }))).toBeNull();
        expect(breakageMigration(item("armor", { level: 2, maxLevel: 2 }))).toBeNull();
    });

    it("ignores item types that do not break", () => {
        for (const type of ["gear", "spell", "feature", "torch", "note"]) {
            expect(breakageMigration(item(type)), type).toBeNull();
        }
        expect(breakageMigration(undefined)).toBeNull();
    });

    it("is idempotent", () => {
        const armor = item("armor", { level: 1, maxLevel: 1 });
        const first = breakageMigration(armor);
        const migrated = item("armor", {
            level: first["system.breakage.level"],
            maxLevel: first["system.breakage.maxLevel"]
        });
        expect(breakageMigration(migrated)).toBeNull();
    });
});

/* -------------------------------------------- */
/*  The actor inventory badge                   */
/* -------------------------------------------- */

/**
 * The condition badge in the inventory list, compiled straight out of the real
 * template so weapon/armor/shield can't drift apart again.
 */
const CARRY_PANEL = readFileSync(
    resolve(import.meta.dirname, "../templates/actor/parts/panel-carry.hbs"), "utf8");

const CONDITION_FRAGMENT = CARRY_PANEL
    .split("{{!-- Condition badge; one track for weapons, armor and shields --}}")[1]
    ?.split("{{!-- end condition badge --}}")[0];

const hbs = Handlebars.create();
hbs.registerHelper("isBroken", level => BreakageCalculator.isBroken(level));
hbs.registerHelper("isDamaged", level => BreakageCalculator.isDamaged(level));

function renderBadge(type, level) {
    const template = hbs.compile(CONDITION_FRAGMENT);
    return template({ item: { type, system: { breakage: { level, maxLevel: 2 } } } }).trim();
}

describe("inventory condition badge", () => {
    it("was found in the template", () => {
        expect(CONDITION_FRAGMENT).toBeTruthy();
    });

    it("branches on the shared track, not on item type", () => {
        expect(CONDITION_FRAGMENT).toContain("isBroken");
        expect(CONDITION_FRAGMENT).toContain("isDamaged");
        expect(CONDITION_FRAGMENT).not.toContain("maxLevel");
        expect(CONDITION_FRAGMENT).not.toContain('eq item.type');
    });

    it.each(["weapon", "armor", "shield"])("renders the same badges for %s", type => {
        expect(renderBadge(type, 0)).toBe("");
        expect(renderBadge(type, 1)).toContain("DMG");
        expect(renderBadge(type, 1)).not.toContain("BROKEN");
        expect(renderBadge(type, 2)).toContain("BROKEN");
    });

    it("reads a string level the same as a number", () => {
        expect(renderBadge("armor", "2")).toContain("BROKEN");
    });

    it("shows nothing for an item with no condition track", () => {
        const template = hbs.compile(CONDITION_FRAGMENT);
        expect(template({ item: { type: "gear", system: {} } }).trim()).toBe("");
    });

    it("is wired up by the system entry point", () => {
        const entry = readFileSync(resolve(import.meta.dirname, "../glog2d6.mjs"), "utf8");
        expect(entry).toMatch(/registerHelper\('isBroken',\s*level\s*=>\s*BreakageCalculator\.isBroken/);
        expect(entry).toMatch(/registerHelper\('isDamaged',\s*level\s*=>\s*BreakageCalculator\.isDamaged/);
    });
});
