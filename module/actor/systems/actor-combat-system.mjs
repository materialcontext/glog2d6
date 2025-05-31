// module/actor/systems/actor-combat-system.mjs
export class ActorCombatSystem {
    constructor(actor) {
        this.actor = actor;
    }

    calculateCombatStats() {
        if (this.actor.type !== "character") return;

        this.calculateAttackValue();
        this.calculateDefenseValues();
    }

    calculateAttackValue() {
        const level = this.actor.system.details.level || 1;

        // Ensure structure exists
        if (!this.actor.system.combat) this.actor.system.combat = {};
        if (!this.actor.system.combat.attack) {
            this.actor.system.combat.attack = { value: 0, bonus: 0, breakdown: [] };
        }

        this.actor.system.combat.attack.value = level;

        console.log(`Attack calculation for ${this.actor.name}: Base = ${level} (level)`);
    }

    calculateDefenseValues() {
        const defenseCalculator = new DefenseCalculator(this.actor);
        const defenseData = defenseCalculator.calculateAll();

        this.actor.system.defense = defenseData;
    }
}

class DefenseCalculator {
    constructor(actor) {
        this.actor = actor;
        this.items = actor.items;
        this.system = actor.system;
    }

    calculateAll() {
        const armorData = this.calculateArmorBonuses();
        const dexBonus = this.calculateDexterityBonus();
        const specialBonuses = this.getSpecialDefenseBonuses();

        return {
            armor: armorData.armor,
            shield: armorData.shield,
            dexBonus: dexBonus,
            meleeBonus: specialBonuses.melee,
            rangedBonus: specialBonuses.ranged,
            meleeTotal: armorData.total + dexBonus + specialBonuses.melee,
            rangedTotal: armorData.total + dexBonus + specialBonuses.ranged,
            total: armorData.total + dexBonus, // Backwards compatibility
            armorEncumbrance: armorData.encumbrance
        };
    }

    calculateArmorBonuses() {
        const armorBonus = this.getEquippedArmorBonus();
        const shieldBonus = this.getEquippedShieldBonus();
        const armorEncumbrance = this.getArmorEncumbrance();

        return {
            armor: armorBonus,
            shield: shieldBonus,
            total: armorBonus + shieldBonus,
            encumbrance: armorEncumbrance
        };
    }

    calculateDexterityBonus() {
        const dexMod = this.system.attributes.dex.effectiveMod;
        return dexMod > 0 ? dexMod : 0;
    }

    getSpecialDefenseBonuses() {
        return {
            melee: this.system.defense?.meleeBonus || 0,
            ranged: this.system.defense?.rangedBonus || 0
        };
    }

    getEquippedArmorBonus() {
        const armor = this.items.find(item => item.type === "armor" && item.system.equipped);
        if (!armor) return 0;

        const originalBonus = armor.system.armorBonus || 0;
        const breakageLevel = armor.system.breakage?.level || 0;
        return BreakageCalculator.calculateArmorBonus(originalBonus, breakageLevel);
    }

    getEquippedShieldBonus() {
        const shield = this.items.find(item => item.type === "shield" && item.system.equipped);
        return shield?.system.armorBonus || 0;
    }

    getArmorEncumbrance() {
        const armor = this.items.find(item => item.type === "armor" && item.system.equipped);
        return armor?.system.encumbrancePenalty || 0;
    }
}
