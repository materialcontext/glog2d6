/**
 * Get weapon types as an array, regardless of whether the data is a string or array.
 * Handles legacy string format for existing world items.
 */
export function getWeaponTypes(weapon) {
    const raw = weapon?.system?.weaponType;
    if (!raw) return ["melee"];
    if (!Array.isArray(raw)) return [raw];
    // The sheet writes an array, which is empty when every tag is unchecked.
    return raw.length ? raw : ["melee"];
}

/**
 * Check if a weapon has a given type tag.
 */
export function  hasWeaponType(weapon, type) {
    return getWeaponTypes(weapon).includes(type);
}
