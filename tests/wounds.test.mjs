import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import Handlebars from "handlebars";
import { JSDOM } from "jsdom";
import { describe, expect, it } from "vitest";

import {
    carriedBonus,
    describeBodyPartRoll,
    recordsBodyPart,
    BODY_PARTS,
    BODY_PART_BIAS,
    SEVERITY_DIE,
    TREATMENT_REQUIREMENTS,
    WOUND_STATES,
    WOUND_STATE_ORDER,
    aggregateWoundEffects,
    autoRemovalElapsed,
    bodyPartFor,
    bodyPartTable,
    combatEffectLabel,
    decorateWounds,
    hpRerollFormula,
    nextWoundState,
    normalizeWound,
    parseDuration,
    scarFromWound,
    treatmentRequirement,
    woundCount,
    woundRemoval,
    woundSeverity
} from "../module/systems/wounds.mjs";

const ROOT = resolve(import.meta.dirname, "..");
const WOUNDS = JSON.parse(readFileSync(resolve(ROOT, "data/wounds.json"), "utf8"));
const TABLE = WOUNDS.wounds;

const DAY = 86400000;
const wound = (typeId, extra = {}) => ({
    id: `${typeId}-1`,
    typeId,
    name: typeId,
    effects: TABLE.find(w => w.id === typeId)?.effects ?? {},
    ...extra
});

/* -------------------------------------------- */
/*  Severity                                    */
/* -------------------------------------------- */

describe("wound severity", () => {
    const band = excess => {
        const results = [];
        for (let die = 1; die <= SEVERITY_DIE; die++) results.push(woundSeverity(die, excess, TABLE.length));
        return [Math.min(...results), Math.max(...results)];
    };

    it("is a roll, not a lookup", () => {
        // The old code did `table[damage - 1]`, so damage 3 was always wound 3.
        const results = new Set();
        for (let die = 1; die <= SEVERITY_DIE; die++) results.add(woundSeverity(die, 3, TABLE.length));
        expect(results.size).toBeGreaterThan(1);
    });

    it("lets damage set the band and the die set the place in it", () => {
        expect(band(1)).toEqual([1, 7]);
        expect(band(6)).toEqual([4, 9]);
        expect(band(12)).toEqual([7, 12]);
    });

    it("never gets less severe as damage climbs", () => {
        for (let die = 1; die <= SEVERITY_DIE; die++) {
            for (let excess = 1; excess < 12; excess++) {
                expect(woundSeverity(die, excess + 1, TABLE.length))
                    .toBeGreaterThanOrEqual(woundSeverity(die, excess, TABLE.length));
            }
        }
    });

    it("can still reach both ends of the table", () => {
        expect(woundSeverity(1, 1, TABLE.length)).toBe(1);
        expect(woundSeverity(SEVERITY_DIE, 99, TABLE.length)).toBe(TABLE.length);
    });

    it("stays inside the table whatever it is given", () => {
        for (const [die, excess] of [[0, 0], [-5, -5], [999, 999], [NaN, NaN], [null, undefined]]) {
            const result = woundSeverity(die, excess, TABLE.length);
            expect(result).toBeGreaterThanOrEqual(1);
            expect(result).toBeLessThanOrEqual(TABLE.length);
        }
    });
});

/**
 * A body that is already broken has less left to give. This is what the worst
 * entries mean by "take 2 wounds instead of 1": the second of those two is
 * read one row worse than the first, because by then you are carrying it.
 */
describe("wounds already carried", () => {
    it("push the lookup one row down each", () => {
        const clean = woundSeverity(6, 4, TABLE.length);
        expect(woundSeverity(6, 4, TABLE.length, 1)).toBe(clean + 1);
        expect(woundSeverity(6, 4, TABLE.length, 3)).toBe(clean + 3);
    });

    it("change nothing for someone who is unhurt", () => {
        expect(woundSeverity(6, 4, TABLE.length, 0)).toBe(woundSeverity(6, 4, TABLE.length));
    });

    /** The worst row is the worst there is; it cannot push past the end. */
    it("still stop at the bottom of the table", () => {
        expect(woundSeverity(6, 4, TABLE.length, 99)).toBe(TABLE.length);
    });

    it("are never a mercy, whatever arrives", () => {
        for (const carried of [-3, NaN, null, undefined, "lots"]) {
            expect(carriedBonus(carried), String(carried)).toBe(0);
        }
        expect(carriedBonus(2.7)).toBe(2);
    });
});

/* -------------------------------------------- */
/*  Anatomy                                     */
/* -------------------------------------------- */

describe("body parts", () => {
    it("matches the shipped table", () => {
        expect([...BODY_PARTS]).toEqual(WOUNDS.bodyParts);
    });

    it("only ever names a real body part", () => {
        // The head is reachable by a weapon and not by the game's own d6, so
        // it is the one part the canonical list does not carry.
        const valid = new Set([...BODY_PARTS, "Head"]);
        for (const [tag, table] of Object.entries(BODY_PART_BIAS)) {
            expect(table, tag).toHaveLength(6);
            for (const part of table) expect(valid, `${tag}: ${part}`).toContain(part);
        }
    });

    /**
     * A firearm that cannot find a head is the gap that made this worth
     * changing: the canonical table has no head at all, so a blow from a
     * known weapon is the only way to take one.
     */
    it("lets every weapon reach the head, and the bare table reach none", () => {
        for (const [tag, table] of Object.entries(BODY_PART_BIAS)) {
            expect(table, `${tag} cannot reach a head`).toContain("Head");
        }
        expect(BODY_PARTS).not.toContain("Head");
    });

    /** Fists go for the face more than anything else does. */
    it("sends fists to the head twice over", () => {
        expect(BODY_PART_BIAS.unarmed.filter(p => p === "Head")).toHaveLength(2);
    });

    it("sends bullets to the body and axes to the limbs", () => {
        const firearm = BODY_PART_BIAS.firearm.filter(p => ["Chest", "Abdomen"].includes(p)).length;
        const melee = BODY_PART_BIAS.melee.filter(p => ["Chest", "Abdomen"].includes(p)).length;
        expect(firearm).toBeGreaterThan(melee);

        const meleeLimbs = BODY_PART_BIAS.melee.filter(p => ["Arm", "Hand", "Leg", "Shoulder"].includes(p)).length;
        expect(meleeLimbs).toBeGreaterThan(3);
    });

    it("lets the shot win when a weapon is both thrown and melee", () => {
        expect(bodyPartTable(["melee", "thrown"])).toBe(BODY_PART_BIAS.thrown);
        expect(bodyPartTable(["melee", "firearm"])).toBe(BODY_PART_BIAS.firearm);
    });

    it("falls back to the plain table for an unknown source", () => {
        expect(bodyPartTable([])).toBe(BODY_PARTS);
        expect(bodyPartTable(["nonsense"])).toBe(BODY_PARTS);
    });

    it("reads a d6 and clamps anything else", () => {
        expect(bodyPartFor(1, ["melee"])).toBe(BODY_PART_BIAS.melee[0]);
        expect(bodyPartFor(6, ["melee"])).toBe(BODY_PART_BIAS.melee[5]);
        expect(BODY_PARTS).toContain(bodyPartFor(0, []));
        expect(BODY_PARTS).toContain(bodyPartFor(99, []));
    });

    it("accepts a bare string tag", () => {
        expect(bodyPartTable("firearm")).toBe(BODY_PART_BIAS.firearm);
    });
});

/* -------------------------------------------- */
/*  Aggregate effects                           */
/* -------------------------------------------- */

describe("aggregate wound effects", () => {
    it("adds up stat reductions from stacking wounds", () => {
        const totals = aggregateWoundEffects([wound("concussed"), wound("concussed", { id: "c2" })], TABLE);
        expect(totals.stats.int).toBe(2);
        expect(totals.stats.wis).toBe(2);
    });

    it("counts a non-stacking wound once, however many you carry", () => {
        // Hobbled says "does not stack" and used to stack anyway.
        const one = aggregateWoundEffects([wound("hobbled")], TABLE);
        const two = aggregateWoundEffects([wound("hobbled"), wound("hobbled", { id: "h2" })], TABLE);
        expect(two.movement).toBe(one.movement);

        const crushed = aggregateWoundEffects(
            [wound("crushed"), wound("crushed", { id: "c2" })], TABLE);
        expect(crushed.stats.str).toBe(1);
    });

    it("takes the worst movement reduction rather than summing", () => {
        expect(aggregateWoundEffects([wound("hobbled")], TABLE).movement).toBe(10);
    });

    it("surfaces the flags nothing used to read", () => {
        expect(aggregateWoundEffects([wound("slashed")], TABLE).healing).toBe(true);
        expect(aggregateWoundEffects([wound("crushed")], TABLE).extendedHealing).toBe(true);
        expect(aggregateWoundEffects([wound("doomed")], TABLE).deathOnFailure).toBe(true);
        expect(aggregateWoundEffects([wound("doomed")], TABLE).sleepDisruption).toBe(0.5);
        expect(aggregateWoundEffects([wound("broken")], TABLE).combatEffects)
            .toEqual(["unconscious_check"]);
    });

    it("lists each combat effect once", () => {
        const totals = aggregateWoundEffects([wound("broken"), wound("broken", { id: "b2" })], TABLE);
        expect(totals.combatEffects).toEqual(["unconscious_check"]);
    });

    it("sums the reaction penalty", () => {
        expect(aggregateWoundEffects([wound("smashed"), wound("smashed", { id: "s2" })], TABLE)
            .reactionPenalty).toBe(2);
    });

    it("is all zeroes for a character with no wounds", () => {
        const totals = aggregateWoundEffects([], TABLE);
        expect(Object.values(totals.stats).every(v => v === 0)).toBe(true);
        expect(totals.healing).toBe(false);
        expect(totals.combatEffects).toEqual([]);
    });

    it("ignores a wound whose type is no longer in the table", () => {
        expect(() => aggregateWoundEffects([{ typeId: "ghost" }], TABLE)).not.toThrow();
    });

    it("falls back to the instance's own snapshot when the table lost the entry", () => {
        const orphan = { typeId: "ghost", effects: { statReduction: { str: 2 } } };
        expect(aggregateWoundEffects([orphan], TABLE).stats.str).toBe(2);
    });

    it("handles every wound the table ships without throwing", () => {
        for (const entry of TABLE) {
            expect(() => aggregateWoundEffects([wound(entry.id)], TABLE), entry.id).not.toThrow();
        }
    });
});

/* -------------------------------------------- */
/*  Recovery                                    */
/* -------------------------------------------- */

describe("recovery track", () => {
    it("runs untreated to healing", () => {
        expect(WOUND_STATE_ORDER).toEqual(["untreated", "treated", "healing"]);
        expect(nextWoundState(WOUND_STATES.UNTREATED)).toBe(WOUND_STATES.TREATED);
        expect(nextWoundState(WOUND_STATES.TREATED)).toBe(WOUND_STATES.HEALING);
        expect(nextWoundState(WOUND_STATES.HEALING)).toBeNull();
    });

    it("treats an unknown state as needing treatment next", () => {
        expect(nextWoundState(undefined)).toBe(WOUND_STATES.TREATED);
    });

    it("defaults a wound stored before states existed to untreated", () => {
        expect(normalizeWound({ id: "a" }).state).toBe(WOUND_STATES.UNTREATED);
        expect(normalizeWound({ id: "a", state: "healing" }).state).toBe("healing");
        expect(normalizeWound({ id: "a", state: "nonsense" }).state).toBe(WOUND_STATES.UNTREATED);
    });

    it("is idempotent", () => {
        const once = normalizeWound({ id: "a" });
        expect(normalizeWound(once)).toEqual(once);
    });

    it("names what each wound needs before treatment", () => {
        expect(treatmentRequirement(wound("humiliated"))).toBe(TREATMENT_REQUIREMENTS.revenge);
        expect(treatmentRequirement(wound("ruptured"))).toBe(TREATMENT_REQUIREMENTS.medical);
        expect(treatmentRequirement(wound("maimed"))).toBe(TREATMENT_REQUIREMENTS.prosthetic);
        expect(treatmentRequirement(wound("concussed"))).toBe(TREATMENT_REQUIREMENTS.stitches);
    });
});

describe("clearing a wound", () => {
    const at = state => wound("concussed", { state });

    it("refuses an untreated wound and says what it needs", () => {
        const result = woundRemoval(at("untreated"), []);
        expect(result.allowed).toBe(false);
        expect(result.reason).toBe(TREATMENT_REQUIREMENTS.stitches);
    });

    it("refuses a treated wound until it has been rested off", () => {
        expect(woundRemoval(at("treated"), []).allowed).toBe(false);
    });

    it("allows a healing wound", () => {
        expect(woundRemoval(at("healing"), []).allowed).toBe(true);
    });

    it("holds Doomed back until it is the only wound left", () => {
        const doomed = wound("doomed", { state: "healing" });
        const other = wound("concussed", { id: "other" });
        expect(woundRemoval(doomed, [doomed, other]).allowed).toBe(false);
        expect(woundRemoval(doomed, [doomed]).allowed).toBe(true);
    });

    it("lets time clear a wound that carries its own timer", () => {
        const now = Date.now();
        const fresh = wound("maimed", { state: "untreated", dateAcquired: new Date(now).toISOString() });
        const old = wound("maimed", { state: "untreated", dateAcquired: new Date(now - 120 * DAY).toISOString() });

        expect(woundRemoval(fresh, [], now).allowed).toBe(false);
        expect(woundRemoval(old, [], now).allowed).toBe(true);
    });
});

describe("durations", () => {
    it("parses the tags the data uses", () => {
        expect(parseDuration("3months")).toBe(3 * 2629800000);
        expect(parseDuration("2 weeks")).toBe(2 * 604800000);
        expect(parseDuration("1day")).toBe(DAY);
    });

    it("returns null for anything else", () => {
        for (const bad of ["soon", "", null, undefined, "3 fortnights"]) {
            expect(parseDuration(bad), String(bad)).toBeNull();
        }
    });

    it("needs both a timer and a date to elapse", () => {
        expect(autoRemovalElapsed({ effects: {} })).toBe(false);
        expect(autoRemovalElapsed({ effects: { autoRemoval: "3months" } })).toBe(false);
        expect(autoRemovalElapsed({
            effects: { autoRemoval: "3months" }, dateAcquired: "not a date"
        })).toBe(false);
    });
});

/* -------------------------------------------- */
/*  Instances                                   */
/* -------------------------------------------- */

describe("wound instances", () => {
    it("reads multipleWounds, which nothing used to", () => {
        expect(woundCount(TABLE.find(w => w.id === "broken"))).toBe(2);
        expect(woundCount(TABLE.find(w => w.id === "doomed"))).toBe(2);
        expect(woundCount(TABLE.find(w => w.id === "marked"))).toBe(1);
        expect(woundCount(undefined)).toBe(1);
    });

    it("reads the max-HP reroll every wound promises", () => {
        expect(hpRerollFormula(wound("marked"))).toBe("1d6");
        expect(hpRerollFormula(wound("crushed"))).toBe("1d8");
        expect(hpRerollFormula(wound("smashed"))).toBeNull();
    });

    it("refuses a formula that is not a plain die", () => {
        expect(hpRerollFormula({ effects: { hpReroll: "1d6 + 4" } })).toBeNull();
        expect(hpRerollFormula({ effects: { hpReroll: 6 } })).toBeNull();
    });
});

/**
 * Every wound used to be stamped with a body part, which made a concussion
 * read as "took it in the arm". Only a wound whose own text asks the question
 * records an answer -- in the shipped data, Marked and nothing else.
 */
describe("which wounds are about where they landed", () => {
    it("is the one that asks", () => {
        expect(recordsBodyPart({ effects: { specialRoll: "bodyPart" } })).toBe(true);
    });

    it("is not the ones that do not", () => {
        expect(recordsBodyPart({ effects: { specialRoll: "maimed" } })).toBe(false);
        expect(recordsBodyPart({ effects: {} })).toBe(false);
        expect(recordsBodyPart(null)).toBe(false);
    });

    it("is exactly one of the wounds this system ships", () => {
        const asking = WOUNDS.wounds.filter(recordsBodyPart).map(w => w.id);
        expect(asking).toEqual(["marked"]);
    });

    /** Concussed is a head injury by its own effects; it has no limb. */
    it("is not the concussion that started this", () => {
        const concussed = WOUNDS.wounds.find(w => w.id === "concussed");
        expect(recordsBodyPart(concussed)).toBe(false);
        expect(concussed.effects.statReduction).toMatchObject({ int: 1, wis: 1 });
    });
});

describe("a description once the roll has happened", () => {
    const marked = () => WOUNDS.wounds.find(w => w.id === "marked").description;

    it("states the answer instead of asking for it", () => {
        const told = describeBodyPartRoll(marked(), "Head");
        expect(told).toContain("Rolled Head");
        expect(told).not.toContain("Roll 1d6 to see");
    });

    /**
     * The trailing "1: Leg, 2: Chest, ..." is instructions for a roll that has
     * already happened -- and a biased blow may not have rolled on that list
     * at all, which is how a head gets there.
     */
    it("drops the list of instructions for a roll already made", () => {
        const told = describeBodyPartRoll(marked(), "Head");
        expect(told).not.toContain("1: Leg");
        expect(told.trim().endsWith(".")).toBe(true);
    });

    it("leaves the max-HP reroll alone, which is a different d6", () => {
        expect(describeBodyPartRoll(marked(), "Arm")).toContain("reroll your 1d6 for max HP");
    });

    it("leaves a description alone when nothing was rolled", () => {
        expect(describeBodyPartRoll(marked(), "")).toBe(marked());
        expect(describeBodyPartRoll(undefined, "Arm")).toBe("");
    });
});

describe("scars", () => {
    const healed = {
        name: "Ruptured", bodyPart: "Shoulder",
        dateAcquired: "2026-01-02T00:00:00.000Z", effects: {}
    };

    /**
     * The cause names the scar. It used to be the body part, so a wound that
     * had been stamped with a limb became "Scar: Arm" and lost what actually
     * happened.
     */
    it("names itself after what caused it, and says where", () => {
        expect(scarFromWound(healed).name).toBe("Scar: Ruptured (Shoulder)");
    });

    it("says only the cause when the wound was never placed", () => {
        expect(scarFromWound({ name: "Doomed", effects: {} }).name).toBe("Scar: Doomed");
    });

    it("has something to call itself even for a nameless wound", () => {
        expect(scarFromWound({ effects: {} }).name).toBe("Scar: Old Wound");
    });

    it("is an inactive feature, so nothing mechanical picks it up", () => {
        const scar = scarFromWound(healed);
        expect(scar.type).toBe("feature");
        expect(scar.system.active).toBe(false);
    });

    it("remembers the wound in its description", () => {
        expect(scarFromWound(healed).system.description).toContain("Ruptured");
        expect(scarFromWound(healed).system.description).toContain("shoulder");
    });

    it("survives a wound with almost nothing on it", () => {
        expect(() => scarFromWound({})).not.toThrow();
        expect(() => scarFromWound(undefined)).not.toThrow();
    });
});

/* -------------------------------------------- */
/*  Sheet context                               */
/* -------------------------------------------- */

describe("decorated wounds", () => {
    it("carries the state, its label, the next step and the removal gate", () => {
        const [decorated] = decorateWounds([wound("concussed")]);
        expect(decorated.state).toBe("untreated");
        expect(decorated.stateLabel).toBe("Untreated");
        expect(decorated.nextState).toBe("treated");
        expect(decorated.removal.allowed).toBe(false);
    });

    it("stops offering a next step once healing", () => {
        const [decorated] = decorateWounds([wound("concussed", { state: "healing" })]);
        expect(decorated.nextState).toBeNull();
        expect(decorated.removal.allowed).toBe(true);
    });

    it("judges last_wound against the whole list", () => {
        const doomed = wound("doomed", { state: "healing" });
        const both = decorateWounds([doomed, wound("concussed", { id: "other" })]);
        expect(both[0].removal.allowed).toBe(false);
    });

    it("handles an empty list", () => {
        expect(decorateWounds([])).toEqual([]);
    });
});

describe("effect labels", () => {
    it("reads the tags the data declares", () => {
        expect(combatEffectLabel("unconscious_check")).toBe("Roll to stay conscious when struck");
    });

    it("degrades a tag it does not know into something readable", () => {
        expect(combatEffectLabel("some_new_thing")).toBe("some new thing");
    });
});

/* -------------------------------------------- */
/*  The wounds panel                            */
/* -------------------------------------------- */

/**
 * Wounds lost their tab and became a panel in the character column. The panel
 * still owes the same four things: one row per wound, its state, what it is
 * waiting on, and controls that only appear in edit mode.
 */
describe("wounds panel", () => {
    const SOURCE = readFileSync(resolve(ROOT, "templates/actor/parts/panel-character.hbs"), "utf8");

    const hbs = Handlebars.create();
    hbs.registerHelper("gt", (a, b) => a > b);
    hbs.registerHelper("or", (...args) => args.slice(0, -1).some(Boolean));
    hbs.registerHelper("not", value => !value);
    hbs.registerHelper("eq", (a, b) => a === b);
    hbs.registerHelper("contains", (haystack, needle) => String(haystack).includes(needle));
    hbs.registerHelper("upperCase", s => String(s).toUpperCase());
    hbs.registerHelper("woundStateLabel", s => s);
    hbs.registerHelper("hasFeatureRoll", () => false);
    hbs.registerHelper("hasFeatureTip", () => false);
    hbs.registerHelper("getFeatureTip", () => "");
    hbs.registerHelper("getReputations", () => []);
    hbs.registerHelper("getReputationDescription", () => ({}));

    function render(wounds, { editMode = true } = {}) {
        const decorated = decorateWounds(wounds);
        const html = hbs.compile(SOURCE)({
            editMode,
            wounds: decorated,
            itemsByKind: { features: [] },
            system: {
                wounds: {
                    count: decorated.length,
                    list: wounds,
                    effects: aggregateWoundEffects(decorated, TABLE)
                }
            }
        });
        return new JSDOM(`<div id="w">${html}</div>`).window.document;
    }

    it("renders an empty state with no wounds", () => {
        const doc = render([]);
        expect(doc.querySelector(".glog-panel-wounds .glog-empty")).not.toBeNull();
        expect(doc.querySelector(".glog-wound")).toBeNull();
    });

    it("renders one row per wound, tagged with its state", () => {
        const doc = render([wound("concussed"), wound("hobbled", { id: "h", state: "healing" })]);
        const rows = [...doc.querySelectorAll(".glog-wound")];
        expect(rows).toHaveLength(2);
        expect(rows[0].classList.contains("wound-state-untreated")).toBe(true);
        expect(rows[1].classList.contains("wound-state-healing")).toBe(true);
    });

    it("shows what a wound is waiting on", () => {
        const doc = render([wound("humiliated")]);
        expect(doc.querySelector(".wound-requirement").textContent).toContain("revenge");
    });

    it("offers the next recovery step until the wound is healing", () => {
        expect(render([wound("concussed")]).querySelector(".advance-wound-btn")).not.toBeNull();
        expect(render([wound("concussed", { state: "healing" })])
            .querySelector(".advance-wound-btn")).toBeNull();
    });

    it("hides the controls outside edit mode", () => {
        const doc = render([wound("concussed")], { editMode: false });
        expect(doc.querySelector(".advance-wound-btn")).toBeNull();
        expect(doc.querySelector(".remove-wound-btn")).toBeNull();
        expect(doc.querySelector(".add-wound-btn")).toBeNull();
    });

    it("shows the body part when one was rolled", () => {
        const doc = render([wound("marked", { bodyPart: "Shoulder" })]);
        expect(doc.querySelector(".wound-part").textContent.trim()).toBe("SHOULDER");
    });

    it("marks the panel when wounds are carried, and not when they are not", () => {
        expect(render([wound("concussed")])
            .querySelector(".glog-panel-wounds").classList.contains("is-carrying")).toBe(true);
        expect(render([])
            .querySelector(".glog-panel-wounds").classList.contains("is-carrying")).toBe(false);
    });
});
