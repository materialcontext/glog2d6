/**
 * The form the GM fills in to call for a roll.
 *
 * Which inputs a request needs is a property of the request type, so the
 * dialog shows and reads them from that list rather than from a chain of
 * `if (type === ...)`. Adding a kind of request adds a row to the catalogue;
 * the form follows.
 *
 * Pure: the parts that decide what is shown and what is submitted are driven
 * from a root element, so they can be exercised without a running game.
 */

import { ROLL_TYPES, rollTypeOptions } from "../systems/roll-requests.mjs";

/** Asked for by every kind of request. */
export const ALWAYS = Object.freeze(["description"]);

/** The inputs one type of request uses. */
export function fieldsFor(type) {
    return [...(ROLL_TYPES[type]?.fields ?? []), ...ALWAYS];
}

const NUMERIC = new Set(["target", "damage"]);

/**
 * The parameters of a submitted request: what this type asked for, and
 * nothing else. A stale attribute left behind by switching type away from an
 * attribute check should not travel with a recon check.
 */
export function requestParams(type, data = {}) {
    const params = {};

    for (const field of fieldsFor(type)) {
        const value = data[field];
        if (value === undefined || value === null || value === "") continue;

        if (NUMERIC.has(field)) {
            const number = parseInt(value, 10);
            if (Number.isFinite(number)) params[field] = number;
            continue;
        }
        params[field] = value;
    }

    return params;
}

/**
 * Show the groups the chosen type uses, and hide the rest.
 *
 * @param {HTMLElement} root
 * @returns {() => void} a refresh, called once before returning
 */
export function wireRequestFields(root) {
    const select = root.querySelector("[name=type]");
    const groups = [...root.querySelectorAll("[data-field]")];

    const refresh = () => {
        const shown = new Set(fieldsFor(select?.value));
        for (const group of groups) group.hidden = !shown.has(group.dataset.field);
    };

    select?.addEventListener("change", refresh);
    refresh();
    return refresh;
}

/** The type choices, for the template. */
export function typeChoices() {
    return rollTypeOptions();
}
