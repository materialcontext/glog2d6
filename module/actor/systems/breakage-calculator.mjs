// In module/systems/breakage-calculator.mjs
export class BreakageCalculator {
    static calculateWeaponDamage(originalDamage, breakageLevel) {
        if (breakageLevel >= 2) return "0"; // Broken
        if (breakageLevel === 0) return originalDamage; // Fine

        // Damaged - reduce die size
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

    static calculateArmorBonus(originalBonus, breakageLevel) {
        return Math.max(0, originalBonus - breakageLevel);
    }
}
