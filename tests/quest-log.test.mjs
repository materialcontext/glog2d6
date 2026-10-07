import { readFileSync, globSync } from "node:fs";
import { resolve } from "node:path";
import Handlebars from "handlebars";
import { JSDOM } from "jsdom";
import { beforeEach, describe, expect, it } from "vitest";

import {
    briefPage,
    currentNote,
    objectivePages,
    questEntries,
    questView,
    saveNote
} from "../module/quests/quest-log.mjs";
import { OBJECTIVE_TYPE } from "../module/systems/quests.mjs";

const ROOT = resolve(import.meta.dirname, "..");
const read = p => readFileSync(resolve(ROOT, p), "utf8");

const page = (name, type, sort = 0) => ({ name, type, sort, uuid: `p.${name}` });

function entry(name, { quest = true, state = "active", order = 0, pages = [] } = {}) {
    const flags = { glog2d6: { quest, state, order } };
    return {
        name,
        uuid: `JournalEntry.${name}`,
        flags,
        pages,
        getFlag: (scope, key) => flags[scope]?.[key]
    };
}

let userFlags;

beforeEach(() => {
    userFlags = {};
    game.user = {
        id: "u1",
        isGM: false,
        getFlag: (scope, key) => userFlags[`${scope}.${key}`],
        setFlag: async (scope, key, value) => { userFlags[`${scope}.${key}`] = value; }
    };
});

/**
 * A player's log is simply what their client holds: a quest or objective they
 * may not read was never sent to them, so there is nothing here to filter.
 */
describe("which journal entries the log shows", () => {
    it("is the ones flagged as quests, whatever folder they sit in", () => {
        game.journal = [entry("A Debt"), entry("Session Notes", { quest: false }), entry("The Ford")];

        expect(questEntries().map(q => q.name)).toEqual(["A Debt", "The Ford"]);
    });

    it("puts live work first, then the GM's order", () => {
        game.journal = [
            entry("Done", { state: "complete" }),
            entry("Second", { order: 2 }),
            entry("First", { order: 1 })
        ];

        expect(questEntries().map(q => q.name)).toEqual(["First", "Second", "Done"]);
    });

    it("has nothing to show in a world with no quests", () => {
        game.journal = [];
        expect(questEntries()).toEqual([]);

        game.journal = undefined;
        expect(questEntries()).toEqual([]);
    });
});

describe("the pages of a quest", () => {
    const quest = entry("A Debt", {
        pages: [
            page("Brief", "text"),
            page("Burn it", OBJECTIVE_TYPE, 2),
            page("Find the ledger", OBJECTIVE_TYPE, 1)
        ]
    });

    it("sorts the objectives the way the GM arranged them", () => {
        expect(objectivePages(quest).map(p => p.name)).toEqual(["Find the ledger", "Burn it"]);
    });

    /** The brief is ordinary rich text, so the GM keeps the journal editor. */
    it("takes the brief from the first page that is not an objective", () => {
        expect(briefPage(quest).name).toBe("Brief");
    });

    it("copes with a quest that has neither", () => {
        expect(objectivePages(entry("Bare"))).toEqual([]);
        expect(briefPage(entry("Bare"))).toBeNull();
    });
});

/**
 * A player's notes live on the player. A user may always write their own
 * flags, so this needs no relay and no widening of what a player owns -- and
 * nobody can overwrite anyone else's note by construction.
 */
describe("a player's own notes", () => {
    it("come back for the quest they were written on", async () => {
        await saveNote("JournalEntry.abc", "The reeve is lying.");
        expect(currentNote("JournalEntry.abc")).toBe("The reeve is lying.");
    });

    it("are empty for a quest nobody has written on", () => {
        expect(currentNote("JournalEntry.xyz")).toBe("");
        expect(currentNote(undefined)).toBe("");
    });

    it("do not disturb each other", async () => {
        await saveNote("JournalEntry.abc", "first");
        await saveNote("JournalEntry.def", "second");

        expect(currentNote("JournalEntry.abc")).toBe("first");
        expect(currentNote("JournalEntry.def")).toBe("second");
    });

    /**
     * A uuid is full of dots and a flag path reads a dot as nesting, so a key
     * written raw would scatter one note across four levels of object.
     */
    it("keeps a dotted uuid in one piece", async () => {
        await saveNote("JournalEntry.abc.JournalEntryPage.def", "kept whole");

        const stored = Object.keys(userFlags["glog2d6.questNotes"]);
        expect(stored).toHaveLength(1);
        expect(stored[0]).not.toContain(".");
        expect(currentNote("JournalEntry.abc.JournalEntryPage.def")).toBe("kept whole");
    });

    it("writes the player's own flags rather than the quest", async () => {
        await saveNote("JournalEntry.abc", "mine");
        expect(Object.keys(userFlags)).toEqual(["glog2d6.questNotes"]);
    });
});

/**
 * What only the GM knows rides along with the page, which a player who may
 * not read the page never receives -- but the GM's own log must not hand it
 * to a player who can read the objective itself.
 */
describe("what the view model gives a player", () => {
    const quest = () => {
        const flags = { glog2d6: { quest: true, state: "active" } };
        return {
            name: "A Debt", uuid: "q1", flags, ownership: { default: 2 },
            getFlag: (scope, key) => flags[scope]?.[key],
            pages: [{
                name: "Thin the rats", type: OBJECTIVE_TYPE, uuid: "o1", sort: 0,
                ownership: { default: -1 },
                system: { current: 2, required: 6, kind: "slay", description: "In the undercroft.", secret: "They are not rats." }
            }]
        };
    };

    it("withholds the GM's own note", () => {
        expect(questView(quest(), { isGM: false }).objectives[0].secret).toBe("");
        expect(questView(quest(), { isGM: true }).objectives[0].secret).toBe("They are not rats.");
    });

    it("gives them everything else about the objective", () => {
        const view = questView(quest(), { isGM: false }).objectives[0];
        expect(view).toMatchObject({ name: "Thin the rats", description: "In the undercroft." });
        expect(view.progress.label).toBe("2/6");
    });

    /** An objective set to inherit follows a quest the party can read. */
    it("reads an inherited objective as shown", () => {
        expect(questView(quest(), { isGM: true }).objectives[0].shown).toBe(true);
    });
});

describe("the system wires it up", () => {
    const entryFile = read("glog2d6.mjs");

    it("opens and closes on the one key", () => {
        const system = read("module/quests/quest-system.mjs");
        expect(system).toContain('key: "KeyQ"');
        expect(system).toContain('modifiers: ["Control"]');
        expect(read("module/quests/quest-log.mjs")).toContain("export function toggleQuestLog");
    });

    /**
     * Keybindings must exist before Foundry initialises them, which it does
     * just after `setup` -- so during init or not at all.
     */
    it("registers the keybinding before init can yield", () => {
        const init = /Hooks\.once\('init'[\s\S]*?\n\}\);/.exec(entryFile)[0];

        expect(init.indexOf("initQuests("), "never called from init").toBeGreaterThan(-1);
        expect(init.indexOf("initQuests("), "sits behind an await").toBeLessThan(init.indexOf("await "));
    });

    /** Every GM-only action goes through the one relay, like everything else. */
    it("asks the GM for anything a player may not write", () => {
        const system = read("module/quests/quest-system.mjs");
        for (const action of ["ADVANCE_OBJECTIVE", "SET_QUEST_STATE", "SET_VISIBILITY"]) {
            expect(system, `${action} is never asked for`).toContain(`askTheGM(RELAY.${action}`);
            expect(system, `${action} is never handled`).toContain(`onlyTheGMCan(RELAY.${action}`);
        }
    });

    /** Visibility is ownership; a `revealed` field would only hide the text. */
    it("never hides a quest behind a field", () => {
        const quests = globSync("module/quests/*.mjs", { cwd: ROOT }).map(read).join("\n");
        expect(quests).not.toMatch(/revealed/);
        expect(quests).toContain("objectiveVisibility");
        expect(quests).toContain("questVisibility");
    });

    it("gives modules somewhere to add to", () => {
        const system = read("module/quests/quest-system.mjs");
        expect(system).toContain("CONFIG.GLOG.OBJECTIVE_KINDS");
        expect(system).toContain("CONFIG.GLOG.QUEST_STATES");
        expect(system).toContain("registerObjectiveKind");
        expect(entryFile).toContain("game.glog2d6.quests = questApi()");
    });

    it("tells modules when something moved", () => {
        const sources = globSync("module/quests/*.mjs", { cwd: ROOT }).map(read).join("\n");
        for (const hook of ["glog2d6.objectiveAdvanced", "glog2d6.questStateChanged",
                            "glog2d6.questVisibilityChanged", "glog2d6.questLogRendered"]) {
            expect(sources, `${hook} is never fired`).toContain(hook);
        }
    });

    it("declares the subtype, and a data model for it", () => {
        const manifest = JSON.parse(read("system.json"));
        expect(manifest.documentTypes.JournalEntryPage).toHaveProperty("objective");
        expect(read("module/quests/quest-system.mjs"))
            .toContain("CONFIG.JournalEntryPage.dataModels[OBJECTIVE_TYPE]");
    });
});


/* -------------------------------------------- */
/*  The window's markup                         */
/* -------------------------------------------- */

function render({ isGM }) {
    const hbs = Handlebars.create();
    hbs.registerHelper("eq", (a, b) => a === b);

    const progress = (done, total) => ({ done, total, label: `${done}/${total}` });
    const objective = (name, current, required, over = {}) => ({
        uuid: `o.${name}`, name, shown: true, description: "", secret: "",
        kind: { label: "Deed", icon: "fas fa-check" },
        progress: {
            current, required, complete: current >= required,
            label: `${current}/${required}`, percent: Math.round((current / required) * 100)
        },
        ...over
    });

    const quests = [
        {
            uuid: "q1", name: "A Debt", state: "active", stateLabel: "Active", shown: true,
            giver: "The Reeve", reward: "40s", brief: "b1", note: "", progress: progress(0, 2),
            objectives: [
                objective("Find the ledger", 0, 1),
                objective("Thin the rats", 2, 6, { secret: "They are not rats." })
            ]
        },
        {
            uuid: "q2", name: "The Marches", state: "complete", stateLabel: "Complete", shown: true,
            giver: "", reward: "", brief: "", note: "", progress: progress(1, 1),
            objectives: [objective("Cross it", 1, 1)]
        }
    ];

    const states = ["active", "complete", "failed", "dormant"]
        .map(key => ({ key, label: key }));

    const html = hbs.compile(read("templates/quests/quest-log.hbs"))({ isGM, quests, states });
    return new JSDOM(html).window.document;
}

describe("the log as it renders", () => {
    /**
     * The bug: the selected option was looked up through `../quest.state`,
     * which from inside the states loop resolved to `quest.quest.state` and
     * so selected nothing -- every quest's dropdown read "Active" however it
     * was set. Block params are in scope; name them rather than count dots.
     */
    it("shows each quest the state it is actually in", () => {
        const doc = render({ isGM: true });
        const chosen = [...doc.querySelectorAll(".glog-quest-state")]
            .map(select => select.querySelector("option[selected]")?.value);

        expect(chosen).toEqual(["active", "complete"]);
    });

    it("gives the GM the controls, and the player none of them", () => {
        expect(render({ isGM: true }).querySelectorAll("[data-action=toggleQuest]").length).toBe(2);
        expect(render({ isGM: false }).querySelector("[data-action=toggleQuest]")).toBeNull();
        expect(render({ isGM: false }).querySelector("[data-action=advance]")).toBeNull();
        expect(render({ isGM: false }).querySelector(".glog-quest-state")).toBeNull();
    });

    /** A player reads the state; they do not set it. */
    it("still tells a player what state a quest is in", () => {
        expect(render({ isGM: false }).querySelector(".glog-quest-state-tag").textContent.trim())
            .toBe("Active");
    });

    it("renders a secret when it is given one", () => {
        expect(render({ isGM: true }).querySelector(".is-secret").textContent)
            .toContain("They are not rats.");
    });

    /**
     * Every objective is a counter, including the ones that only reach one: a
     * lone checkbox in a column of 2/6 reads as a different kind of thing.
     */
    it("counts every objective the same way", () => {
        const counts = [...render({ isGM: true }).querySelectorAll(".glog-objective-count")]
            .map(el => el.textContent.trim());

        expect(counts).toEqual(["0/1", "2/6", "1/1"]);
        expect(render({ isGM: true }).querySelector("input[type=checkbox]")).toBeNull();
    });

    it("gives every player somewhere to write that is their own", () => {
        const notes = render({ isGM: false }).querySelectorAll("[data-note-for]");
        expect(notes.length).toBe(2);
        expect(notes[0].dataset.noteFor).toBe("q1");
    });

    it("says so when there is nothing to show", () => {
        const hbs = Handlebars.create();
        hbs.registerHelper("eq", (a, b) => a === b);
        const doc = new JSDOM(hbs.compile(read("templates/quests/quest-log.hbs"))(
            { isGM: false, quests: [], states: [] })).window.document;

        expect(doc.querySelector(".glog-quest-empty").textContent).toContain("No quests yet");
    });
});
