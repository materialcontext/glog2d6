/**
 * Get weapon types as an array, regardless of whether the data is a string or array.
 * Handles legacy string format for existing world items.
 */
export function getWeaponTypes(weapon) {
    const raw = weapon?.system?.weaponType;
    if (!raw) return ["melee"];
    return Array.isArray(raw) ? raw : [raw];
}

/**
 * Check if a weapon has a given type tag.
 */
export function  hasWeaponType(weapon, type) {
    return getWeaponTypes(weapon).includes(type);
}
