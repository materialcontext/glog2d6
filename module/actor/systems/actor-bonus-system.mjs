// module/actor/systems/actor-bonus-system.ms
import { BonusCalculator } from "../../systems/bonus-calculator.mjs";

export class ActorBonusSystem {
    constructor(actor) {
        this.actor = actor;
        this.bonusCalculator = new BonusCalculator(actor);
    }

    calculateAndApplyAllBonuses() {
        try {
            if (this.actor.type !== "character") return;

            const bonuses = this.bonusCalculator.calculateBonuses();
            this.applyBonusesToActorData(bonuses);
            this.applyWoundPenalties();
        } catch (error) { // we need to keep running but be made VERY aware
            console.error(`🚨 BONUS CALCULATION FAILED FOR ${this.actor.name.toUpperCase()}! 🚨`);
            console.error('Error details:', error);
            console.error('Stack trace:', error.stack);

            if (globalThis.ui?.notifications) {
                ui.notifications.error(`Bonus calculation failed for ${this.actor.name}: ${error.message}`, { permanent: true });
            }
        }
    }

    applyBonusesToActorData(bonuses) {
        for (const [target, bonusData] of bonuses) {
            this.applyBonusToSpecificTarget(target, bonusData.total, bonusData.breakdown);
        }
    }

    applyBonusToSpecificTarget(target, totalBonus, breakdown) {
        const bonusApplier = new BonusTargetApplier(this.actor.system);
        bonusApplier.applyBonus(target, totalBonus, breakdown);
    }

    applyWoundPenalties() {
        if (!this.actor.traumaSystem) console.log("NO TRAUMA SYSTEM!!!");

        // Ensure wounds structure exists
        if (!this.actor.system.wounds) console.log("NO WOUNDS SYSTEM");

        const penalties = this.actor.traumaSystem.getWoundPenalties();

        // Apply stat penalties to effective values
        for (const [stat, penalty] of Object.entries(penalties.stats)) {
            if (penalty > 0) {
                const attr = this.actor.system.attributes[stat];

                // Debug logging to find the issue
                console.log(`Applying wound penalty to ${stat}:`, {
                    attr,
                    penalty,
                    attrValue: attr.value,
                    attrMod: attr.mod,
                    attrValueType: typeof attr.value,
                    attrModType: typeof attr.mod
                });

                const effectiveValue = Math.max(1, attr.value - penalty);
                attr.effectiveValue = effectiveValue;
                attr.effectiveMod = this.actor.attributeSystem.calculateSingleModifier(effectiveValue);

                console.log(`After wound penalty applied:`, {
                    effectiveValue: attr.effectiveValue,
                    effectiveMod: attr.effectiveMod,
                    effectiveModType: typeof attr.effectiveMod
                });
            }
        }

        // Store wound effects for UI display
        this.actor.system.wounds.effects = {
            statReductions: Object.fromEntries(Object.entries(penalties.stats).filter(([, v]) => v > 0)),
            movementReduction: penalties.movement,
            noHealing: penalties.healing,
            attackPenalty: penalties.attackPenalty,
            defensePenalty: penalties.defensePenalty,
            reactionPenalty: penalties.reactionPenalty
        };
    }
}

class BonusTargetApplier {
    constructor(systemData) {
        this.system = systemData;
        this.targetHandlers = this.createSpecialTargetHandlers();
    }

    createSpecialTargetHandlers() {
        return {
            "skills.stealth.bonus": this.applyStealthBonus.bind(this),
            "skills.reaction.bonus": this.applyReactionBonus.bind(this),
            "spellSlots": this.applySpellSlotsBonus.bind(this),
            "magicDiceMax": this.applyMagicDiceMaxBonus.bind(this),
        };
    }

    applyBonus(target, totalBonus, breakdown) {
        const specialHandler = this.targetHandlers[target];

        if (specialHandler) {
            specialHandler(totalBonus, breakdown);
            return;
        }

        // FIXED: Properly navigate to the target property
        const pathParts = target.split(".");
        const propertyName = pathParts.pop(); // Last part is the property name
        const targetObject = pathParts.reduce((obj, key) => {
            if (!obj || !obj[key]) {
                throw new Error(`Invalid bonus target path: ${target}. Missing: ${key}`);
            }
            return obj[key];
        }, this.system);

        // CRITICAL: Verify the target object exists and is valid
        if (!targetObject || typeof targetObject !== 'object') {
            throw new Error(`FATAL: Bonus target ${target} resolved to non-object: ${typeof targetObject} (${targetObject})`);
        }

        // Apply the bonus safely
        targetObject[propertyName] = (targetObject[propertyName] || 0) + totalBonus;
        targetObject[`${propertyName}Breakdown`] = breakdown;
    }

    applyStealthBonus(totalBonus, breakdown) {
        const stealthSkills = ["sneak", "hide", "disguise"];
        for (const skill of stealthSkills) {
            this.system.skills[skill].bonus = (this.system.skills[skill].bonus || 0) + totalBonus;
            this.system.skills[skill].breakdown = breakdown;
        }
    }

    applyReactionBonus(totalBonus, breakdown) {
        const socialSkills = ["reaction", "diplomacy", "intimidate"];
        for (const skill of socialSkills) {
            this.system.skills[skill].bonus = (this.system.skills[skill].bonus || 0) + totalBonus;
            this.system.skills[skill].breakdown = breakdown;
        }
    }

    applySpellSlotsBonus(totalBonus, _breakdown) {
        this.system.spellSlots = (this.system.spellSlots || 0) + totalBonus;
    }

    applyMagicDiceMaxBonus(totalBonus, breakdown) {
        this.system.magicDiceMax = Math.max(0, (this.system.magicDiceMax || 0) + totalBonus);
        this.system.magicDiceMaxBreakdown = breakdown;
    }
}
