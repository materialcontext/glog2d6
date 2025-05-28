// module/actor/handlers/equipment-handler.mjs
export class EquipmentHandler {
    constructor(actor) {
        this.actor = actor;
    }

    async handleEquipmentToggle(itemId, isEquipping) {
        const item = this.actor.items.get(itemId);

        if (item && isEquipping) {
            await this.enforceEquipmentRules(item);
        } else if (item) {
            await item.update({ "system.equipped": false });
        }
    }

    async enforceEquipmentRules(newItem) {
        const ruleEnforcer = this.createRuleEnforcerForItemType(newItem.type);
        const conflictingItems = ruleEnforcer.findConflictingItems(newItem);

        await this.unequipConflictingItems(conflictingItems);
        await newItem.update({ "system.equipped": true });
    }

    createRuleEnforcerForItemType(itemType) {
        const enforcers = {
            weapon: new WeaponEquipmentRules(this.actor),
            shield: new ShieldEquipmentRules(this.actor),
            armor: new ArmorEquipmentRules(this.actor)
        };

        return enforcers[itemType] || new NoOpEquipmentRules();
    }

    async unequipConflictingItems(items) {
        if (items.length === 0) return;

        const updates = items.map(item => ({
            _id: item.id,
            "system.equipped": false
        }));

        await this.actor.updateEmbeddedDocuments("Item", updates);
    }

    findWeakestWeapon(weapons) {
        const weaponStrengthCalculator = new WeaponStrengthCalculator();
        return weapons.reduce((weakest, current) =>
            weaponStrengthCalculator.isWeakerThan(current, weakest) ? current : weakest
        );
    }
}

class WeaponEquipmentRules {
    constructor(actor) {
        this.actor = actor;
    }

    findConflictingItems(newWeapon) {
        const currentlyEquipped = this.getCurrentlyEquippedItems();
        const conflicts = [];

        if (newWeapon.system.size === "heavy") {
            conflicts.push(...currentlyEquipped.allWeapons, ...currentlyEquipped.shields);
        } else {
            conflicts.push(...this.findWeaponTypeConflicts(newWeapon, currentlyEquipped.weapons));
            conflicts.push(...this.findCapacityConflicts(currentlyEquipped));
        }

        return conflicts;
    }

    findWeaponTypeConflicts(newWeapon, equippedWeapons) {
        const newWeaponType = newWeapon.system.weaponType;

        return equippedWeapons.filter(weapon => {
            const existingType = weapon.system.weaponType;
            return this.weaponTypesConflict(newWeaponType, existingType);
        });
    }

    weaponTypesConflict(typeA, typeB) {
        const rangedTypes = new Set(["ranged"]);
        const meleeTypes = new Set(["melee", "thrown"]);

        return (rangedTypes.has(typeA) && meleeTypes.has(typeB)) ||
               (meleeTypes.has(typeA) && rangedTypes.has(typeB));
    }

    getCurrentlyEquippedItems() {
        const items = this.actor.items;
        return {
            weapons: items.filter(i => i.type === "weapon" && i.system.equipped),
            shields: items.filter(i => i.type === "shield" && i.system.equipped),
            get allWeapons() { return this.weapons; }
        };
    }
}

class ShieldEquipmentRules {
    constructor(actor) {
        this.actor = actor;
    }

    findConflictingItems(newShield) {
        const currentlyEquipped = this.getCurrentlyEquippedItems();
        const conflicts = [];

        // Unequip existing shields (only one shield at a time)
        conflicts.push(...currentlyEquipped.shields);

        // Heavy weapons prevent shields
        const heavyWeapons = currentlyEquipped.weapons.filter(w => w.system.size === "heavy");
        conflicts.push(...heavyWeapons);

        // If 2 weapons equipped, unequip one (shield needs a free hand)
        const nonHeavyWeapons = currentlyEquipped.weapons.filter(w => w.system.size !== "heavy");
        if (nonHeavyWeapons.length >= 2) {
            const weakestWeapon = new WeaponStrengthCalculator().findWeakest(nonHeavyWeapons);
            conflicts.push(weakestWeapon);
        }

        return conflicts;
    }

    getCurrentlyEquippedItems() {
        const items = this.actor.items;
        return {
            weapons: items.filter(i => i.type === "weapon" && i.system.equipped),
            shields: items.filter(i => i.type === "shield" && i.system.equipped)
        };
    }
}

class ArmorEquipmentRules {
    constructor(actor) {
        this.actor = actor;
    }

    findConflictingItems(newArmor) {
        const currentlyEquipped = this.getCurrentlyEquippedItems();

        // Only one armor piece at a time - unequip all existing armor
        return currentlyEquipped.armor;
    }

    getCurrentlyEquippedItems() {
        const items = this.actor.items;
        return {
            armor: items.filter(i => i.type === "armor" && i.system.equipped)
        };
    }
}

class NoOpEquipmentRules {
    findConflictingItems() {
        return [];
    }
}

class WeaponStrengthCalculator {
    constructor() {
        this.sizePriority = { heavy: 3, medium: 2, light: 1 };
    }

    isWeakerThan(weaponA, weaponB) {
        const priorityA = this.sizePriority[weaponA.system.size] || 1;
        const priorityB = this.sizePriority[weaponB.system.size] || 1;

        if (priorityA !== priorityB) {
            return priorityA < priorityB;
        }

        return this.getDamageScore(weaponA) < this.getDamageScore(weaponB);
    }

    findWeakest(weapons) {
        if (weapons.length === 0) return null;

        return weapons.reduce((weakest, current) =>
            this.isWeakerThan(current, weakest) ? current : weakest
        );
    }

    getDamageScore(weapon) {
        return weapon.system.damage?.length || 0;
    }
}
