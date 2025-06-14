// module/utils/actor-analysis.mjs

/**
 * Analyze equipped weapons from an items collection
 * @param {Collection} items - The actor's items collection
 * @returns {Object} Weapon analysis object
 */
export function getClassTemplateCount(items, className) {
    if (!items || items.size === 0) {
        return 0;
    }

    const classFeatures = items.filter(i =>
        i &&
        i.type === "feature" &&
        i.system &&
        i.system.active &&
        i.system.classSource === className
    );

    const templates = new Set();
    for (const feature of classFeatures) {
        if (feature.system && feature.system.template) {
            templates.add(feature.system.template);
        }
    }

    return templates.size;
}

export function analyzeEquippedWeapons(items) {
    console.log("🗡️ analyzeEquippedWeapons called");
    console.log("🗡️ items:", items);
    console.log("🗡️ items.size:", items?.size);

    if (!items || items.size === 0) {
        return { hasWeapons: false, attackButtonType: 'generic' };
    }

    // Debug all weapons first
    const allWeapons = items.filter(i => i.type === "weapon");
    console.log("🗡️ All weapons found:", allWeapons.length);

    allWeapons.forEach((weapon, index) => {
        console.log(`🗡️ Weapon ${index}:`, {
            name: weapon.name,
            type: weapon.type,
            hasSystem: !!weapon.system,
            system: weapon.system,
            systemKeys: weapon.system ? Object.keys(weapon.system) : 'no system',
            weaponType: weapon.system?.weaponType,
            equipped: weapon.system?.equipped
        });
    });

    const equippedWeapons = items.filter(i =>
        i &&
        i.type === "weapon" &&
        i.system &&
        i.system.equipped
    );

    console.log("🗡️ Equipped weapons:", equippedWeapons.length);
    const analysis = {
        hasWeapons: equippedWeapons.length > 0,
        weaponCount: equippedWeapons.length,
        primaryWeapon: null,
        weaponTypes: new Set(),
        hasThrowable: false,
        attackButtonType: 'generic',
        throwableWeapon: null,
        meleeWeapons: [],
        rangedWeapons: []
    };

    if (equippedWeapons.length === 0) {
        return analysis;
    }

    // Categorize weapons
    for (const weapon of equippedWeapons) {
        if (!weapon.system) {
            console.warn("Weapon missing system data:", weapon);
            continue;
        }

        const type = weapon.system?.weaponType || 'melee';
        analysis.weaponTypes.add(type);

        if (type === 'thrown') {
            analysis.hasThrowable = true;
            analysis.throwableWeapon = weapon;
            analysis.meleeWeapons.push(weapon);
        } else if (type === 'ranged') {
            analysis.rangedWeapons.push(weapon);
        } else {
            analysis.meleeWeapons.push(weapon);
        }
    }

    // Determine primary weapon
    analysis.primaryWeapon = findBestWeapon(equippedWeapons);

    // Determine attack button type
    if (analysis.hasThrowable && analysis.meleeWeapons.length > 1) {
        analysis.attackButtonType = 'split';
    } else if (analysis.rangedWeapons.length > 0 && analysis.meleeWeapons.length === 0) {
        analysis.attackButtonType = 'ranged';
    } else if (analysis.meleeWeapons.length > 0 && analysis.rangedWeapons.length === 0) {
        analysis.attackButtonType = 'melee';
    } else if (analysis.weaponTypes.size > 1) {
        analysis.attackButtonType = 'split';
    }

    return analysis;
}

export function hasFeature(items, ...featureNames) {
    // Enhanced safety checks
    if (!items) {
        console.warn('hasFeature called with null/undefined items collection');
        return false;
    }

    // Handle both Collection and Array types
    const itemsArray = items.size !== undefined ? Array.from(items) : items;

    if (!itemsArray || itemsArray.length === 0) {
        return false;
    }

    if (!featureNames || featureNames.length === 0) {
        console.warn('hasFeature called without feature names');
        return false;
    }

    try {
        return featureNames.some(name => {
            if (!name) return false;

            return itemsArray.some(item => {
                if (!item || item.type !== "feature") return false;
                if (!item.system) return false;
                if (!item.system.active) return false;
                if (!item.name) return false;

                return item.name === name;
            });
        });
    } catch (error) {
        console.error('Error in hasFeature:', error, { items: itemsArray, featureNames });
        return false;
    }
}

/**
 * Find the best weapon from a list
 * @param {Array} weapons - Array of weapon items
 * @returns {Object|null} The best weapon or null
 */
export function findBestWeapon(weapons) {
    if (weapons.length === 0) return null;
    if (weapons.length === 1) return weapons[0];

    const sizePriority = { heavy: 3, medium: 2, light: 1 };

    return weapons.reduce((best, current) => {
        const priorityA = sizePriority[current.system?.size] || 1;
        const priorityB = sizePriority[best.system?.size] || 1;

        if (priorityA !== priorityB) {
            return priorityA > priorityB ? current : best;
        }

        const damageA = calculateDamageScore(current.system?.damage);
        const damageB = calculateDamageScore(best.system?.damage);
        return damageA > damageB ? current : best;
    });
}

function calculateDamageScore(damage) {
    if (!damage) return 0;
    const numbers = damage.match(/\d+/g) || [];
    return numbers.reduce((sum, n) => sum + parseInt(n), 0);
}
