/**
 * Choosing who a request is asked of.
 *
 * Written for the recon dialog and now shared by every kind of request, which
 * is the point: a GM calling for a trauma save picks the party the same way
 * they pick who is keeping watch.
 *
 * Pure: no Foundry globals, so the awkward parts -- which names a filter
 * matches, which boxes came back ticked -- are testable on their own.
 */

/**
 * The characters a request can be asked of, in an order you can search by eye.
 * World order is insertion order, which stops being findable at about a dozen.
 */
export function actorChoices(actors = []) {
    return [...actors]
        .filter(actor => actor?.type === "character")
        .map(actor => ({
            id: actor.id,
            name: actor.name ?? "",
            nameLower: String(actor.name ?? "").toLowerCase()
        }))
        .sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Whether a row survives the filter. An empty filter matches everything, and
 * matching is on a substring rather than a prefix so "ford" finds "Mareth of
 * the Ford".
 */
export function matchesFilter(nameLower, term) {
    const needle = String(term ?? "").trim().toLowerCase();
    if (!needle) return true;
    return String(nameLower ?? "").includes(needle);
}

const PREFIX = "actors.";

/**
 * The actor ids ticked in the submitted form.
 *
 * An unticked box arrives as false rather than not at all, so the value has
 * to be read rather than the key's presence. The boxes are named
 * `actors.<id>`, which reaches `_updateObject` flat or expanded into an
 * `actors` object depending on how the form was submitted -- both are read
 * here, because a picker that silently finds nobody is the worst of the two
 * failure modes.
 */
export function selectedActorIds(data = {}) {
    const flat = Object.entries(data)
        .filter(([key, value]) => key.startsWith(PREFIX) && value)
        .map(([key]) => key.slice(PREFIX.length));

    const nested = Object.entries(data?.actors ?? {})
        .filter(([, value]) => value)
        .map(([id]) => id);

    return [...new Set([...flat, ...nested])].filter(Boolean);
}

/**
 * Wire the character picker: filtering, select all/none, and a count that
 * tells the truth about a list you may only be seeing part of.
 *
 * Takes a root element rather than a Foundry Application, so the fiddly part
 * -- what the count says once a filter hides a ticked row -- can be driven in
 * a test instead of only in a running game.
 *
 * @param {HTMLElement} root
 * @returns {() => void} a refresh, called once before returning
 */
export function wireActorPicker(root) {
    const rows = [...root.querySelectorAll(".picker-actor")];
    const boxes = rows.map(row => row.querySelector("input[type=checkbox]"));
    const count = root.querySelector(".picker-count");
    const note = root.querySelector(".picker-hidden-note");

    const refresh = () => {
        const selected = boxes.filter(box => box.checked).length;
        const hidden = rows.filter(row => row.hidden);
        const hiddenSelected = hidden.filter(row => boxes[rows.indexOf(row)].checked).length;

        if (count) count.textContent = `${selected} selected`;
        if (note) {
            note.textContent = hidden.length
                ? `${hidden.length} hidden${hiddenSelected ? `, ${hiddenSelected} selected` : ""}`
                : "";
        }
    };

    // Filtering hides rows, it never unticks them -- typing a name should not
    // silently drop someone you had already chosen. That makes a selection you
    // cannot see possible, which is what the note above is for.
    root.querySelector(".picker-filter")?.addEventListener("input", event => {
        const term = event.currentTarget.value;
        for (const row of rows) row.hidden = !matchesFilter(row.dataset.actorName, term);
        refresh();
    });

    // "All" means what you can currently see, once a filter is on.
    root.querySelector(".picker-select-all")?.addEventListener("click", () => {
        rows.forEach((row, index) => { if (!row.hidden) boxes[index].checked = true; });
        refresh();
    });

    root.querySelector(".picker-select-none")?.addEventListener("click", () => {
        for (const box of boxes) box.checked = false;
        refresh();
    });

    for (const box of boxes) box.addEventListener("change", refresh);

    refresh();
    return refresh;
}
