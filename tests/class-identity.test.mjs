import { describe, expect, it } from "vitest";

import {
    CUSTOM_CLASS_KEY,
    classDisplayName,
    classOptions,
    classUpdateFor,
    effectiveClassKey,
    isCustomClass,
    selectedClassOption
} from "../module/actor/class-identity.mjs";

const CLASSES = ["Acrobat", "Fighter", "Wizard"];

describe("class options", () => {
    it("lists every known class and then Custom", () => {
        const options = classOptions(CLASSES);
        expect(options.map(o => o.key)).toEqual([...CLASSES, CUSTOM_CLASS_KEY]);
        expect(options.at(-1).label).toBe("Custom");
    });

    it("survives an empty or dirty class list", () => {
        expect(classOptions([]).map(o => o.key)).toEqual([CUSTOM_CLASS_KEY]);
        expect(classOptions([null, "", "Fighter"]).map(o => o.key))
            .toEqual(["Fighter", CUSTOM_CLASS_KEY]);
    });
});

/**
 * The key is what "Add class features" looks up, so it must never resolve to a
 * name that has no feature list behind it.
 */
describe("the lookup key", () => {
    it("is the class you picked", () => {
        expect(effectiveClassKey({ class: "Fighter", classKey: "Fighter" }, CLASSES)).toBe("Fighter");
    });

    it("is empty for a custom class, however it is labelled", () => {
        expect(effectiveClassKey({ class: "Bone Surgeon", classKey: CUSTOM_CLASS_KEY }, CLASSES)).toBe("");
        expect(effectiveClassKey({ class: "Fighter", classKey: CUSTOM_CLASS_KEY }, CLASSES)).toBe("");
    });

    it("is empty when nothing is set", () => {
        expect(effectiveClassKey({}, CLASSES)).toBe("");
        expect(effectiveClassKey({ class: "" }, CLASSES)).toBe("");
        expect(effectiveClassKey(undefined, CLASSES)).toBe("");
    });

    /**
     * Actors saved before classKey existed carry only a label. A label that
     * names a real class still means that class -- otherwise every existing
     * character would silently lose its features on upgrade.
     */
    it("reads a legacy actor's label as its class", () => {
        expect(effectiveClassKey({ class: "Wizard" }, CLASSES)).toBe("Wizard");
        expect(effectiveClassKey({ class: "Wizard", classKey: "" }, CLASSES)).toBe("Wizard");
    });

    it("treats a legacy label that matches nothing as custom", () => {
        expect(effectiveClassKey({ class: "Bone Surgeon" }, CLASSES)).toBe("");
    });
});

describe("which option the dropdown shows", () => {
    it("shows the class for a known class", () => {
        expect(selectedClassOption({ class: "Fighter", classKey: "Fighter" }, CLASSES)).toBe("Fighter");
        expect(selectedClassOption({ class: "Fighter" }, CLASSES)).toBe("Fighter");
    });

    it("shows Custom for a custom class", () => {
        expect(selectedClassOption({ class: "Bone Surgeon", classKey: CUSTOM_CLASS_KEY }, CLASSES))
            .toBe(CUSTOM_CLASS_KEY);
        expect(selectedClassOption({ class: "Bone Surgeon" }, CLASSES)).toBe(CUSTOM_CLASS_KEY);
    });

    /** A key naming a class this world no longer has is a custom class now. */
    it("shows Custom for a key that no longer resolves", () => {
        expect(selectedClassOption({ class: "Knight", classKey: "Knight" }, CLASSES))
            .toBe(CUSTOM_CLASS_KEY);
    });

    it("shows nothing when there is no class", () => {
        expect(selectedClassOption({}, CLASSES)).toBe("");
    });
});

describe("picking from the dropdown", () => {
    it("writes both fields for a known class", () => {
        expect(classUpdateFor("Wizard", { class: "Fighter", classKey: "Fighter" }, CLASSES)).toEqual({
            "system.details.class": "Wizard",
            "system.details.classKey": "Wizard"
        });
    });

    it("clears both when you pick nothing", () => {
        expect(classUpdateFor("", { class: "Fighter" }, CLASSES)).toEqual({
            "system.details.class": "",
            "system.details.classKey": ""
        });
    });

    /** Renaming a custom class should be one step, not two. */
    it("keeps a custom label when you pick Custom", () => {
        expect(classUpdateFor(CUSTOM_CLASS_KEY, { class: "Bone Surgeon" }, CLASSES)).toEqual({
            "system.details.class": "Bone Surgeon",
            "system.details.classKey": CUSTOM_CLASS_KEY
        });
    });

    /**
     * Going Fighter -> Custom must not leave the sheet reading "Fighter", which
     * would look like a Fighter that had quietly lost its feature list.
     */
    it("clears a label that is still the name of a real class", () => {
        expect(classUpdateFor(CUSTOM_CLASS_KEY, { class: "Fighter", classKey: "Fighter" }, CLASSES)).toEqual({
            "system.details.class": "",
            "system.details.classKey": CUSTOM_CLASS_KEY
        });
    });

    it("refuses a class it does not know", () => {
        expect(classUpdateFor("Knight", { class: "Fighter" }, CLASSES))
            .toEqual({ "system.details.class": "", "system.details.classKey": "" });
    });
});

describe("what the sheet prints", () => {
    it("uses the label", () => {
        expect(classDisplayName({ class: "Bone Surgeon" })).toBe("Bone Surgeon");
    });

    it("says something rather than nothing when there is no class", () => {
        expect(classDisplayName({})).toBe("Classless");
        expect(classDisplayName({ class: "   " })).toBe("Classless");
    });

    it("marks the custom sentinel", () => {
        expect(isCustomClass(CUSTOM_CLASS_KEY)).toBe(true);
        expect(isCustomClass("Fighter")).toBe(false);
    });
});
