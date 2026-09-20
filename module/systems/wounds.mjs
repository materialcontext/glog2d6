/**
 * The wound domain: severity, anatomy, treatment, recovery and scars.
 *
 * Plain data and pure functions only -- no Foundry globals -- so every rule
 * below is unit testable without a running client. `ActorTraumaSystem` is the
 * adapter that rolls dice and writes documents; the rules live here.
 */

/* -------------------------------------------- */
/*  Recovery track                              */
/* -------------------------------------------- */

/**
 * A wound moves untreated -> treated -> healing, and is only then removable.
 * Removing it leaves a scar rather than nothing.
 */
export const WOUND_STATES = Object.freeze({
    UNTREATED: "untreated",
    TREATED: "treated",
    HEALING: "healing"
});

export const WOUND_STATE_ORDER = Object.freeze([
    WOUND_STATES.UNTREATED,
    WOUND_STATES.TREATED,
    WOUND_STATES.HEALING
]);

export const WOUND_STATE_LABELS = Object.freeze({
    untreated: "Untreated",
    treated: "Treated",
    healing: "Healing"
});

/** What each `specialRemoval` tag demands before a wound counts as treated. */
export const TREATMENT_REQUIREMENTS = Object.freeze({
    revenge: "Get revenge on whoever did this",
    medical: "Be treated by a medical specialist",
    prosthetic: "Fit a prosthetic, or find magical replacement",
    last_wound: "Clear every other wound first",
    stitches: "Rest and have the wound stitched shut"
});

/**
 * What this wound needs before it can be treated.
 *
 * @param {object} wound
 * @returns {string}
 */
export function treatmentRequirement(wound) {
    const tag = wound?.effects?.specialRemoval;
    return TREATMENT_REQUIREMENTS[tag] ?? TREATMENT_REQUIREMENTS.stitches;
}

/**
 * The next state along the track, or null when already at the end.
 *
 * @param {string} state
 * @returns {string|null}
 */
export function nextWoundState(state) {
    const index = WOUND_STATE_ORDER.indexOf(state);
    if (index === -1) return WOUND_STATES.TREATED;
    return WOUND_STATE_ORDER[index + 1] ?? null;
}

/* -------------------------------------------- */
/*  Severity                                    */
/* -------------------------------------------- */

/** Faces on the severity die. */
export const SEVERITY_DIE = 12;

/**
 * Where a blow lands on the wound table.
 *
 * The old behaviour indexed the table directly by excess damage, so a given
 * damage total always produced the same wound. Here the damage sets the band
 * and the die sets the position within it: severity still climbs with damage,
 * but a light blow can turn nasty and a heavy one can glance off.
 *
 *   excess  1 -> entries 1-7
 *   excess  6 -> entries 4-9
 *   excess 12 -> entries 7-12
 *
 * @param {number} dieResult     A d12 result, 1..SEVERITY_DIE.
 * @param {number} excessDamage  Damage taken past 0 HP.
 * @param {number} tableSize     How many wounds the table holds.
 * @returns {number} A 1-based index into the wound table.
 */
export function woundSeverity(dieResult, excessDamage, tableSize) {
    const die = clampInt(dieResult, 1, SEVERITY_DIE);
    const excess = Math.max(1, Math.floor(Number(excessDamage) || 1));
    const size = Math.max(1, Math.floor(Number(tableSize) || 1));
    return clampInt(Math.ceil((die + excess) / 2), 1, size);
}

function clampInt(value, min, max) {
    const numeric = Math.floor(Number(value));
    if (!Number.isFinite(numeric)) return min;
    return Math.min(Math.max(numeric, min), max);
}

/* -------------------------------------------- */
/*  Anatomy                                     */
/* -------------------------------------------- */

/** The canonical 1d6 body part table, mirrored from wounds.json. */
export const BODY_PARTS = Object.freeze(["Leg", "Chest", "Arm", "Shoulder", "Abdomen", "Hand"]);

/**
 * Where a blow lands, biased by what struck you. Each row is still a d6 table,
 * so the canonical parts are unchanged -- only their odds move. A bullet finds
 * the body; an axe finds what you raised to stop it.
 */
export const BODY_PART_BIAS = Object.freeze({
    firearm: Object.freeze(["Chest", "Chest", "Abdomen", "Abdomen", "Shoulder", "Leg"]),
    ranged: Object.freeze(["Chest", "Abdomen", "Shoulder", "Leg", "Arm", "Chest"]),
    explosive: Object.freeze(["Leg", "Leg", "Abdomen", "Arm", "Hand", "Chest"]),
    melee: Object.freeze(["Arm", "Shoulder", "Leg", "Hand", "Chest", "Arm"]),
    thrown: Object.freeze(["Chest", "Shoulder", "Arm", "Leg", "Abdomen", "Hand"]),
    unarmed: Object.freeze(["Chest", "Abdomen", "Arm", "Shoulder", "Hand", "Chest"])
});

/**
 * Pick the bias row for a set of weapon tags. Ranged damage beats melee when a
 * weapon carries both, since the shot is what reached you.
 *
 * @param {string[]} weaponTags
 * @returns {readonly string[]}
 */
export function bodyPartTable(weaponTags = []) {
    const tags = Array.isArray(weaponTags) ? weaponTags : [weaponTags];
    for (const tag of ["firearm", "explosive", "ranged", "thrown", "melee"]) {
        if (tags.includes(tag)) return BODY_PART_BIAS[tag];
    }
    return BODY_PARTS;
}

/**
 * The body part a d6 lands on for a given damage source.
 *
 * @param {number} dieResult   A d6 result, 1..6.
 * @param {string[]} weaponTags
 * @returns {string}
 */
export function bodyPartFor(dieResult, weaponTags = []) {
    const table = bodyPartTable(weaponTags);
    return table[clampInt(dieResult, 1, table.length) - 1];
}

/* -------------------------------------------- */
/*  Wound instances                             */
/* -------------------------------------------- */

/**
 * Fill in fields a wound stored before recovery tracking existed. Applied on
 * read, so no world migration is needed and it is safe to run repeatedly.
 *
 * @param {object} wound
 * @returns {object}
 */
export function normalizeWound(wound) {
    if (!wound) return wound;
    const state = WOUND_STATE_ORDER.includes(wound.state) ? wound.state : WOUND_STATES.UNTREATED;
    return { ...wound, state, effects: wound.effects ?? {} };
}

/**
 * How many wounds one table entry inflicts. The nastiest entries declare
 * `multipleWounds`, which was previously read by nothing.
 *
 * @param {object} woundEntry
 * @returns {number}
 */
export function woundCount(woundEntry) {
    return Math.max(1, Math.floor(Number(woundEntry?.effects?.multipleWounds) || 1));
}

/**
 * The max-HP reroll a wound promises on removal. Every wound description ends
 * with some version of "reroll your max HP and keep it if higher".
 *
 * @param {object} wound
 * @returns {string|null}
 */
export function hpRerollFormula(wound) {
    const formula = wound?.effects?.hpReroll;
    return typeof formula === "string" && /^\d*d\d+$/.test(formula) ? formula : null;
}

/* -------------------------------------------- */
/*  Aggregate effects                           */
/* -------------------------------------------- */

const EMPTY_PENALTIES = () => ({
    stats: { str: 0, dex: 0, con: 0, int: 0, wis: 0, cha: 0 },
    movement: 0,
    healing: false,
    extendedHealing: false,
    deathOnFailure: false,
    sleepDisruption: 0,
    combatEffects: [],
    attackPenalty: 0,
    defensePenalty: 0,
    reactionPenalty: 0
});

/**
 * Total up what a set of wounds does to a character.
 *
 * Honours `stacks: false`, which nothing read before: a second Hobbled used to
 * pile another penalty on top of the first despite its own text saying it does
 * not stack. Also surfaces the flags the data has always declared and no code
 * ever looked at -- extended healing, death on a failed save, disrupted sleep
 * and combat effects.
 *
 * @param {object[]} wounds       Wound instances from `system.wounds.list`.
 * @param {object[]} definitions  The wound table (CONFIG.GLOG.WOUNDS.wounds).
 * @returns {object}
 */
export function aggregateWoundEffects(wounds = [], definitions = []) {
    const penalties = EMPTY_PENALTIES();
    const byId = new Map(definitions.map(entry => [entry.id, entry]));
    const counted = new Set();

    for (const wound of wounds) {
        const entry = byId.get(wound?.typeId);
        const effects = entry?.effects ?? wound?.effects;
        if (!effects) continue;

        // A non-stacking wound contributes once no matter how many you carry.
        if (effects.stacks === false) {
            if (counted.has(wound.typeId)) continue;
            counted.add(wound.typeId);
        }

        for (const [stat, value] of Object.entries(effects.statReduction ?? {})) {
            if (stat in penalties.stats) penalties.stats[stat] += Number(value) || 0;
        }

        if (effects.movementReduction) {
            penalties.movement = Math.max(penalties.movement, Number(effects.movementReduction) || 0);
        }
        if (effects.sleepDisruption) {
            penalties.sleepDisruption = Math.max(penalties.sleepDisruption, Number(effects.sleepDisruption) || 0);
        }

        if (effects.noHealing) penalties.healing = true;
        if (effects.extendedHealing) penalties.extendedHealing = true;
        if (effects.deathOnFailure) penalties.deathOnFailure = true;

        if (effects.combatEffect && !penalties.combatEffects.includes(effects.combatEffect)) {
            penalties.combatEffects.push(effects.combatEffect);
        }

        penalties.attackPenalty += Number(effects.attackPenalty) || 0;
        penalties.defensePenalty += Number(effects.defensePenalty) || 0;
        penalties.reactionPenalty += Number(effects.reactionPenalty) || 0;
    }

    return penalties;
}

/* -------------------------------------------- */
/*  Recovery                                    */
/* -------------------------------------------- */

const DURATION_UNITS = Object.freeze({
    day: 86400000,
    week: 604800000,
    month: 2629800000,
    year: 31557600000
});

/**
 * Parse a duration tag such as "3months" into milliseconds.
 *
 * @param {string} duration
 * @returns {number|null}
 */
export function parseDuration(duration) {
    const match = /^(\d+)\s*(day|week|month|year)s?$/i.exec(String(duration ?? "").trim());
    if (!match) return null;
    return Number(match[1]) * DURATION_UNITS[match[2].toLowerCase()];
}

/**
 * Has a wound with `autoRemoval` outlasted its own timer?
 *
 * @param {object} wound
 * @param {number} now  Epoch milliseconds.
 * @returns {boolean}
 */
export function autoRemovalElapsed(wound, now = Date.now()) {
    const span = parseDuration(wound?.effects?.autoRemoval);
    if (span === null) return false;

    const acquired = Date.parse(wound?.dateAcquired ?? "");
    if (Number.isNaN(acquired)) return false;

    return now - acquired >= span;
}

/**
 * Whether a wound can be cleared right now, and why not if it cannot.
 *
 * @param {object} wound
 * @param {object[]} allWounds  Every wound the character carries.
 * @param {number} now          Epoch milliseconds.
 * @returns {{allowed: boolean, reason: string}}
 */
export function woundRemoval(wound, allWounds = [], now = Date.now()) {
    const normalized = normalizeWound(wound);

    // Time heals some things whether or not anyone treated them.
    if (autoRemovalElapsed(normalized, now)) {
        return { allowed: true, reason: "Healed with time" };
    }

    if (normalized.effects?.specialRemoval === "last_wound") {
        const others = allWounds.filter(other => other?.id !== normalized.id);
        if (others.length) {
            return { allowed: false, reason: TREATMENT_REQUIREMENTS.last_wound };
        }
    }

    if (normalized.state === WOUND_STATES.UNTREATED) {
        return { allowed: false, reason: treatmentRequirement(normalized) };
    }

    if (normalized.state === WOUND_STATES.TREATED) {
        return { allowed: false, reason: "Rest and recover hit points to start healing" };
    }

    return { allowed: true, reason: "Healed" };
}

/* -------------------------------------------- */
/*  Scars                                       */
/* -------------------------------------------- */

/**
 * What a healed wound leaves behind: an inactive feature, so nothing in the
 * bonus, roll or recon systems picks it up, but the sheet still remembers.
 *
 * @param {object} wound
 * @returns {object} Item creation data.
 */
export function scarFromWound(wound) {
    const normalized = normalizeWound(wound) ?? {};
    const place = normalized.bodyPart ? `${normalized.bodyPart}` : normalized.name;
    const taken = Number.isNaN(Date.parse(normalized.dateAcquired ?? ""))
        ? null
        : new Date(normalized.dateAcquired);

    const lines = [`Left by ${normalized.name ?? "a wound"}.`];
    if (normalized.bodyPart) lines.push(`Took it in the ${normalized.bodyPart.toLowerCase()}.`);
    if (normalized.maimedResult) lines.push(normalized.maimedResult);
    if (taken) lines.push(`Suffered ${taken.toLocaleDateString()}.`);

    return {
        name: `Scar: ${place ?? "Old Wound"}`,
        type: "feature",
        system: {
            description: lines.join(" "),
            classSource: "",
            template: "scar",
            level: 1,
            // Inactive on purpose: every feature consumer filters on `active`,
            // so a scar is history rather than a mechanical bonus.
            active: false,
            prerequisites: "",
            reputationType: ""
        }
    };
}

/* -------------------------------------------- */
/*  Presentation                                */
/* -------------------------------------------- */

/** Human readings of the `combatEffect` tags the data declares. */
export const COMBAT_EFFECT_LABELS = Object.freeze({
    unconscious_check: "Roll to stay conscious when struck"
});

/**
 * @param {string} effect
 * @returns {string}
 */
export function combatEffectLabel(effect) {
    return COMBAT_EFFECT_LABELS[effect] ?? String(effect ?? "").replace(/_/g, " ");
}

/**
 * Wounds ready for the sheet: normalised, with their recovery state and what
 * is standing between them and being cleared.
 *
 * @param {object[]} wounds
 * @param {number} now
 * @returns {object[]}
 */
export function decorateWounds(wounds = [], now = Date.now()) {
    const normalized = wounds.map(normalizeWound);
    return normalized.map(wound => ({
        ...wound,
        stateLabel: WOUND_STATE_LABELS[wound.state],
        nextState: nextWoundState(wound.state),
        removal: woundRemoval(wound, normalized, now)
    }));
}
