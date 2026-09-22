import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import Handlebars from "handlebars";
import { JSDOM } from "jsdom";
import { beforeAll, describe, expect, it } from "vitest";

import { GLOG2D6ItemSheet } from "../module/item/item-sheet.mjs";
import { ITEM_SHEET_TYPES, itemSheetTemplate } from "../module/item/item-sheet-config.mjs";

const ROOT = resolve(import.meta.dirname, "..");
const TEMPLATE_JSON = JSON.parse(readFileSync(resolve(ROOT, "template.json"), "utf8"));

/* -------------------------------------------- */
/*  Core helper stand-ins                       */
/* -------------------------------------------- */

/**
 * Behavioural stand-in for Foundry's `selectOptions`. Only the helpers that
 * still exist in v14 are registered here on purpose: if a template reaches for
 * a removed helper (`{{#select}}`, `{{colorPicker}}`) or a system helper that
 * isn't registered at render time, Handlebars throws and the test fails.
 */
Handlebars.registerHelper("selectOptions", function (choices, options) {
    const { blank, selected } = options.hash;
    const chosen = (Array.isArray(selected) ? selected : [selected]).map(String);
    const html = [];
    if (blank !== undefined) html.push(`<option value="">${Handlebars.escapeExpression(blank)}</option>`);
    for (const [value, label] of Object.entries(choices ?? {})) {
        const isSelected = chosen.includes(String(value)) ? " selected" : "";
        html.push(`<option value="${Handlebars.escapeExpression(value)}"${isSelected}>`
            + `${Handlebars.escapeExpression(label)}</option>`);
    }
    return new Handlebars.SafeString(html.join(""));
});

/* -------------------------------------------- */
/*  Fixtures                                    */
/* -------------------------------------------- */

/** Default `system` data for an item type, resolving template.json's mixins. */
function defaultSystem(type) {
    const definition = TEMPLATE_JSON.Item[type] ?? {};
    const mixins = (definition.templates ?? []).map(name => TEMPLATE_JSON.Item.templates[name] ?? {});
    const merged = {};
    for (const source of [...mixins, definition]) foundry.utils.mergeObject(merged, source);
    delete merged.templates;
    return merged;
}

/** A stand-in Item document carrying this system's default data. */
function fakeItem(type, { name = `Test ${type}`, system = {} } = {}) {
    const data = foundry.utils.mergeObject(defaultSystem(type), system);
    return {
        id: `${type}-id`,
        type,
        name,
        img: `icons/svg/${type}.svg`,
        flags: {},
        system: data,
        toObject: () => ({ system: foundry.utils.deepClone(data) })
    };
}

function sheetFor(type, itemOptions) {
    return new GLOG2D6ItemSheet({ document: fakeItem(type, itemOptions) });
}

/** The single root element a part template must render. */
function rootElement(type) {
    const doc = new JSDOM(`<div id="w">${templateSource(type)}</div>`).window.document;
    return doc.querySelector("#w").firstElementChild;
}

function templateSource(type) {
    const path = itemSheetTemplate(type).replace("systems/glog2d6/", "");
    return readFileSync(resolve(ROOT, path), "utf8");
}

/** Render an item type's sheet body exactly as the sheet would, and parse it. */
async function renderSheet(type, itemOptions) {
    const sheet = sheetFor(type, itemOptions);
    const parts = sheet._configureRenderParts({});
    const context = await sheet._prepareContext({});
    const path = parts.body.template.replace("systems/glog2d6/", "");
    const html = Handlebars.compile(readFileSync(resolve(ROOT, path), "utf8"))(context);
    // The real app root is the <form>; parts render into its window content.
    return new JSDOM(`<form>${html}</form>`).window.document.querySelector("form");
}

/* -------------------------------------------- */
/*  Tests                                       */
/* -------------------------------------------- */

describe("v14 template regressions", () => {
    it.each(ITEM_SHEET_TYPES)("%s sheet uses no helper removed in v14", type => {
        const source = templateSource(type);
        expect(source).not.toMatch(/\{\{#select\b/);
        expect(source).not.toMatch(/\{\{\s*colorPicker\b/);
        expect(source).not.toMatch(/nameAttr\s*=/);
    });

    it.each(ITEM_SHEET_TYPES)("%s sheet does not declare its own <form>", type => {
        // ApplicationV2 renders the sheet with tag: "form"; a nested form would
        // detach every field from the submission pipeline.
        expect(templateSource(type)).not.toMatch(/<\/?form[\s>]/);
    });

    it.each(ITEM_SHEET_TYPES)("%s sheet renders without a missing helper", async type => {
        await expect(renderSheet(type)).resolves.toBeTruthy();
    });
});

describe("ApplicationV2 part structure", () => {
    // A Handlebars part is replaced as a single element on re-render, so a
    // template with sibling roots loses everything after the first. Two roots
    // is exactly how the item sheets lost their whole <section> body.
    it.each(ITEM_SHEET_TYPES)("%s template has exactly one root element", type => {
        const doc = new JSDOM(`<div id="w">${templateSource(type)}</div>`).window.document;
        const roots = [...doc.querySelector("#w").children];
        expect(roots.map(el => el.tagName)).toHaveLength(1);
    });

    it.each(ITEM_SHEET_TYPES)("%s template root carries a class to style", type => {
        const root = rootElement(type);
        expect(root.className.trim(), `${type}: root has no class to hang CSS on`).not.toBe("");
        expect(root.classList.contains("sheet-content")).toBe(true);
    });

    it.each(ITEM_SHEET_TYPES)("%s template part id matches the sheet's part", type => {
        const declared = rootElement(type).dataset.applicationPart;
        const configured = Object.keys(sheetFor(type)._configureRenderParts({}))[0];
        expect(declared, `${type}: template says "${declared}", sheet configures "${configured}"`)
            .toBe(configured);
    });
});

describe("actor sheets are still ApplicationV1", () => {
    // GLOG2D6ActorSheet extends foundry.appv1.sheets.ActorSheet, and
    // FormApplication#_renderInner takes `this.form` from the rendered root or
    // a <form> inside it. No form element means no submit data, so the sheet
    // silently stops saving.
    it.each(["actor-character-sheet", "actor-hireling-sheet"])("%s renders a <form>", name => {
        const source = readFileSync(resolve(ROOT, `templates/actor/${name}.hbs`), "utf8");
        expect(source).toMatch(/<form[\s>]/);
        expect(source).toMatch(/<\/form>/);
    });

    it("still extends the v1 sheet, which is why the form is required", () => {
        const sheet = readFileSync(resolve(ROOT, "module/actor/actor-sheet.mjs"), "utf8");
        expect(sheet).toMatch(/extends foundry\.appv1\.sheets\.ActorSheet/);
    });
});

describe("sheet plumbing", () => {
    it.each(ITEM_SHEET_TYPES)("%s sheet resolves to its own template", type => {
        const sheet = sheetFor(type);
        expect(sheet._configureRenderParts({}).body.template).toBe(itemSheetTemplate(type));
    });

    it("tags the application element with the item type", () => {
        expect(sheetFor("torch").options.classes).toEqual(
            expect.arrayContaining(["glog2d6", "sheet", "item", "item-torch"])
        );
    });

    it("applies per-type window sizing", () => {
        expect(sheetFor("note").options.position).toEqual({ width: 480, height: 420 });
        expect(sheetFor("weapon").options.position).toEqual({ width: 520, height: 480 });
    });

    it("submits changes as they are made", () => {
        expect(sheetFor("gear").options.form).toMatchObject({ submitOnChange: true, closeOnSubmit: false });
    });

    it("exposes item, system and source data to templates", async () => {
        const sheet = sheetFor("spell", { system: { range: "Touch" } });
        const context = await sheet._prepareContext({});
        expect(context.item.name).toBe("Test spell");
        expect(context.name).toBe("Test spell");
        expect(context.system.range).toBe("Touch");
        expect(context.source.range).toBe("Touch");
        expect(context.editable).toBe(true);
    });
});

describe("rendered markup", () => {
    it.each(ITEM_SHEET_TYPES)("%s sheet binds a document name field", async type => {
        const form = await renderSheet(type);
        expect(form.querySelector('input[name="name"]')).not.toBeNull();
    });

    it.each(ITEM_SHEET_TYPES)("%s sheet binds a description field", async type => {
        const form = await renderSheet(type);
        expect(form.querySelector('[name="system.description"]')).not.toBeNull();
    });

    it.each(ITEM_SHEET_TYPES.filter(t => t !== "note"))("%s sheet wires the image picker action", async type => {
        const img = (await renderSheet(type)).querySelector('img[data-edit="img"]');
        expect(img).not.toBeNull();
        expect(img.dataset.action).toBe("editImage");
    });

    it.each(ITEM_SHEET_TYPES)("%s sheet leaves no empty select", async type => {
        for (const select of (await renderSheet(type)).querySelectorAll("select")) {
            expect(select.options.length, `${type}: ${select.name} rendered no options`).toBeGreaterThan(0);
        }
    });

    it("marks the stored armor type as selected", async () => {
        const form = await renderSheet("armor", { system: { type: "heavy" } });
        const select = form.querySelector('select[name="system.type"]');
        expect(select.value).toBe("heavy");
        expect([...select.options].map(o => o.value)).toEqual(["light", "medium", "heavy"]);
    });

    it("matches a numeric breakage level against string option values", async () => {
        const form = await renderSheet("weapon", { system: { breakage: { level: 1, maxLevel: 2 } } });
        expect(form.querySelector('select[name="system.breakage.level"]').value).toBe("1");
    });

    it.each(["weapon", "armor", "shield"])("%s sheet shows the shared condition list", async type => {
        const form = await renderSheet(type);
        const labels = [...form.querySelectorAll('select[name="system.breakage.level"] option')]
            .map(o => o.textContent);
        expect(labels).toEqual(["Fine", "Damaged", "Broken"]);
    });

    it("preselects a legacy armor level stored against maxLevel 1", async () => {
        const form = await renderSheet("armor", { system: { breakage: { level: 2, maxLevel: 1 } } });
        expect(form.querySelector('select[name="system.breakage.level"]').value).toBe("2");
    });

    it("renders one checkbox per weapon type with distinct values", async () => {
        const form = await renderSheet("weapon", { system: { weaponType: ["ranged", "firearm"] } });
        const boxes = [...form.querySelectorAll('input[name="system.weaponType"]')];
        expect(boxes.map(b => b.value)).toEqual(["melee", "ranged", "thrown", "explosive", "firearm"]);
        expect(boxes.filter(b => b.checked).map(b => b.value)).toEqual(["ranged", "firearm"]);
    });

    it("checks a legacy string weapon type", async () => {
        const form = await renderSheet("weapon", { system: { weaponType: "melee" } });
        const checked = [...form.querySelectorAll('input[name="system.weaponType"]')].filter(b => b.checked);
        expect(checked.map(b => b.value)).toEqual(["melee"]);
    });

    it("hides the reputation picker on an ordinary feature", async () => {
        const form = await renderSheet("feature", { name: "Tracker" });
        expect(form.querySelector('select[name="system.reputationType"]')).toBeNull();
    });

    it("shows the reputation picker on a 'Reputation for ...' feature", async () => {
        const form = await renderSheet("feature", { name: "Reputation for Violence" });
        const select = form.querySelector('select[name="system.reputationType"]');
        expect(select).not.toBeNull();
        expect([...select.options].map(o => o.value)).toEqual(["", "Honesty", "Violence"]);
    });

    it("keeps the torch colour field as a plain colour input", async () => {
        const input = (await renderSheet("torch")).querySelector('[name="system.lightColor"]');
        expect(input.tagName).toBe("INPUT");
        expect(input.getAttribute("type")).toBe("color");
    });

    it("preselects the stored light animation", async () => {
        const form = await renderSheet("torch", { system: { lightAnimation: { type: "pulse" } } });
        expect(form.querySelector('select[name="system.lightAnimation.type"]').value).toBe("pulse");
    });
});

describe("item sheet stylesheet", () => {
    const CSS = readFileSync(resolve(ROOT, "glog2d6.css"), "utf8");

    /** Selectors the stylesheet aims at item sheets, pseudo-classes stripped. */
    function itemSelectors() {
        const withoutComments = CSS.replace(/\/\*[\s\S]*?\*\//g, "");
        const selectors = new Set();
        for (const [, group] of withoutComments.matchAll(/([^{}]+)\{[^{}]*\}/g)) {
            for (const selector of group.split(",")) {
                const clean = selector.trim().replace(/:(hover|focus|disabled|active)\b/g, "");
                if (clean.startsWith(".glog2d6.item")) selectors.add(clean);
            }
        }
        return [...selectors];
    }

    /** A rendered item sheet inside the element the application actually builds. */
    async function styledSheet(type) {
        const sheet = sheetFor(type);
        const context = await sheet._prepareContext({});
        const path = sheet._configureRenderParts({}).body.template.replace("systems/glog2d6/", "");
        const html = Handlebars.compile(readFileSync(resolve(ROOT, path), "utf8"))(context);
        const classes = sheet.options.classes.join(" ");
        return new JSDOM(
            `<form class="application ${classes}"><section class="window-content">${html}</section></form>`
        ).window.document;
    }

    it("aims at least one rule at item sheets", () => {
        expect(itemSelectors().length).toBeGreaterThan(10);
    });

    it("has no rule that cannot match any item sheet", async () => {
        const documents = await Promise.all(ITEM_SHEET_TYPES.map(styledSheet));
        const dead = itemSelectors().filter(selector =>
            !documents.some(doc => doc.querySelector(selector))
        );
        expect(dead, `stylesheet rules that match nothing: ${dead.join(", ")}`).toEqual([]);
    });

    it("styles the structural classes the templates rely on", async () => {
        const selectors = itemSelectors().join(" ");
        for (const cls of ["sheet-content", "sheet-body", "item-img", "charname", "form-group"]) {
            expect(selectors, `nothing styles .${cls}`).toContain(cls);
        }
    });

    it("keeps chat message buttons out of the sheet scope", () => {
        // `.btn` is used inside chat cards, which are not under `.glog2d6`.
        expect(CSS).toMatch(/^\.btn \{/m);
    });
});

describe("submission", () => {
    /** A form element holding the given weapon type checkboxes. */
    function weaponForm(checked) {
        const values = ["melee", "ranged", "thrown", "explosive", "firearm"];
        const inputs = values.map(v =>
            `<input type="checkbox" name="system.weaponType" value="${v}"${checked.includes(v) ? " checked" : ""}>`
        ).join("");
        return new JSDOM(`<form>${inputs}</form>`).window.document.querySelector("form");
    }

    function submit(sheet, form, flatData) {
        return sheet._prepareSubmitData({}, form, { object: flatData });
    }

    it("collapses weapon type checkboxes into a single array field", () => {
        const sheet = sheetFor("weapon", { system: { weaponType: "melee" } });
        const data = submit(sheet, weaponForm(["melee", "thrown"]), { "system.damage": "1d6" });
        expect(data.system.weaponType).toEqual(["melee", "thrown"]);
    });

    it("allows every weapon type tag to be cleared", () => {
        const sheet = sheetFor("weapon", { system: { weaponType: ["melee"] } });
        const data = submit(sheet, weaponForm([]), {});
        expect(data.system.weaponType).toEqual([]);
    });

    it("re-applies the size profile when weapon size changes", () => {
        const sheet = sheetFor("weapon", { system: { weaponType: ["melee"], size: "medium" } });
        const data = submit(sheet, weaponForm(["melee"]), { "system.size": "heavy" });
        expect(data.system).toMatchObject({
            size: "heavy", damage: "1d10", slots: 2, attackPenalty: 1, encumbrancePenalty: 1
        });
    });

    it("switches a weapon to the ranged profile when melee is unchecked", () => {
        const sheet = sheetFor("weapon", { system: { weaponType: ["melee"], size: "heavy" } });
        const data = submit(sheet, weaponForm(["ranged"]), {});
        expect(data.system).toMatchObject({ damage: "1d6", slots: 1, attackPenalty: 0 });
    });

    it("leaves hand-tuned weapon stats alone when nothing governing changed", () => {
        const sheet = sheetFor("weapon", { system: { weaponType: ["melee"], size: "medium" } });
        const data = submit(sheet, weaponForm(["melee"]), { "system.damage": "1d6+2" });
        expect(data.system.damage).toBe("1d6+2");
        expect(data.system.slots).toBeUndefined();
    });

    it("re-applies armor stats when the armor type changes", () => {
        const sheet = sheetFor("armor", { system: { type: "light" } });
        const data = sheetSubmit(sheet, { "system.type": "heavy" });
        expect(data.system).toMatchObject({ type: "heavy", armorBonus: 3, encumbrancePenalty: 2 });
    });

    it("leaves hand-tuned armor stats alone when the type is unchanged", () => {
        const sheet = sheetFor("armor", { system: { type: "medium" } });
        const data = sheetSubmit(sheet, { "system.type": "medium", "system.armorBonus": 5 });
        expect(data.system.armorBonus).toBe(5);
    });

    it("stores the submitted condition as a number on the shared track", () => {
        for (const type of ["weapon", "armor", "shield"]) {
            const sheet = sheetFor(type);
            const data = sheetSubmit(sheet, { "system.breakage.level": "2" });
            expect(data.system.breakage, type).toEqual({ level: 2, maxLevel: 2 });
        }
    });

    it("clamps an out-of-range condition on submit", () => {
        const data = sheetSubmit(sheetFor("armor"), { "system.breakage.level": "7" });
        expect(data.system.breakage.level).toBe(2);
    });

    it("leaves the condition alone when the form did not submit one", () => {
        const data = sheetSubmit(sheetFor("weapon"), { "system.damage": "1d8" });
        expect(data.system.breakage).toBeUndefined();
    });

    it("does not touch types without derived stats", () => {
        const sheet = sheetFor("gear");
        const data = sheetSubmit(sheet, { "system.quantity": 3 });
        expect(data).toEqual({ system: { quantity: 3 } });
    });

    function sheetSubmit(sheet, flatData) {
        const form = new JSDOM("<form></form>").window.document.querySelector("form");
        return sheet._prepareSubmitData({}, form, { object: flatData });
    }
});

describe("system manifest", () => {
    let manifest;

    beforeAll(() => {
        manifest = JSON.parse(readFileSync(resolve(ROOT, "system.json"), "utf8"));
    });

    it("declares v14 compatibility", () => {
        expect(Number(manifest.compatibility.verified)).toBeGreaterThanOrEqual(14);
        expect(Number(manifest.compatibility.minimum)).toBeGreaterThanOrEqual(13);
    });

    it("declares every item subtype template.json defines", () => {
        expect(Object.keys(manifest.documentTypes.Item).sort())
            .toEqual([...TEMPLATE_JSON.Item.types].sort());
    });
});
