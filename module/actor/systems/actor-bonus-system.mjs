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
        } else {
            const targetStat = this.getTargetStatObjectFromString(this.system, target);
            targetStat.bonus = (target.bonus || 0) + totalBonus;
            targetStat.breakdown = breakdown;
        }
    }

    getTargetStatObjectFromString(parent, targetPath) {
        return targetPath.split(".").slice(0, -1).reduce((o, k) => o?.[k], parent);
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
