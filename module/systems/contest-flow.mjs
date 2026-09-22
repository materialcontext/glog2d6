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
    criticalExcess,
    defenseModifier,
    excessDamage,
    isDropped,
    resolveContest,
    takesWounds
} from "./contest.mjs";
import { attackModifier } from "./contest.mjs";
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
    // six. Better to leave the roll standing on its own.
    if (!attacking && !attackData) return null;

    // Whoever is not rolling stands on six plus what they would have added.
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
export function damageButton(contest, { actorId, weaponId }) {
    if (!contest?.hit) return "";

    // Nothing to roll for a blow with no weapon behind it -- the margin is
    // the whole of the damage, so it goes straight to being spent.
    if (!weaponId) {
        return applyDamageButton({
            targetId: contest.defender?.id,
            amount: contest.baseDamage,
            dieTotal: 0,
            crit: contest.crit,
            attackerId: actorId
        });
    }

    return `<br><button type="button" class="damage-roll-btn"
        data-actor-id="${actorId}"
        data-weapon-id="${weaponId}"
        data-base-damage="${contest.baseDamage}"
        data-crit="${contest.crit ? "1" : ""}"
        data-target-id="${contest.defender?.id ?? ""}">Roll Damage</button>`;
}

/** The button that spends the damage, once someone decides it landed. */
export function applyDamageButton({ targetId, amount, dieTotal, crit, attackerId, weaponId }) {
    if (!targetId) return "";

    return `<br><button type="button" class="btn btn-danger p-4 mt-4 apply-damage-btn"
        data-target-id="${targetId}"
        data-damage="${amount}"
        data-die-total="${dieTotal}"
        data-crit="${crit ? "1" : ""}"
        data-attacker-id="${attackerId ?? ""}"
        data-weapon-id="${weaponId ?? ""}">Apply ${crit ? "Critical " : ""}Damage${crit ? "" : ` (${amount})`}</button>`;
}

/**
 * Spend the damage.
 *
 * A critical hit does not subtract: it puts them on the floor, and twice the
 * weapon die is what the wound is rolled on.
 */
export async function applyDamage({ targetId, amount = 0, dieTotal = 0, crit = false, attackerId = "", weaponId = "" }) {
    const target = game.actors.get(targetId);
    if (!target) return null;

    // Hit points on someone else's sheet are the GM's to write.
    if (!target.isOwner) {
        await askTheGM(RELAY.APPLY_DAMAGE, { targetId, amount, dieTotal, crit, attackerId, weaponId });
        return null;
    }

    const remaining = Number(target.system?.hp?.value) || 0;
    const dealt = Math.max(0, Math.floor(Number(amount) || 0));

    const dropped = crit || isDropped(dealt, remaining);
    const excess = crit ? criticalExcess(dieTotal) : excessDamage(dealt, remaining);

    await target.update({ "system.hp.value": crit ? 0 : Math.max(0, remaining - dealt) });

    // The GM's own creatures keep no ledger, so they are simply down.
    if (dropped && takesWounds(target)) {
        await callForTraumaSave([target.id], { damage: excess, attacker: attackerId, weapon: weaponId });
    }

    return { dropped, excess, remaining: crit ? 0 : Math.max(0, remaining - dealt) };
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

    await askTheGM(RELAY.BREAK_WEAPON, { actorId: attacker.id });
    return attacker.id;
}

/** Registered during init; takes no live game state to do it. */
export function initContestFlow() {
    onlyTheGMCan(RELAY.APPLY_DAMAGE, (data) => applyDamage({ ...data, targetId: data.targetId }));

    onlyTheGMCan(RELAY.BREAK_WEAPON, (data) =>
        game.actors.get(data.actorId)?.breakEquippedItem("weapon"));
}
