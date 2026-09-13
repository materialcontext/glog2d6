/**
 * A character's class has two jobs that pull in opposite directions: it is a
 * label on the sheet, and it is the key that "Add class features" looks up.
 *
 * So it gets two fields. `system.details.class` is the label -- type whatever
 * you want. `system.details.classKey` is the key -- either the exact name of a
 * class the system knows about, or the custom sentinel, which means "no
 * lookup". The dropdown writes both; picking Custom frees the label and leaves
 * the lookup deliberately empty rather than pointing it at a name that
 * resolves to nothing.
 */

export const CUSTOM_CLASS_KEY = "custom";
export const CUSTOM_CLASS_LABEL = "Custom";
export const NO_CLASS_KEY = "";

/**
 * Options for the class dropdown: every known class, then Custom.
 */
export function classOptions(classNames = []) {
    const known = classNames
        .filter(name => typeof name === "string" && name.length)
        .map(name => ({ key: name, label: name }));

    return [...known, { key: CUSTOM_CLASS_KEY, label: CUSTOM_CLASS_LABEL }];
}

export function isCustomClass(classKey) {
    return classKey === CUSTOM_CLASS_KEY;
}

/**
 * The key feature lookup should use, or "" when there is nothing to look up.
 *
 * Actors written before `classKey` existed carry only a display name, so a name
 * that matches a known class is read as that class. A name that does not match
 * was already a custom class by another route, and stays one.
 */
export function effectiveClassKey(details = {}, classNames = []) {
    const stored = details.classKey;

    if (typeof stored === "string" && stored.length) {
        return isCustomClass(stored) ? NO_CLASS_KEY : stored;
    }

    const name = typeof details.class === "string" ? details.class : "";
    return classNames.includes(name) ? name : NO_CLASS_KEY;
}

/**
 * Which option the dropdown should show as selected.
 */
export function selectedClassOption(details = {}, classNames = []) {
    const stored = details.classKey;
    if (typeof stored === "string" && stored.length) {
        return isCustomClass(stored) || classNames.includes(stored)
            ? stored
            : CUSTOM_CLASS_KEY;
    }

    const name = typeof details.class === "string" ? details.class : "";
    if (!name) return NO_CLASS_KEY;

    return classNames.includes(name) ? name : CUSTOM_CLASS_KEY;
}

/**
 * The update to apply when someone picks an option from the dropdown.
 *
 * Picking a known class overwrites the label too, because the label was the
 * class name and now the class is different. Picking Custom keeps whatever
 * label is there so a rename is one step, not two -- unless the label is still
 * the name of a known class, in which case it would read as that class and is
 * cleared so there is a visibly empty field to type into.
 */
export function classUpdateFor(choice, details = {}, classNames = []) {
    if (choice === CUSTOM_CLASS_KEY) {
        const name = typeof details.class === "string" ? details.class : "";
        const keep = name && !classNames.includes(name);

        return {
            "system.details.class": keep ? name : "",
            "system.details.classKey": CUSTOM_CLASS_KEY
        };
    }

    if (!choice || !classNames.includes(choice)) {
        return {
            "system.details.class": "",
            "system.details.classKey": NO_CLASS_KEY
        };
    }

    return {
        "system.details.class": choice,
        "system.details.classKey": choice
    };
}

/**
 * What to print when there is no class at all.
 */
export function classDisplayName(details = {}) {
    const name = typeof details.class === "string" ? details.class.trim() : "";
    return name || "Classless";
}
