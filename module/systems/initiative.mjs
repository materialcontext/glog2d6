/**
 * Initiative, as the combat tracker rolls it.
 *
 * Foundry's `CONFIG.Combat.initiative.formula` defaults to `null`, and the
 * manifest carried no `initiative` field either, so the tracker had no formula
 * to roll with at all. This gives it one: 2d6 plus the better of your DEX and
 * WIS modifiers -- quickness or noticing first, whichever serves you.
 *
 * The formula reads a single derived number rather than reaching into
 * `@attributes.dex.effectiveMod` directly. A roll term that resolves to
 * undefined fails the whole roll, and `effectiveMod` only exists once derived
 * data has run -- which it has not for an actor that never opened its sheet,
 * and never does for the shapes NPCs and hirelings come in.
 */

export const INITIATIVE_FORMULA = "2d6 + @initiative";

/** 2d6 plus an integer is an integer; decimals here only add noise. */
export const INITIATIVE_DECIMALS = 0;

/** Initiative is the better of these two, not a fixed attribute. */
export const INITIATIVE_ATTRIBUTES = Object.freeze(["dex", "wis"]);

/**
 * One attribute's contribution: its effective modifier where wounds and
 * encumbrance have been applied, its plain modifier where they have not.
 *
 * `??` rather than `||`, so an effective modifier of zero counts as zero
 * instead of falling through to the unmodified value.
 */
function attributeModifier(attribute) {
    const mod = attribute?.effectiveMod ?? attribute?.mod ?? 0;
    const value = Number(mod);

    return Number.isFinite(value) ? value : 0;
}

/**
 * The modifier an actor adds to initiative: the better of DEX and WIS.
 *
 * Only attributes the actor actually has are considered. Treating an absent
 * one as zero would quietly floor a clumsy character at +0 rather than letting
 * their negative modifier stand.
 */
export function initiativeModifier(system = {}) {
    const attributes = system?.attributes ?? {};
    const present = INITIATIVE_ATTRIBUTES
        .filter(key => attributes?.[key] != null)
        .map(key => attributeModifier(attributes[key]));

    return present.length ? Math.max(...present) : 0;
}

/** The shape Foundry wants on CONFIG.Combat.initiative. */
export function initiativeConfig() {
    return { formula: INITIATIVE_FORMULA, decimals: INITIATIVE_DECIMALS };
}
