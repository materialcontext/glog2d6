import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import {
    DEFAULT_SHEET_MODE,
    SHEET_MODES,
    SHEET_MODE_SIZES,
    allowsEditMode,
    isSheetMode,
    modeFlagPath,
    modeSize,
    modeTemplate,
    modeToggleIcon,
    modeToggleLabel,
    normalizeMode,
    otherMode
} from "../module/actor/sheet-mode.mjs";

const ROOT = resolve(import.meta.dirname, "..");

describe("sheet modes", () => {
    it("knows its own two modes and nothing else", () => {
        expect(isSheetMode("compact")).toBe(true);
        expect(isSheetMode("full")).toBe(true);
        expect(isSheetMode("palette")).toBe(false);
        expect(isSheetMode(undefined)).toBe(false);
    });

    it("falls back to full for anything it does not recognise", () => {
        expect(normalizeMode(undefined)).toBe(DEFAULT_SHEET_MODE);
        expect(normalizeMode(null)).toBe(SHEET_MODES.FULL);
        expect(normalizeMode("nonsense")).toBe(SHEET_MODES.FULL);
        expect(normalizeMode("compact")).toBe(SHEET_MODES.COMPACT);
    });

    it("toggles, and toggling twice comes back", () => {
        expect(otherMode(SHEET_MODES.FULL)).toBe(SHEET_MODES.COMPACT);
        expect(otherMode(otherMode(SHEET_MODES.FULL))).toBe(SHEET_MODES.FULL);
        expect(otherMode("nonsense")).toBe(SHEET_MODES.COMPACT);
    });

    /**
     * The flag is keyed by actor so one user's choice about one character never
     * reaches another character, and lives on the user so it never reaches
     * another player looking at the same character.
     */
    it("keys the preference by actor", () => {
        expect(modeFlagPath("abc123")).toBe("sheetMode.abc123");
        expect(modeFlagPath("abc123")).not.toBe(modeFlagPath("def456"));
    });

    it("hands out the sizes the layouts were drawn against", () => {
        expect(modeSize(SHEET_MODES.COMPACT)).toEqual({ width: 290, height: 216 });
        expect(modeSize(SHEET_MODES.FULL)).toEqual({ width: 900, height: 850 });
        expect(modeSize("nonsense")).toEqual(SHEET_MODE_SIZES.full);
    });

    it("points at templates that exist", () => {
        for (const mode of Object.values(SHEET_MODES)) {
            const path = modeTemplate(mode).replace("systems/glog2d6/", "");
            expect(() => readFileSync(resolve(ROOT, path), "utf8")).not.toThrow();
        }
        expect(modeTemplate("compact")).not.toBe(modeTemplate("full"));
    });

    /** The control says where it takes you, not where you are. */
    it("labels the toggle with its destination", () => {
        expect(modeToggleLabel(SHEET_MODES.FULL)).toBe("Compact");
        expect(modeToggleLabel(SHEET_MODES.COMPACT)).toBe("Full");
        expect(modeToggleIcon(SHEET_MODES.FULL)).toContain("compress");
        expect(modeToggleIcon(SHEET_MODES.COMPACT)).toContain("expand");
    });

    it("offers edit mode only where there is something to edit", () => {
        expect(allowsEditMode(SHEET_MODES.FULL)).toBe(true);
        expect(allowsEditMode(SHEET_MODES.COMPACT)).toBe(false);
    });
});
