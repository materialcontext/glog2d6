// module/actor/systems/actor-inventory-system.mjs
export class ActorInventorySystem {
    constructor(actor) {
        this.actor = actor;
    }

    calculateInventoryData() {
        if (this.actor.type !== "character") return;

        const inventoryCalculator = new InventoryCalculator(this.actor);
        const inventoryData = inventoryCalculator.calculateAll();

        this.applyInventoryDataToActor(inventoryData);
    }

    applyInventoryDataToActor(inventoryData) {
        Object.assign(this.actor.system.inventory, inventoryData);

        console.log(`Inventory calculation for ${this.actor.name}:`);
        console.log(`  Slots: ${inventoryData.slots.used}/${inventoryData.slots.max} (overflow: ${inventoryData.slotEncumbrance})`);
        console.log(`  Equipment penalties: ${inventoryData.equipmentEncumbrance}`);
        console.log(`  Total encumbrance: ${inventoryData.encumbrance}`);
    }
}

class InventoryCalculator {
    constructor(actor) {
        this.actor = actor;
        this.system = actor.system;
        this.items = actor.items;
    }

    calculateAll() {
        const maxSlots = this.calculateMaxSlots();
        const usedSlots = this.calculateUsedSlots();
        const slotEncumbrance = Math.max(0, usedSlots - maxSlots);
        const equipmentEncumbrance = this.calculateEquipmentEncumbrance();

        return {
            slots: {
                max: maxSlots,
                used: usedSlots
            },
            encumbrance: slotEncumbrance + equipmentEncumbrance,
            slotEncumbrance: slotEncumbrance,
            equipmentEncumbrance: equipmentEncumbrance
        };
    }

    calculateMaxSlots() {
        const strMod = this.system.attributes.str.mod;
        const conMod = this.system.attributes.con.mod;
        return 6 + Math.max(strMod, conMod);
    }

    calculateUsedSlots() {
        let usedSlots = 0;

        for (const item of this.items) {
            if (item.system.slots) {
                usedSlots += item.system.slots;
            }
        }

        return usedSlots;
    }

    calculateEquipmentEncumbrance() {
        const encumbranceCalculator = new EquipmentEncumbranceCalculator(this.items, this.actor);
        return encumbranceCalculator.calculateTotal();
    }
}

class EquipmentEncumbranceCalculator {
    constructor(items, actor) {
        this.items = items;
        this.actor = actor;
    }

    calculateTotal() {
        const armorEncumbrance = this.calculateArmorEncumbrance();
        const weaponEncumbrance = this.calculateWeaponEncumbrance();
        const rawTotal = armorEncumbrance + weaponEncumbrance;

        return this.applyArmorTrainingReduction(rawTotal);
    }

    calculateArmorEncumbrance() {
        const equippedArmor = this.items.find(item =>
            item.type === "armor" && item.system.equipped
        );

        return equippedArmor?.system.encumbrancePenalty || 0;
    }

    calculateWeaponEncumbrance() {
        const equippedWeapons = this.items.filter(item =>
            item.type === "weapon" && item.system.equipped
        );

        return equippedWeapons.reduce((total, weapon) => {
            return total + (weapon.system.encumbrancePenalty || 0);
        }, 0);
    }

    applyArmorTrainingReduction(totalEncumbrance) {
        if (totalEncumbrance <= 0) return 0;

        const hasArmorTraining = this.checkForArmorTraining();
        if (hasArmorTraining) {
            console.log(`Armor Training: Reduced equipment encumbrance by 1`);
            return Math.max(0, totalEncumbrance - 1);
        }

        return totalEncumbrance;
    }

    checkForArmorTraining() {
        return this.items.some(item =>
            item.type === "feature" &&
            item.name.includes("Armor Training") &&
            item.system.active
        );
    }
}
