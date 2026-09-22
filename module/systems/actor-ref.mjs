/**
 * Finding the actor a chat card points at.
 *
 * Cards outlive the moment that made them, so they carry a reference rather
 * than the document. That reference has to be a uuid, never an id: a token
 * that is not linked to its prototype carries a *synthetic* actor, and
 * Foundry gives that actor its base actor's id -- `game.actors` therefore
 * hands back the sheet in the sidebar rather than the creature on the canvas.
 * Damage written that way lands on the prototype, and hit points read that
 * way are the prototype's.
 *
 * Bare ids are still accepted, because cards posted before this existed carry
 * them, and because a linked actor is the same document either way.
 */

/**
 * @param {string} ref an actor or token uuid, or a plain actor id
 * @returns {object|null}
 */
export function actorFrom(ref) {
    const reference = typeof ref === "string" ? ref.trim() : "";
    if (!reference) return null;

    // No dot means a plain id, which only the world collection can answer.
    if (!reference.includes(".")) return game.actors?.get(reference) ?? null;

    let found = null;
    try {
        // Without `strict: false` this throws for anything it cannot answer
        // on the spot, which for our purposes is simply "not found".
        found = fromUuidSync(reference, { strict: false });
    } catch (error) {
        console.warn("glog2d6 | Could not resolve an actor reference", reference, error);
        return null;
    }

    if (!found) return null;
    return found.documentName === "Token" ? found.actor ?? null : found;
}

/** How a card should refer to an actor: its uuid, which a token keeps its own. */
export function actorRef(actor) {
    return actor?.uuid ?? actor?.id ?? "";
}
