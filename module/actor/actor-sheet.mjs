import { toggleTorch, toggleTorchItem } from './handlers/torch-handlers.mjs';
import {
    addClassFeatures,
    getAvailableClasses,
    toggleFeature,
    hasAvailableClassFeatures,
} from './handlers/feature-handlers.mjs'

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

    async getData() {
        const context = super.getData();

        // Add roll data for formulas
        context.rollData = context.actor.getRollData();
        context.system = context.actor.system;
        context.flags = context.actor.flags;


        // Add edit mode
        context.editMode = this.actor.getFlag("glog2d6", "editMode") === true;

        // Get available classes from compendium pack
        context.availableClasses = await this._getAvailableClasses();

        // Check if character has available class features
        context.hasAvailableFeatures = this._hasAvailableClassFeatures();

        // Debug encumbrance
        if (this.actor.type === "character") {
            console.log(`Sheet getData - Encumbrance: ${context.system.inventory.encumbrance}, Used: ${context.system.inventory.slots.used}/${context.system.inventory.slots.max}`);
        }

        // acrobat training feature accessor
        context.hasAcrobatTraining = this.actor.hasFeature("Acrobat Training");

        // Analyze equipped weapons for smart button display
        const weaponAnalysis = this._analyzeEquippedWeapons();

        console.log(weaponAnalysis);

        context.weaponAnalysis = weaponAnalysis;
        context.hasAcrobatTraining = this.actor.hasFeature("Acrobat Training");


        return context;
    }

    activateListeners(html) {
        super.activateListeners(html);

        this._enhanceAttributeDisplay(html);

        // Everything below here is only needed if the sheet is editable
        if (!this.isEditable) return;

        // Attribute rolls - click on card when not in edit mode
        html.find('.attribute-card.clickable').click(this._onAttributeRoll.bind(this));
        html.find('.attribute-save').click(this._onSaveRoll.bind(this));

        // Combat rolls - click on card when not in edit mode
        html.find('.combat-card.clickable[data-action="attack"]').click(this._onAttackRoll.bind(this));

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
        html.find('.item-delete', '.feature-delete').click(this._onItemDelete.bind(this));

        // Torch toggle - fixed
        html.find('.torch-btn').click(this._onTorchToggle.bind(this));
        html.find('.torch-icon[data-action="toggle-torch"]').click(this._onTorchItemToggle.bind(this));

        // spells
        html.find('.spell-cast-btn').click(this._onSpellCast.bind(this));

        // Feature management
        html.find('.add-class-features').click(this._onAddClassFeatures.bind(this));
        html.find('.feature-item').click(this._onFeatureToggle.bind(this));

        // action buttons
        html.find('[data-action="sneak"].clickable').click(this._onSneakRoll.bind(this));
        html.find('[data-action="hide"].clickable').click(this._onHideRoll.bind(this));
        html.find('[data-action="disguise"].clickable').click(this._onDisguiseRoll.bind(this));
        html.find('[data-action="reaction"].clickable').click(this._onReactionRoll.bind(this));
        html.find('[data-action="diplomacy"].clickable').click(this._onDiplomacyRoll.bind(this));
        html.find('[data-action="intimidate"].clickable').click(this._onIntimidateRoll.bind(this));

        // Defense roll listeners
        html.find('.combat-card.clickable[data-action="defend"]').click(this._onDefenseRoll.bind(this));
        html.find('.combat-card.clickable[data-action="defend-melee"]').click(this._onMeleeDefenseRoll.bind(this));
        html.find('.combat-card.clickable[data-action="defend-ranged"]').click(this._onRangedDefenseRoll.bind(this));
    }

    async _onAddClassFeatures(event) {
        return addClassFeatures(this, event);
    }

    async _onFeatureToggle(event) {
        return toggleFeature(this, event);
    }

    _hasAvailableClassFeatures() {
        return hasAvailableClassFeatures(this);
    }

    async _getAvailableClasses() {
        return getAvailableClasses(this);
    }

    async _onAttributeRoll(event) {
        event.preventDefault();
        const element = event.currentTarget;
        const attribute = element.dataset.attribute;

        // Use default target of 7, DM will declare if different
        this.actor.rollAttribute(attribute, 7);
    }

    // Action roll handlers
    async _onSneakRoll(event) {
        event.preventDefault();
        this.actor.rollSneak();
    }

    async _onHideRoll(event) {
        event.preventDefault();
        this.actor.rollHide();
    }

    async _onDisguiseRoll(event) {
        event.preventDefault();
        this.actor.rollDisguise();
    }

    async _onReactionRoll(event) {
        event.preventDefault();
        this.actor.rollReaction();
    }

    async _onDiplomacyRoll(event) {
        event.preventDefault();
        this.actor.rollDiplomacy();
    }

    async _onIntimidateRoll(event) {
        event.preventDefault();
        this.actor.rollIntimidate();
    }

    async _onDefenseRoll(event) {
        event.preventDefault();
        this.actor.rollDefense();
    }

    async _onMeleeDefenseRoll(event) {
        event.preventDefault();
        this.actor.rollMeleeDefense();
    }

    async _onRangedDefenseRoll(event) {
        event.preventDefault();
        this.actor.rollRangedDefense();
    }

    async _onSaveRoll(event) {
        event.preventDefault();
        event.stopPropagation(); // Prevent the event from bubbling up to the attribute card
        const element = event.currentTarget;
        const attribute = element.dataset.attribute;
        this.actor.rollSave(attribute);
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

    async _onSpellCast(event) {
        event.preventDefault();
        const itemId = event.currentTarget.dataset.itemId;
        const spell = this.actor.items.get(itemId);

        if (spell) {
            // For now, just show the spell in chat - extend this later for actual spell mechanics
            ChatMessage.create({
                speaker: ChatMessage.getSpeaker({ actor: this.actor }),
                content: `
                <div class="glog2d6-roll">
                    <h3>${this.actor.name} casts ${spell.name}</h3>
                    <div class="roll-result">
                        ${spell.system.level ? `<strong>Level:</strong> ${spell.system.level}<br>` : ''}
                        ${spell.system.school ? `<strong>School:</strong> ${spell.system.school}<br>` : ''}
                        ${spell.system.range ? `<strong>Range:</strong> ${spell.system.range}<br>` : ''}
                        ${spell.system.duration ? `<strong>Duration:</strong> ${spell.system.duration}<br>` : ''}
                        ${spell.system.components ? `<strong>Components:</strong> ${spell.system.components}<br>` : ''}
                        <br><strong>Description:</strong><br>
                        ${spell.system.description || 'No description available.'}
                    </div>
                </div>
            `
            });
        }
    }

    async _onTorchToggle(event) {
        return toggleTorch(this, event);
    }

    async _onTorchItemToggle(event) {
        return toggleTorchItem(this, event);
    }

    _analyzeEquippedWeapons() {
        console.log("analyszing...")
        const equippedWeapons = this.actor.items.filter(i =>
            i.type === "weapon" && i.system.equipped
        );

        const analysis = {
            hasWeapons: equippedWeapons.length > 0,
            weaponCount: equippedWeapons.length,
            primaryWeapon: null,
            weaponTypes: new Set(),
            hasThrowable: false,
            attackButtonType: 'generic', // 'generic', 'melee', 'ranged', 'split'
            throwableWeapon: null
        };

        if (equippedWeapons.length === 0) {
            analysis.attackButtonType = 'generic';
            return analysis;
        }

        // Analyze weapon types
        for (const weapon of equippedWeapons) {
            const type = weapon.system.weaponType || 'melee';
            analysis.weaponTypes.add(type);

            if (type === 'thrown') {
                analysis.hasThrowable = true;
                analysis.throwableWeapon = weapon;
            }
        }

        // Determine primary weapon (best weapon logic)
        analysis.primaryWeapon = this.actor._getBestWeapon(equippedWeapons);

        // Determine attack button type
        if (analysis.hasThrowable && equippedWeapons.length === 2) {
            // Dual wielding with throwable = split attack button
            analysis.attackButtonType = 'split';
        } else if (analysis.weaponTypes.has('ranged')) {
            analysis.attackButtonType = 'ranged';
        } else {
            analysis.attackButtonType = 'melee';
        }

        return analysis;
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

    /**
    * Enhance attribute display with proper coloring, effective values, and modifier handling
    */
    _enhanceAttributeDisplay(html) {
        if (this.actor.getFlag("glog2d6", "editMode")) return; // Skip in edit mode

        html.find('.attribute-card[data-attribute]').each((index, element) => {
            const $card = $(element);
            const attributeKey = $card.attr('data-attribute');

            if (attributeKey) {
                const attribute = this.actor.system.attributes[attributeKey];
                const originalMod = attribute.mod;
                const effectiveMod = attribute.effectiveMod !== undefined ? attribute.effectiveMod : attribute.mod;
                const baseValue = attribute.value;
                const effectiveValue = attribute.effectiveValue !== undefined ? attribute.effectiveValue : attribute.value;

                // FIXED: Show effective attribute value when different from base
                const $attributeValue = $card.find('.attribute-value');
                if (effectiveValue !== baseValue) {
                    // Show effective value with original in parentheses (struck through)
                    $attributeValue.html(`
                    <span class="effective-attr-value">${effectiveValue}</span>
                    <span class="original-attr-value">(${baseValue})</span>
                `);
                } else {
                    // Show normal value
                    $attributeValue.text(baseValue);
                }

                // Update the modifier display
                const $modifierCurrent = $card.find('.modifier-current');
                $modifierCurrent.text((effectiveMod >= 0 ? '+' : '') + effectiveMod);

                // Handle original modifier display
                const $modifierOriginal = $card.find('.modifier-original');
                if (effectiveMod !== originalMod) {
                    $modifierOriginal.text((originalMod >= 0 ? '+' : '') + originalMod).show();
                } else {
                    $modifierOriginal.hide();
                }

                // Apply coloring to attribute value to indicate if value/modifier is affected
                $attributeValue.removeClass('normal negatively-impacted positively-impacted');

                if (effectiveValue < baseValue || effectiveMod < originalMod) {
                    $attributeValue.addClass('negatively-impacted');
                } else if (effectiveValue > baseValue || effectiveMod > originalMod) {
                    $attributeValue.addClass('positively-impacted');
                } else {
                    $attributeValue.addClass('normal');
                }
            }
        });

        // Update movement display to show effective movement (don't touch - it's working)
        const $movementDisplay = html.find('.movement-display');
        if ($movementDisplay.length > 0 && this.actor.type === "character") {
            const baseMovement = this.actor.system.details.movement;
            const effectiveMovement = this.actor.system.details.effectiveMovement;

            if (effectiveMovement !== undefined && effectiveMovement !== baseMovement) {
                // Show effective movement with struck-through original
                $movementDisplay.html(`
                <span>Move</span>
                <span class="effective-value">${effectiveMovement}</span>
                <span class="original-value">(${baseMovement})</span>
            `);
                $movementDisplay.addClass('negatively-impacted');
            } else {
                // Show normal movement
                $movementDisplay.html(`
                <span>Move</span>
                ${baseMovement}
            `);
                $movementDisplay.removeClass('negatively-impacted');
            }
        }
    }

    async _handleEquipment(newItem) {
        const items = this.actor.items;
        const updates = [];

        if (newItem.type === "weapon") {
            const equippedWeapons = items.filter(i => i.type === "weapon" && i.system.equipped);
            const equippedShields = items.filter(i => i.type === "shield" && i.system.equipped);
            const equippedHeavyWeapons = equippedWeapons.filter(w => w.system.size === "heavy");

            // NEW: Check for weapon type conflicts (can't mix melee and ranged)
            const newWeaponType = newItem.system.weaponType;
            for (let weapon of equippedWeapons) {
                const existingType = weapon.system.weaponType;
                if ((newWeaponType === "ranged" && existingType !== "ranged" && existingType !== "thrown") ||
                    (newWeaponType !== "ranged" && newWeaponType !== "thrown" && existingType === "ranged")) {
                    // Weapon type conflict - unequip conflicting weapon
                    updates.push({ _id: weapon.id, "system.equipped": false });
                }
            }

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
                const remainingWeapons = equippedWeapons.filter(w =>
                    w.system.size !== "heavy" &&
                    !updates.some(u => u._id === w.id) // Don't count weapons we're about to unequip
                );

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
        }
        // ... rest of your existing shield and armor logic stays exactly the same ...
        else if (newItem.type === "shield") {
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
        const li = $(event.currentTarget).parents(".item, .feature-item");
        const item = this.actor.items.get(li.data("itemId"));
        return item.delete();
    }
}
