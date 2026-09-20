/**
 * Declarative configuration for GLOG2D6 item sheets.
 *
 * Everything in this module is plain data or a pure function. There are no
 * Foundry globals here on purpose: the sheet class stays a thin adapter, and
 * all of the domain rules below can be unit tested without a running client.
 *
 * To add a new item type: add an entry to ITEM_SHEET_CONFIG and drop a
 * matching `templates/item/item-<type>-sheet.hbs` next to the others.
 */

import { BREAKAGE_LABELS, BreakageCalculator } from "../systems/breakage-calculator.mjs";

const TEMPLATE_ROOT = "systems/glog2d6/templates/item";

/* -------------------------------------------- */
/*  Choice lists                                */
/* -------------------------------------------- */

export const ARMOR_TYPES = Object.freeze({
    light: "Light",
    medium: "Medium",
    heavy: "Heavy"
});

export const WEAPON_SIZES = Object.freeze({
    light: "Light",
    medium: "Medium",
    heavy: "Heavy"
});

export const GEAR_SIZES = Object.freeze({
    tiny: "Tiny",
    small: "Small",
    medium: "Medium",
    large: "Large"
});

export const WEAPON_TYPES = Object.freeze({
    melee: "Melee",
    ranged: "Ranged",
    thrown: "Thrown",
    explosive: "Explosive",
    firearm: "Firearm"
});

export const FEATURE_CLASS_SOURCES = Object.freeze({
    "": "No Class",
    Acrobat: "Acrobat",
    Assassin: "Assassin",
    Barbarian: "Barbarian",
    Courtier: "Courtier",
    Fighter: "Fighter",
    Hunter: "Hunter",
    Thief: "Thief",
    Wizard: "Wizard",
    Custom: "Custom"
});

export const FEATURE_TEMPLATES = Object.freeze({
    "level-0": "Level 0",
    A: "Template A",
    B: "Template B",
    C: "Template C",
    D: "Template D",
    X: "Template X",
    scar: "Scar",
    // Written before untemplated features settled on X. Kept in the list so a
    // feature already stored this way still shows its own value selected.
    custom: "Template X (legacy)"
});

export const LIGHT_ANIMATIONS = Object.freeze({
    "": "Static (No Animation)",
    torch: "Torch Flicker",
    pulse: "Pulse",
    chroma: "Chroma",
    wave: "Wave",
    fog: "Fog",
    sunburst: "Sunburst",
    dome: "Dome",
    emanation: "Emanation",
    hexa: "Hexa",
    ghost: "Ghost",
    energy: "Energy",
    roiling: "Roiling",
    hole: "Black Hole"
});

/**
 * Condition dropdown, shared by every breakable type. See
 * `module/systems/breakage-calculator.mjs` for the track itself.
 */
export const BREAKAGE_LEVELS = BREAKAGE_LABELS;

/**
 * The render context slice every breakable item needs: the condition list plus
 * the current level as a string, so `selectOptions` can match it.
 *
 * @param {object} system
 * @returns {{breakageLevels: Record<string, string>, breakageLevel: string}}
 */
export function breakageChoices(system = {}) {
    return {
        breakageLevels: BREAKAGE_LABELS,
        breakageLevel: String(BreakageCalculator.normalizeLevel(system.breakage?.level))
    };
}

/* -------------------------------------------- */
/*  Weapon type tags                            */
/* -------------------------------------------- */

/**
 * Normalise the stored `system.weaponType` into an array of tags. Legacy world
 * items store a bare string; the sheet writes an array.
 *
 * @param {string|string[]|null|undefined} raw
 * @returns {string[]}
 */
export function weaponTypeTags(raw) {
    if (Array.isArray(raw)) return raw.filter(t => t in WEAPON_TYPES);
    if (typeof raw === "string" && raw in WEAPON_TYPES) return [raw];
    return [];
}

/**
 * Checkbox descriptors for the weapon type tag list.
 *
 * @param {string|string[]} raw  Current `system.weaponType` value.
 * @returns {Array<{value: string, label: string, checked: boolean}>}
 */
export function weaponTypeOptions(raw) {
    const tags = weaponTypeTags(raw);
    return Object.entries(WEAPON_TYPES).map(([value, label]) => ({
        value,
        label,
        checked: tags.includes(value)
    }));
}

/* -------------------------------------------- */
/*  Derived stat blocks                         */
/* -------------------------------------------- */

const ARMOR_DEFAULTS = Object.freeze({
    light: Object.freeze({ armorBonus: 1, encumbrancePenalty: 0 }),
    medium: Object.freeze({ armorBonus: 2, encumbrancePenalty: 1 }),
    heavy: Object.freeze({ armorBonus: 3, encumbrancePenalty: 2 })
});

const MELEE_DEFAULTS = Object.freeze({
    light: Object.freeze({ damage: "1", slots: 1, attackPenalty: 0, encumbrancePenalty: 0 }),
    medium: Object.freeze({ damage: "1d6", slots: 1, attackPenalty: 0, encumbrancePenalty: 0 }),
    heavy: Object.freeze({ damage: "1d10", slots: 2, attackPenalty: 1, encumbrancePenalty: 1 })
});

const RANGED_DEFAULTS = Object.freeze({
    damage: "1d6", slots: 1, attackPenalty: 0, encumbrancePenalty: 0
});

/**
 * Baseline stats for an armor type.
 * @param {string} type
 * @returns {{armorBonus: number, encumbrancePenalty: number}}
 */
export function armorDefaults(type) {
    return { ...(ARMOR_DEFAULTS[type] ?? ARMOR_DEFAULTS.light) };
}

/**
 * Baseline stats for a weapon. A weapon tagged `melee` (or tagged with nothing
 * at all) uses the size table; anything purely at range uses the ranged block.
 *
 * @param {string|string[]} rawWeaponType
 * @param {string} size
 * @returns {{damage: string, slots: number, attackPenalty: number, encumbrancePenalty: number}}
 */
export function weaponDefaults(rawWeaponType, size) {
    const tags = weaponTypeTags(rawWeaponType);
    const isMelee = tags.length === 0 || tags.includes("melee");
    if (!isMelee) return { ...RANGED_DEFAULTS };
    return { ...(MELEE_DEFAULTS[size] ?? MELEE_DEFAULTS.medium) };
}

/* -------------------------------------------- */
/*  Per-type sheet configuration                */
/* -------------------------------------------- */

/**
 * A feature whose name reads "Reputation for ..." gets the reputation picker.
 * Matches the same rule `hasFeatureRoll` uses for rollable reputations.
 *
 * @param {string} name
 * @returns {boolean}
 */
export function isReputationFeature(name) {
    return typeof name === "string" && name.toLowerCase().includes("reputation for");
}

/**
 * @typedef {object} ItemSheetTypeConfig
 * @property {string}   [template]   Override for the derived template path.
 * @property {object}   [position]   Window size override.
 * @property {(item: {name: string, system: object}) => object} [choices]
 *   Extra render context (choice lists, precomputed selections) for this type.
 * @property {string[]} [autoFields]
 *   Top-level `system.*` fields whose change recomputes derived stats.
 * @property {(system: object) => object} [derive]
 *   Derived `system` values to write when one of `autoFields` changes.
 */

/** @type {Record<string, ItemSheetTypeConfig>} */
export const ITEM_SHEET_CONFIG = Object.freeze({
    weapon: {
        choices: ({ system }) => ({
            weaponSizes: WEAPON_SIZES,
            weaponTypes: weaponTypeOptions(system.weaponType),
            ...breakageChoices(system)
        }),
        autoFields: ["system.weaponType", "system.size"],
        derive: system => weaponDefaults(system.weaponType, system.size)
    },

    armor: {
        choices: ({ system }) => ({
            armorTypes: ARMOR_TYPES,
            ...breakageChoices(system)
        }),
        autoFields: ["system.type"],
        derive: system => armorDefaults(system.type)
    },

    gear: {
        choices: () => ({ gearSizes: GEAR_SIZES })
    },

    shield: {
        choices: ({ system }) => breakageChoices(system)
    },

    spell: {},

    feature: {
        position: { height: 560 },
        choices: ({ name }) => ({
            classSources: FEATURE_CLASS_SOURCES,
            featureTemplates: FEATURE_TEMPLATES,
            isReputationFeature: isReputationFeature(name)
        })
    },

    torch: {
        position: { height: 660 },
        choices: () => ({ lightAnimations: LIGHT_ANIMATIONS })
    },

    note: {
        position: { width: 480, height: 420 }
    }
});

/** Item types this system ships a sheet template for. */
export const ITEM_SHEET_TYPES = Object.freeze(Object.keys(ITEM_SHEET_CONFIG));

/**
 * Template path for an item type. Unknown types fall back to the gear sheet so
 * a mis-typed or module-added item still renders something editable.
 *
 * @param {string} type
 * @returns {string}
 */
export function itemSheetTemplate(type) {
    const config = ITEM_SHEET_CONFIG[type];
    if (config?.template) return config.template;
    const known = config ? type : "gear";
    return `${TEMPLATE_ROOT}/item-${known}-sheet.hbs`;
}

/** All sheet templates, for preloading. */
export function itemSheetTemplates() {
    return ITEM_SHEET_TYPES.map(itemSheetTemplate);
}

/**
 * Build the type-specific slice of the render context.
 *
 * @param {string} type
 * @param {{name?: string, system?: object}} item
 * @returns {object}
 */
export function itemSheetChoices(type, item = {}) {
    const source = { name: item.name ?? "", system: item.system ?? {} };
    return ITEM_SHEET_CONFIG[type]?.choices?.(source) ?? {};
}

/**
 * Names of the form fields that trigger a derived-stat refresh for a type.
 *
 * @param {string} type
 * @returns {string[]}
 */
export function autoFieldsFor(type) {
    return ITEM_SHEET_CONFIG[type]?.autoFields ?? [];
}

/** Shallow structural equality, good enough for scalars and tag arrays. */
function sameValue(a, b) {
    if (Array.isArray(a) || Array.isArray(b)) {
        const left = Array.isArray(a) ? a : [a];
        const right = Array.isArray(b) ? b : [b];
        return left.length === right.length && left.every((v, i) => v === right[i]);
    }
    return a === b;
}

/**
 * Did an edit touch any field that governs derived stats for this type?
 *
 * @param {string} type
 * @param {object} currentSystem  `system` data as currently stored.
 * @param {object} pendingSystem  `system` data as it will be after the edit.
 * @returns {boolean}
 */
export function autoFieldsChanged(type, currentSystem = {}, pendingSystem = {}) {
    return autoFieldsFor(type).some(field => {
        const key = field.replace(/^system\./, "");
        return !sameValue(currentSystem[key], pendingSystem[key]);
    });
}

/**
 * Compute the derived `system` update for a pending edit, or null when this
 * type has no derived stats.
 *
 * @param {string} type
 * @param {object} pendingSystem  The `system` data as it will be after the edit.
 * @returns {object|null}  A flattened update, e.g. `{"system.damage": "1d6"}`.
 */
export function deriveSystemUpdate(type, pendingSystem = {}) {
    const derive = ITEM_SHEET_CONFIG[type]?.derive;
    if (!derive) return null;
    return Object.fromEntries(
        Object.entries(derive(pendingSystem)).map(([key, value]) => [`system.${key}`, value])
    );
}
