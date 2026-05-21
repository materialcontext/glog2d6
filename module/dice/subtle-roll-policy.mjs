/**
 * Resolves whether a given roll should be subtle (whispered to GM only)
 * and whether a critical result should auto-reveal it.
 *
 * This is a pure function — no side effects, safe to call anywhere.
 */

const SUBTLE_DEFAULTS = {
    // Combat — always public
    attack:       false,
    defense:      false,
    damage:       false,

    // Saves and physical outcomes — player knows the result
    save:         false,
    movement:     false,
    trauma:       false,

    // Physical attributes — self-evident
    strength:     false,
    dexterity:    false,
    constitution: false,

    // Mental/social attributes — GM narrates outcome
    wisdom:       true,
    intellect:    true,
    social:       true,   // covers CHA checks + diplomacy/intimidate/reaction

    // Skills
    stealth:      true,

    // Features default public; individual features opt in via rollConfigs
    feature:      false,
};

const SUBTLE_NOTIFICATIONS = {
    stealth:   (name) => `${name} moves carefully...`,
    wisdom:    (name) => `${name} takes in their surroundings...`,
    intellect: (name) => `${name} tries to recall something...`,
    social:    (name) => `${name} makes their case...`,
};

export class SubtleRollPolicy {
    /**
     * @param {Actor} actor
     * @param {string} rollContext  — must match a key in SUBTLE_DEFAULTS
     * @returns {{ subtle: boolean, revealOnCritical: boolean, reason: string|null }}
     */
    static resolve(actor, rollContext) {
        const defaultSubtle = SUBTLE_DEFAULTS[rollContext] ?? false;

        // Stalker: stealth rolls are always visible to the rolling player
        if (rollContext === 'stealth') {
            const hasStalker = actor.items.some(i =>
                i.type === 'feature' &&
                i.name === 'Stalker' &&
                i.system.active
            );
            if (hasStalker) {
                return { subtle: false, revealOnCritical: false, reason: 'Stalker' };
            }
        }

        return {
            subtle: defaultSubtle,
            revealOnCritical: defaultSubtle, // only meaningful when subtle is true
            reason: null
        };
    }

    /**
     * Returns the public notification text for a subtle roll.
     * This is posted to all players so the table knows a roll occurred.
     *
     * @param {string} actorName
     * @param {string} rollContext
     * @returns {string}
     */
    static getNotification(actorName, rollContext) {
        const fn = SUBTLE_NOTIFICATIONS[rollContext] ?? ((name) => `${name} acts...`);
        return fn(actorName);
    }
}
