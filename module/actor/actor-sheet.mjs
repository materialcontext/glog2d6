export class GLOG2D6ActorSheet extends ActorSheet {

    static get defaultOptions() {
        return foundry.utils.mergeObject(super.defaultOptions, {
            classes: ["glog2d6", "sheet", "actor"],
            width: 520,
            height: 760,
            tabs: [{ navSelector: ".sheet-tabs", contentSelector: ".sheet-body", initial: "features" }]
        });
    }

    get template() {
        return `systems/glog2d6/templates/actor/actor-${this.actor.type}-sheet.hbs`;
    }

    getData() {
        const context = super.getData();

        // Add roll data for formulas
        context.rollData = context.actor.getRollData();
        context.system = context.actor.system;
        context.flags = context.actor.flags;

        // Calculate inventory usage
        let usedSlots = 0;
        for (let item of context.actor.items) {
            usedSlots += item.system.slots || 0;
        }
        context.actor.system.inventory.slots.used = usedSlots;

        // Add edit mode
        context.editMode = this.actor.getFlag("glog2d6", "editMode") || false;

        return context;
    }

    activateListeners(html) {
        super.activateListeners(html);

        // Everything below here is only needed if the sheet is editable
        if (!this.isEditable) return;

        // Attribute rolls - click on card when not in edit mode
        html.find('.attribute-card.clickable').click(this._onAttributeRoll.bind(this));
        html.find('.attribute-save').click(this._onSaveRoll.bind(this));

        // Combat rolls - click on card when not in edit mode
        html.find('.combat-card.clickable[data-action="attack"]').click(this._onAttackRoll.bind(this));
        html.find('.combat-card.clickable[data-action="defend"]').click(this._onDefenseRoll.bind(this));

        // Movement roll
        html.find('.movement-display.clickable').click(this._onMovementRoll.bind(this));

        // Weapon attack buttons
        html.find('.weapon-attack-btn').click(this._onWeaponAttack.bind(this));

        // Equipment toggles
        html.find('.equipped-toggle').change(this._onEquippedToggle.bind(this));

        // Edit mode toggle
        html.find('.edit-toggle').click(this._onEditToggle.bind(this));

        // Item management
        html.find('.item-create').click(this._onItemCreate.bind(this));
        html.find('.item-edit').click(this._onItemEdit.bind(this));
        html.find('.item-delete').click(this._onItemDelete.bind(this));

        // torch
        html.find('.torch-btn').click(this._onTorchToggle.bind(this));
    }

    async _onAttributeRoll(event) {
        event.preventDefault();
        const element = event.currentTarget;
        const attribute = element.dataset.attribute;

        // Use default target of 7, DM will declare if different
        this.actor.rollAttribute(attribute, 7);
    }

    async _onSaveRoll(event) {
        event.preventDefault();
        event.stopPropagation(); // Prevent the event from bubbling up to the attribute card
        const element = event.currentTarget;
        const attribute = element.dataset.attribute;
        this.actor.rollSave(attribute);
    }

    async _onTorchToggle(event) {
        event.preventDefault();
        const currentTorch = this.actor.system.torch || false;
        await this.actor.update({ "system.torch": !currentTorch });
    }

    async _onAttackRoll(event) {
        event.preventDefault();

        // Prompt for melee or ranged
        const attackType = await this._getAttackType();
        if (attackType === null) return;

        this.actor.rollAttack(attackType);
    }

    async _onEditToggle(event) {
        event.preventDefault();
        const currentMode = this.actor.getFlag("glog2d6", "editMode") || false;
        await this.actor.setFlag("glog2d6", "editMode", !currentMode);
        this.render();
    }

    async _onDefenseRoll(event) {
        event.preventDefault();
        this.actor.rollDefense();
    }

    async _onEquippedToggle(event) {
        event.preventDefault();
        const itemId = event.currentTarget.dataset.itemId;
        const item = this.actor.items.get(itemId);
        const isEquipping = event.currentTarget.checked;

        if (item && isEquipping) {
            await this._handleEquipment(item);
        } else if (item) {
            await item.update({ "system.equipped": false });
        }

        this.render();
    }

    async _handleEquipment(newItem) {
        const items = this.actor.items;
        const updates = [];

        if (newItem.type === "weapon") {
            const equippedWeapons = items.filter(i => i.type === "weapon" && i.system.equipped);
            const equippedShields = items.filter(i => i.type === "shield" && i.system.equipped);
            const equippedHeavyWeapons = equippedWeapons.filter(w => w.system.size === "heavy");

            if (newItem.system.size === "heavy") {
                // Heavy weapon unequips all other weapons and shields
                for (let item of [...equippedWeapons, ...equippedShields]) {
                    updates.push({ _id: item.id, "system.equipped": false });
                }
            } else {
                // Light/medium weapon
                // First, unequip any heavy weapons (they can't coexist with other weapons)
                for (let weapon of equippedHeavyWeapons) {
                    updates.push({ _id: weapon.id, "system.equipped": false });
                }

                // Then handle normal weapon limits
                const remainingWeapons = equippedWeapons.filter(w => w.system.size !== "heavy");

                if (equippedShields.length > 0) {
                    // Shield prevents second weapon
                    if (remainingWeapons.length >= 1) {
                        // Unequip weakest weapon
                        const weakest = this._findWeakestWeapon(remainingWeapons);
                        updates.push({ _id: weakest.id, "system.equipped": false });
                    }
                } else if (remainingWeapons.length >= 2) {
                    // Two weapons already equipped, unequip weakest
                    const weakest = this._findWeakestWeapon(remainingWeapons);
                    updates.push({ _id: weakest.id, "system.equipped": false });
                }
            }
        } else if (newItem.type === "shield") {
            const equippedWeapons = items.filter(i => i.type === "weapon" && i.system.equipped);
            const equippedShields = items.filter(i => i.type === "shield" && i.system.equipped);
            const equippedHeavyWeapons = equippedWeapons.filter(w => w.system.size === "heavy");

            // Unequip existing shields
            for (let shield of equippedShields) {
                updates.push({ _id: shield.id, "system.equipped": false });
            }

            // Heavy weapons prevent shields
            for (let weapon of equippedHeavyWeapons) {
                updates.push({ _id: weapon.id, "system.equipped": false });
            }

            // If 2 weapons equipped, unequip one
            const remainingWeapons = equippedWeapons.filter(w => w.system.size !== "heavy");
            if (remainingWeapons.length >= 2) {
                const weakest = this._findWeakestWeapon(remainingWeapons);
                updates.push({ _id: weakest.id, "system.equipped": false });
            }
        } else if (newItem.type === "armor") {
            const equippedArmor = items.filter(i => i.type === "armor" && i.system.equipped);

            // Unequip existing armor
            for (let armor of equippedArmor) {
                updates.push({ _id: armor.id, "system.equipped": false });
            }
        }

        // Apply all updates
        if (updates.length > 0) {
            await this.actor.updateEmbeddedDocuments("Item", updates);
        }

        // Equip the new item
        await newItem.update({ "system.equipped": true });
    }

    _findWeakestWeapon(weapons) {
        // Simple logic: heavy > medium > light, then by damage string length
        const priority = { heavy: 3, medium: 2, light: 1 };

        return weapons.reduce((weakest, current) => {
            const weakestPriority = priority[weakest.system.size] || 1;
            const currentPriority = priority[current.system.size] || 1;

            if (currentPriority < weakestPriority) {
                return current;
            } else if (currentPriority === weakestPriority) {
                // Same size, compare damage (rough approximation)
                const weakestDamage = weakest.system.damage?.length || 0;
                const currentDamage = current.system.damage?.length || 0;
                return currentDamage < weakestDamage ? current : weakest;
            }
            return weakest;
        });
    }

    async _onWeaponAttack(event) {
        event.preventDefault();
        const itemId = event.currentTarget.dataset.itemId;
        const weapon = this.actor.items.get(itemId);

        if (weapon) {
            this.actor.rollWeaponAttack(weapon);
        }
    }

    async _onMovementRoll(event) {
        event.preventDefault();
        this.actor.rollMovement();
    }

    async _getAttackType() {
        return new Promise((resolve) => {
            new Dialog({
                title: "Attack Type",
                content: `<p>Choose your attack type:</p>`,
                buttons: {
                    melee: {
                        label: "Melee",
                        callback: () => resolve("melee")
                    },
                    ranged: {
                        label: "Ranged",
                        callback: () => resolve("ranged")
                    }
                },
                default: "melee",
                close: () => resolve(null)
            }).render(true);
        });
    }

    async _onItemCreate(event) {
        event.preventDefault();
        const element = event.currentTarget;
        const type = element.dataset.type;

        const itemData = {
            name: `New ${type.capitalize()}`,
            type: type,
            system: {}
        };

        const cls = getDocumentClass("Item");
        return cls.create(itemData, { parent: this.actor });
    }

    _onItemEdit(event) {
        event.preventDefault();
        const li = $(event.currentTarget).parents(".item");
        const item = this.actor.items.get(li.data("itemId"));
        item.sheet.render(true);
    }

    async _onItemDelete(event) {
        event.preventDefault();
        const li = $(event.currentTarget).parents(".item");
        const item = this.actor.items.get(li.data("itemId"));
        return item.delete();
    }
}
