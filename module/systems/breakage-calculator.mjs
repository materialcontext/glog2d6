/**
 * The breakage (condition) track, shared by every breakable item type.
 *
 * One track, one set of rules: Fine -> Damaged -> Broken. Weapons, armor and
 * shields all use it, so `maxLevel` is 2 everywhere and "broken" always means
 * `level >= BREAKAGE_MAX_LEVEL`.
 *
 * Pure functions only, so both the sheets and the actor systems can rely on
 * this without pulling in Foundry globals.
 */

/** Named positions on the condition track. */
export const BREAKAGE_LEVELS = Object.freeze({
    FINE: 0,
    DAMAGED: 1,
    BROKEN: 2
});

/** Highest level any breakable item can reach; reaching it means broken. */
export const BREAKAGE_MAX_LEVEL = BREAKAGE_LEVELS.BROKEN;

/** Display labels, also used as the condition dropdown on item sheets. */
export const BREAKAGE_LABELS = Object.freeze({
    0: "Fine",
    1: "Damaged",
    2: "Broken"
});

/** Item types that carry a condition track. */
export const BREAKABLE_TYPES = Object.freeze(["weapon", "armor", "shield"]);

export class BreakageCalculator {

    /* -------------------------------------------- */
    /*  Level handling                              */
    /* -------------------------------------------- */

    /**
     * Coerce any stored value into a valid level. Form submissions arrive as
     * strings and legacy items may carry out-of-range levels.
     *
     * @param {number|string|null|undefined} level
     * @returns {number} 0, 1 or 2
     */
    static normalizeLevel(level) {
        const numeric = Number(level);
        if (!Number.isFinite(numeric)) return BREAKAGE_LEVELS.FINE;
        return Math.min(Math.max(Math.floor(numeric), BREAKAGE_LEVELS.FINE), BREAKAGE_MAX_LEVEL);
    }

    static isBroken(level) {
        return this.normalizeLevel(level) >= BREAKAGE_MAX_LEVEL;
    }

    static isDamaged(level) {
        return this.normalizeLevel(level) === BREAKAGE_LEVELS.DAMAGED;
    }

    static isFine(level) {
        return this.normalizeLevel(level) === BREAKAGE_LEVELS.FINE;
    }

    /** The next level down the track, stopping at Broken. */
    static nextLevel(level) {
        return Math.min(this.normalizeLevel(level) + 1, BREAKAGE_MAX_LEVEL);
    }

    static label(level) {
        return BREAKAGE_LABELS[this.normalizeLevel(level)];
    }

    /** A fresh condition block for a newly created breakable item. */
    static defaultBreakage() {
        return { level: BREAKAGE_LEVELS.FINE, maxLevel: BREAKAGE_MAX_LEVEL };
    }

    /* -------------------------------------------- */
    /*  Effects                                     */
    /* -------------------------------------------- */

    /**
     * Damage formula for a weapon at a given condition.
     * @param {string} originalDamage
     * @param {number|string} breakageLevel
     * @returns {string}
     */
    static calculateWeaponDamage(originalDamage, breakageLevel) {
        if (this.isBroken(breakageLevel)) return "0";
        if (this.isFine(breakageLevel)) return originalDamage;
        return this.reduceDieSize(originalDamage);
    }

    static reduceDieSize(damageString) {
        const dieReductions = {
            '2d6': '2d4',
            '2d4': '2d2',
            'd12': 'd10',
            'd10': 'd8',
            'd8': 'd6',
            'd6': 'd4',
            'd4': 'd2',
            'd2': '1'
        };

        for (const [from, to] of Object.entries(dieReductions)) {
            if (damageString.includes(from)) {
                return damageString.replace(from, to);
            }
        }

        return damageString; // No reduction possible (like "1")
    }

    /**
     * Protection offered by armor or a shield at a given condition. Broken
     * protection is worth nothing, matching a broken weapon dealing no damage.
     *
     * @param {number} originalBonus
     * @param {number|string} breakageLevel
     * @returns {number}
     */
    static calculateArmorBonus(originalBonus, breakageLevel) {
        if (this.isBroken(breakageLevel)) return 0;
        return Math.max(0, (originalBonus || 0) - this.normalizeLevel(breakageLevel));
    }
}

/**
 * The breakage update an item needs in order to sit on the uniform track, or
 * null when it is already correct or not breakable at all.
 *
 * Pure, so the world migration can be tested without a running client.
 *
 * @param {{type?: string, system?: object}} item
 * @returns {Record<string, number>|null}
 */
export function breakageMigration(item) {
    if (!BREAKABLE_TYPES.includes(item?.type)) return null;

    const current = item.system?.breakage ?? {};
    const level = BreakageCalculator.normalizeLevel(current.level);

    if (current.level === level && current.maxLevel === BREAKAGE_MAX_LEVEL) return null;

    return {
        "system.breakage.level": level,
        "system.breakage.maxLevel": BREAKAGE_MAX_LEVEL
    };
}
