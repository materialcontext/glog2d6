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

        // Analyze equipped weapons for smart button display
        const weaponAnalysis = this._analyzeEquippedWeapons();
        context.weaponAnalysis = weaponAnalysis;

        // Properly detect Acrobat training with robust fallback
        context.hasAcrobatTraining = this.actor.hasFeature ?
            this.actor.hasFeature("Acrobat Training") :
            this.actor.items.some(i => i.type === "feature" && i.system.active && i.name === "Acrobat Training");

        // Debug logging
        if (this.actor.type === "character") {
            console.log(`Sheet getData - ${this.actor.name}:`);
            console.log(`  Edit Mode: ${context.editMode}`);
            console.log(`  Weapon Analysis:`, weaponAnalysis);
            console.log(`  Has Acrobat Training: ${context.hasAcrobatTraining}`);
            console.log(`  Encumbrance: ${context.system.inventory.encumbrance}`);
        }

        return context;
    }

    activateListeners(html) {
        super.activateListeners(html);

        // FIXED: Enhance attribute display regardless of edit mode
        this._enhanceAttributeDisplay(html);

        // Everything below here is only needed if the sheet is editable
        if (!this.isEditable) return;

        // FIXED: Only activate clickable elements when NOT in edit mode
        const editMode = this.actor.getFlag("glog2d6", "editMode") === true;

        if (!editMode) {
            // Attribute rolls - click on card when not in edit mode
            html.find('.attribute-card.clickable').click(this._onAttributeRoll.bind(this));

            // Combat action buttons
            html.find('.action-card.clickable').each((i, element) => {
                const action = element.dataset.action;
                if (action) {
                    $(element).click(this._getActionHandler(action).bind(this));
                }
            });

            // Combat rolls - click on card when not in edit mode
            html.find('.combat-card.clickable').each((i, element) => {
                const action = element.dataset.action;
                if (action) {
                    $(element).click(this._getCombatHandler(action).bind(this));
                }
            });

            // Movement roll
            html.find('.movement-display.clickable').click(this._onMovementRoll.bind(this));
        }

        // Always active elements (regardless of edit mode)
        html.find('.attribute-save').click(this._onSaveRoll.bind(this));
        html.find('.weapon-attack-btn').click(this._onWeaponAttack.bind(this));
        html.find('.spell-cast-btn').click(this._onSpellCast.bind(this));
        html.find('.rest-btn').click(this._onRest.bind(this));

        // Equipment and UI controls
        html.find('.equipped-toggle').change(this._onEquippedToggle.bind(this));
        html.find('.edit-toggle').click(this._onEditToggle.bind(this));

        // Item management
        html.find('.item-create').click(this._onItemCreate.bind(this));
        html.find('.item-edit').click(this._onItemEdit.bind(this));
        html.find('.item-delete').click(this._onItemDelete.bind(this));

        // Torch controls
        html.find('.torch-btn').click(this._onTorchToggle.bind(this));
        html.find('.torch-icon[data-action="toggle-torch"]').click(this._onTorchItemToggle.bind(this));

        // Feature management
        html.find('.add-class-features').click(this._onAddClassFeatures.bind(this));
        html.find('.feature-item').click(this._onFeatureToggle.bind(this));

        // Auto-update hireling stats when type changes
        html.find('.hireling-type-select').change(this._onHirelingTypeChange.bind(this));
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

    async _onMeleeDefenseRoll(event) {
        event.preventDefault();
        this.actor.rollMeleeDefense();
    }

    async _onRangedDefenseRoll(event) {
        event.preventDefault();
        this.actor.rollRangedDefense();
    }

    async _onSpellCast(event) {
        event.preventDefault();
        const itemId = event.currentTarget.dataset.itemId;
        const spell = this.actor.items.get(itemId);

        if (spell) {
            const currentMD = this.actor.system.magicDiceCurrent || 0;
            const maxMD = this.actor.system.magicDiceMax || 0;

            // Create dice buttons for available magic dice
            let diceButtons = '';
            for (let i = 1; i <= currentMD; i++) {
                diceButtons += `<button type="button" class="magic-die-btn" data-dice-count="${i}" data-spell-id="${spell.id}">
                ${i} Die${i > 1 ? 's' : ''}
            </button>`;
            }

            if (currentMD === 0) {
                diceButtons = '<p><em>No magic dice available!</em></p>';
            }

            ChatMessage.create({
                speaker: ChatMessage.getSpeaker({ actor: this.actor }),
                content: `
            <div class="glog2d6-spell-cast">
                <h3>${this.actor.name} prepares to cast ${spell.name}</h3>
                <div class="spell-info">
                    ${spell.system.level ? `<strong>Level:</strong> ${spell.system.level}<br>` : ''}
                    ${spell.system.school ? `<strong>School:</strong> ${spell.system.school}<br>` : ''}
                    ${spell.system.range ? `<strong>Range:</strong> ${spell.system.range}<br>` : ''}
                    ${spell.system.duration ? `<strong>Duration:</strong> ${spell.system.duration}<br>` : ''}
                    ${spell.system.components ? `<strong>Components:</strong> ${spell.system.components}<br>` : ''}
                    <br><strong>Description:</strong><br>
                    ${spell.system.description || 'No description available.'}
                </div>
                <div class="magic-dice-selection">
                    <p><strong>Choose Magic Dice to invest:</strong></p>
                    ${diceButtons}
                </div>
            </div>
        `,
                flags: {
                    glog2d6: {
                        actorId: this.actor.id,
                        spellId: spell.id
                    }
                }
            });
        }
    }

    async _onRest(event) {
        event.preventDefault();
        await this.actor.rest();
        ui.notifications.info(`${this.actor.name} rests and recovers magic dice.`);
        this.render(); // Refresh to show updated MD
    }

    async _onTorchToggle(event) {
        return toggleTorch(this, event);
    }

    async _onTorchItemToggle(event) {
        return toggleTorchItem(this, event);
    }

    _analyzeEquippedWeapons() {
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
            throwableWeapon: null,
            meleeWeapons: [],
            rangedWeapons: []
        };

        if (equippedWeapons.length === 0) {
            return analysis;
        }

        // Categorize weapons
        for (const weapon of equippedWeapons) {
            const type = weapon.system.weaponType || 'melee';
            analysis.weaponTypes.add(type);

            if (type === 'thrown') {
                analysis.hasThrowable = true;
                analysis.throwableWeapon = weapon;
                analysis.meleeWeapons.push(weapon); // Thrown weapons can be melee
            } else if (type === 'ranged') {
                analysis.rangedWeapons.push(weapon);
            } else {
                analysis.meleeWeapons.push(weapon);
            }
        }

        // Determine primary weapon
        analysis.primaryWeapon = this.actor._getBestWeapon(equippedWeapons);

        // FIXED: Better attack button type logic
        if (analysis.hasThrowable && analysis.meleeWeapons.length > 1) {
            // Has throwable + another melee weapon = split buttons
            analysis.attackButtonType = 'split';
        } else if (analysis.rangedWeapons.length > 0 && analysis.meleeWeapons.length === 0) {
            // Only ranged weapons
            analysis.attackButtonType = 'ranged';
        } else if (analysis.meleeWeapons.length > 0 && analysis.rangedWeapons.length === 0) {
            // Only melee weapons
            analysis.attackButtonType = 'melee';
        } else if (analysis.weaponTypes.size > 1) {
            // Mixed weapon types
            analysis.attackButtonType = 'split';
        } else {
            // Default to generic
            analysis.attackButtonType = 'generic';
        }

        console.log(`Weapon Analysis for ${this.actor.name}:`, analysis);
        return analysis;
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

        const analysis = this._analyzeEquippedWeapons();

        if (!analysis.hasWeapons) {
            // No weapons equipped, prompt for attack type
            const attackType = await this._getAttackType();
            if (attackType === null) return;
            this.actor.rollAttack(attackType);
        } else if (analysis.attackButtonType === 'split') {
            // Multiple attack options available
            const attackType = await this._getAttackType();
            if (attackType === null) return;
            this.actor.rollAttack(attackType);
        } else {
            // Single attack type, use primary weapon
            if (analysis.primaryWeapon) {
                this.actor.rollWeaponAttack(analysis.primaryWeapon);
            } else {
                this.actor.rollAttack();
            }
        }
    }

    async _onEditToggle(event) {
        event.preventDefault();
        const currentMode = this.actor.getFlag("glog2d6", "editMode") || false;
        await this.actor.setFlag("glog2d6", "editMode", !currentMode);

        // Force a complete re-render to ensure all elements update properly
        this.render(true);
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

    async _onHirelingTypeChange(event) {
        const newType = event.target.value;
        const updates = { "system.details.type": newType };

        if (newType === "henchman") {
            updates["system.details.dailyWage"] = 1;
            updates["system.combat.attack.value"] = 0;
            updates["system.combat.attack.bonus"] = 0;
        } else if (newType === "mercenary") {
            updates["system.details.dailyWage"] = 10;
            updates["system.combat.attack.value"] = 1; // Level 0 fighter
            updates["system.combat.attack.bonus"] = 1; // Fighter bonus
        }

        await this.actor.update(updates);
        this.render();
    }

    _getActionHandler(action) {
        const handlers = {
            'sneak': this._onSneakRoll,
            'hide': this._onHideRoll,
            'disguise': this._onDisguiseRoll,
            'reaction': this._onReactionRoll,
            'diplomacy': this._onDiplomacyRoll,
            'intimidate': this._onIntimidateRoll
        };

        return handlers[action] || (() => {
            console.warn(`No handler for action: ${action}`);
        });
    }

    _getCombatHandler(action) {
        const handlers = {
            'attack': this._onAttackRoll,
            'defend': this._onDefenseRoll,
            'defend-melee': this._onMeleeDefenseRoll,
            'defend-ranged': this._onRangedDefenseRoll
        };

        return handlers[action] || (() => {
            console.warn(`No handler for combat action: ${action}`);
        });
    }

    /**
    * Enhance attribute display with proper coloring, effective values, and modifier handling
    */
    _enhanceAttributeDisplay(html) {
        const editMode = this.actor.getFlag("glog2d6", "editMode") === true;

        if (editMode) {
            // In edit mode, ensure no clickable styling
            html.find('.attribute-card').removeClass('clickable');
            html.find('.combat-card').removeClass('clickable');
            html.find('.action-card').removeClass('clickable');
            html.find('.movement-display').removeClass('clickable');
            return;
        }

        // FIXED: Add clickable class to interactive elements
        html.find('.attribute-card[data-attribute]').addClass('clickable');
        html.find('.combat-card[data-action]').addClass('clickable');
        html.find('.action-card[data-action]').addClass('clickable');
        html.find('.movement-display').addClass('clickable');

        // Update attribute values and modifiers
        html.find('.attribute-card[data-attribute]').each((index, element) => {
            const $card = $(element);
            const attributeKey = $card.attr('data-attribute');

            if (attributeKey && this.actor.system.attributes[attributeKey]) {
                const attribute = this.actor.system.attributes[attributeKey];
                this._updateAttributeDisplay($card, attribute);
            }
        });

        // Update movement display
        this._updateMovementDisplay(html);
    }

    _updateAttributeDisplay($card, attribute) {
        const originalMod = attribute.mod;
        const effectiveMod = attribute.effectiveMod !== undefined ? attribute.effectiveMod : attribute.mod;
        const baseValue = attribute.value;
        const effectiveValue = attribute.effectiveValue !== undefined ? attribute.effectiveValue : attribute.value;

        // Show effective attribute value when different from base
        const $attributeValue = $card.find('.attribute-value');
        if (effectiveValue !== baseValue) {
            $attributeValue.html(`
                <span class="effective-attr-value">${effectiveValue}</span>
                <span class="original-attr-value">(${baseValue})</span>
            `);
        } else {
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

        // Apply coloring
        $attributeValue.removeClass('normal negatively-impacted positively-impacted');
        if (effectiveValue < baseValue || effectiveMod < originalMod) {
            $attributeValue.addClass('negatively-impacted');
        } else if (effectiveValue > baseValue || effectiveMod > originalMod) {
            $attributeValue.addClass('positively-impacted');
        } else {
            $attributeValue.addClass('normal');
        }
    }

    _updateMovementDisplay(html) {
        const $movementDisplay = html.find('.movement-display');
        if ($movementDisplay.length > 0 && this.actor.type === "character") {
            const baseMovement = this.actor.system.details.movement;
            const effectiveMovement = this.actor.system.details.effectiveMovement;

            if (effectiveMovement !== undefined && effectiveMovement !== baseMovement) {
                $movementDisplay.html(`
                    <span>Move</span>
                    <span class="effective-value">${effectiveMovement}</span>
                    <span class="original-value">(${baseMovement})</span>
                `);
                $movementDisplay.addClass('negatively-impacted');
            } else {
                $movementDisplay.html(`
                    <span>Move</span>
                    ${baseMovement || 4}
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
