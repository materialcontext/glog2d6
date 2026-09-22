import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import {
    DAMAGE_VARIABLE,
    DEFAULT_FORMULA,
    isDocumentResult,
    ownsItsRoll,
    resultForValue,
    resultUuid,
    rollFormulaFor,
    severityFor,
    tableFormula
} from "../module/systems/wound-table.mjs";
import { SEVERITY_DIE, WOUND_ITEM_TYPE, woundEntryFromItem, woundSeverity } from "../module/systems/wounds.mjs";

const ROOT = resolve(import.meta.dirname, "..");
const read = p => readFileSync(resolve(ROOT, p), "utf8");

const shipped = { formula: `1d${SEVERITY_DIE}`, results: [] };
const authored = { formula: `1d6 + ${DAMAGE_VARIABLE}`, results: [] };

/**
 * The shipped table is a list the system indexes into, and its *length* used to
 * be load-bearing. A table says it wants the roll for itself by naming damage
 * in its formula; saying nothing keeps the old behaviour exactly.
 */
describe("who owns the roll", () => {
    it("is the table, once its formula says where damage goes", () => {
        expect(ownsItsRoll(authored)).toBe(true);
        expect(rollFormulaFor(authored)).toBe(`1d6 + ${DAMAGE_VARIABLE}`);
    });

    it("is the system, for a table that says nothing about damage", () => {
        expect(ownsItsRoll(shipped)).toBe(false);
        expect(rollFormulaFor(shipped)).toBe(DEFAULT_FORMULA);
    });

    it("is the system for a table that is missing, blank or nonsense", () => {
        expect(ownsItsRoll(null)).toBe(false);
        expect(ownsItsRoll({ formula: "   " })).toBe(false);
        expect(ownsItsRoll({ formula: 12 })).toBe(false);
        expect(rollFormulaFor(undefined)).toBe(DEFAULT_FORMULA);
    });

    it("reads a formula with room around it", () => {
        expect(tableFormula({ formula: "  1d12  " })).toBe("1d12");
        expect(tableFormula({})).toBe("");
    });
});

describe("the number the ranges are read against", () => {
    /**
     * The system's severity folds damage in itself, which is why an owning
     * table must not have it folded in twice.
     */
    it("is the system's severity when the system rolled", () => {
        expect(severityFor(shipped, { total: 8, damage: 5, entryCount: 12 }))
            .toBe(woundSeverity(8, 5, 12));
    });

    it("is the table's own total when the table rolled", () => {
        expect(severityFor(authored, { total: 8, damage: 5, entryCount: 12 })).toBe(8);
    });

    /** An owning table's total is whatever its formula produced -- no clamping. */
    it("is not squeezed into the shipped table's twelve", () => {
        expect(severityFor(authored, { total: 40, damage: 2, entryCount: 12 })).toBe(40);
        expect(severityFor(shipped, { total: 40, damage: 2, entryCount: 12 })).toBeLessThanOrEqual(12);
    });

    /**
     * Carried wounds read one row worse either way. A table that owns its
     * roll keeps its own ranges, so nothing clamps it back.
     */
    it("counts the wounds already carried, whoever rolled", () => {
        expect(severityFor(shipped, { total: 6, damage: 4, entryCount: 12, carried: 2 }))
            .toBe(woundSeverity(6, 4, 12, 2));
        expect(severityFor(authored, { total: 8, carried: 2 })).toBe(10);
    });

    it("leaves an unhurt character where they were", () => {
        expect(severityFor(authored, { total: 8, carried: 0 })).toBe(8);
        expect(severityFor(authored, { total: 8 })).toBe(8);
    });

    it("survives a total that never arrived", () => {
        expect(severityFor(authored, {})).toBe(0);
        expect(severityFor(authored, { total: 3.7 })).toBe(3);
    });
});

describe("finding the result for a value", () => {
    const results = [
        { range: [1, 3], text: "a" },
        { range: [4, 4], text: "b" },
        { range: [5, 99], text: "c" }
    ];

    it("reads the range, not the position", () => {
        expect(resultForValue(results, 2).text).toBe("a");
        expect(resultForValue(results, 4).text).toBe("b");
        expect(resultForValue(results, 50).text).toBe("c");
    });

    it("says so when nothing covers the value", () => {
        expect(resultForValue(results, 0)).toBeNull();
        expect(resultForValue(results, 100)).toBeNull();
        expect(resultForValue([], 1)).toBeNull();
        expect(resultForValue(undefined, 1)).toBeNull();
    });

    it("ignores a result with no usable range", () => {
        expect(resultForValue([{ text: "a" }, { range: [1, 2], text: "b" }], 1).text).toBe("b");
    });
});

/**
 * Foundry has spelled the document-result constant differently across versions,
 * so the shape is what gets checked.
 */
describe("a result that points at a document", () => {
    it("is recognised by what it carries", () => {
        expect(isDocumentResult({ documentId: "abc" })).toBe(true);
        expect(isDocumentResult({ documentUuid: "Item.abc" })).toBe(true);
        expect(isDocumentResult({ text: "A broken rib" })).toBe(false);
        expect(isDocumentResult(null)).toBe(false);
    });

    it("forms a uuid for a world document", () => {
        expect(resultUuid({ documentId: "abc", documentCollection: "Item" })).toBe("Item.abc");
    });

    it("forms a uuid for a compendium document", () => {
        expect(resultUuid({ documentId: "abc", documentCollection: "glog2d6.wounds" }))
            .toBe("Compendium.glog2d6.wounds.Item.abc");
    });

    it("prefers a uuid the result already carries", () => {
        expect(resultUuid({ documentUuid: "Item.xyz", documentId: "abc", documentCollection: "Item" }))
            .toBe("Item.xyz");
    });

    it("forms none where it cannot", () => {
        expect(resultUuid({ documentId: "abc" })).toBeNull();
        expect(resultUuid({ text: "A broken rib" })).toBeNull();
    });
});

/** The payoff for making wounds documents: a drawn wound *is* the entry. */
describe("an authored wound read as a table entry", () => {
    const item = {
        id: "abc",
        name: "Shattered Kneecap",
        img: "knee.webp",
        type: WOUND_ITEM_TYPE,
        system: { typeId: "shattered-knee", description: "You do not run again.", effects: { movementReduction: 20 } }
    };

    it("becomes the entry the roll would otherwise have looked up", () => {
        expect(woundEntryFromItem(item)).toEqual({
            id: "shattered-knee",
            name: "Shattered Kneecap",
            img: "knee.webp",
            description: "You do not run again.",
            effects: { movementReduction: 20 }
        });
    });

    it("falls back to the document's own id when none was typed", () => {
        expect(woundEntryFromItem({ id: "abc", name: "A Wound", system: {} }).id).toBe("abc");
        expect(woundEntryFromItem({ id: "abc", name: "A Wound", system: {} }).effects).toEqual({});
    });

    /** Copied, so editing an applied wound cannot reach back into the source. */
    it("copies the effects rather than sharing them", () => {
        const entry = woundEntryFromItem(item);
        entry.effects.movementReduction = 0;
        expect(item.system.effects.movementReduction).toBe(20);
    });

    it("has nothing to say about a missing item", () => {
        expect(woundEntryFromItem(null)).toBeNull();
    });
});

describe("the system wires it up", () => {
    const trauma = read("module/actor/systems/actor-trauma-system.mjs");

    it("rolls what the table asks for, and passes it the damage", () => {
        expect(trauma).toContain("rollFormulaFor(worldTable)");
        expect(trauma).toContain("excess: this.damage");
    });

    it("stopped hard-coding the die and the table's length", () => {
        expect(trauma).not.toMatch(/new Roll\(`1d\$\{SEVERITY_DIE\}`\)/);
        expect(trauma).toContain("severityFor(worldTable");
    });

    /** The count is what is on the body, and a scar is not on the body. */
    it("counts the unhealed wounds a character is carrying", () => {
        expect(trauma).toContain("woundsFromItems(this.actor.items).length");
        expect(trauma).toContain("let carried = this._carriedWounds()");
    });

    /**
     * A wound taken a moment ago is one you are carrying, so the second of a
     * "take 2 wounds instead of 1" lands harder than the first.
     */
    it("counts a wound taken earlier in the same blow", () => {
        expect(trauma).toContain("this._rollWound(table, ++carried)");
    });

    it("takes an authored wound over anything matched back to the list", () => {
        expect(trauma).toContain("_authoredEntry(result)");
        expect(trauma).toContain("woundEntryFromItem(document)");
    });

    /**
     * A table that owns its roll has already counted the damage, so the chat
     * card must not read as though it were added on top a second time.
     */
    it("describes the roll in the table's own terms", () => {
        expect(trauma).toContain("_rollDetail(worldTable, roll, carried)");
        expect(trauma).toContain("Severity ${severity} (${detail})");
        expect(trauma).not.toContain("Severity ${severity} (d${SEVERITY_DIE} ${roll.total}");
    });

    /**
     * The shipped table stays a plain list, so every existing world keeps the
     * wounds it had.
     */
    it("leaves the shipped table behaving exactly as before", () => {
        const content = read("scripts/initialize-content.mjs");
        expect(content).toContain("formula: `1d${woundsData.length}`");
        expect(content).not.toContain(DAMAGE_VARIABLE);
        expect(ownsItsRoll({ formula: "1d12" })).toBe(false);
    });
});
