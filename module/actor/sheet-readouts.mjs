/**
 * View models for the character sheet.
 *
 * Both layouts render the same facts at different sizes, so the facts are
 * assembled here once, as plain data, and the templates only lay them out.
 * Nothing in this file touches a Foundry global.
 */

import { BreakageCalculator, BREAKABLE_TYPES } from "../systems/breakage-calculator.mjs";
import { combatEffectLabel } from "../systems/wounds.mjs";

const num = value => Number(value) || 0;

export function signed(value) {
    const n = num(value);
    return n >= 0 ? `+${n}` : `−${Math.abs(n)}`;
}

/**
 * ATTACK tiles. One per way this character can swing right now; the labels stay
 * short because every tile in the band shares one row's width.
 */
export function attackTiles(context = {}) {
    const combat = context.combat ?? {};
    const analysis = context.weaponAnalysis ?? {};
    const base = num(combat.attack?.value) + num(combat.attack?.bonus);

    const tile = (label, extra = {}) => ({
        label,
        value: signed(base),
        action: "attack",
        ...extra
    });

    if (!analysis.hasWeapons) return [tile("Attack")];

    switch (analysis.attackButtonType) {
        case "split":
            return [
                tile("Melee", { attackType: "melee" }),
                analysis.hasThrowable
                    ? tile("Thrown", { attackType: "thrown" })
                    : tile("Ranged", { attackType: "ranged" })
            ];
        case "firearm":
            return [{
                label: "Firearm",
                value: signed(base + num(combat.firearm?.bonus)),
                action: "attack"
            }];
        case "ranged":
            return [tile("Ranged")];
        case "melee":
            return [tile("Melee")];
        default:
            return [tile("Unarmed")];
    }
}

/**
 * DEFEND tiles. Acrobat Training splits melee from ranged; everyone else has
 * one number. Colour already says these are defence, so the split tiles can
 * carry the bare direction as a label.
 */
export function defenseTiles(context = {}) {
    const defense = context.defense ?? {};

    if (context.hasAcrobatTraining) {
        return [
            { label: "Melee", value: num(defense.meleeTotal), action: "defend-melee" },
            { label: "Ranged", value: num(defense.rangedTotal), action: "defend-ranged" }
        ];
    }

    return [{ label: "Defend", value: num(defense.total), action: "defend" }];
}

/**
 * A bar reads by length, so it needs a percentage, and it changes colour once
 * you are hurt enough for that to be the first thing you notice.
 */
export function hpBar(value, max) {
    const cap = Math.max(1, num(max));
    const current = Math.max(0, Math.min(num(value), cap));
    const percent = Math.round((current / cap) * 100);

    return {
        percent,
        value: current,
        max: cap,
        hurt: percent <= 50
    };
}

/**
 * Magic dice as pips: spent dice stay in place, dimmed, so the pool's size is
 * still readable when it is empty.
 */
export function magicDicePips(current, max) {
    const total = Math.max(0, num(max));
    const spent = Math.max(0, Math.min(num(current), total));

    return Array.from({ length: total }, (_, index) => ({ filled: index < spent }));
}

/**
 * Slot pressure, as a sentence fragment the inventory bar can print.
 */
export function encumbranceNote(inventory = {}) {
    const total = num(inventory.encumbrance);
    if (total <= 0) return null;

    const fromSlots = num(inventory.slotEncumbrance);
    const fromKit = num(inventory.equipmentEncumbrance);

    if (fromSlots > 0 && fromKit > 0) {
        return `−${total} (${fromSlots} slots + ${fromKit} equipment)`;
    }
    if (fromSlots > 0) return `−${total} from slot overflow`;
    if (fromKit > 0) return `−${total} from equipment`;
    return `−${total}`;
}

/**
 * The "In effect" panel: everything currently changing a number you would
 * otherwise read straight off the sheet. A row is only worth printing when it
 * differs from the plain case, except movement and encumbrance, which are
 * always worth a glance.
 */
export function inEffectRows({ system = {}, items = [] } = {}) {
    const rows = [];
    const details = system.details ?? {};
    const base = num(details.movement);
    const effective = details.effectiveMovement === undefined
        ? base
        : num(details.effectiveMovement);

    rows.push({
        label: "Movement",
        value: effective === base ? `${base}` : `${effective} (was ${base})`,
        impaired: effective < base
    });

    const worn = items.filter(item =>
        BREAKABLE_TYPES.includes(item?.type) && item?.system?.equipped
    );

    const armour = worn.filter(item => item.type === "armor" || item.type === "shield");
    if (armour.length) {
        const broken = armour.filter(item => BreakageCalculator.isBroken(item.system?.breakage?.level));
        const damaged = armour.filter(item => BreakageCalculator.isDamaged(item.system?.breakage?.level));
        const note = broken.length
            ? `${broken.length} broken`
            : damaged.length ? `${damaged.length} damaged` : "sound";

        rows.push({
            label: "Armour",
            value: `+${num(system.defense?.armor)} · ${note}`,
            impaired: broken.length > 0 || damaged.length > 0
        });
    }

    const weapons = worn.filter(item => item.type === "weapon");
    const hurtWeapon = weapons.find(item => !BreakageCalculator.isFine(item.system?.breakage?.level));
    if (hurtWeapon) {
        rows.push({
            label: "Weapon",
            value: `${hurtWeapon.name} · ${BreakageCalculator.label(hurtWeapon.system?.breakage?.level).toLowerCase()}`,
            impaired: true
        });
    }

    // Just the number here: the inventory bar is where the breakdown fits.
    const encumbrance = num(system.inventory?.encumbrance);
    rows.push({
        label: "Encumbrance",
        value: encumbrance > 0 ? `\u2212${encumbrance}` : "none",
        impaired: encumbrance > 0
    });

    return rows;
}

/**
 * Wound penalties, as rows the same panel can print underneath. The wounds
 * panel says *what* you are carrying; this says what it is costing you.
 */
export function woundEffectRows(effects = {}) {
    const rows = [];

    for (const [stat, penalty] of Object.entries(effects.statReductions ?? {})) {
        if (num(penalty) > 0) {
            rows.push({ label: stat.toUpperCase(), value: `−${num(penalty)}`, impaired: true });
        }
    }

    if (num(effects.movementReduction) > 0) {
        rows.push({ label: "Movement", value: `capped at ${num(effects.movementReduction)}'`, impaired: true });
    }
    if (num(effects.attackPenalty) > 0) {
        rows.push({ label: "Attack", value: `−${num(effects.attackPenalty)}`, impaired: true });
    }
    if (num(effects.defensePenalty) > 0) {
        rows.push({ label: "Defence", value: `−${num(effects.defensePenalty)}`, impaired: true });
    }
    if (num(effects.reactionPenalty) > 0) {
        rows.push({ label: "Reaction", value: `−${num(effects.reactionPenalty)}`, impaired: true });
    }
    if (effects.noHealing) {
        rows.push({ label: "Healing", value: "none until treated", impaired: true });
    } else if (effects.extendedHealing) {
        rows.push({ label: "Healing", value: "slower than usual", impaired: true });
    }
    if (num(effects.sleepDisruption) > 0) {
        rows.push({ label: "Sleep", value: `worth ${num(effects.sleepDisruption)} of normal`, impaired: true });
    }

    for (const effect of effects.combatEffects ?? []) {
        rows.push({ label: "In combat", value: combatEffectLabel(effect), impaired: true });
    }

    if (effects.deathOnFailure) {
        rows.push({ label: "Trauma", value: "a failed save kills you", impaired: true });
    }

    return rows;
}

export const ATTRIBUTE_KEYS = Object.freeze(["str", "dex", "con", "int", "wis", "cha"]);

export const SKILLS = Object.freeze([
    { key: "sneak", label: "Sneak" },
    { key: "hide", label: "Hide" },
    { key: "disguise", label: "Disguise" },
    { key: "reaction", label: "Reaction" },
    { key: "diplomacy", label: "Diplomacy" },
    { key: "intimidate", label: "Intimidate" }
]);

/**
 * Attribute tiles. The roll is 2d6 + mod, so the modifier is the headline and
 * the raw score is bookkeeping -- compact drops the score entirely.
 */
export function attributeTiles(attributes = {}) {
    return ATTRIBUTE_KEYS.map(key => {
        const attr = attributes[key] ?? {};
        const mod = num(attr.mod);
        const effectiveMod = attr.effectiveMod === undefined ? mod : num(attr.effectiveMod);
        const value = num(attr.value);
        const effectiveValue = attr.effectiveValue === undefined ? value : num(attr.effectiveValue);

        return {
            key,
            label: key.toUpperCase(),
            value,
            effectiveValue,
            mod,
            effectiveMod,
            display: signed(effectiveMod),
            negative: effectiveMod < 0,
            impaired: effectiveMod < mod || effectiveValue < value,
            improved: effectiveMod > mod || effectiveValue > value,
            changed: effectiveMod !== mod || effectiveValue !== value
        };
    });
}

/**
 * Skill chips, in the order the old sheet listed them.
 */
export function skillChips(skills = {}) {
    return SKILLS.map(({ key, label }) => {
        const bonus = num(skills[key]?.bonus);
        return { key, label, action: key, bonus, display: signed(bonus), negative: bonus < 0 };
    });
}

const CARRIED_TYPES = Object.freeze(["weapon", "armor", "shield", "gear", "torch"]);

/**
 * Split the actor's items into the lists the panels render.
 *
 * Doing it here rather than with a filter inside each `{{#each}}` is what lets
 * a panel tell "this character has no spells" from "this character has no
 * items at all" -- the templates used to conflate the two.
 */
export function partitionItems(items = []) {
    const bucket = { carried: [], features: [], spells: [], notes: [] };

    for (const item of items) {
        if (CARRIED_TYPES.includes(item?.type)) bucket.carried.push(item);
        else if (item?.type === "feature") bucket.features.push(item);
        else if (item?.type === "spell") bucket.spells.push(item);
        else if (item?.type === "note") bucket.notes.push(item);
    }

    return bucket;
}

/**
 * How many magic dice a spell may be cast with right now. Zero available means
 * an empty list, and the card says so instead of offering a button that fails.
 */
export function castingOptions(current) {
    const available = Math.max(0, num(current));
    return Array.from({ length: available }, (_, index) => index + 1);
}

/**
 * The whole truth about an item, as one line for its row's tooltip.
 *
 * A 28px row has space for the few facts you scan by -- name, damage, whether
 * it is broken. Size, armour type and light radius matter too, just not enough
 * to spend row width on, so they live here instead of being dropped.
 */
export function itemSummary(item) {
    const system = item?.system ?? {};
    const name = item?.name ?? "";
    const parts = [];

    switch (item?.type) {
        case "weapon":
            if (system.size) parts.push(String(system.size));
            if (system.damage) parts.push(`${system.damage} damage`);
            break;
        case "armor":
            if (system.type) parts.push(String(system.type));
            parts.push(`+${num(system.armorBonus)} armour`);
            break;
        case "shield":
            parts.push("shield", `+${num(system.armorBonus)} armour`);
            break;
        case "torch": {
            const bright = num(system.lightRadius?.bright);
            const dim = num(system.lightRadius?.dim);
            if (bright || dim) parts.push(`${bright}/${dim} ft light`);
            parts.push(system.duration?.enabled
                ? `${num(system.duration.remaining)}h left`
                : "burns indefinitely");
            break;
        }
        case "gear":
            if (system.size) parts.push(String(system.size));
            if (num(system.value)) parts.push(`${num(system.value)}gp`);
            break;
    }

    if (num(system.encumbrancePenalty) > 0) {
        parts.push(`\u2212${num(system.encumbrancePenalty)} encumbrance`);
    }
    if (num(system.slots) > 0) {
        parts.push(`${num(system.slots)} slot${num(system.slots) === 1 ? "" : "s"}`);
    }
    if (BREAKABLE_TYPES.includes(item?.type) && !BreakageCalculator.isFine(system.breakage?.level)) {
        parts.push(BreakageCalculator.label(system.breakage?.level).toLowerCase());
    }

    return parts.length ? `${name} \u2014 ${parts.join(" \u00b7 ")}` : name;
}

/**
 * What a feature's tag says: the class it came from and the template that
 * granted it, together -- "Fighter D".
 *
 * The template key alone was meaningless on the sheet ("A" tells you nothing
 * without the class), and the class alone could not tell two templates apart.
 */
export const FEATURE_TEMPLATE_LABELS = Object.freeze({
    "level-0": "0",
    // Older features were written this way before untemplated ones settled
    // on X; they mean the same thing.
    custom: "X"
});

export function featureBadge(item) {
    const system = item?.system ?? {};
    const name = String(item?.name ?? "");
    const template = String(system.template ?? "").trim();

    // A scar is something that happened to you, not a template you were
    // granted. Newer ones say so in the field; older ones only in the name.
    if (template === "scar" || name.startsWith("Scar:")) return "Scar";

    const label = FEATURE_TEMPLATE_LABELS[template] ?? template;
    const source = String(system.classSource ?? "").trim();

    if (!label) return source;
    return source ? `${source} ${label}` : label;
}
