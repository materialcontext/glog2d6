import { readFileSync, globSync } from "node:fs";
import { resolve } from "node:path";
import Handlebars from "handlebars";
import { JSDOM } from "jsdom";
import { describe, expect, it } from "vitest";

import { EventHandlerRegistry } from "../module/actor/event-registry.mjs";
import { SHEET_MODES, modeSize } from "../module/actor/sheet-mode.mjs";
import {
    attackTiles,
    attributeTiles,
    castingOptions,
    defenseTiles,
    encumbranceNote,
    featureBadge,
    hpBar,
    inEffectRows,
    itemSummary,
    magicDicePips,
    partitionItems,
    skillChips,
    woundEffectRows
} from "../module/actor/sheet-readouts.mjs";

const ROOT = resolve(import.meta.dirname, "..");
const read = path => readFileSync(resolve(ROOT, path), "utf8");

const SHEETS = {
    full: "templates/actor/actor-character-sheet.hbs",
    compact: "templates/actor/actor-character-compact.hbs"
};

const PARTS = globSync("templates/actor/parts/*.hbs", { cwd: ROOT }).sort();

/* -------------------------------------------- */
/*  A Handlebars environment like the real one  */
/* -------------------------------------------- */

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
    hbs.registerHelper("hasFeatureRoll", () => true);
    hbs.registerHelper("hasFeatureTip", () => true);
    hbs.registerHelper("getFeatureTip", () => "a tip");
    hbs.registerHelper("getReputations", () => [{ name: "Violence" }]);
    hbs.registerHelper("getReputationDescription", () => ({ description: "known for it" }));

    for (const file of PARTS) {
        const name = file.split("/").pop().replace(".hbs", "");
        hbs.registerPartial(name, read(file));
    }

    return hbs;
}

/* -------------------------------------------- */
/*  Two characters: one full, one brand new     */
/* -------------------------------------------- */

const ATTRS = ["str", "dex", "con", "int", "wis", "cha"];

function emptySystem() {
    return {
        hp: { value: 10, max: 10 },
        attributes: Object.fromEntries(ATTRS.map(k => [k, { value: 7, mod: 0 }])),
        skills: Object.fromEntries(
            ["sneak", "hide", "disguise", "reaction", "diplomacy", "intimidate"]
                .map(k => [k, { bonus: 0, breakdown: [] }])
        ),
        details: { class: "", classKey: "", level: 1, movement: 4 },
        woundTable: "",
        combat: { attack: { value: 0, bonus: 0 }, firearm: { bonus: 0 } },
        defense: { total: 0, meleeTotal: 0, rangedTotal: 0, armor: 0 },
        inventory: { slots: { used: 0, max: 6 }, encumbrance: 0 },
        wounds: { count: 0, list: [], effects: {} },
        torch: { lit: false, activeTorchId: null },
        magicDiceCurrent: 0,
        magicDiceMax: 0,
        spellSlots: 0
    };
}

/** Long names everywhere: the row that clips is the row that would overflow. */
const LONG = "Grandfather's Serrated Boarding Cutlass of the Drowned Company";

function loadedSystem() {
    const system = emptySystem();
    system.hp = { value: 6, max: 11 };
    system.details = { class: "Bone Surgeon", classKey: "custom", level: 3, movement: 4, effectiveMovement: 2 };
    system.woundTable = "Beast Maulings";
    system.combat.attack = { value: 4, bonus: 1 };
    system.defense = { total: 12, meleeTotal: 13, rangedTotal: 11, armor: 2 };
    system.inventory = { slots: { used: 9, max: 6 }, encumbrance: 3, slotEncumbrance: 2, equipmentEncumbrance: 1 };
    system.magicDiceCurrent = 2;
    system.magicDiceMax = 3;
    system.spellSlots = 2;
    system.torch = { lit: true, activeTorchId: "t1" };
    for (const key of ATTRS) system.attributes[key] = { value: 9, mod: 1, effectiveMod: -1, effectiveValue: 5 };
    system.wounds = {
        count: 2,
        list: [],
        effects: {
            statReductions: { str: 2 },
            movementReduction: 10,
            noHealing: true,
            attackPenalty: 1,
            defensePenalty: 1,
            reactionPenalty: 1,
            sleepDisruption: 2,
            combatEffects: ["auto_fail_initiative"],
            deathOnFailure: true
        }
    };
    return system;
}

function items() {
    return [
        { id: "w1", name: LONG, type: "weapon", img: "a.png", system: { equipped: true, damage: "1d10", slots: 2, breakage: { level: 1 }, encumbrancePenalty: 1 } },
        { id: "a1", name: "Brigandine", type: "armor", img: "a.png", system: { equipped: true, armorBonus: 2, slots: 0, breakage: { level: 0 } } },
        { id: "s1", name: "Kite Shield", type: "shield", img: "a.png", system: { equipped: true, armorBonus: 1, slots: 1, breakage: { level: 2 } } },
        { id: "t1", name: "Pitch Torch", type: "torch", img: "a.png", system: { slots: 1, lightRadius: { bright: 30, dim: 60 }, duration: { enabled: true, remaining: 0.5 } } },
        { id: "g1", name: "Rope", type: "gear", img: "a.png", system: { slots: 1, value: 1 } },
        { id: "f1", name: "Reputation for Violence", type: "feature", img: "a.png", system: { active: true, template: "level-1", description: LONG } },
        { id: "f2", name: "Tracker", type: "feature", img: "a.png", system: { active: false, template: "level-2", description: "x" } },
        { id: "p1", name: "Summon Rain", type: "spell", img: "a.png", system: { range: "sight", description: LONG } },
        { id: "n1", name: LONG, type: "note", img: "a.png", system: { description: "secret" } }
    ];
}

const WOUNDS = [{
    id: "w", typeId: "hobbled", name: "Hobbled", state: "untreated", bodyPart: "Leg",
    description: "Movement reduced.", effects: {},
    removal: { allowed: false, reason: "Rest and have the wound stitched shut" },
    nextState: "treated"
}];

/** The context the real DataContextBuilder assembles, built from the same functions. */
function context({ loaded, mode, editMode = false }) {
    const system = loaded ? loadedSystem() : emptySystem();
    const list = loaded ? items() : [];
    const weaponAnalysis = loaded
        ? { hasWeapons: true, attackButtonType: "split", hasThrowable: true }
        : { hasWeapons: false, attackButtonType: "generic" };
    const hasAcrobatTraining = Boolean(loaded);
    const isCompact = mode === SHEET_MODES.COMPACT;

    const attacks = attackTiles({ combat: system.combat, weaponAnalysis });
    const defenses = defenseTiles({ defense: system.defense, hasAcrobatTraining });

    return {
        cssClass: "editable",
        actor: { name: loaded ? LONG : "New Character", img: "portrait.png", type: "character" },
        system,
        mode,
        isCompact,
        editMode: editMode && !isCompact,
        classDisplay: loaded ? "Bone Surgeon" : "Classless",
        classOptions: [{ key: "Fighter", label: "Fighter" }, { key: "custom", label: "Custom" }],
        selectedClass: loaded ? "custom" : "",
        isCustomClass: Boolean(loaded),
        hasAvailableFeatures: Boolean(loaded),
        weaponAnalysis,
        hasAcrobatTraining,
        wounds: loaded ? WOUNDS : [],
        attackTiles: attacks,
        defenseTiles: defenses,
        combatTiles: [
            ...attacks.map(t => ({ ...t, kind: "attack" })),
            ...defenses.map(t => ({ ...t, kind: "defend" }))
        ],
        hpBar: hpBar(system.hp.value, system.hp.max),
        attributeTiles: attributeTiles(system.attributes),
        skillChips: skillChips(system.skills),
        magicDice: magicDicePips(system.magicDiceCurrent, system.magicDiceMax),
        castingOptions: castingOptions(system.magicDiceCurrent),
        encumbranceNote: encumbranceNote(system.inventory),
        inEffect: inEffectRows({ system, items: list }),
        woundEffects: woundEffectRows(system.wounds.effects),
        itemsByKind: partitionItems(list)
    };
}

function render(sheet, options) {
    const hbs = environment();
    const html = hbs.compile(read(SHEETS[sheet]))(context({ mode: sheet, ...options }));
    return new JSDOM(html).window.document;
}

const CASES = [
    ["full", "loaded", { sheet: "full", loaded: true }],
    ["full", "empty", { sheet: "full", loaded: false }],
    ["full", "loaded in edit mode", { sheet: "full", loaded: true, editMode: true }],
    ["full", "empty in edit mode", { sheet: "full", loaded: false, editMode: true }],
    ["compact", "loaded", { sheet: "compact", loaded: true }],
    ["compact", "empty", { sheet: "compact", loaded: false }]
];

/* -------------------------------------------- */
/*  Rendering                                   */
/* -------------------------------------------- */

describe.each(CASES)("the %s sheet, %s", (_sheet, _state, { sheet, ...options }) => {
    const doc = () => render(sheet, options);

    /**
     * Actor sheets are still AppV1. FormApplication reads `this.form` off the
     * rendered root, so a sheet whose root is not a <form> silently stops
     * saving everything the player types.
     */
    it("has a <form> for a root", () => {
        expect(doc().body.firstElementChild.tagName).toBe("FORM");
        expect(doc().querySelectorAll("form")).toHaveLength(1);
    });

    it("renders the rolls you make", () => {
        const d = doc();
        expect(d.querySelectorAll(".glog-tile").length).toBeGreaterThanOrEqual(2);
        expect(d.querySelectorAll(".glog-attr")).toHaveLength(6);
        expect(d.querySelectorAll(".glog-skill")).toHaveLength(6);
    });

    it("offers the four things you do to yourself", () => {
        const d = doc();
        for (const cls of [".heal-btn", ".rest-btn", ".torch-btn", ".trauma-save-btn"]) {
            expect(d.querySelector(cls), `${cls} is missing`).not.toBeNull();
        }
    });

    it("leaves no empty text nodes where a value should be", () => {
        for (const el of doc().querySelectorAll(".glog-tile-value, .glog-attr-mod, .glog-skill-value")) {
            expect(el.textContent.trim()).not.toBe("");
        }
    });
});

/* -------------------------------------------- */
/*  Compact is a palette                        */
/* -------------------------------------------- */

describe("the compact sheet", () => {
    it("never renders an input you would have to type into, even in edit mode", () => {
        // `editMode` is forced off for compact upstream; this proves the
        // template does not smuggle edit-only controls in by another route.
        const d = render("compact", { loaded: true, editMode: true });
        const typed = [...d.querySelectorAll("input")].filter(i => i.name !== "system.hp.value");
        expect(typed).toEqual([]);
        expect(d.querySelector("select")).toBeNull();
        expect(d.querySelector(".item-create")).toBeNull();
    });

    it("drops the raw scores and saves the full sheet carries", () => {
        const d = render("compact", { loaded: true });
        expect(d.querySelector(".glog-attr-save")).toBeNull();
        expect(render("full", { loaded: true }).querySelector(".glog-attr-save")).not.toBeNull();
    });

    it("keeps hit points editable, with a stepper either side", () => {
        const d = render("compact", { loaded: true });
        expect(d.querySelector('input[name="system.hp.value"]')).not.toBeNull();
        expect([...d.querySelectorAll(".hp-step")].map(b => b.dataset.step)).toEqual(["-1", "1"]);
    });

    it("shows the wound count only when there are wounds", () => {
        expect(render("compact", { loaded: true }).body.textContent).toContain("WND");
        expect(render("compact", { loaded: false }).body.textContent).not.toContain("WND");
    });

    it("carries no panels, tabs or item lists", () => {
        const d = render("compact", { loaded: true });
        expect(d.querySelector(".glog-panel")).toBeNull();
        expect(d.querySelector(".sheet-tabs")).toBeNull();
        expect(d.querySelector(".glog-row")).toBeNull();
    });
});

/* -------------------------------------------- */
/*  Full carries everything the tabs used to    */
/* -------------------------------------------- */

describe("the full sheet", () => {
    it("shows features, wounds, spells and effects without a tab between them", () => {
        const d = render("full", { loaded: true });
        expect(d.querySelector(".feature-card")).not.toBeNull();
        expect(d.querySelector(".glog-wound")).not.toBeNull();
        expect(d.querySelector(".glog-spell")).not.toBeNull();
        expect(d.querySelector(".glog-effects")).not.toBeNull();
    });

    /** Notes is the only thing left behind a tab. */
    it("keeps exactly two tabs, inventory and notes", () => {
        const d = render("full", { loaded: true });
        expect([...d.querySelectorAll(".sheet-tabs .glog-tab")].map(a => a.dataset.tab))
            .toEqual(["inventory", "notes"]);
        expect([...d.querySelectorAll(".tab")].map(t => t.dataset.tab))
            .toEqual(["inventory", "notes"]);
    });

    it("gives every pane a matching nav entry", () => {
        const d = render("full", { loaded: true });
        const navs = [...d.querySelectorAll(".sheet-tabs .glog-tab")].map(a => a.dataset.tab);
        for (const pane of d.querySelectorAll(".tab")) {
            expect(navs).toContain(pane.dataset.tab);
            expect(pane.dataset.group).toBe("primary");
        }
    });

    it("splits attack and defence onto the same row when the loadout splits", () => {
        const tiles = [...render("full", { loaded: true }).querySelectorAll(".glog-tile")];
        expect(tiles).toHaveLength(4);
        expect(tiles.filter(t => t.classList.contains("glog-tile-attack"))).toHaveLength(2);
        expect(tiles.filter(t => t.classList.contains("glog-tile-defend"))).toHaveLength(2);
    });

    it("offers one magic-dice button per die you still have", () => {
        const d = render("full", { loaded: true });
        expect([...d.querySelectorAll(".spell-md-btn")].map(b => b.dataset.diceCount))
            .toEqual(["1", "2"]);
    });

    it("says so rather than offering a button when the dice are gone", () => {
        const hbs = environment();
        const ctx = context({ loaded: true, mode: "full" });
        ctx.system.magicDiceCurrent = 0;
        ctx.castingOptions = castingOptions(0);
        const d = new JSDOM(hbs.compile(read(SHEETS.full))(ctx)).window.document;
        expect(d.querySelector(".spell-md-btn")).toBeNull();
        expect(d.querySelector(".glog-md-empty")).not.toBeNull();
    });

    it("puts an empty state in every list of an empty character", () => {
        const d = render("full", { loaded: false });
        // Inventory, notes, features, wounds, spells.
        expect(d.querySelectorAll(".glog-empty").length).toBe(5);
        expect(d.querySelector(".glog-row")).toBeNull();
    });

    it("shows the custom class name and the dropdown together in edit mode", () => {
        const d = render("full", { loaded: true, editMode: true });
        expect(d.querySelector("select.class-select")).not.toBeNull();
        expect(d.querySelector('input[name="system.details.class"]')).not.toBeNull();
    });

    /** A known class has a fixed name, so there is nothing to type. */
    it("hides the free-text name when a known class is selected", () => {
        const hbs = environment();
        const ctx = context({ loaded: true, mode: "full", editMode: true });
        ctx.isCustomClass = false;
        ctx.selectedClass = "Fighter";
        const d = new JSDOM(hbs.compile(read(SHEETS.full))(ctx)).window.document;
        expect(d.querySelector("select.class-select")).not.toBeNull();
        expect(d.querySelector('input[name="system.details.class"]')).toBeNull();
    });

    /**
     * The npc sheet is retired -- a monster is a character the GM runs -- so
     * the table a creature's blows draw from had to come with it.
     */
    it("lets a character declare the table its blows draw from", () => {
        const d = render("full", { loaded: true, editMode: true });
        const field = d.querySelector('input[name="system.woundTable"]');

        expect(field).not.toBeNull();
        expect(field.value).toBe("Beast Maulings");
        expect(field.closest(".glog-panel-wounds"), "it belongs with the wounds").not.toBeNull();
    });

    it("keeps that field out of the way while playing", () => {
        expect(render("full", { loaded: true }).querySelector('input[name="system.woundTable"]')).toBeNull();
    });

    it("never gives the class dropdown a name, which would let the form clobber the key", () => {
        const d = render("full", { loaded: true, editMode: true });
        expect(d.querySelector("select.class-select").getAttribute("name")).toBeNull();
    });
});

/* -------------------------------------------- */
/*  Everything is actually wired up             */
/* -------------------------------------------- */

describe("the sheet's wiring", () => {
    const mappings = new EventHandlerRegistry({}).eventMappings;
    const markup = [
        ...Object.values(SHEETS).map(read),
        ...PARTS.map(read),
        read("templates/actor/actor-hireling-sheet.hbs")
    ].join("\n");

    it("has handlers for everything it registers", async () => {
        const { GLOG2D6ActorSheet } = await import("../module/actor/actor-sheet.mjs");
        for (const { handler } of mappings) {
            expect(typeof GLOG2D6ActorSheet.prototype[handler], `${handler} is not on the sheet`)
                .toBe("function");
        }
    });

    /**
     * A selector that matches nothing is a feature that quietly stopped
     * working. Every hook the registry binds has to exist in some template.
     */
    it("binds nothing that no template renders", () => {
        const orphans = mappings
            .map(m => m.selector)
            .filter(selector => {
                const className = selector.match(/\.([\w-]+)/)?.[1];
                return className && !new RegExp(`\\b${className}\\b`).test(markup);
            });

        expect(orphans, `bound but never rendered: ${orphans.join(", ")}`).toEqual([]);
    });

    it("routes every data-action the sheet renders to a known action", () => {
        const handled = new Set([
            "attack", "defend", "defend-melee", "defend-ranged",
            "sneak", "hide", "disguise", "reaction", "diplomacy", "intimidate",
            // Bound by class rather than by action name.
            "heal", "rest", "torch", "trauma", "movement", "toggle-torch"
        ]);

        for (const doc of [render("full", { loaded: true }), render("compact", { loaded: true })]) {
            for (const el of doc.querySelectorAll("[data-action]")) {
                expect(handled, `unrouted data-action="${el.dataset.action}"`)
                    .toContain(el.dataset.action);
            }
        }
    });

    it("gives every row that owns an item its id, so edit and delete can find it", () => {
        const d = render("full", { loaded: true, editMode: true });
        for (const control of d.querySelectorAll(".item-edit, .item-delete, .note-reveal")) {
            expect(control.closest("[data-item-id]"), "a control with no item to act on")
                .not.toBeNull();
        }
    });
});

/* -------------------------------------------- */
/*  Overflow and spacing                        */
/* -------------------------------------------- */

describe("the stylesheet", () => {
    const CSS = read("glog2d6.css");
    const classesUsed = new Set();

    // Strip the handlebars first. Matching only brace-free class attributes
    // silently skipped every conditionally-applied class -- which is most of
    // the states worth styling.
    for (const source of [...Object.values(SHEETS).map(read), ...PARTS.map(read)]) {
        const bare = source
            .replace(/\{\{![\s\S]*?\}\}/g, " ")
            .replace(/\{\{[^{}]*\}\}/g, " ");
        for (const [, group] of bare.matchAll(/class="([^"]*)"/g)) {
            for (const name of group.split(/\s+/)) {
                // A name left dangling on a hyphen is the stem of an
                // interpolated class (glog-tile-{{kind}}), not a class.
                if (!name.startsWith("glog-") || name.includes("{") || name.endsWith("-")) continue;
                classesUsed.add(name);
            }
        }
    }

    it("found the classes the sheet uses", () => {
        expect(classesUsed.size).toBeGreaterThan(40);
    });

    it("styles every one of them", () => {
        // Substring matching would let `.glog-row-btn` satisfy `.glog-row`, so
        // the selector has to end where the class name does.
        const styled = name => new RegExp(`\\.${name}(?![\\w-])`).test(CSS);
        const unstyled = [...classesUsed].filter(name => !styled(name));
        expect(unstyled, `used but never styled: ${unstyled.join(", ")}`).toEqual([]);
    });

    /**
     * The compact rows carry explicit heights precisely so this sum is knowable
     * rather than emergent. If it stops fitting the frame, the palette starts
     * clipping its own footer, which is exactly what it did before.
     */
    it("fits the compact stack inside the compact frame", () => {
        const rows = { vitals: 16, tiles: 38, attributes: 32, skills: 18 * 2 + 4, footer: 18 };
        const gaps = 4 * 4;
        const padding = 6 * 2;
        const windowHeader = 30;

        const needed = Object.values(rows).reduce((a, b) => a + b, 0) + gaps + padding + windowHeader;
        expect(needed).toBeLessThanOrEqual(modeSize(SHEET_MODES.COMPACT).height);
    });

    /**
     * Row 2 puts attributes beside skills. They only share a baseline if the
     * two stacks are the same height.
     */
    it("matches the attribute and skill stack heights in full mode", () => {
        const attributes = 44;
        const skills = 20 * 2 + 4;
        expect(skills).toBe(attributes);
    });

    it("never lets the sheet scroll sideways", () => {
        expect(CSS).toMatch(/\.glog-sheet\s*\{[^}]*overflow:\s*hidden/);
        for (const rule of ["\\.glog-rows", "\\.glog-panel-body"]) {
            const block = new RegExp(`${rule}\\s*\\{[^}]*\\}`).exec(CSS)?.[0] ?? "";
            expect(block, `${rule} may scroll sideways`).toContain("overflow-x: hidden");
        }
    });

    /**
     * Long names are the usual cause of a sheet growing a horizontal scrollbar:
     * a flex child defaults to min-width:auto and refuses to shrink below its
     * content.
     */
    it("lets every text row shrink below its content", () => {
        for (const name of ["glog-row-name", "glog-entry-name", "glog-skill-label", "glog-name"]) {
            const block = new RegExp(`\\.${name}\\s*\\{[^}]*\\}`).exec(CSS)?.[0] ?? "";
            expect(block, `.${name} does not clip`).toMatch(/text-overflow:\s*ellipsis/);
            expect(block, `.${name} does not wrap or hide`).toMatch(/overflow:\s*hidden/);
        }
    });

    /**
     * The class-name sweep above only collects `glog-` prefixed names, so the
     * `is-` state modifiers need saying out loud. A torch has three states and
     * they have to be three colours, or "running low" and "about to go out"
     * look identical.
     */
    it("gives each badge state a rule of its own", () => {
        for (const state of ["is-danger", "is-low", "is-lit"]) {
            expect(CSS, `.glog-badge.${state} is unstyled`)
                .toMatch(new RegExp(`\\.glog-badge\\.${state}\\s*\\{`));
        }
    });

    it("keeps the wounds panel from crowding out features", () => {
        const block = /\.glog-panel-wounds\s*\{[^}]*\}/.exec(CSS)?.[0] ?? "";
        expect(block).toMatch(/max-height/);
    });
});

/* -------------------------------------------- */
/*  Everything that is not a character          */
/* -------------------------------------------- */

/**
 * NPCs share the character sheet class and hirelings extend it, but both keep
 * their own templates. The character layout -- its window class, its two sizes,
 * the window-content padding those rely on -- must not follow them there.
 */
describe("the sheets that are not characters", () => {
    const sheet = read("module/actor/actor-sheet.mjs");
    const defaults = /static get defaultOptions\(\)[\s\S]*?\n    \}/.exec(sheet)[0];

    it("leaves the shared defaults sized for an NPC", () => {
        expect(defaults).toContain("width: 600");
        expect(defaults).not.toContain("glog-character");
    });

    it("puts the character window class on characters only", () => {
        // Anchored on the definition, not the call in the constructor.
        const applied = /\n    _applyModeOptions\(\)[\s\S]*?\n    \}/.exec(sheet)[0];
        expect(applied).toMatch(/type !== "character"\)\s*return/);
        expect(applied).toContain("glog-character");
    });

    /** That class is the hook the padding and overflow rules hang off. */
    it("scopes the window chrome to that class", () => {
        const css = read("glog2d6.css");
        expect(css).toMatch(/\.window-app\.glog-character \.window-content/);
        expect(css).not.toMatch(/\.window-app\.glog2d6 \.window-content/);
    });

    it("keeps the hireling template off the new parts", () => {
        for (const file of ["templates/actor/actor-hireling-sheet.hbs"]) {
            expect(read(file), `${file} should not use the character parts`).not.toMatch(/\{\{>\s*(band|tests|panel-)/);
        }
    });
});

/* -------------------------------------------- */
/*  Glyphs                                      */
/* -------------------------------------------- */

/**
 * The sheet declares one family: Roboto, then Signika, then the system stack.
 * Foundry bundles Signika; Roboto is only there if the player's machine has it.
 * So every character the templates use has to live in the plain Latin range
 * both of them actually ship, or somebody gets a row of tofu.
 */
describe("the characters the sheet prints", () => {
    /** The Google Fonts "latin" subset, which is what Signika ships. */
    const SAFE = new Set([
        " ", "·", "×", "é",
        "–", "—", "‘", "’", "“", "”",
        "…", "′", "−"
    ]);

    it.each([...Object.values(SHEETS), ...PARTS])("%s prints nothing exotic", file => {
        const offenders = new Set();
        for (const char of read(file)) {
            if (char.charCodeAt(0) > 127 && !SAFE.has(char)) offenders.add(char);
        }
        expect([...offenders], `unsafe glyphs: ${[...offenders].join(" ")}`).toEqual([]);
    });

    it("declares exactly one family, and lets form controls inherit it", () => {
        const css = read("glog2d6.css");
        const families = [...css.matchAll(/font-family:\s*([^;]+);/g)].map(m => m[1].trim());
        const declared = families.filter(f => f !== "inherit");

        expect(new Set(declared).size, `more than one family: ${declared.join(" | ")}`).toBe(1);
        expect(declared[0]).toContain("Signika");
        // Controls do not inherit font-family on their own.
        expect(css).toMatch(/\.glog-sheet input[\s\S]{0,120}font-family:\s*inherit/);
    });

    /**
     * Foundry ships Font Awesome 6 *free*. Pro-only icons render as an empty
     * box, which is how `fa-sword` sat invisible on the old inventory rows.
     */
    it("uses no Font Awesome Pro icons", () => {
        const PRO_ONLY = ["fa-sword", "fa-axe", "fa-helmet-battle", "fa-bow-arrow", "fa-dagger"];
        for (const file of [...Object.values(SHEETS), ...PARTS]) {
            const source = read(file);
            for (const icon of PRO_ONLY) {
                expect(source.includes(icon), `${file} uses Pro-only ${icon}`).toBe(false);
            }
        }
    });
});

/* -------------------------------------------- */
/*  Partial registration                        */
/* -------------------------------------------- */

/**
 * An unregistered partial is not a blank section -- Handlebars throws, and the
 * whole sheet fails to render. The list in the entry point and the files on
 * disk have to agree in both directions.
 */
describe("the parts the sheet is assembled from", () => {
    const entry = read("glog2d6.mjs");
    const onDisk = PARTS.map(file => file.split("/").pop().replace(".hbs", "")).sort();

    const registered = (() => {
        const block = /registerPartial\([\s\S]*?parts\/\$\{name\}/.exec(entry);
        const list = /for \(const name of \[([\s\S]*?)\]\)/.exec(entry);
        expect(block, "the parts are no longer registered in a loop").not.toBeNull();
        return [...list[1].matchAll(/"([\w-]+)"/g)].map(m => m[1]).sort();
    })();

    it("registers every part that exists", () => {
        expect(registered).toEqual(onDisk);
    });

    it("registers every part the templates actually ask for", () => {
        const used = new Set();
        for (const source of [...Object.values(SHEETS).map(read), ...PARTS.map(read)]) {
            for (const [, name] of source.matchAll(/\{\{>\s*([\w-]+)/g)) used.add(name);
        }

        const missing = [...used].filter(name => !registered.includes(name));
        expect(missing, `used but never registered: ${missing.join(", ")}`).toEqual([]);
    });

    it("preloads both sheet templates", () => {
        expect(entry).toContain("actor/actor-character-sheet.hbs");
        expect(entry).toContain("actor/actor-character-compact.hbs");
    });
});

/* -------------------------------------------- */
/*  Specificity traps                           */
/* -------------------------------------------- */

/**
 * `.glog-sheet button` has a higher specificity (0,1,1) than the single-class
 * rules that size each button (0,1,0). A `height` in the reset therefore wins
 * everywhere and flattens the whole utility stack to its line box -- which is
 * exactly what it did, silently, until a browser measured it.
 */
describe("the form-control reset", () => {
    const CSS = read("glog2d6.css");
    const reset = /\.glog-sheet input,\s*\n\.glog-sheet select,\s*\n\.glog-sheet button \{[^}]*\}/.exec(CSS);

    it("is still there", () => {
        expect(reset).not.toBeNull();
    });

    it("sets no height, which would outrank every sized button", () => {
        expect(reset[0]).not.toMatch(/(^|[\s;{])height:/);
    });

    it("still hands the family down, which controls do not inherit", () => {
        expect(reset[0]).toMatch(/font-family:\s*inherit/);
    });

    /** Every button the sheet sizes must out-specify core's own height. */
    it("gives every button on the sheet a height of its own", () => {
        const sized = ["glog-stack-btn", "glog-row-btn", "glog-md", "glog-tagbtn"];
        for (const name of sized) {
            const block = new RegExp(`\\.${name}\\s*\\{[^}]*\\}`).exec(CSS)?.[0] ?? "";
            expect(block, `.${name} does not set its own height`).toMatch(/height:/);
        }
        const step = /\.glog-hp-step \.hp-step\s*\{[^}]*\}/.exec(CSS)?.[0] ?? "";
        expect(step).toMatch(/height:/);
    });
});

/**
 * A number input reserves room for its spinner arrows. At the sizes this sheet
 * uses that is wider than a digit, so "10" rendered as "1(".
 */
describe("the hit point field", () => {
    const CSS = read("glog2d6.css");

    it("hides the spinners that would eat a digit", () => {
        expect(CSS).toMatch(/\.glog-hp-input[\s\S]{0,260}appearance:\s*textfield/);
        expect(CSS).toMatch(/\.glog-hp-input::-webkit-(outer|inner)-spin-button/);
    });

    it("is wide enough for two digits", () => {
        const block = /\.glog-hp-input \{[^}]*\}/.exec(CSS)[0];
        const width = Number(/width:\s*(\d+)px/.exec(block)[1]);
        expect(width).toBeGreaterThanOrEqual(30);
    });
});

/* -------------------------------------------- */
/*  The type scale                              */
/* -------------------------------------------- */

/**
 * Full has the room to set body copy a step larger than compact, but only the
 * text you *read* should take it. The headline numbers are already display
 * sized and go gawky when they grow, and the small-caps labels are set at the
 * size the boxes around them were measured for -- a step up there put THROWN
 * one pixel into an ellipsis.
 */
describe("the type scale", () => {
    const CSS = read("glog2d6.css");

    // Rule by rule: `.glog-sheet` appears more than once, and only one of them
    // declares the scale.
    const rules = [...CSS.matchAll(/([^{}]+)\{([^}]*)\}/g)]
        .map(m => ({ selector: m[1].trim().split("\n").pop().trim(), body: m[2] }));

    const scaleOf = selector => {
        const rule = rules.find(r => r.selector === selector && /--fs-/.test(r.body));
        return Object.fromEntries([...(rule?.body ?? "").matchAll(/(--fs-[\w-]+):\s*(\d+)px/g)]
            .map(([, k, v]) => [k, Number(v)]));
    };

    const base = scaleOf(".glog-sheet");
    const full = scaleOf(".glog-sheet.is-full");

    it("defines the whole scale once, on the sheet", () => {
        expect(Object.keys(base).length).toBeGreaterThanOrEqual(8);
        expect(base["--fs-body"]).toBeGreaterThan(0);
    });

    it("grows only the text you read", () => {
        expect(Object.keys(full).sort()).toEqual(["--fs-body", "--fs-row", "--fs-skill"]);
        for (const token of Object.keys(full)) {
            expect(full[token], `${token} is not actually bigger in full`)
                .toBeGreaterThan(base[token]);
        }
    });

    it("leaves the headline numbers and small-caps labels alone", () => {
        for (const token of ["--fs-tile", "--fs-attr", "--fs-name", "--fs-micro", "--fs-small"]) {
            expect(full[token], `${token} must not be overridden for the full sheet`)
                .toBeUndefined();
        }
    });

    /** Compact was measured to the pixel; it must not inherit the full scale. */
    it("keeps the compact sizes literal so they never follow", () => {
        const compactRules = [...CSS.matchAll(/\.is-compact[^{]*\{([^}]*)\}/g)].map(m => m[1]);
        const sized = compactRules.filter(r => /font-size:/.test(r));

        expect(sized.length).toBeGreaterThanOrEqual(3);
        for (const rule of sized) {
            expect(rule, "a compact rule reads a scale token").not.toMatch(/font-size:\s*var\(/);
        }
    });

    it("sizes the sheet from the scale rather than from stray pixels", () => {
        const start = CSS.indexOf("   CHARACTER SHEET");
        const strays = rules
            .filter(r => CSS.indexOf(r.selector) > start)
            .filter(r => !r.selector.includes("is-compact"))
            // The empty-state glyph is an icon, not type.
            .filter(r => !r.selector.includes("glog-empty"))
            .filter(r => /font-size:\s*\d+px/.test(r.body))
            .map(r => r.selector);

        expect(strays, "these bypass the scale").toEqual([]);
    });
});

/* -------------------------------------------- */
/*  Nothing the old sheet showed got dropped    */
/* -------------------------------------------- */

/**
 * The tab rewrite quietly lost a handful of item and spell details. These pin
 * the ones that came back, so the next layout change has to be deliberate
 * about dropping them rather than silently doing it.
 */
describe("what the item rows carry", () => {
    const doc = () => render("full", { loaded: true });

    it("puts the facts the row has no width for on its tooltip", () => {
        const pane = doc().querySelector('.tab[data-tab="inventory"]');
        const rows = [...pane.querySelectorAll(".glog-row[data-item-id]")];
        const titles = rows.map(r => r.getAttribute("title")).filter(Boolean);

        expect(titles.length).toBe(rows.length);
        expect(titles.join(" ")).toContain("armour");
        expect(titles.some(t => /\d+ slot/.test(t))).toBe(true);
    });

    it("shows a torch's light radius", () => {
        expect(doc().body.textContent).toContain("30/60ft");
    });

    it("marks the torch that is actually burning", () => {
        const lit = [...doc().querySelectorAll(".glog-badge.is-lit")];
        expect(lit).toHaveLength(1);
        expect(lit[0].textContent.trim()).toBe("LIT");
    });

    /** Three tiers, not two: plenty, running low, about to go out. */
    it.each([
        [4, []],
        [1.5, ["is-low"]],
        [0.5, ["is-danger"]]
    ])("grades %sh of torch left as %s", (remaining, expected) => {
        const hbs = environment();
        const ctx = context({ loaded: true, mode: "full" });
        const torch = ctx.itemsByKind.carried.find(i => i.type === "torch");
        torch.system.duration.remaining = remaining;

        const d = new JSDOM(hbs.compile(read(SHEETS.full))(ctx)).window.document;
        const badge = [...d.querySelectorAll(".glog-badge")]
            .find(b => b.textContent.trim() === `${remaining}h`);

        expect(badge, `no badge for ${remaining}h`).not.toBeNull();
        for (const cls of ["is-low", "is-danger"]) {
            expect(badge.classList.contains(cls), `${remaining}h should${expected.includes(cls) ? "" : " not"} be ${cls}`)
                .toBe(expected.includes(cls));
        }
    });
});

describe("what the spell cards carry", () => {
    const doc = () => render("full", { loaded: true });

    it("shows the spell's art", () => {
        expect(doc().querySelectorAll(".glog-spell-img").length)
            .toBe(doc().querySelectorAll(".glog-spell").length);
    });

    it("shows how long a spell lasts when it says", () => {
        const hbs = environment();
        const ctx = context({ loaded: true, mode: "full" });
        ctx.itemsByKind.spells[0].system.duration = "one hour per die";

        const d = new JSDOM(hbs.compile(read(SHEETS.full))(ctx)).window.document;
        expect(d.querySelector(".glog-spell-meta").textContent).toContain("one hour per die");
    });

    it("says nothing about duration when the spell does not", () => {
        expect(doc().querySelector(".glog-spell-meta")).toBeNull();
    });

    /** Inventory stays dense; only the spell cards get art. */
    it("leaves the inventory rows without art", () => {
        expect(doc().querySelector(".glog-row img")).toBeNull();
    });
});

describe("rolling a feature", () => {
    /** One visual language for "press this and dice happen". */
    it("uses the same button as spending magic dice", () => {
        const d = render("full", { loaded: true });
        const roll = d.querySelector(".feature-roll-btn");

        expect(roll).not.toBeNull();
        expect(roll.classList.contains("glog-md")).toBe(true);
        expect(roll.classList.contains("glog-tagbtn")).toBe(false);
    });
});

describe("the feature tag", () => {
    it("names the class and template together rather than a bare key", () => {
        const hbs = environment();
        const ctx = context({ loaded: true, mode: "full" });
        const [feature] = ctx.itemsByKind.features;
        feature.system.classSource = "Fighter";
        feature.system.template = "D";

        const d = new JSDOM(hbs.compile(read(SHEETS.full))(ctx)).window.document;
        const tags = [...d.querySelectorAll(".glog-tag")].map(t => t.textContent.trim());

        expect(tags).toContain("Fighter D");
        expect(tags).not.toContain("D");
    });

    it("prints nothing rather than an empty tag when there is nothing to say", () => {
        const hbs = environment();
        const ctx = context({ loaded: true, mode: "full" });
        for (const f of ctx.itemsByKind.features) {
            f.system.classSource = "";
            f.system.template = "";
        }

        const d = new JSDOM(hbs.compile(read(SHEETS.full))(ctx)).window.document;
        const empty = [...d.querySelectorAll(".feature-card .glog-tag")]
            .filter(t => !t.textContent.trim());
        expect(empty).toEqual([]);
    });
});

/**
 * The stored template values, the dropdown that edits them, and the labels the
 * badge prints all have to agree, or a feature shows one thing on the sheet and
 * another in its own item sheet.
 */
describe("feature templates", () => {
    it("offers every value the system writes", () => {
        const config = read("module/item/item-sheet-config.mjs");
        const block = /FEATURE_TEMPLATES = Object\.freeze\(\{([\s\S]*?)\}\)/.exec(config)[1];

        for (const key of ["level-0", "A", "B", "C", "D", "X", "scar"]) {
            expect(block, `${key} is not offered in the feature sheet`)
                .toMatch(new RegExp(`(^|\\s)"?${key}"?\\s*:`, "m"));
        }
    });

    /** Dropping it would silently reassign every feature already stored so. */
    it("still lists the legacy spelling", () => {
        expect(read("module/item/item-sheet-config.mjs")).toMatch(/custom:\s*"/);
    });

    it("writes X, not custom, wherever a feature has no template", () => {
        const sources = ["scripts/initialize-content.mjs", "template.json"];
        for (const file of sources) {
            expect(read(file), `${file} still writes the old default`)
                .not.toMatch(/"?template"?:\s*"custom"/);
        }
        expect(read("module/systems/wounds.mjs")).toMatch(/template:\s*"scar"/);
    });
});
