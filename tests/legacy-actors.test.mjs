import { readFileSync, globSync } from "node:fs";
import { resolve } from "node:path";
import Handlebars from "handlebars";
import { JSDOM } from "jsdom";
import { beforeAll, afterAll, describe, expect, it, vi } from "vitest";

import { DataContextBuilder } from "../module/actor/data-context-builder.mjs";
import { SHEET_MODES } from "../module/actor/sheet-mode.mjs";
import { featureBadge, itemSummary } from "../module/actor/sheet-readouts.mjs";

const ROOT = resolve(import.meta.dirname, "..");
const read = path => readFileSync(resolve(ROOT, path), "utf8");
const PARTS = globSync("templates/actor/parts/*.hbs", { cwd: ROOT }).sort();

/** A Foundry item collection is a Map-alike, not an array. */
class Items extends Array {
    get size() { return this.length; }
    get(id) { return this.find(i => i.id === id); }
}

function actor(system, items = []) {
    return {
        id: "legacy1",
        name: "Old Character",
        img: "p.png",
        type: "character",
        system,
        flags: {},
        items: Items.from(items),
        getFlag: () => undefined,
        getRollData: () => ({})
    };
}

function environment() {
    const hbs = Handlebars.create();
    hbs.registerHelper("eq", (a, b) => a === b);
    hbs.registerHelper("gt", (a, b) => (a ?? 0) > (b ?? 0));
    hbs.registerHelper("lt", (a, b) => (a ?? 0) < (b ?? 0));
    hbs.registerHelper("and", (...a) => a.slice(0, -1).every(Boolean));
    hbs.registerHelper("or", (...a) => a.slice(0, -1).some(Boolean));
    hbs.registerHelper("not", v => !v);
    hbs.registerHelper("upperCase", s => String(s ?? "").toUpperCase());
    hbs.registerHelper("contains", (h, n) => String(h ?? "").includes(n));
    hbs.registerHelper("itemSummary", itemSummary);
    hbs.registerHelper("featureBadge", featureBadge);
    hbs.registerHelper("isBroken", l => Number(l) >= 2);
    hbs.registerHelper("isDamaged", l => Number(l) === 1);
    hbs.registerHelper("woundStateLabel", s => String(s ?? ""));
    hbs.registerHelper("hasFeatureRoll", () => false);
    hbs.registerHelper("hasFeatureTip", () => false);
    hbs.registerHelper("getFeatureTip", () => "");
    hbs.registerHelper("getReputations", () => []);
    hbs.registerHelper("getReputationDescription", () => ({}));
    for (const file of PARTS) {
        hbs.registerPartial(file.split("/").pop().replace(".hbs", ""), read(file));
    }
    return hbs;
}

function renderBoth(legacyActor) {
    const hbs = environment();
    return Object.entries({
        full: "templates/actor/actor-character-sheet.hbs",
        compact: "templates/actor/actor-character-compact.hbs"
    }).map(([mode, file]) => {
        const context = new DataContextBuilder(legacyActor).buildCompleteContext(
            { actor: legacyActor, cssClass: "editable" },
            { mode: mode === "compact" ? SHEET_MODES.COMPACT : SHEET_MODES.FULL }
        );
        return [mode, new JSDOM(hbs.compile(read(file))(context)).window.document];
    });
}

/* -------------------------------------------- */

/**
 * These are the shapes real saved actors are in, not the shape template.json
 * describes. A world that has been played in has characters from before skills
 * had a breakdown, before items had a condition track, and before the class had
 * a lookup key. All of them have to open.
 */
describe("actors saved by earlier versions", () => {
    beforeAll(() => {
        CONFIG.GLOG.CLASSES = [{ name: "Fighter" }, { name: "Wizard" }];
        CONFIG.GLOG.FEATURES = [{ name: "Fighter", features: {} }];
        vi.spyOn(console, "log").mockImplementation(() => {});
        vi.spyOn(console, "warn").mockImplementation(() => {});
    });
    afterAll(() => vi.restoreAllMocks());

    /** The bare minimum an actor could conceivably have on disk. */
    const skeletal = () => ({
        hp: { value: 4, max: 8 },
        attributes: { str: { value: 9, mod: 1 } },
        details: { class: "Fighter", level: 2, movement: 4 },
        inventory: { slots: { used: 0, max: 6 } }
    });

    it("opens a character with almost nothing on it", () => {
        for (const [mode, doc] of renderBoth(actor(skeletal()))) {
            expect(doc.querySelector("form"), `${mode} did not render`).not.toBeNull();
            expect(doc.querySelectorAll(".glog-attr"), `${mode} lost its attributes`).toHaveLength(6);
            expect(doc.querySelectorAll(".glog-skill"), `${mode} lost its skills`).toHaveLength(6);
        }
    });

    it("prints no NaN or undefined anywhere on the page", () => {
        for (const [mode, doc] of renderBoth(actor(skeletal()))) {
            const text = doc.body.textContent;
            expect(text, `${mode} printed NaN`).not.toMatch(/NaN/);
            expect(text, `${mode} printed undefined`).not.toMatch(/undefined/);
        }
    });

    /**
     * The class was a free-text field before it had a key. A saved "Fighter"
     * must still resolve to the Fighter feature list, or every existing
     * character silently loses "Add class features" on upgrade.
     */
    it("keeps a legacy class pointing at its feature list", () => {
        const context = new DataContextBuilder(actor(skeletal())).buildCompleteContext({}, {});
        expect(context.classKey).toBe("Fighter");
        expect(context.selectedClass).toBe("Fighter");
        expect(context.isCustomClass).toBe(false);
        expect(context.classDisplay).toBe("Fighter");
    });

    /** A class this world no longer defines becomes a custom one, not an error. */
    it("treats a class the world no longer has as custom", () => {
        const system = skeletal();
        system.details.class = "Knight";
        const context = new DataContextBuilder(actor(system)).buildCompleteContext({}, {});
        expect(context.classKey).toBe("");
        expect(context.isCustomClass).toBe(true);
        expect(context.classDisplay).toBe("Knight");
    });

    it("says something rather than nothing for a character with no class", () => {
        const system = skeletal();
        system.details = { level: 1, movement: 4 };
        const [[, doc]] = renderBoth(actor(system));
        expect(doc.body.textContent).toContain("Classless");
    });

    /** Items predating the condition track have no `breakage` at all. */
    it("opens with items that have no condition track", () => {
        const items = [
            { id: "a", name: "Old Sword", type: "weapon", img: "i.png", system: { equipped: true, damage: "1d6" } },
            { id: "b", name: "Old Mail", type: "armor", img: "i.png", system: { equipped: true, armorBonus: 1 } }
        ];
        const [[, doc]] = renderBoth(actor(skeletal(), items));
        expect(doc.querySelectorAll(".glog-row")).toHaveLength(2);
        expect(doc.querySelector(".glog-badge.is-danger")).toBeNull();
        expect(doc.body.textContent).not.toMatch(/undefined/);
    });

    it("opens with no wounds block at all", () => {
        const context = new DataContextBuilder(actor(skeletal())).buildCompleteContext({}, {});
        expect(context.wounds).toEqual([]);
        expect(context.woundEffects).toEqual([]);
    });

    it("opens with a wounds block from before effects were aggregated", () => {
        const system = skeletal();
        system.wounds = { count: 1, list: [{ id: "w", typeId: "hobbled", name: "Hobbled" }] };
        const [[, doc]] = renderBoth(actor(system));
        expect(doc.querySelectorAll(".glog-wound")).toHaveLength(1);
        expect(doc.body.textContent).not.toMatch(/undefined/);
    });

    /**
     * CONFIG.GLOG can be missing entirely if the data files failed to load. The
     * sheet still has to open -- that is the difference between a degraded
     * sheet and a player who cannot see their character.
     */
    it("opens when the system data never loaded", () => {
        const saved = CONFIG.GLOG;
        CONFIG.GLOG = {};
        try {
            for (const [mode, doc] of renderBoth(actor(skeletal()))) {
                expect(doc.querySelector("form"), `${mode} did not render`).not.toBeNull();
                expect(doc.querySelectorAll(".glog-attr")).toHaveLength(6);
            }
        } finally {
            CONFIG.GLOG = saved;
        }
    });

    /** Compact is a palette; an actor left in edit mode must not render one. */
    it("ignores an edit-mode flag left set when opening compact", () => {
        const legacy = actor(skeletal());
        legacy.getFlag = (scope, key) => (key === "editMode" ? true : undefined);

        const context = mode => new DataContextBuilder(legacy).buildCompleteContext({}, { mode });
        expect(context(SHEET_MODES.COMPACT).editMode).toBe(false);
        expect(context(SHEET_MODES.FULL).editMode).toBe(true);
    });

    /** No stored preference means the sheet a returning player already knows. */
    it("opens in full mode for anyone who has never chosen", () => {
        const context = new DataContextBuilder(actor(skeletal())).buildCompleteContext({}, {});
        expect(context.mode).toBe(SHEET_MODES.FULL);
        expect(context.isCompact).toBe(false);
    });
});
