/**
 * The quest log: a window of its own.
 *
 * Foundry will not let a system add a Document collection, so "a dedicated
 * space" is an Application over documents that live in the journal. The
 * window is the good way in; the journal sidebar still shows them, which is
 * no loss.
 *
 * The player view needs no filtering. A quest or an objective a player may
 * not see was never sent to their client, so their log is simply what they
 * have -- which is why their progress count cannot leak the objectives they
 * have not been shown.
 */

import {
    FLAG_SCOPE,
    OBJECTIVE_TYPE,
    QUEST_FLAG,
    objectiveKind,
    objectiveProgress,
    ownershipLevel,
    questMeta,
    questOrder,
    questProgress,
    questStateLabel,
    shownToPlayers
} from "../systems/quests.mjs";
import { advanceObjective, setQuestState, setVisible } from "./quest-system.mjs";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

/** Every quest this client holds, which for a player is every one they may read. */
export function questEntries() {
    return [...(game.journal ?? [])]
        .filter(entry => entry.getFlag?.(FLAG_SCOPE, QUEST_FLAG))
        .sort(questOrder);
}

/** The objective pages of a quest, in the GM's order. */
export function objectivePages(entry) {
    return [...(entry.pages ?? [])]
        .filter(page => page.type === OBJECTIVE_TYPE)
        .sort((a, b) => (a.sort ?? 0) - (b.sort ?? 0));
}

/** The brief: the first page that is not an objective. */
export function briefPage(entry) {
    return [...(entry.pages ?? [])].find(page => page.type !== OBJECTIVE_TYPE) ?? null;
}

/** One quest, as the window renders it. */
export function questView(entry, { isGM }) {
    const meta = questMeta(entry);
    const pages = objectivePages(entry);
    const questLevel = ownershipLevel(entry);

    const objectives = pages.map(page => {
        const progress = objectiveProgress(page.system);
        return {
            uuid: page.uuid,
            name: page.name,
            description: page.system?.description ?? "",
            secret: isGM ? page.system?.secret ?? "" : "",
            kind: objectiveKind(page.system?.kind, CONFIG.GLOG.OBJECTIVE_KINDS),
            progress,
            shown: shownToPlayers(ownershipLevel(page), questLevel)
        };
    });

    return {
        uuid: entry.uuid,
        name: entry.name,
        state: meta.state,
        stateLabel: questStateLabel(meta.state, CONFIG.GLOG.QUEST_STATES),
        giver: meta.giver,
        reward: meta.reward,
        brief: briefPage(entry)?.uuid ?? "",
        objectives,
        progress: questProgress(pages),
        shown: shownToPlayers(questLevel),
        note: currentNote(entry.uuid)
    };
}

/* -------------------------------------------- */
/*  Player notes                                */
/* -------------------------------------------- */

/**
 * A player's own notes live on the player, not on the quest.
 *
 * A user may always write their own flags, so this needs no relay and no
 * widening of what a player owns -- and nobody can overwrite anyone else's
 * note, by construction rather than by care.
 */
export function currentNote(questUuid) {
    const notes = game.user?.getFlag?.(FLAG_SCOPE, "questNotes") ?? {};
    return notes[noteKey(questUuid)] ?? "";
}

export async function saveNote(questUuid, text) {
    const notes = { ...(game.user.getFlag(FLAG_SCOPE, "questNotes") ?? {}) };
    notes[noteKey(questUuid)] = String(text ?? "");
    return game.user.setFlag(FLAG_SCOPE, "questNotes", notes);
}

/** A uuid has dots in it, and a flag path reads dots as nesting. */
function noteKey(uuid) {
    return String(uuid ?? "").replaceAll(".", "_");
}

/* -------------------------------------------- */
/*  The window                                  */
/* -------------------------------------------- */

export class QuestLog extends HandlebarsApplicationMixin(ApplicationV2) {
    static DEFAULT_OPTIONS = {
        id: "glog-quest-log",
        classes: ["glog2d6", "glog-quest-log"],
        position: { width: 560, height: 680 },
        window: { title: "Quest Log", icon: "fas fa-scroll", resizable: true },
        actions: {
            toggleQuest: QuestLog.#onToggleQuest,
            toggleObjective: QuestLog.#onToggleObjective,
            advance: QuestLog.#onAdvance,
            setState: QuestLog.#onSetState,
            openBrief: QuestLog.#onOpenBrief,
            editQuest: QuestLog.#onEditQuest
        }
    };

    static PARTS = {
        body: { template: "systems/glog2d6/templates/quests/quest-log.hbs", scrollable: [".glog-quest-list"] }
    };

    async _prepareContext() {
        const isGM = game.user.isGM;

        return {
            isGM,
            quests: questEntries().map(entry => questView(entry, { isGM })),
            states: Object.entries(CONFIG.GLOG.QUEST_STATES ?? {}).map(([key, label]) => ({ key, label }))
        };
    }

    _onRender(context, options) {
        super._onRender?.(context, options);

        for (const field of this.element.querySelectorAll("[data-note-for]")) {
            field.addEventListener("change", async event => {
                await saveNote(event.currentTarget.dataset.noteFor, event.currentTarget.value);
            });
        }

        Hooks.callAll("glog2d6.questLogRendered", this, this.element, context);
    }

    static async #onToggleQuest(event, target) {
        await setVisible(target.dataset.uuid, target.dataset.shown !== "true");
        this.render();
    }

    static async #onToggleObjective(event, target) {
        await setVisible(target.dataset.uuid, target.dataset.shown !== "true");
        this.render();
    }

    static async #onAdvance(event, target) {
        await advanceObjective(target.dataset.uuid, Number(target.dataset.by) || 1);
        this.render();
    }

    static async #onSetState(event, target) {
        await setQuestState(target.dataset.uuid, target.value);
        this.render();
    }

    static async #onOpenBrief(event, target) {
        const page = target.dataset.uuid ? await fromUuid(target.dataset.uuid) : null;
        page?.parent?.sheet?.render(true, { pageId: page.id });
    }

    static async #onEditQuest(event, target) {
        const entry = await fromUuid(target.dataset.uuid);
        entry?.sheet?.render(true);
    }
}

/* -------------------------------------------- */
/*  Opening and closing it                      */
/* -------------------------------------------- */

let open = null;

/** Ctrl+Q both opens and closes, so the one key is the whole interaction. */
export function toggleQuestLog() {
    if (open?.rendered) {
        open.close();
        open = null;
        return null;
    }

    open ??= new QuestLog();
    open.render(true);
    return open;
}

/** Redraw an open log when the documents behind it move. */
export function refreshQuestLog() {
    if (open?.rendered) open.render();
}
