/**
 * The quest log, wired into a running game.
 *
 * The rules are in systems/quests, which knows nothing about Foundry. This is
 * the adapter: it registers the objective subtype and its sheet, gives the GM
 * sole authority over state through the existing relay, and exposes the small
 * surface a module extends.
 *
 * Nothing here reads `game` while setting up. Registration happens during
 * init -- keybindings must, and the relay handlers should, for the same
 * reason every chat button in this system is registered before init can
 * yield.
 */

import {
    OBJECTIVE_KINDS,
    OBJECTIVE_TYPE,
    QUEST_STATE_LABELS,
    advancedBy,
    objectiveVisibility,
    questVisibility
} from "../systems/quests.mjs";
import { RELAY, askTheGM, onlyTheGMCan } from "../systems/gm-relay.mjs";
import { ObjectiveModel } from "./objective-model.mjs";

/** Resolving a document a card or a click points at, by uuid. */
function documentFrom(uuid) {
    if (!uuid) return null;
    try {
        return fromUuidSync(uuid, { strict: false }) ?? null;
    } catch (error) {
        console.warn("glog2d6 | Could not resolve a quest document", uuid, error);
        return null;
    }
}

/* -------------------------------------------- */
/*  What only the GM may do                     */
/* -------------------------------------------- */

/**
 * Advance an objective.
 *
 * Players stay at observer, which is what "the GM owns the state" has to mean
 * if it is going to hold: a player cannot write the page, so the ask travels.
 * An objective kind that counts for itself runs on whichever client saw the
 * thing happen, and the same ask carries it home.
 */
export async function advanceObjective(uuid, by = 1) {
    return askTheGM(RELAY.ADVANCE_OBJECTIVE, { uuid, by });
}

/** Set a quest's state: active, complete, failed, dormant, or a module's own. */
export async function setQuestState(uuid, state) {
    return askTheGM(RELAY.SET_QUEST_STATE, { uuid, state });
}

/** Show or hide a quest, or one objective within it. */
export async function setVisible(uuid, visible) {
    return askTheGM(RELAY.SET_VISIBILITY, { uuid, visible });
}

async function applyAdvance({ uuid, by = 1 }) {
    const page = documentFrom(uuid);
    if (page?.type !== OBJECTIVE_TYPE) return null;

    const current = advancedBy(page.system, by);
    if (current === page.system.current) return null;

    await page.update({ "system.current": current });
    Hooks.callAll("glog2d6.objectiveAdvanced", page, current);
    return current;
}

async function applyState({ uuid, state }) {
    const entry = documentFrom(uuid);
    if (!entry) return null;

    const from = entry.getFlag("glog2d6", "state");
    if (from === state) return null;

    await entry.setFlag("glog2d6", "state", state);
    Hooks.callAll("glog2d6.questStateChanged", entry, from, state);
    return state;
}

async function applyVisibility({ uuid, visible }) {
    const document = documentFrom(uuid);
    if (!document) return null;

    // A quest is shown by being readable; an objective by following its quest.
    const ownership = document.documentName === "JournalEntryPage"
        ? objectiveVisibility(visible)
        : questVisibility(visible);

    await document.update({ ownership });
    Hooks.callAll("glog2d6.questVisibilityChanged", document, visible);
    return visible;
}

/* -------------------------------------------- */
/*  Setup                                       */
/* -------------------------------------------- */

/**
 * Registered during init, and touching no live game state while doing it.
 *
 * @param {() => void} toggleLog  opens or closes the log window.
 */
export function initQuests(toggleLog) {
    // Subtypes of anything but an Actor or an Item come from a data model
    // rather than template.json, under the key Foundry gives a package's own
    // subtypes.
    CONFIG.JournalEntryPage.dataModels[OBJECTIVE_TYPE] = ObjectiveModel;

    // Catalogues, not switches: a module adds an entry and the sheet offers
    // it, the log labels it, and anything that can advance it may.
    CONFIG.GLOG.QUEST_STATES = { ...QUEST_STATE_LABELS, ...(CONFIG.GLOG.QUEST_STATES ?? {}) };
    CONFIG.GLOG.OBJECTIVE_KINDS = { ...OBJECTIVE_KINDS, ...(CONFIG.GLOG.OBJECTIVE_KINDS ?? {}) };

    onlyTheGMCan(RELAY.ADVANCE_OBJECTIVE, applyAdvance);
    onlyTheGMCan(RELAY.SET_QUEST_STATE, applyState);
    onlyTheGMCan(RELAY.SET_VISIBILITY, applyVisibility);

    // Keybindings have to be registered before they are initialised, which
    // happens just after `setup` -- so during init or not at all.
    game.keybindings.register("glog2d6", "questLog", {
        name: "Quest Log",
        hint: "Open or close the quest log.",
        editable: [{ key: "KeyQ", modifiers: ["Control"] }],
        onDown: () => { toggleLog(); return true; },
        precedence: CONST.KEYBINDING_PRECEDENCE.NORMAL
    });
}

/* -------------------------------------------- */
/*  What a module extends                       */
/* -------------------------------------------- */

/**
 * The surface a module hooks into. Everything here is sugar over the
 * catalogues and the relay; a module that would rather write
 * `CONFIG.GLOG.OBJECTIVE_KINDS` itself is welcome to.
 */
export function questApi() {
    return {
        /** Add a kind of objective. `advance` is left to whoever sees it happen. */
        registerObjectiveKind(id, kind) {
            CONFIG.GLOG.OBJECTIVE_KINDS[id] = { label: id, icon: "fas fa-check", ...kind };
            return CONFIG.GLOG.OBJECTIVE_KINDS[id];
        },

        /** Add a state a quest can be in. */
        registerQuestState(id, label) {
            CONFIG.GLOG.QUEST_STATES[id] = label;
            return label;
        },

        advanceObjective,
        setQuestState,
        setVisible
    };
}
