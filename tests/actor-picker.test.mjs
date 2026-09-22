import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import Handlebars from "handlebars";
import { JSDOM } from "jsdom";
import { describe, expect, it } from "vitest";

import { matchesFilter, actorChoices, selectedActorIds, wireActorPicker } from "../module/dialogs/actor-picker.mjs";

const ROOT = resolve(import.meta.dirname, "..");
const read = p => readFileSync(resolve(ROOT, p), "utf8");

const world = [
    { id: "c", name: "Ulric", type: "character" },
    { id: "a", name: "mareth of the Ford", type: "character" },
    { id: "b", name: "Brother Cedric", type: "character" },
    { id: "n", name: "Goblin", type: "npc" },
    { id: "h", name: "Torchbearer", type: "hireling" }
];

describe("who a request can be asked of", () => {
    it("is the characters, and only the characters", () => {
        expect(actorChoices(world).map(a => a.id).sort()).toEqual(["a", "b", "c"]);
    });

    /** World order is insertion order, which stops being findable at a dozen. */
    it("sorts them so a long list can be searched by eye", () => {
        expect(actorChoices(world).map(a => a.name))
            .toEqual(["Brother Cedric", "mareth of the Ford", "Ulric"]);
    });

    it("survives an empty world", () => {
        expect(actorChoices([])).toEqual([]);
        expect(actorChoices()).toEqual([]);
    });
});

describe("filtering the list", () => {
    it("matches anywhere in the name, not just the start", () => {
        expect(matchesFilter("mareth of the ford", "ford")).toBe(true);
        expect(matchesFilter("mareth of the ford", "mar")).toBe(true);
    });

    it("ignores case on both sides", () => {
        expect(matchesFilter("brother cedric", "CEDRIC")).toBe(true);
    });

    it("shows everything when nothing is typed", () => {
        for (const term of ["", "   ", null, undefined]) {
            expect(matchesFilter("anyone", term)).toBe(true);
        }
    });

    it("hides what does not match", () => {
        expect(matchesFilter("ulric", "cedric")).toBe(false);
    });
});

describe("reading the submitted form", () => {
    it("takes the ticked boxes", () => {
        expect(selectedActorIds({ "actors.a": true, "actors.b": false, "actors.c": true }))
            .toEqual(["a", "c"]);
    });

    it("ignores everything that is not an actor box", () => {
        expect(selectedActorIds({ checkType: "ambush", location: "Ruins", "actors.a": true }))
            .toEqual(["a"]);
    });

    it("returns nothing when nothing is ticked", () => {
        expect(selectedActorIds({ "actors.a": false })).toEqual([]);
        expect(selectedActorIds({ actors: { a: false } })).toEqual([]);
        expect(selectedActorIds({})).toEqual([]);
        expect(selectedActorIds()).toEqual([]);
    });

    /**
     * Foundry hands `_updateObject` an expanded object when the form is
     * submitted with nothing to merge into it, and the flat one otherwise.
     * A picker that reads only one shape finds nobody and tells the GM to
     * select someone they already selected.
     */
    it("reads the boxes however the form arrives", () => {
        expect(selectedActorIds({ actors: { a: true, b: false, c: true } })).toEqual(["a", "c"]);
        expect(selectedActorIds({ checkType: "ambush", actors: { a: true } })).toEqual(["a"]);
    });

    it("does not count the same character twice", () => {
        expect(selectedActorIds({ "actors.a": true, actors: { a: true } })).toEqual(["a"]);
    });
});

/**
 * The bug: every box arrived ticked, so the default request went to the whole
 * party whether you meant it or not.
 */
describe("the dialog markup", () => {
    const html = Handlebars.compile(read("templates/dialogs/roll-request.hbs"))({
        actors: actorChoices(world),
        types: [{ key: "recon", name: "Recon Check" }]
    });
    const doc = new JSDOM(html).window.document;

    it("starts with nobody selected", () => {
        const boxes = [...doc.querySelectorAll('.picker-actor input[type="checkbox"]')];
        expect(boxes).toHaveLength(3);
        expect(boxes.filter(b => b.hasAttribute("checked"))).toEqual([]);
    });

    it("offers a filter that never reaches the submitted data", () => {
        const filter = doc.querySelector(".picker-filter");
        expect(filter).not.toBeNull();
        expect(filter.getAttribute("name"), "the filter would submit as a field").toBeNull();
    });

    it("carries a lowercased name on each row for the filter to match", () => {
        const rows = [...doc.querySelectorAll(".picker-actor")];
        expect(rows.map(r => r.dataset.actorName))
            .toEqual(["brother cedric", "mareth of the ford", "ulric"]);
    });

    it("offers select all and select none, and somewhere to report the count", () => {
        for (const sel of [".picker-select-all", ".picker-select-none", ".picker-count"]) {
            expect(doc.querySelector(sel), `${sel} is missing`).not.toBeNull();
        }
    });

    it("says so when there is nobody to pick", () => {
        const empty = new JSDOM(Handlebars.compile(read("templates/dialogs/roll-request.hbs"))(
            { actors: [], types: [] })).window.document;
        expect(empty.querySelector(".picker-actor")).toBeNull();
        expect(empty.querySelector(".picker-actors").textContent).toContain("No characters");
    });
});

/**
 * The picker, driven the way a GM drives it. This runs the real wiring the
 * dialog installs, not a copy of it.
 */
describe("using the picker", () => {
    const party = [
        { id: "a", name: "Mareth of the Ford", type: "character" },
        { id: "b", name: "Brother Cedric", type: "character" },
        { id: "c", name: "Ulric Fordson", type: "character" }
    ];

    function open() {
        const html = Handlebars.compile(read("templates/dialogs/roll-request.hbs"))({
            actors: actorChoices(party),
            types: [{ key: "recon", name: "Recon Check" }]
        });
        const dom = new JSDOM(`<div id="root">${html}</div>`);
        const root = dom.window.document.querySelector("#root");
        wireActorPicker(root);

        const rows = () => [...root.querySelectorAll(".picker-actor")];
        return {
            root,
            visible: () => rows().filter(r => !r.hidden).map(r => r.textContent.trim()),
            boxFor: name => rows().find(r => r.textContent.includes(name)).querySelector("input"),
            count: () => root.querySelector(".picker-count").textContent,
            note: () => root.querySelector(".picker-hidden-note").textContent,
            type: term => {
                const filter = root.querySelector(".picker-filter");
                filter.value = term;
                filter.dispatchEvent(new dom.window.Event("input"));
            },
            click: sel => root.querySelector(sel).dispatchEvent(new dom.window.Event("click")),
            check: name => {
                const box = rows().find(r => r.textContent.includes(name)).querySelector("input");
                box.checked = true;
                box.dispatchEvent(new dom.window.Event("change"));
            }
        };
    }

    it("opens with nobody selected", () => {
        const ui = open();
        expect(ui.count()).toBe("0 selected");
        expect(ui.visible()).toHaveLength(3);
    });

    it("counts as you tick", () => {
        const ui = open();
        ui.check("Ulric");
        expect(ui.count()).toBe("1 selected");
    });

    it("filters to matching names", () => {
        const ui = open();
        ui.type("ford");
        expect(ui.visible()).toEqual(["Mareth of the Ford", "Ulric Fordson"]);
        ui.type("");
        expect(ui.visible()).toHaveLength(3);
    });

    /**
     * The trap: filter after choosing someone, and they are still chosen but
     * no longer on screen. Silently dropping them would be worse, so the
     * picker says so instead.
     */
    it("keeps a selection the filter hides, and admits to it", () => {
        const ui = open();
        ui.check("Brother Cedric");
        ui.type("ford");

        expect(ui.boxFor("Brother Cedric").checked, "filtering unticked someone").toBe(true);
        expect(ui.count()).toBe("1 selected");
        expect(ui.note()).toContain("1 selected");
    });

    it("says nothing about hidden rows when none are hidden", () => {
        const ui = open();
        expect(ui.note()).toBe("");
    });

    /** "All" can only sensibly mean what you can see. */
    it("selects all of what the filter leaves visible", () => {
        const ui = open();
        ui.type("ford");
        ui.click(".picker-select-all");

        expect(ui.count()).toBe("2 selected");
        expect(ui.boxFor("Brother Cedric").checked).toBe(false);
    });

    it("clears everything, including what is hidden", () => {
        const ui = open();
        ui.click(".picker-select-all");
        ui.type("cedric");
        ui.click(".picker-select-none");

        expect(ui.count()).toBe("0 selected");
        expect(ui.boxFor("Mareth of the Ford").checked).toBe(false);
    });
});
