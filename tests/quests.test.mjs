import { describe, expect, it } from "vitest";

import {
    DEFAULT_OBJECTIVE_KIND,
    DEFAULT_QUEST_STATE,
    OWNERSHIP,
    OBJECTIVE_KINDS,
    OBJECTIVE_TYPE,
    QUEST_STATES,
    advancedBy,
    isFinished,
    isObjectiveComplete,
    isQuestEntry,
    objectiveKind,
    objectiveProgress,
    objectiveVisibility,
    ownershipLevel,
    questMeta,
    questOrder,
    questProgress,
    questStateLabel,
    questVisibility,
    shownToPlayers,
    stateRank
} from "../module/systems/quests.mjs";

const entry = (name, flags = {}) => ({ name, flags: { glog2d6: flags } });
const objective = (current, required) => ({ system: { current, required } });

/**
 * Everything is a counter, including the ones that only ever reach one: a
 * lone checkbox among a column of "2/6" reads as a different kind of thing
 * when it is not one.
 */
describe("how far along one objective is", () => {
    it("counts toward what it needs", () => {
        expect(objectiveProgress({ current: 2, required: 6 })).toMatchObject({
            current: 2, required: 6, complete: false, label: "2/6"
        });
    });

    it("reads a one-step objective the same way as any other", () => {
        expect(objectiveProgress({ current: 0, required: 1 }).label).toBe("0/1");
        expect(objectiveProgress({ current: 1, required: 1 }).label).toBe("1/1");
    });

    it("is complete once it has what it needs", () => {
        expect(isObjectiveComplete({ current: 6, required: 6 })).toBe(true);
        expect(isObjectiveComplete({ current: 5, required: 6 })).toBe(false);
    });

    it("needs at least one of something", () => {
        expect(objectiveProgress({ required: 0 }).required).toBe(1);
        expect(objectiveProgress({}).label).toBe("0/1");
        expect(objectiveProgress().label).toBe("0/1");
    });

    it("never counts past what it needs, or below nothing", () => {
        expect(objectiveProgress({ current: 99, required: 6 }).current).toBe(6);
        expect(objectiveProgress({ current: -4, required: 6 }).current).toBe(0);
    });

    it("survives nonsense in either number", () => {
        expect(objectiveProgress({ current: "two", required: "six" })).toMatchObject({
            current: 0, required: 1
        });
    });

    it("reports a percentage for the bar", () => {
        expect(objectiveProgress({ current: 3, required: 6 }).percent).toBe(50);
        expect(objectiveProgress({ current: 0, required: 3 }).percent).toBe(0);
    });
});

describe("advancing one", () => {
    it("moves by however much happened", () => {
        expect(advancedBy({ current: 2, required: 6 }, 1)).toBe(3);
        expect(advancedBy({ current: 2, required: 6 }, 3)).toBe(5);
    });

    it("stops at what it needs", () => {
        expect(advancedBy({ current: 5, required: 6 }, 10)).toBe(6);
    });

    it("can be walked back, but not past nothing", () => {
        expect(advancedBy({ current: 3, required: 6 }, -2)).toBe(1);
        expect(advancedBy({ current: 1, required: 6 }, -9)).toBe(0);
    });

    it("moves by one when nobody said", () => {
        expect(advancedBy({ current: 0, required: 2 })).toBe(1);
    });
});

/**
 * A player's client only holds the objectives it was sent, so this counts
 * their own list rather than hinting at the GM's.
 */
describe("how far along the quest is", () => {
    it("counts the objectives that are done", () => {
        expect(questProgress([objective(6, 6), objective(1, 3), objective(0, 1)]))
            .toMatchObject({ done: 1, total: 3, complete: false, label: "1/3" });
    });

    it("is complete when every one of them is", () => {
        expect(questProgress([objective(2, 2), objective(1, 1)]).complete).toBe(true);
    });

    /** Nothing to do is not the same as everything done. */
    it("is not complete when there is nothing in it", () => {
        expect(questProgress([])).toMatchObject({ done: 0, total: 0, complete: false, percent: 0 });
        expect(questProgress()).toMatchObject({ total: 0 });
    });

    it("reads a bare system object as readily as a page", () => {
        expect(questProgress([{ current: 1, required: 1 }]).done).toBe(1);
    });
});

describe("quest state", () => {
    it("is active until something says otherwise", () => {
        expect(questMeta(entry("A Debt")).state).toBe(DEFAULT_QUEST_STATE);
        expect(questMeta(undefined).state).toBe(QUEST_STATES.ACTIVE);
    });

    it("knows which states mean it is over", () => {
        expect(isFinished(QUEST_STATES.COMPLETE)).toBe(true);
        expect(isFinished(QUEST_STATES.FAILED)).toBe(true);
        expect(isFinished(QUEST_STATES.ACTIVE)).toBe(false);
        expect(isFinished(QUEST_STATES.DORMANT)).toBe(false);
    });

    it("has a reading for every state it ships", () => {
        for (const state of Object.values(QUEST_STATES)) {
            expect(questStateLabel(state), state).toBeTruthy();
        }
    });

    /** A module's own state falls back rather than rendering blank. */
    it("falls back for a state it has never heard of", () => {
        expect(questStateLabel("haunted")).toBe("Active");
        expect(stateRank("haunted")).toBe(stateRank(DEFAULT_QUEST_STATE));
    });
});

describe("which journal entries are quests", () => {
    it("is the ones that say so, whatever folder they are in", () => {
        expect(isQuestEntry(entry("A Debt", { quest: true }))).toBe(true);
        expect(isQuestEntry(entry("Session Notes"))).toBe(false);
        expect(isQuestEntry(null)).toBe(false);
    });

    it("carries the GM's own fields alongside", () => {
        expect(questMeta(entry("A Debt", { giver: "The Reeve", reward: "40s", order: 2 })))
            .toMatchObject({ giver: "The Reeve", reward: "40s", order: 2 });
    });
});

describe("the order of the log", () => {
    const quest = (name, state, order = 0) => entry(name, { quest: true, state, order });

    it("puts live work above work that is over", () => {
        const sorted = [
            quest("Done", QUEST_STATES.COMPLETE),
            quest("Waiting", QUEST_STATES.DORMANT),
            quest("Now", QUEST_STATES.ACTIVE)
        ].sort(questOrder).map(q => q.name);

        expect(sorted).toEqual(["Now", "Waiting", "Done"]);
    });

    it("then follows the order the GM set", () => {
        const sorted = [
            quest("Second", QUEST_STATES.ACTIVE, 2),
            quest("First", QUEST_STATES.ACTIVE, 1)
        ].sort(questOrder).map(q => q.name);

        expect(sorted).toEqual(["First", "Second"]);
    });

    it("then by name, so the list never shuffles on its own", () => {
        const sorted = [quest("Beta", QUEST_STATES.ACTIVE), quest("Alpha", QUEST_STATES.ACTIVE)]
            .sort(questOrder).map(q => q.name);

        expect(sorted).toEqual(["Alpha", "Beta"]);
    });
});

describe("objective kinds", () => {
    it("names and pictures each one", () => {
        for (const [id, kind] of Object.entries(OBJECTIVE_KINDS)) {
            expect(kind.label, id).toBeTruthy();
            expect(kind.icon, id).toMatch(/^fas fa-/);
        }
    });

    /** A kind a module registered, and then stopped registering. */
    it("falls back rather than rendering a blank row", () => {
        expect(objectiveKind("harvest").label).toBe("Deed");
        expect(objectiveKind(undefined).label).toBe("Deed");
    });

    it("reads a module's kinds when it is given them", () => {
        const theirs = { harvest: { label: "Harvest", icon: "fas fa-wheat" } };
        expect(objectiveKind("harvest", theirs).label).toBe("Harvest");
    });
});

/** Foundry namespaces a package's subtypes; the sheet is registered by it. */
describe("the objective subtype", () => {
    it("is namespaced to this system", () => {
        expect(OBJECTIVE_TYPE).toBe("glog2d6.objective");
    });
});


/**
 * Visibility is ownership, never a field: a page a player may not see is
 * never sent to their client. A `revealed` boolean would leave the text in
 * their browser for anyone willing to open a console -- the same lesson the
 * subtle rolls taught.
 */
describe("who can see a quest", () => {
    it("is the party, once the GM says so", () => {
        expect(questVisibility(true)).toEqual({ default: OWNERSHIP.OBSERVER });
        expect(questVisibility(false)).toEqual({ default: OWNERSHIP.NONE });
    });

    /** Players read the log; the GM writes it. */
    it("is never more than reading", () => {
        expect(questVisibility(true).default).toBeLessThan(OWNERSHIP.OWNER);
    });
});

describe("who can see one objective", () => {
    /**
     * Shown means following the quest, so revealing a quest also reveals the
     * objectives nobody ever singled out.
     */
    it("follows the quest unless it was singled out", () => {
        expect(objectiveVisibility(true)).toEqual({ default: OWNERSHIP.INHERIT });
        expect(objectiveVisibility(false)).toEqual({ default: OWNERSHIP.NONE });
    });

    it("is hidden inside a quest the party can otherwise read", () => {
        expect(shownToPlayers(OWNERSHIP.NONE, OWNERSHIP.OBSERVER)).toBe(false);
    });

    it("is shown when it inherits from a quest the party can read", () => {
        expect(shownToPlayers(OWNERSHIP.INHERIT, OWNERSHIP.OBSERVER)).toBe(true);
    });

    /** An objective marked shown inside a hidden quest is still hidden. */
    it("cannot be shown inside a quest the party does not have", () => {
        expect(shownToPlayers(OWNERSHIP.INHERIT, OWNERSHIP.NONE)).toBe(false);
    });

    it("reads a missing level as hidden rather than as shown", () => {
        expect(ownershipLevel(undefined)).toBe(OWNERSHIP.NONE);
        expect(ownershipLevel({ ownership: {} })).toBe(OWNERSHIP.NONE);
        expect(ownershipLevel({ ownership: { default: OWNERSHIP.OBSERVER } })).toBe(OWNERSHIP.OBSERVER);
    });

    /** Limited is enough to know a thing exists, not to read it. */
    it("does not count a glimpse as having been shown", () => {
        expect(shownToPlayers(OWNERSHIP.LIMITED)).toBe(false);
    });
});

/* -------------------------------------------- */
/*  The objective's schema                      */
/* -------------------------------------------- */

const { ObjectiveModel } = await import("../module/quests/objective-model.mjs");

describe("what an objective stores", () => {
    const schema = ObjectiveModel.defineSchema();

    it("counts toward a requirement, and nothing else", () => {
        expect(schema.current).toMatchObject({ kind: "number", integer: true, initial: 0, min: 0 });
        expect(schema.required).toMatchObject({ kind: "number", integer: true, initial: 1, min: 1 });
    });

    /** One of something is the smallest an objective can ask for. */
    it("never asks for nothing", () => {
        expect(schema.required.min).toBe(1);
    });

    it("says what it is counting", () => {
        expect(schema.kind).toMatchObject({ kind: "string", initial: DEFAULT_OBJECTIVE_KIND });
    });

    /**
     * Rich text both ways, and declared in the manifest: the GM writes what
     * the party is told and what only they know in the same editor.
     */
    it("holds prose for the party and prose for the GM", () => {
        expect(schema.description.kind).toBe("html");
        expect(schema.secret.kind).toBe("html");
    });

    it("works out its own progress once, where the sheet and log both read it", () => {
        const objective = new ObjectiveModel({ current: 2, required: 6 });
        objective.prepareDerivedData();
        expect(objective.progress.label).toBe("2/6");
    });
});
