/**
 * How a wound table decides what you got.
 *
 * The shipped table is a list of twelve, indexed by a severity the system
 * computes from the die and the damage. That coupling is what made a second
 * table hard to write: the table's *length* was load-bearing, so a table of
 * six and a table of twenty behaved completely differently from the same blow.
 *
 * A table can opt out by saying how damage enters its own formula. Write
 * `1d12 + @excess` and the table owns the roll: its formula is rolled as
 * written and its ranges are read against the total. Say nothing about damage
 * -- as the shipped `1d12` does -- and the system computes a severity as it
 * always has, so existing tables keep behaving exactly as before.
 */

import { SEVERITY_DIE, carriedBonus, woundSeverity } from "./wounds.mjs";

/** The damage a blow carried past your last hit point. */
export const DAMAGE_VARIABLE = "@excess";

/** What the system rolls for a table that has no opinion about damage. */
export const DEFAULT_FORMULA = `1d${SEVERITY_DIE}`;

export function tableFormula(table) {
    const formula = table?.formula;
    return typeof formula === "string" ? formula.trim() : "";
}

/**
 * A table owns its roll when its formula says how damage enters it. Anything
 * else is a plain list the system indexes into.
 */
export function ownsItsRoll(table) {
    return tableFormula(table).includes(DAMAGE_VARIABLE);
}

/** The formula to roll for this table. */
export function rollFormulaFor(table) {
    return ownsItsRoll(table) ? tableFormula(table) : DEFAULT_FORMULA;
}

/**
 * The number a table's ranges are read against: its own total when it owns the
 * roll, and a computed severity when it does not.
 */
export function severityFor(table, { total, damage, entryCount, carried = 0 } = {}) {
    // Wounds already carried push the lookup down the table either way. A
    // table that owns its roll keeps its own ranges, so nothing is clamped;
    // a plain list is still bounded by its own length.
    return ownsItsRoll(table)
        ? Math.floor(Number(total) || 0) + carriedBonus(carried)
        : woundSeverity(total, damage, entryCount, carried);
}

/** The result whose range covers a value. */
export function resultForValue(results = [], value) {
    return [...results].find(result => {
        const [low, high] = result?.range ?? [];
        return Number.isFinite(low) && Number.isFinite(high) && value >= low && value <= high;
    }) ?? null;
}

/**
 * Whether a table result points at a document rather than carrying text.
 * Foundry has spelled this constant differently across versions, so the shape
 * is what is checked rather than the name.
 */
export function isDocumentResult(result) {
    return Boolean(result?.documentId ?? result?.documentUuid);
}

/** The uuid a document result points at, where one can be formed. */
export function resultUuid(result) {
    if (result?.documentUuid) return String(result.documentUuid);
    if (!result?.documentId) return null;

    const collection = result.documentCollection;
    if (!collection) return null;

    // A compendium collection reads "pack.name"; a world one is a document name.
    return collection.includes(".")
        ? `Compendium.${collection}.Item.${result.documentId}`
        : `${collection}.${result.documentId}`;
}
