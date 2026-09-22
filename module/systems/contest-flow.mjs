/**
 * Running a contest in a live game: who is on the other end, what the card
 * says, and what happens to the loser.
 *
 * The rules themselves are in systems/contest, which knows nothing about
 * Foundry. This is the adapter -- targets, chat cards, hit points -- and it
 * is deliberately the only place that reads them.
 */

import {
    CONTEST,
    OUTCOMES,
    callsForTraumaSave,
    criticalExcess,
    defenseModifier,
    excessDamage,
    resolveContest,
    takesWounds
} from "./contest.mjs";
import { attackModifier } from "./contest.mjs";
import { actorFrom, actorRef } from "./actor-ref.mjs";
import { RELAY, askTheGM, onlyTheGMCan } from "./gm-relay.mjs";
import { callForTraumaSave } from "./gm-roll-system.mjs";

/**
 * Who the roll is against.
 *
 * A target, not a selection: Foundry lets anyone target any token but only
 * select the ones they own, so targeting is the half of the pair that works
 * from both ends of the table. Targeting yourself is read as targeting
 * nobody.
 */
export function opponentActor(self = null) {
    const targets = [...(game.user?.targets ?? [])];
    const actors = targets.map(token => token?.actor).filter(Boolean);
    const other = actors.find(actor => actor.id !== self?.id);

    return other ?? null;
}

/**
 * Resolve a roll against whoever is targeted, or report that nobody was.
 *
 * @returns {object|null} the outcome, plus the opponent, or null when the
 *          roll stands on its own as it always has.
 */
export function contestAgainst({ mode, actor, roll, weaponType = "melee", strMod = 0, attackData = null }) {
    const opponent = opponentActor(actor);
    if (!opponent) return null;

    const attacking = mode !== CONTEST.DEFENSE;

    // Defending against something whose attack cannot be read would quietly
    // measure it as zero, which reads as a real contest against a target of
    // seven. Better to leave the roll standing on its own.
    if (!attacking && !attackData) return null;

    // Whoever is not rolling stands on seven plus what they would have added.
    const opponentModifier = attacking
        ? defenseModifier(opponent.system, weaponType)
        : attackModifier(attackData ?? {});

    const result = resolveContest({
        mode,
        rollTotal: roll.total,
        opponentModifier,
        doubleSixes: roll.isCriticalHit,
        snakeEyes: roll.isCriticalFailure,
        weaponType,
        strMod
    });

    return {
        ...result,
        mode,
        opponent,
        attacker: attacking ? actor : opponent,
        defender: attacking ? opponent : actor
    };
}

/**
 * The outcome in the words of whoever is reading it. On a defence card "HIT"
 * alone reads as though the defender hit something, when what happened is
 * that they were hit.
 */
const DEFENDING_LABELS = Object.freeze({
    [OUTCOMES.CRITICAL]: "Critical hit against you",
    [OUTCOMES.HIT]: "They hit",
    [OUTCOMES.MISS]: "They miss",
    [OUTCOMES.FUMBLE]: "They fumble"
});

const OUTCOME_CLASS = Object.freeze({
    [OUTCOMES.CRITICAL]: "text-success text-bold",
    [OUTCOMES.HIT]: "text-success",
    [OUTCOMES.MISS]: "text-muted",
    [OUTCOMES.FUMBLE]: "text-danger text-bold"
});

/** What the contest says, on the card of the roll that decided it. */
export function contestLine(contest) {
    if (!contest) return "";

    const defending = contest.mode === CONTEST.DEFENSE;
    const against = defending ? contest.attacker : contest.defender;
    const said = defending ? DEFENDING_LABELS[contest.outcome] : contest.label;

    return `
        <br><small>vs ${against.name} (${contest.target})</small>
        <br><strong class="${OUTCOME_CLASS[contest.outcome]}">${said.toUpperCase()}</strong>
        ${contest.hit && !contest.crit ? `<br><small>Base damage: ${contest.baseDamage}</small>` : ""}
        ${contest.crit ? `<br><small>They are on the floor; the die is doubled into the wound.</small>` : ""}`;
}

/**
 * The button that carries a landed blow into damage.
 *
 * The margin used to be interpolated as the literal string `{{roll.total}}`
 * into a template that was never compiled, so base damage was always NaN and
 * therefore always zero.
 */
export function damageButton(contest, { attacker, weaponId }) {
    if (!contest?.hit) return "";

    // Nothing to roll for a blow with no weapon behind it -- the margin is
    // the whole of the damage, so it goes straight to being spent.
    if (!weaponId) {
        return applyDamageButton({
            targetUuid: actorRef(contest.defender),
            amount: contest.baseDamage,
            dieTotal: 0,
            crit: contest.crit,
            attacker
        });
    }

    return `<br><button type="button" class="damage-roll-btn"
        data-attacker="${attacker}"
        data-weapon-id="${weaponId}"
        data-base-damage="${contest.baseDamage}"
        data-crit="${contest.crit ? "1" : ""}"
        data-target-uuid="${actorRef(contest.defender)}">Roll Damage</button>`;
}

/** The button that spends the damage, once someone decides it landed. */
export function applyDamageButton({ targetUuid, amount, dieTotal, crit, attacker, weaponId }) {
    if (!targetUuid) return "";

    return `<br><button type="button" class="btn btn-danger p-4 mt-4 apply-damage-btn"
        data-target-uuid="${targetUuid}"
        data-damage="${amount}"
        data-die-total="${dieTotal}"
        data-crit="${crit ? "1" : ""}"
        data-attacker="${attacker ?? ""}"
        data-weapon-id="${weaponId ?? ""}">Apply ${crit ? "Critical " : ""}Damage${crit ? "" : ` (${amount})`}</button>`;
}

/**
 * Spend the damage.
 *
 * A critical hit does not subtract: it puts them on the floor, and twice the
 * weapon die is what the wound is rolled on.
 */
export async function applyDamage({ targetUuid, amount = 0, dieTotal = 0, crit = false, attacker = "", weaponId = "" }) {
    const target = actorFrom(targetUuid);
    if (!target) {
        ui.notifications.warn("glog2d6: that blow has no target left to land on.");
        return null;
    }

    // Hit points on someone else's sheet are the GM's to write.
    if (!target.isOwner) {
        await askTheGM(RELAY.APPLY_DAMAGE, { targetUuid, amount, dieTotal, crit, attacker, weaponId });
        return null;
    }

    const remaining = Math.max(0, Math.floor(Number(target.system?.hp?.value) || 0));
    const dealt = Math.max(0, Math.floor(Number(amount) || 0));

    const left = crit ? 0 : Math.max(0, remaining - dealt);
    const excess = crit ? criticalExcess(dieTotal) : excessDamage(dealt, remaining);
    const wounded = crit || callsForTraumaSave(dealt, remaining);

    await target.update({ "system.hp.value": left });

    // The GM's own creatures keep no ledger, so they are simply down.
    const asks = wounded && takesWounds(target);
    if (asks) {
        await callForTraumaSave([target.id], { damage: excess, attacker, weapon: weaponId });
    }

    await reportDamage({ target, dealt, left, excess, crit, wounded, asks });

    return { target, dealt, left, excess, wounded, asked: asks };
}

/** Say what the damage did, so a blow that lands is never silent. */
async function reportDamage({ target, dealt, left, excess, crit, wounded, asks }) {
    const state = left > 0
        ? `${left} hit point${left === 1 ? "" : "s"} left`
        : crit ? "on the floor" : "down to nothing";

    const after = wounded
        ? (asks
            ? `<div class="text-small text-danger">${excess} past it &mdash; a trauma save is called for.</div>`
            : `<div class="text-small text-muted">${excess} past it, and no wounds to keep.</div>`)
        : "";

    await ChatMessage.create({
        content: `<div class="section p-10">
            <div class="text-small"><strong>${target.name}</strong> takes ${dealt} &mdash; ${state}.</div>
            ${after}
        </div>`
    });
}

/**
 * A fumbled attack costs the weapon a step on the breakage track.
 *
 * Asked of the GM whoever rolled it: in a contest rolled from the defender's
 * end, the weapon that fumbled belongs to someone that client cannot edit.
 */
export async function fumbleBreakage(contest) {
    if (!contest?.fumble) return null;

    const attacker = contest.attacker;
    const armed = [...(attacker?.items ?? [])]
        .some(item => item?.type === "weapon" && item?.system?.equipped);
    if (!armed) return null;

    await askTheGM(RELAY.BREAK_WEAPON, { attacker: actorRef(attacker) });
    return actorRef(attacker);
}

/** Registered during init; takes no live game state to do it. */
export function initContestFlow() {
    onlyTheGMCan(RELAY.APPLY_DAMAGE, (data) => applyDamage(data));

    onlyTheGMCan(RELAY.BREAK_WEAPON, (data) =>
        actorFrom(data.attacker)?.breakEquippedItem("weapon"));
}
