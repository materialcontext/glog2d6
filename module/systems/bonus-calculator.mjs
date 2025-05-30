/**
 * Handles calculation and application of bonuses from various sources
 */
import { getClassTemplateCount } from '../utils/actor-analysis.mjs'

export class BonusCalculator {
    constructor(actor) {
        this.actor = actor;
        this.bonuses = new Map(); // target -> array of bonuses
    }

    /**
     * Collect all bonus sources and calculate final bonuses
     */
    calculateBonuses() {
        this.bonuses.clear();

        // Collect bonuses from active features
        this._collectFeatureBonuses();

        // TODO: Add other bonus sources
        // this._collectItemBonuses();
        // this._collectConditionBonuses();

        return this._compileFinalBonuses();
    }

    /**
     * Collect bonuses from active class features
     */
    _collectFeatureBonuses() {
        const activeFeatures = this.actor.items.filter(i =>
            i.type === "feature" && i.system.active
        );

        for (const feature of activeFeatures) {
            const bonusFunction = FEATURE_BONUSES[feature.name];
            if (bonusFunction) {
                const bonuses = bonusFunction(this.actor, feature);
                for (const bonus of bonuses) {
                    this._addBonus(bonus.target, {
                        source: feature.name,
                        type: "feature",
                        value: bonus.value,
                        bonusType: bonus.type || "untyped"
                    });
                }
            }
        }
    }

    /**
     * Add a bonus to the collection
     */
    _addBonus(target, bonus) {
        if (!this.bonuses.has(target)) {
            this.bonuses.set(target, []);
        }
        this.bonuses.get(target).push(bonus);
    }

    /**
     * Calculate final bonuses considering stacking rules
     */
    _compileFinalBonuses() {
        const finalBonuses = new Map();

        for (const [target, bonusArray] of this.bonuses) {
            const stackedBonus = this._calculateStackedBonus(bonusArray);
            if (stackedBonus !== 0) {
                finalBonuses.set(target, {
                    total: stackedBonus,
                    breakdown: bonusArray
                });
            }
        }

        return finalBonuses;
    }

    /**
     * Calculate stacked bonus considering bonus types
     * TODO: Implement proper stacking rules (typed bonuses don't stack)
     */
    _calculateStackedBonus(bonusArray) {
        // For now, just sum all bonuses
        // TODO: Implement stacking rules where same-type bonuses don't stack
        return bonusArray.reduce((total, bonus) => total + bonus.value, 0);
    }

    /**
     * Get bonus breakdown for UI display
     */
    getBonusBreakdown(target) {
        return this.bonuses.get(target) || [];
    }
}

/**
 * Feature bonus definitions - easily extensible
 */
const FEATURE_BONUSES = {
    "Acrobat Training": (actor, feature) => {
        const templates = getClassTemplateCount(actor.items, "Acrobat") - 1;
        const bonus = Math.floor(templates / 2);

        // Only apply if not encumbered
        const isEncumbered = actor.system.inventory?.encumbrance > 0;

        if (!isEncumbered && bonus > 0) {
            return [
                { target: "details.movement.bonus", value: bonus, type: "untyped" },
                { target: "defense.melee.bonus", value: bonus, type: "untyped" }
            ];
        }

        return [];
    },
    // Fighter gets +2 to all attack rolls
    "Combat Training": (actor, feature) => [
        { target: "combat.attack.bonus", value: 2, type: "untyped" }
    ],

    // Barbarian gets +1 HP per template
    "Barbarian Heritage": (actor, feature) => {
        const templates = getClassTemplateCount(actor.items, "Barbarian") - 1;
        return [
            { target: "hp.bonus", value: templates, type: "untyped" }
        ];
    },

    // Thief gets stealth bonuses
    "Thievery Training": (actor, feature) => {
        const templates = getClassTemplateCount(actor.items, "Thief") - 1;
        return [
            { target: "skills.stealth.bonus", value: Math.floor(templates / 2), type: "untyped" }
        ];
    },

    // Assassin gets stealth bonuses
    "Assassin Training": (actor, feature) => [
        { target: "skills.stealth.bonus", value: 2, type: "untyped" }
    ],

    // Courtier gets reaction bonuses
    "Noble Bearing": (actor, feature) => {
        const templates = getClassTemplateCount(actor.items, "Courtier") - 1;
        return [
            { target: "skills.reaction.bonus", value: Math.floor(templates / 2), type: "untyped" }
        ];
    },

    // Hunter gets archery bonuses
    "Archery Training": (actor, feature) => {
        const templates = getClassTemplateCount(actor.items, "Hunter") - 1;
        return [
            { target: "combat.archery.bonus", value: Math.floor(templates / 2), type: "untyped" }
        ];
    },
    "Magical Training": (actor, feature) => {
        const templates = getClassTemplateCount(actor.items, "Wizard") - 1;
        const intMod = actor.system.attributes.int.mod;
        const spellSlots = templates + Math.max(0, intMod);
        return [
            { target: "magicDiceMax", value: templates, type: "untyped" },
            { target: "spellSlots", value: spellSlots, type: "untyped" }
        ];
    },
    // Intellect Fortress - already partially there, just need to fix it
    "Intellect Fortress": (actor, feature) => {
        const templates = getClassTemplateCount(actor.items, "Wizard") - 1;
        return [
            { target: "saves.int.bonus", value: Math.floor(templates / 2), type: "untyped" },
            { target: "saves.wis.bonus", value: Math.floor(templates / 2), type: "untyped" }
        ];
    },
};
