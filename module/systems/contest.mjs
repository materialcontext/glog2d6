/**
 * An attack is one contest, rolled from either end.
 *
 * The rules have the defender roll against an attacker's fixed number, but a
 * table often wants it the other way round -- the GM rolls the monster's
 * attack and the players sit still. Both are the same contest: one side rolls
 * 2d6 and adds what they would add, the other stands on `6 + what they would
 * add`. Which side rolls decides nothing about the outcome, so neither is
 * modelled as the primary one.
 *
 * Pure: no Foundry globals, no documents. What comes in is numbers and what
 * goes out is an outcome, so the arithmetic that decides whether someone was
 * hit is testable on its own.
 */

/** A roll of 7 is average on 2d6; standing still is worth 6. */
export const STATIC_BASE = 6;

export const CONTEST = Object.freeze({ ATTACK: "attack", DEFENSE: "defense" });

/** Weapon types that are defended against at range. */
const RANGED_TYPES = new Set(["ranged", "firearm", "explosive", "thrown"]);

const num = value => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
};

/** The number an actor presents when they are not the one rolling. */
export function staticTarget(modifier) {
    return STATIC_BASE + num(modifier);
}

/**
 * Everything an attack roll adds, as one number.
 *
 * Mirrors the roll data the attack formula is built from: every term is
 * included and the unused ones are zero, so summing them is the same
 * arithmetic the dice do. The penalty is the one term that subtracts.
 */
export function attackModifier(rollData = {}) {
    const { penalty = 0, ...adds } = rollData;
    return Object.values(adds).reduce((total, value) => total + num(value), 0) - num(penalty);
}

/** Whether this weapon is defended against at range. */
export function isRangedType(weaponType) {
    return RANGED_TYPES.has(String(weaponType ?? "").toLowerCase());
}

/** Everything a defense roll adds, against the weapon that is coming at it. */
export function defenseModifier(system = {}, weaponType = "melee") {
    const defense = system?.defense ?? {};
    const against = isRangedType(weaponType) ? defense.rangedTotal : defense.meleeTotal;
    return num(against ?? defense.total);
}

/** Strength is added to damage in the hand, not at a distance. */
export function addsStrength(weaponType) {
    const type = String(weaponType ?? "melee").toLowerCase();
    return type === "melee" || type === "thrown";
}

export const OUTCOMES = Object.freeze({
    CRITICAL: "critical",
    HIT: "hit",
    MISS: "miss",
    FUMBLE: "fumble"
});

export const OUTCOME_LABELS = Object.freeze({
    critical: "Critical Hit",
    hit: "Hit",
    miss: "Miss",
    fumble: "Fumble"
});

/**
 * Resolve one contest.
 *
 * Doubles speak before the total does, and they speak from whichever end
 * rolled them: double sixes are a critical hit for an attacker and a clean
 * escape for a defender, snake eyes the reverse.
 *
 * @param {object}  contest
 * @param {string}  contest.mode             Which side rolled: CONTEST.ATTACK or CONTEST.DEFENSE.
 * @param {number}  contest.rollTotal        What the rolling side scored.
 * @param {number}  contest.opponentModifier What the still side adds.
 * @param {boolean} [contest.doubleSixes]
 * @param {boolean} [contest.snakeEyes]
 * @param {string}  [contest.weaponType]
 * @param {number}  [contest.strMod]         The *attacker's* strength.
 * @returns {{outcome: string, hit: boolean, crit: boolean, fumble: boolean,
 *            target: number, margin: number, baseDamage: number, label: string}}
 */
export function resolveContest({
    mode = CONTEST.ATTACK,
    rollTotal = 0,
    opponentModifier = 0,
    doubleSixes = false,
    snakeEyes = false,
    weaponType = "melee",
    strMod = 0
} = {}) {
    const attacking = mode !== CONTEST.DEFENSE;
    const target = staticTarget(opponentModifier);

    // The attacker's margin over the defender, however it was arrived at.
    const margin = attacking ? num(rollTotal) - target : target - num(rollTotal);

    const crit = attacking ? doubleSixes : snakeEyes;
    const fumble = attacking ? snakeEyes : doubleSixes;

    const hit = crit ? true : fumble ? false : margin >= 0;
    const outcome = crit ? OUTCOMES.CRITICAL : fumble ? OUTCOMES.FUMBLE : hit ? OUTCOMES.HIT : OUTCOMES.MISS;

    return {
        outcome,
        hit,
        crit,
        fumble,
        target,
        margin,
        baseDamage: hit ? Math.max(0, margin) + (addsStrength(weaponType) ? num(strMod) : 0) : 0,
        label: OUTCOME_LABELS[outcome]
    };
}

/**
 * A critical hit does not add up damage -- it puts the target on the floor and
 * asks what it cost them. The die is what carries over into the wound, twice.
 */
export function criticalExcess(dieTotal) {
    return Math.max(1, Math.floor(num(dieTotal) * 2));
}

/** Damage past what the target had left, which is what a wound is rolled on. */
export function excessDamage(damage, remainingHp) {
    return Math.max(0, Math.floor(num(damage)) - Math.max(0, Math.floor(num(remainingHp))));
}

/**
 * Whether a blow calls for a trauma save.
 *
 * Damage that brings you exactly to zero leaves you at zero and no worse:
 * what wounds you is damage with nowhere left to go. Being already at zero is
 * the same question asked with nothing remaining, so any damage at all counts
 * there -- which is what "damage at 0 HP calls for a Trauma save" means.
 */
export function callsForTraumaSave(damage, remainingHp) {
    return excessDamage(damage, remainingHp) > 0;
}

/**
 * Who is owed a trauma save. The GM's own creatures do not take wounds -- the
 * wound system is a character's ledger, and an ownerless monster has nowhere
 * to keep one.
 */
export function takesWounds(actor) {
    return Boolean(actor?.hasPlayerOwner);
}
