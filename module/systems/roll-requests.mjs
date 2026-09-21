/**
 * What the GM can call for, as data.
 *
 * A request is the GM naming a roll and who owes it; the players own the
 * button. Every kind of request used to be a formula except recon, which was
 * a boolean special case (`isRecon`) that forked the whole lifecycle into a
 * second system with its own chat message, its own socket and its own
 * cleanup. Here a type instead *names* what rolls it -- `rolls: "recon"` --
 * so the fork is one lookup rather than a branch, and a new kind of request
 * is a new entry rather than a new system.
 *
 * Pure: the catalogue and the sums are testable without a running game.
 */

import { initiativeModifier } from "./initiative.mjs";

export const SKILL_ATTRS = Object.freeze({
    sneak: "dex", hide: "wis", disguise: "int",
    reaction: "cha", diplomacy: "cha", intimidate: "cha"
});

/** The target a trauma save has to beat. */
export const TRAUMA_DC = 10;

function attributeMod(actor, key) {
    return Number(actor?.system?.attributes?.[key]?.effectiveMod) || 0;
}

function activeFeatures(actor) {
    const items = actor?.items ?? [];
    return items.filter?.(i => i?.type === "feature" && i?.system?.active) ?? [];
}

/**
 * Tough, or anything a GM wrote that says it helps with trauma. Matching on
 * the name is how the shipped content spells it.
 */
export function traumaBonus(actor) {
    const helps = activeFeatures(actor).some(f => f.name === "Tough" || String(f.name ?? "").includes("Trauma"));
    return helps ? 1 : 0;
}

export const ROLL_TYPES = Object.freeze({
    attribute: {
        name: "Attribute Check",
        fields: ["attribute", "target"],
        formula: "2d6 + @mod",
        data: (actor, { attribute }) => ({ mod: attributeMod(actor, attribute) })
    },
    save: {
        name: "Save",
        fields: ["attribute", "target"],
        formula: "2d6 + @mod + @save",
        data: (actor, { attribute }) => ({
            mod: attributeMod(actor, attribute),
            save: Number(actor?.system?.saves?.[attribute]?.bonus) || 0
        })
    },
    skill: {
        name: "Skill Check",
        fields: ["skill", "target"],
        formula: "2d6 + @mod + @skill",
        data: (actor, { skill }) => ({
            mod: attributeMod(actor, SKILL_ATTRS[skill] ?? "cha"),
            skill: Number(actor?.system?.skills?.[skill]?.bonus) || 0
        })
    },
    // Shares systems/initiative with the combat tracker, so the two cannot
    // drift into disagreeing about what initiative is.
    initiative: {
        name: "Initiative",
        fields: [],
        formula: "2d6 + @initiative",
        data: (actor) => ({ initiative: initiativeModifier(actor?.system) })
    },
    /**
     * The GM calls for the save; failing it offers the wound rather than
     * imposing one, and the blow that caused it rides along so the wound is
     * rolled on the attacker's table and against the right anatomy.
     */
    trauma: {
        name: "Trauma Save",
        fields: ["damage", "attacker", "woundTable"],
        formula: "2d6 + @con + @trauma",
        dc: TRAUMA_DC,
        data: (actor) => ({ con: attributeMod(actor, "con"), trauma: traumaBonus(actor) })
    },
    recon: {
        name: "Recon Check",
        fields: ["location"],
        rolls: "recon"
    }
});

export function rollType(type) {
    return ROLL_TYPES[type] ?? null;
}

/** The types a request dialog offers, in the order they are declared. */
export function rollTypeOptions() {
    return Object.entries(ROLL_TYPES).map(([key, config]) => ({
        key,
        name: config.name,
        fields: config.fields ?? []
    }));
}

/** Whether a type wants a given input. Drives which groups the dialog shows. */
export function usesField(type, field) {
    return (rollType(type)?.fields ?? []).includes(field);
}

/**
 * What to roll for one actor, or null for a type that rolls itself. Keeping
 * this separate from the rolling is what lets the sums be checked without
 * dice.
 */
export function rollSpec(type, actor, params = {}) {
    const config = rollType(type);
    if (!config || config.rolls) return null;
    return { formula: config.formula, data: config.data(actor, params) };
}

/**
 * Whether a total passed. A type can carry its own target -- a trauma save is
 * always against 10 -- and the GM can name one for anything else.
 */
export function succeeded(type, total, params = {}) {
    const dc = rollType(type)?.dc ?? (params.target ? Number(params.target) : null);
    if (!Number.isFinite(dc) || dc === null) return undefined;
    return Number(total) >= dc;
}

/** The damage a trauma save is being made against, never below one. */
export function requestDamage(params = {}) {
    const damage = Math.floor(Number(params.damage));
    return Number.isFinite(damage) && damage > 0 ? damage : 1;
}

/** Whether everyone asked has now rolled. */
export function isComplete(request) {
    return (request?.results?.size ?? 0) >= (request?.actorIds?.length ?? 0);
}

/**
 * Whether a user may roll for an actor.
 *
 * Requests are executed on the GM's client, because that is where the request
 * lives -- so ownership has to be asked about the user who clicked rather
 * than about whoever is running the code.
 */
export function mayRollFor(actor, user) {
    if (!actor || !user) return false;
    if (user.isGM) return true;
    return Boolean(actor.testUserPermission?.(user, "OWNER"));
}
