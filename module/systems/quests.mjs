/**
 * The quest domain: what a quest is, how far along it is, and who may see it.
 *
 * Plain data and pure functions only -- no Foundry globals -- so every rule
 * here is unit testable without a running client. The documents, the window
 * and the permissions are adapters over this.
 *
 * Shape, for orientation:
 *
 *   JournalEntry           one quest. Its state lives in flags, because
 *                          Foundry will not let a system subtype a
 *                          JournalEntry.
 *     JournalEntryPage     the brief: ordinary rich text, so the GM keeps the
 *                          whole journal editor.
 *     JournalEntryPage     an objective, one per page, typed
 *       (objective)        `glog2d6.objective`.
 *
 * Visibility is document ownership, never a field. A page a player may not
 * see is never sent to their client, which is also why a player's progress
 * count cannot leak the objectives they have not been shown: their client
 * counts what it has.
 */

export const FLAG_SCOPE = "glog2d6";

/** Marks a JournalEntry as a quest, so folders stay the GM's business. */
export const QUEST_FLAG = "quest";

/** The namespaced subtype key. Foundry prefixes package subtypes this way. */
export const OBJECTIVE_TYPE = "glog2d6.objective";

/* -------------------------------------------- */
/*  State                                       */
/* -------------------------------------------- */

export const QUEST_STATES = Object.freeze({
    ACTIVE: "active",
    COMPLETE: "complete",
    FAILED: "failed",
    DORMANT: "dormant"
});

export const DEFAULT_QUEST_STATE = QUEST_STATES.ACTIVE;

/**
 * The shipped states. A module adds to `CONFIG.GLOG.QUEST_STATES` rather than
 * editing this, which is why the UI reads labels through a lookup instead of
 * a switch.
 */
export const QUEST_STATE_LABELS = Object.freeze({
    active: "Active",
    complete: "Complete",
    failed: "Failed",
    dormant: "Dormant"
});

/** States that mean the quest is over, however it ended. */
export const FINISHED_STATES = Object.freeze([QUEST_STATES.COMPLETE, QUEST_STATES.FAILED]);

export function isFinished(state) {
    return FINISHED_STATES.includes(state);
}

/**
 * Order for the log: what is live first, then what is waiting, then what is
 * done. Within a band, by name.
 */
const STATE_ORDER = Object.freeze({ active: 0, dormant: 1, complete: 2, failed: 3 });

export function stateRank(state) {
    return STATE_ORDER[state] ?? STATE_ORDER[DEFAULT_QUEST_STATE];
}

export function questStateLabel(state, labels = QUEST_STATE_LABELS) {
    return labels[state] ?? labels[DEFAULT_QUEST_STATE] ?? "Active";
}

/* -------------------------------------------- */
/*  Counters                                    */
/* -------------------------------------------- */

const count = (value, fallback = 0) => {
    const number = Math.floor(Number(value));
    return Number.isFinite(number) ? number : fallback;
};

/**
 * How far along one objective is.
 *
 * Everything is a counter, including the ones that only ever reach one: a
 * lone checkbox among a column of "2/6" reads as a different kind of thing
 * when it is not one.
 */
export function objectiveProgress(system = {}) {
    const required = Math.max(1, count(system.required, 1));
    const current = Math.min(Math.max(0, count(system.current)), required);

    return {
        current,
        required,
        complete: current >= required,
        label: `${current}/${required}`,
        percent: Math.round((current / required) * 100)
    };
}

export function isObjectiveComplete(system) {
    return objectiveProgress(system).complete;
}

/** An advance, clamped to the objective's own bounds. */
export function advancedBy(system = {}, amount = 1) {
    const { current, required } = objectiveProgress(system);
    return Math.min(Math.max(0, current + count(amount)), required);
}

/**
 * How far along the whole quest is, counted over the objectives given.
 *
 * Only ever called with the objectives the caller actually holds, which for a
 * player is only the ones they have been shown -- so "2 of 3" is the truth
 * about their own list rather than a hint about the GM's.
 */
export function questProgress(objectives = []) {
    const states = [...objectives].map(objective => objectiveProgress(objective?.system ?? objective));
    const done = states.filter(state => state.complete).length;

    return {
        done,
        total: states.length,
        complete: states.length > 0 && done === states.length,
        label: `${done}/${states.length}`,
        percent: states.length ? Math.round((done / states.length) * 100) : 0
    };
}

/* -------------------------------------------- */
/*  Objective kinds                             */
/* -------------------------------------------- */

/**
 * What an objective is counting. A kind is data: a module adds one to
 * `CONFIG.GLOG.OBJECTIVE_KINDS` and the sheet offers it, the log labels it,
 * and anything that knows how to advance it can.
 */
export const OBJECTIVE_KINDS = Object.freeze({
    deed: { label: "Deed", icon: "fas fa-check" },
    find: { label: "Find", icon: "fas fa-gem" },
    slay: { label: "Slay", icon: "fas fa-skull" },
    reach: { label: "Reach", icon: "fas fa-map-signs" },
    deliver: { label: "Deliver", icon: "fas fa-box" }
});

export const DEFAULT_OBJECTIVE_KIND = "deed";

export function objectiveKind(kind, kinds = OBJECTIVE_KINDS) {
    return kinds[kind] ?? kinds[DEFAULT_OBJECTIVE_KIND] ?? { label: "Deed", icon: "fas fa-check" };
}

/* -------------------------------------------- */
/*  Reading the documents                       */
/* -------------------------------------------- */

/** Whether a journal entry is one of ours. */
export function isQuestEntry(entry) {
    return Boolean(entry?.flags?.[FLAG_SCOPE]?.[QUEST_FLAG]);
}

/** The quest-level data kept in flags, with everything filled in. */
export function questMeta(entry) {
    const stored = entry?.flags?.[FLAG_SCOPE] ?? {};

    return {
        state: stored.state ?? DEFAULT_QUEST_STATE,
        giver: stored.giver ?? "",
        reward: stored.reward ?? "",
        order: count(stored.order)
    };
}

/** Sort for the log: live work first, then by the GM's order, then by name. */
export function questOrder(a, b) {
    const left = questMeta(a);
    const right = questMeta(b);

    return stateRank(left.state) - stateRank(right.state)
        || left.order - right.order
        || String(a?.name ?? "").localeCompare(String(b?.name ?? ""));
}

/* -------------------------------------------- */
/*  Visibility                                  */
/* -------------------------------------------- */

/**
 * Foundry's ownership levels, named here so the rules below read as rules.
 * INHERIT is the one that matters: a page set to it follows its quest, which
 * is what lets "shown with the quest" and "hidden inside a shown quest" be
 * the same mechanism.
 */
export const OWNERSHIP = Object.freeze({
    INHERIT: -1,
    NONE: 0,
    LIMITED: 1,
    OBSERVER: 2,
    OWNER: 3
});

/** Players read quests; only the GM writes them. */
export const SHOWN = OWNERSHIP.OBSERVER;

/** What a quest's ownership becomes when the party does or does not know it. */
export function questVisibility(visible) {
    return { default: visible ? SHOWN : OWNERSHIP.NONE };
}

/**
 * What an objective's ownership becomes. Shown means following the quest, so
 * revealing a quest reveals the objectives that were never singled out.
 */
export function objectiveVisibility(visible) {
    return { default: visible ? OWNERSHIP.INHERIT : OWNERSHIP.NONE };
}

/**
 * Whether players can read something, given its level and its parent's.
 *
 * @param {number} level        the document's own `ownership.default`
 * @param {number} parentLevel  the parent's, for a page set to INHERIT
 */
export function shownToPlayers(level, parentLevel = OWNERSHIP.NONE) {
    const effective = level === OWNERSHIP.INHERIT ? parentLevel : level;
    return Number(effective) >= SHOWN;
}

/** The level a document is currently set to, defaulting to hidden. */
export function ownershipLevel(document) {
    const level = document?.ownership?.default;
    return Number.isFinite(level) ? level : OWNERSHIP.NONE;
}
