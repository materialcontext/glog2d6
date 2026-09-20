/**
 * Choosing who is looking, for a recon check.
 *
 * Pure: no Foundry globals, so the awkward parts -- which names a filter
 * matches, which boxes came back ticked -- are testable on their own.
 */

/**
 * The characters a recon check can target, in an order you can search by eye.
 * World order is insertion order, which stops being findable at about a dozen.
 */
export function reconActorChoices(actors = []) {
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

/**
 * The actor ids ticked in the submitted form. Checkboxes arrive as
 * `actors.<id>`, and an unticked one arrives as false rather than not at all.
 */
export function selectedActorIds(data = {}) {
    return Object.entries(data)
        .filter(([key, value]) => key.startsWith("actors.") && value)
        .map(([key]) => key.slice("actors.".length))
        .filter(Boolean);
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
export function wireReconSelection(root) {
    const rows = [...root.querySelectorAll(".recon-actor")];
    const boxes = rows.map(row => row.querySelector("input[type=checkbox]"));
    const count = root.querySelector(".recon-count");
    const note = root.querySelector(".recon-hidden-note");

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
    root.querySelector(".recon-filter")?.addEventListener("input", event => {
        const term = event.currentTarget.value;
        for (const row of rows) row.hidden = !matchesFilter(row.dataset.actorName, term);
        refresh();
    });

    // "All" means what you can currently see, once a filter is on.
    root.querySelector(".recon-select-all")?.addEventListener("click", () => {
        rows.forEach((row, index) => { if (!row.hidden) boxes[index].checked = true; });
        refresh();
    });

    root.querySelector(".recon-select-none")?.addEventListener("click", () => {
        for (const box of boxes) box.checked = false;
        refresh();
    });

    for (const box of boxes) box.addEventListener("change", refresh);

    refresh();
    return refresh;
}
