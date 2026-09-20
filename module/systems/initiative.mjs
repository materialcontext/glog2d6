/**
 * Initiative, as the combat tracker rolls it.
 *
 * Foundry's `CONFIG.Combat.initiative.formula` defaults to `null`, and the
 * manifest carried no `initiative` field either, so the tracker had no formula
 * to roll with at all. This gives it one, and matches the house rule the GM
 * roll system already uses: 2d6 plus your DEX modifier.
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

/**
 * The modifier a given actor adds to initiative: their effective DEX where
 * wounds and encumbrance have been applied, their plain DEX where they have
 * not, and zero for anything without a DEX at all.
 */
export function initiativeModifier(system = {}) {
    const dex = system?.attributes?.dex ?? {};
    const mod = dex.effectiveMod ?? dex.mod ?? 0;
    const value = Number(mod);

    return Number.isFinite(value) ? value : 0;
}

/** The shape Foundry wants on CONFIG.Combat.initiative. */
export function initiativeConfig() {
    return { formula: INITIATIVE_FORMULA, decimals: INITIATIVE_DECIMALS };
}
