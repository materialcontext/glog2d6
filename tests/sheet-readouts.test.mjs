import { describe, expect, it } from "vitest";

import {
    ATTRIBUTE_KEYS,
    SKILLS,
    attackTiles,
    attributeTiles,
    castingOptions,
    defenseTiles,
    encumbranceNote,
    featureBadge,
    hpBar,
    inEffectRows,
    itemSummary,
    magicDicePips,
    partitionItems,
    signed,
    skillChips,
    woundEffectRows
} from "../module/actor/sheet-readouts.mjs";

const combat = { attack: { value: 4, bonus: 1 }, firearm: { bonus: 2 } };
const labels = tiles => tiles.map(t => t.label);

describe("signing a modifier", () => {
    it("always shows the sign, and uses a real minus", () => {
        expect(signed(3)).toBe("+3");
        expect(signed(0)).toBe("+0");
        expect(signed(-2)).toBe("−2");
        expect(signed(undefined)).toBe("+0");
        expect(signed("x")).toBe("+0");
    });
});

describe("attack tiles", () => {
    it("shows one plain tile with nothing equipped", () => {
        const tiles = attackTiles({ combat, weaponAnalysis: { hasWeapons: false } });
        expect(labels(tiles)).toEqual(["Attack"]);
        expect(tiles[0].value).toBe("+5");
    });

    it("names the one way you can swing", () => {
        for (const [type, label] of [["melee", "Melee"], ["ranged", "Ranged"], ["generic", "Unarmed"]]) {
            const tiles = attackTiles({ combat, weaponAnalysis: { hasWeapons: true, attackButtonType: type } });
            expect(labels(tiles)).toEqual([label]);
        }
    });

    /** Firearms add their own bonus; nothing else does. */
    it("folds the firearm bonus in", () => {
        const tiles = attackTiles({ combat, weaponAnalysis: { hasWeapons: true, attackButtonType: "firearm" } });
        expect(tiles[0].value).toBe("+7");
    });

    it("splits melee from thrown, and tags which is which", () => {
        const tiles = attackTiles({
            combat,
            weaponAnalysis: { hasWeapons: true, attackButtonType: "split", hasThrowable: true }
        });
        expect(labels(tiles)).toEqual(["Melee", "Thrown"]);
        expect(tiles.map(t => t.attackType)).toEqual(["melee", "thrown"]);
    });

    it("splits melee from ranged when there is nothing to throw", () => {
        const tiles = attackTiles({
            combat,
            weaponAnalysis: { hasWeapons: true, attackButtonType: "split", hasThrowable: false }
        });
        expect(labels(tiles)).toEqual(["Melee", "Ranged"]);
    });

    it("survives an actor with no combat block at all", () => {
        expect(attackTiles({})).toEqual([{ label: "Attack", value: "+0", action: "attack" }]);
    });
});

describe("defence tiles", () => {
    it("is one number for most people", () => {
        const tiles = defenseTiles({ defense: { total: 12 } });
        expect(tiles).toEqual([{ label: "Defend", value: 12, action: "defend" }]);
    });

    it("splits for an Acrobat, and routes each half to its own roll", () => {
        const tiles = defenseTiles({
            defense: { meleeTotal: 13, rangedTotal: 11 },
            hasAcrobatTraining: true
        });
        expect(labels(tiles)).toEqual(["Melee", "Ranged"]);
        expect(tiles.map(t => t.action)).toEqual(["defend-melee", "defend-ranged"]);
    });
});

describe("the hit point bar", () => {
    it("reads by length", () => {
        expect(hpBar(6, 11).percent).toBe(55);
        expect(hpBar(11, 11).percent).toBe(100);
        expect(hpBar(0, 11).percent).toBe(0);
    });

    it("clamps rather than overflowing its track", () => {
        expect(hpBar(20, 11).percent).toBe(100);
        expect(hpBar(-5, 11).percent).toBe(0);
    });

    /** A zero maximum would divide by zero and print NaN across the bar. */
    it("survives a zero or missing maximum", () => {
        expect(hpBar(3, 0).percent).toBe(100);
        expect(hpBar(undefined, undefined).percent).toBe(0);
    });

    /** Red once you have lost half of what you had, and not a point before. */
    it("turns once you are hurt enough to notice", () => {
        expect(hpBar(5, 11).hurt).toBe(true);
        expect(hpBar(6, 11).hurt).toBe(false);
        expect(hpBar(5, 10).hurt).toBe(true);
        expect(hpBar(0, 10).hurt).toBe(true);
        expect(hpBar(10, 10).hurt).toBe(false);
    });
});

describe("magic dice", () => {
    it("keeps spent dice in place so the pool's size still reads", () => {
        expect(magicDicePips(2, 3).map(p => p.filled)).toEqual([true, true, false]);
        expect(magicDicePips(0, 3).map(p => p.filled)).toEqual([false, false, false]);
    });

    it("shows nothing for someone who casts nothing", () => {
        expect(magicDicePips(0, 0)).toEqual([]);
    });

    it("never shows more spent than it has", () => {
        expect(magicDicePips(9, 2).filter(p => p.filled)).toHaveLength(2);
    });

    it("offers one casting option per die still in hand", () => {
        expect(castingOptions(3)).toEqual([1, 2, 3]);
        expect(castingOptions(0)).toEqual([]);
        expect(castingOptions(undefined)).toEqual([]);
    });
});

describe("encumbrance", () => {
    it("says nothing when you are not encumbered", () => {
        expect(encumbranceNote({ encumbrance: 0 })).toBeNull();
        expect(encumbranceNote({})).toBeNull();
    });

    it("says where the penalty came from", () => {
        expect(encumbranceNote({ encumbrance: 3, slotEncumbrance: 2, equipmentEncumbrance: 1 }))
            .toBe("−3 (2 slots + 1 equipment)");
        expect(encumbranceNote({ encumbrance: 2, slotEncumbrance: 2 })).toContain("slot overflow");
        expect(encumbranceNote({ encumbrance: 1, equipmentEncumbrance: 1 })).toContain("equipment");
    });
});

describe("attribute tiles", () => {
    it("covers the six, in order", () => {
        const tiles = attributeTiles({});
        expect(tiles.map(t => t.key)).toEqual([...ATTRIBUTE_KEYS]);
        expect(tiles.every(t => t.display === "+0")).toBe(true);
    });

    /** The roll is 2d6 + mod, so the modifier is the headline. */
    it("headlines the effective modifier, not the raw score", () => {
        const [str] = attributeTiles({ str: { value: 9, mod: 1, effectiveMod: -1 } });
        expect(str.display).toBe("−1");
        expect(str.negative).toBe(true);
        expect(str.impaired).toBe(true);
    });

    it("marks an improvement differently from an impairment", () => {
        const [str] = attributeTiles({ str: { value: 9, mod: 1, effectiveMod: 2 } });
        expect(str.improved).toBe(true);
        expect(str.impaired).toBe(false);
    });

    it("calls an untouched attribute neither", () => {
        const [str] = attributeTiles({ str: { value: 9, mod: 1 } });
        expect(str.changed).toBe(false);
        expect(str.effectiveValue).toBe(9);
    });
});

describe("skill chips", () => {
    it("lists the six in the order the sheet has always shown them", () => {
        expect(skillChips({}).map(c => c.key)).toEqual(SKILLS.map(s => s.key));
    });

    it("routes each chip to its own roll", () => {
        const chips = skillChips({ sneak: { bonus: 2 }, reaction: { bonus: -1 } });
        expect(chips[0]).toMatchObject({ action: "sneak", display: "+2", negative: false });
        expect(chips.find(c => c.key === "reaction")).toMatchObject({ display: "−1", negative: true });
    });
});

describe("splitting the item list", () => {
    const items = [
        { type: "weapon" }, { type: "armor" }, { type: "shield" },
        { type: "gear" }, { type: "torch" },
        { type: "feature" }, { type: "spell" }, { type: "note" },
        { type: "something-new" }, null
    ];

    it("puts everything you carry in one list", () => {
        expect(partitionItems(items).carried).toHaveLength(5);
    });

    it("keeps features, spells and notes apart", () => {
        const split = partitionItems(items);
        expect(split.features).toHaveLength(1);
        expect(split.spells).toHaveLength(1);
        expect(split.notes).toHaveLength(1);
    });

    /**
     * The old templates filtered inside `{{#each}}`, so an empty panel and an
     * actor with no items at all produced the same markup.
     */
    it("distinguishes an empty panel from an empty actor", () => {
        const split = partitionItems([{ type: "weapon" }]);
        expect(split.carried).toHaveLength(1);
        expect(split.spells).toEqual([]);
        expect(partitionItems([]).carried).toEqual([]);
    });
});

describe("what is in effect", () => {
    const fine = {
        details: { movement: 4 },
        defense: { armor: 2 },
        inventory: { encumbrance: 0 }
    };

    it("always reports movement and encumbrance", () => {
        const rows = inEffectRows({ system: fine, items: [] });
        expect(rows.map(r => r.label)).toEqual(["Movement", "Encumbrance"]);
        expect(rows.every(r => !r.impaired)).toBe(true);
    });

    it("shows what movement used to be when something cut it", () => {
        const rows = inEffectRows({
            system: { ...fine, details: { movement: 4, effectiveMovement: 2 } },
            items: []
        });
        expect(rows[0]).toMatchObject({ value: "2 (was 4)", impaired: true });
    });

    it("reports worn armour and flags what is broken", () => {
        const rows = inEffectRows({
            system: fine,
            items: [{ type: "shield", system: { equipped: true, breakage: { level: 2 } } }]
        });
        const armour = rows.find(r => r.label === "Armour");
        expect(armour.value).toContain("1 broken");
        expect(armour.impaired).toBe(true);
    });

    it("says armour is sound when it is", () => {
        const rows = inEffectRows({
            system: fine,
            items: [{ type: "armor", system: { equipped: true, breakage: { level: 0 } } }]
        });
        expect(rows.find(r => r.label === "Armour")).toMatchObject({ impaired: false });
    });

    /** Only a hurt weapon is worth a line; a sound one tells you nothing new. */
    it("mentions a weapon only when it is damaged", () => {
        const sound = inEffectRows({
            system: fine,
            items: [{ type: "weapon", name: "Axe", system: { equipped: true, breakage: { level: 0 } } }]
        });
        expect(sound.find(r => r.label === "Weapon")).toBeUndefined();

        const hurt = inEffectRows({
            system: fine,
            items: [{ type: "weapon", name: "Axe", system: { equipped: true, breakage: { level: 1 } } }]
        });
        expect(hurt.find(r => r.label === "Weapon").value).toBe("Axe · damaged");
    });

    it("ignores what you are not wearing", () => {
        const rows = inEffectRows({
            system: fine,
            items: [{ type: "shield", system: { equipped: false, breakage: { level: 2 } } }]
        });
        expect(rows.find(r => r.label === "Armour")).toBeUndefined();
    });
});

describe("what your wounds are costing you", () => {
    it("says nothing when you are unhurt", () => {
        expect(woundEffectRows({})).toEqual([]);
        expect(woundEffectRows()).toEqual([]);
    });

    it("names each penalty in the language the sheet uses", () => {
        const rows = woundEffectRows({
            statReductions: { str: 2, dex: 0 },
            movementReduction: 10,
            attackPenalty: 1,
            defensePenalty: 2,
            reactionPenalty: 1,
            noHealing: true,
            sleepDisruption: 2,
            deathOnFailure: true,
            combatEffects: ["auto_fail_initiative"]
        });

        const labelled = Object.fromEntries(rows.map(r => [r.label, r.value]));
        expect(labelled.STR).toBe("−2");
        expect(labelled.DEX).toBeUndefined();
        expect(labelled.Movement).toBe("capped at 10'");
        expect(labelled.Attack).toBe("−1");
        expect(labelled.Defence).toBe("−2");
        expect(labelled.Healing).toBe("none until treated");
        expect(labelled.Sleep).toContain("2 of normal");
        expect(labelled.Trauma).toContain("kills you");
        expect(rows.every(r => r.impaired)).toBe(true);
    });

    /** "No healing at all" and "healing is slower" are not both true at once. */
    it("reports the worse of the two healing states, never both", () => {
        expect(woundEffectRows({ noHealing: true, extendedHealing: true })
            .filter(r => r.label === "Healing")).toHaveLength(1);
        expect(woundEffectRows({ extendedHealing: true })
            .find(r => r.label === "Healing").value).toContain("slower");
    });
});

describe("the item summary", () => {
    const of = (type, system, name = "Thing") => itemSummary({ name, type, system });

    it("leads with the name", () => {
        expect(of("gear", {})).toBe("Thing");
        expect(of("weapon", { damage: "1d6" })).toMatch(/^Thing — /);
    });

    /** The three the row has no width for and used to drop entirely. */
    it("carries weapon size, armour type and gear size", () => {
        expect(of("weapon", { size: "heavy", damage: "1d10" })).toContain("heavy");
        expect(of("armor", { type: "chain", armorBonus: 2 })).toContain("chain");
        expect(of("gear", { size: "bulky" })).toContain("bulky");
    });

    it("carries a torch's light radius and how long it has left", () => {
        const lit = of("torch", { lightRadius: { bright: 30, dim: 60 }, duration: { enabled: true, remaining: 4 } });
        expect(lit).toContain("30/60 ft light");
        expect(lit).toContain("4h left");
        expect(of("torch", { duration: { enabled: false } })).toContain("burns indefinitely");
    });

    it("names a condition, and only when there is one", () => {
        expect(of("weapon", { breakage: { level: 2 } })).toContain("broken");
        expect(of("weapon", { breakage: { level: 1 } })).toContain("damaged");
        expect(of("weapon", { breakage: { level: 0 } })).not.toContain("fine");
    });

    /** Gear has no condition track, so it must never claim one. */
    it("does not give unbreakable things a condition", () => {
        expect(of("gear", { breakage: { level: 2 } })).not.toContain("broken");
    });

    it("counts slots in the singular when there is one", () => {
        expect(of("gear", { slots: 1 })).toContain("1 slot");
        expect(of("gear", { slots: 2 })).toContain("2 slots");
        expect(of("gear", { slots: 0 })).not.toContain("slot");
    });

    it("mentions an encumbrance penalty only when it bites", () => {
        expect(of("weapon", { encumbrancePenalty: 1 })).toContain("−1 encumbrance");
        expect(of("weapon", { encumbrancePenalty: 0 })).not.toContain("encumbrance");
    });

    it("survives an item with nothing on it", () => {
        expect(itemSummary({})).toBe("");
        expect(itemSummary(undefined)).toBe("");
    });
});

describe("the feature badge", () => {
    const of = (system, name = "Something") => featureBadge({ name, system });

    it("names the class and the template together", () => {
        expect(of({ classSource: "Fighter", template: "D" })).toBe("Fighter D");
        expect(of({ classSource: "Wizard", template: "A" })).toBe("Wizard A");
    });

    /** level-0 is template zero: the feature that makes you the class. */
    it("reads level-0 as 0", () => {
        expect(of({ classSource: "Fighter", template: "level-0" })).toBe("Fighter 0");
    });

    it("gives an untemplated feature X", () => {
        expect(of({ classSource: "Custom", template: "X" })).toBe("Custom X");
        expect(of({ classSource: "", template: "X" })).toBe("X");
    });

    /** A scar is something that happened to you, not a template. */
    it("calls a scar a scar", () => {
        expect(of({ classSource: "", template: "scar" }, "Scar: Shoulder")).toBe("Scar");
    });

    it("recognises a scar written before the field existed", () => {
        expect(of({ classSource: "", template: "custom" }, "Scar: Leg")).toBe("Scar");
    });

    /**
     * Existing worlds are full of features stored as "custom", from back when
     * that was the word for untemplated. They mean X and must not read
     * "Custom Custom".
     */
    it("reads the old spelling of untemplated as X", () => {
        expect(of({ classSource: "Custom", template: "custom" })).toBe("Custom X");
        expect(of({ classSource: "Fighter", template: "custom" })).toBe("Fighter X");
    });

    it("says what it can when half the information is missing", () => {
        expect(of({ classSource: "Fighter", template: "" })).toBe("Fighter");
        expect(of({ classSource: "", template: "" })).toBe("");
        expect(featureBadge({})).toBe("");
        expect(featureBadge(undefined)).toBe("");
    });
});
