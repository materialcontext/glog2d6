import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { JSDOM } from "jsdom";
import Handlebars from "handlebars";
import { describe, expect, it } from "vitest";

import { ALWAYS, fieldsFor, requestParams, typeChoices, wireRequestFields } from "../module/dialogs/request-form.mjs";
import { ROLL_TYPES } from "../module/systems/roll-requests.mjs";

const ROOT = resolve(import.meta.dirname, "..");
const read = p => readFileSync(resolve(ROOT, p), "utf8");

Handlebars.registerHelper("upperCase", s => String(s).toUpperCase());
Handlebars.registerHelper("capitalize", s => String(s).charAt(0).toUpperCase() + String(s).slice(1));

function open(type) {
    const html = Handlebars.compile(read("templates/dialogs/roll-request.hbs"))({
        types: typeChoices(),
        attributes: ["str", "dex", "con"],
        skills: ["sneak", "hide"],
        actors: [{ id: "a", name: "Mareth", nameLower: "mareth" }],
        attackers: [{ id: "n1", name: "Dire Wolf" }],
        tables: ["Beast Maulings"]
    });

    const root = new JSDOM(`<div id="root">${html}</div>`).window.document.querySelector("#root");
    root.querySelector("[name=type]").value = type;
    wireRequestFields(root);

    return {
        root,
        shown: () => [...root.querySelectorAll("[data-field]")].filter(g => !g.hidden).map(g => g.dataset.field),
        choose: next => {
            const select = root.querySelector("[name=type]");
            select.value = next;
            select.dispatchEvent(new root.ownerDocument.defaultView.Event("change"));
        }
    };
}

describe("what a request asks for", () => {
    it("is what its type asks for, plus the description everything takes", () => {
        expect(fieldsFor("trauma")).toEqual(["damage", "attacker", "woundTable", ...ALWAYS]);
        expect(fieldsFor("recon")).toEqual(["location", ...ALWAYS]);
        expect(fieldsFor("initiative")).toEqual([...ALWAYS]);
    });

    it("is nothing much for a type nobody has heard of", () => {
        expect(fieldsFor("nonsense")).toEqual([...ALWAYS]);
    });
});

/**
 * Switching type leaves the old inputs sitting in the form, filled in. Taking
 * only what this type asked for is what stops a stale attribute riding along
 * with a recon check.
 */
describe("reading the filled-in form", () => {
    const filled = { attribute: "dex", skill: "sneak", target: "9", damage: "4", location: "The Ford", description: "Dark" };

    it("takes only what this type asked for", () => {
        expect(requestParams("recon", filled)).toEqual({ location: "The Ford", description: "Dark" });
        expect(requestParams("attribute", filled)).toEqual({ attribute: "dex", target: 9, description: "Dark" });
    });

    it("reads the numbers as numbers", () => {
        expect(requestParams("trauma", filled).damage).toBe(4);
        expect(requestParams("attribute", { target: "not a number" })).toEqual({});
    });

    it("leaves out what was never filled in", () => {
        expect(requestParams("trauma", { damage: "2", attacker: "", woundTable: "" }))
            .toEqual({ damage: 2 });
    });
});

/**
 * Hiding has to hide.
 *
 * `hidden` is a property in a test and a layout question in a browser: the
 * browser's own `[hidden] { display: none }` loses to any author rule that
 * sets a display, and these groups and rows all carry `.flex`. Measured in
 * Chromium first, where every "hidden" group was still 40-odd pixels tall.
 */
describe("hidden means gone", () => {
    const styled = (markup) => {
        const dom = new JSDOM(`<!doctype html><html><head><style>${read("glog2d6.css")}</style></head>
            <body><div class="glog2d6">${markup}</div></body></html>`);
        return dom.window;
    };

    it("takes a hidden field group out of the layout", () => {
        const window = styled(`<div id="g" class="form-group flex flex-col" data-field="damage" hidden></div>`);
        expect(window.getComputedStyle(window.document.getElementById("g")).display).toBe("none");
    });

    it("takes a filtered-out character out of the list", () => {
        const window = styled(`<label id="r" class="picker-actor flex flex-center p-4 section" hidden></label>`);
        expect(window.getComputedStyle(window.document.getElementById("r")).display).toBe("none");
    });

    it("leaves everything else where it was", () => {
        const window = styled(`<div id="g" class="form-group flex flex-col" data-field="damage"></div>`);
        expect(window.getComputedStyle(window.document.getElementById("g")).display).toBe("flex");
    });
});

describe("the dialog", () => {
    it("offers every kind of request", () => {
        const options = [...open("attribute").root.querySelectorAll("[name=type] option")];
        expect(options.map(o => o.value)).toEqual(Object.keys(ROLL_TYPES));
    });

    it("shows a trauma save what a trauma save needs", () => {
        expect(open("trauma").shown().sort())
            .toEqual(["attacker", "damage", "description", "woundTable"].sort());
    });

    it("shows a recon check where it is happening", () => {
        expect(open("recon").shown().sort()).toEqual(["description", "location"].sort());
    });

    it("follows the GM changing their mind", () => {
        const dialog = open("trauma");
        dialog.choose("skill");
        expect(dialog.shown().sort()).toEqual(["description", "skill", "target"].sort());
        expect(dialog.shown()).not.toContain("damage");
    });

    it("lets the GM name who struck and what table it draws from", () => {
        const root = open("trauma").root;
        expect([...root.querySelectorAll("[name=attacker] option")].map(o => o.value))
            .toEqual(["", "n1"]);
        expect([...root.querySelectorAll("[name=woundTable] option")].map(o => o.value))
            .toEqual(["", "Beast Maulings"]);
    });

    /** Naming nobody is a real answer: damage from nowhere in particular. */
    it("does not make the GM name an attacker", () => {
        const blank = open("trauma").root.querySelector("[name=attacker] option");
        expect(blank.value).toBe("");
        expect(blank.textContent).toMatch(/nothing in particular/i);
    });

    it("still picks the party the way the recon dialog did", () => {
        const root = open("recon").root;
        for (const sel of [".picker-filter", ".picker-actor", ".picker-select-all", ".picker-count"]) {
            expect(root.querySelector(sel), `${sel} is missing`).not.toBeNull();
        }
    });
});
