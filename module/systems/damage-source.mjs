/**
 * What hit you.
 *
 * Wounds used to be rolled with no idea where the damage came from, which had
 * two consequences. Anatomy was biased by the *victim's* equipped weapon --
 * getting shot while holding a sword rolled melee anatomy -- and every attacker
 * in the world drew from the same wound table.
 *
 * A damage source answers both: the tags that bias where you were hit, and the
 * table the wound is drawn from. Nothing here touches a Foundry global; the
 * documents are read for their plain fields and the rest is data.
 */

/** The world table used when nothing more specific applies. */
export const DEFAULT_WOUND_TABLE = "GLOG Wounds Table";

const text = value => (typeof value === "string" ? value.trim() : "");

/**
 * The weapon tags of an item, if it is a weapon at all.
 *
 * A weapon with no declared type is melee -- that is what a sword with a blank
 * field is -- but anything that is not a weapon contributes no bias rather than
 * a made-up one.
 */
export function weaponTags(item) {
    if (item?.type !== "weapon") return [];

    const raw = item.system?.weaponType;
    if (Array.isArray(raw)) return raw.filter(Boolean);
    return text(raw) ? [text(raw)] : ["melee"];
}

/**
 * A document's own wound table, by name or uuid. Weapons and actors both may
 * declare one; anything else has none.
 */
export function woundTableRef(document) {
    return text(document?.system?.woundTable) || null;
}

/**
 * Describe the blow.
 *
 * Precedence for the table is weapon, then attacker, then whatever the caller
 * names, then the world default -- a flaming sword burns whoever swings it, a
 * dire wolf mauls with whatever it bites, and everything else falls through.
 */
export function damageSource({ actor = null, item = null, tags = null, table = null } = {}) {
    return {
        actorId: actor?.id ?? null,
        actorName: text(actor?.name) || null,
        itemId: item?.id ?? null,
        itemName: text(item?.name) || null,
        tags: Array.isArray(tags) ? tags.filter(Boolean) : weaponTags(item),
        table: woundTableRef(item) ?? woundTableRef(actor) ?? (text(table) || null)
    };
}

/**
 * The same blow, drawn from a table named outright.
 *
 * Precedence inside `damageSource` answers "what is this attacker like"; this
 * answers "what was this particular blow", which is the GM's to say and so
 * wins over both the weapon and the attacker.
 */
export function withTable(source, table) {
    const named = text(table);
    return named ? { ...source, table: named } : source;
}

/** An empty source: damage from nowhere in particular. */
export function unknownSource() {
    return damageSource({});
}

/** Which table this blow draws from. */
export function woundTableFor(source, { fallback = DEFAULT_WOUND_TABLE } = {}) {
    return source?.table || fallback;
}

/**
 * The tags that bias anatomy. An unknown source biases nothing, and
 * `bodyPartTable` already reads that as the plain unweighted list.
 */
export function anatomyTags(source) {
    return Array.isArray(source?.tags) ? source.tags : [];
}

/** How the chat card names the blow, when it can name it at all. */
export function describeSource(source) {
    const by = source?.actorName;
    const via = source?.itemName;

    if (by && via) return `${by}'s ${via}`;
    return by || via || null;
}
