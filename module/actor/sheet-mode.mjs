/**
 * Which shape a character sheet is wearing.
 *
 * Two layouts, one document: `compact` is a palette of the things you click in
 * a fight, `full` is the whole character. Nothing here touches Foundry -- the
 * sheet class is the adapter that reads and writes the flag.
 */

export const SHEET_MODES = Object.freeze({
    COMPACT: "compact",
    FULL: "full"
});

export const DEFAULT_SHEET_MODE = SHEET_MODES.FULL;

/**
 * Frame sizes the two layouts were drawn against.
 *
 * These are *window* sizes, not content sizes. Compact's rows carry explicit
 * heights that add up to 160; the window also has to find room for the 6px
 * padding on each side of the content and the ~30px window header, which is
 * where the rest of the 216 goes. Changing the height without changing the
 * stylesheet's row heights is how the palette starts overflowing.
 *
 * The width is set by the window header rather than by the content, which
 * needs far less. The frame carries the actor name, core's Prototype Token and
 * Close controls -- both of which render their labels as text -- and our own
 * Edit and mode-toggle buttons. That is roughly 290px of controls before the
 * name gets a pixel, and at 290 the close button fell off the end entirely.
 */
export const SHEET_MODE_SIZES = Object.freeze({
    [SHEET_MODES.COMPACT]: Object.freeze({ width: 420, height: 216 }),
    [SHEET_MODES.FULL]: Object.freeze({ width: 900, height: 850 })
});

/**
 * The preference lives on the *user*, keyed by actor id. A GM flipping an NPC
 * to compact must not change what its player sees on the same document.
 */
export const SHEET_MODE_FLAG = "sheetMode";

export function isSheetMode(value) {
    return value === SHEET_MODES.COMPACT || value === SHEET_MODES.FULL;
}

export function normalizeMode(value) {
    return isSheetMode(value) ? value : DEFAULT_SHEET_MODE;
}

export function otherMode(mode) {
    return normalizeMode(mode) === SHEET_MODES.COMPACT
        ? SHEET_MODES.FULL
        : SHEET_MODES.COMPACT;
}

export function modeSize(mode) {
    return SHEET_MODE_SIZES[normalizeMode(mode)];
}

export function modeFlagPath(actorId) {
    return `${SHEET_MODE_FLAG}.${actorId}`;
}

export function modeTemplate(mode) {
    return normalizeMode(mode) === SHEET_MODES.COMPACT
        ? "systems/glog2d6/templates/actor/actor-character-compact.hbs"
        : "systems/glog2d6/templates/actor/actor-character-sheet.hbs";
}

/**
 * The header button says where it takes you, not where you are.
 */
export function modeToggleLabel(mode) {
    return otherMode(mode) === SHEET_MODES.COMPACT ? "Compact" : "Full";
}

export function modeToggleIcon(mode) {
    return otherMode(mode) === SHEET_MODES.COMPACT
        ? "fa-solid fa-compress"
        : "fa-solid fa-expand";
}

/**
 * Compact is a palette, not an editor: there is nothing to type into it, so it
 * never offers edit mode and never renders an edit-mode variant.
 */
export function allowsEditMode(mode) {
    return normalizeMode(mode) === SHEET_MODES.FULL;
}
