// Enhanced actor-sheet.mjs with real functionality
import { toggleTorch, toggleTorchItem } from './handlers/torch-handlers.mjs';
import { safely } from "../systems/safely.mjs";
import {
    addClassFeatures,
    toggleFeature,
    hasAvailableClassFeatures,
} from './handlers/feature-handlers.mjs'

export class GLOG2D6ActorSheet extends ActorSheet {
    constructor(...args) {
        console.log('🔧 Enhanced ActorSheet constructor');
        super(...args);

        // Add back safe methods setup
        this._setupSafeMethods();

        console.log('✅ Enhanced ActorSheet constructor complete');
    }

    _setupSafeMethods() {
        // Create safe versions of potentially risky methods
        this.getWeaponAnalysis = safely({
            fallback: { hasWeapons: false, attackButtonType: 'generic' },
            context: 'weapon-analysis'
        })(() => this.actor.analyzeEquippedWeapons());

        this.hasFeature = safely.silent(false)(
            (featureName) => this.actor.hasFeature(featureName)
        );

        this.hasAvailableFeatures = safely({
            fallback: false,
            context: 'loading-available-features'
        })((actor) => hasAvailableClassFeatures(actor));

        console.log('✅ Safe methods setup complete');
    }

    static get defaultOptions() {
        return foundry.utils.mergeObject(super.defaultOptions, {
            classes: ["glog2d6", "sheet", "actor"],
            width: 520,
            height: 760,
            tabs: [{ navSelector: ".sheet-tabs", contentSelector: ".sheet-body", initial: "inventory" }]
        });
    }

    get template() {
        return `systems/glog2d6/templates/actor/actor-${this.actor.type}-sheet.hbs`;
    }

    async getData() {
        console.log('🔧 Enhanced getData() called');

        const context = super.getData();

        // Basic context
        context.rollData = context.actor.getRollData();
        context.system = context.actor.system;
        context.flags = context.actor.flags;

        // Edit mode
        context.editMode = this.actor.getFlag("glog2d6", "editMode") === true;
        console.log('Edit mode:', context.editMode);

        // Available classes - from config data
        let classes = CONFIG.GLOG.CLASSES;
        context.availableClasses = classes.map((cls) => cls.name);

        // Available features - safely
        try {
            context.hasAvailableFeatures = this.hasAvailableFeatures(this.actor);
            console.log('Has available features:', context.hasAvailableFeatures);
        } catch (error) {
            console.warn('Failed to check available features:', error);
            context.hasAvailableFeatures = false;
        }

        // Weapon analysis - safely
        try {
            context.weaponAnalysis = this.getWeaponAnalysis();
            console.log('Weapon analysis:', context.weaponAnalysis);
        } catch (error) {
            console.warn('Failed to analyze weapons:', error);
            context.weaponAnalysis = { hasWeapons: false, attackButtonType: 'generic' };
        }

        // Feature checks - safely
        try {
            context.hasAcrobatTraining = this.hasFeature("Acrobat Training");
            console.log('Has Acrobat training:', context.hasAcrobatTraining);
        } catch (error) {
            console.warn('Failed to check features:', error);
            context.hasAcrobatTraining = false;
        }

        console.log('✅ Enhanced getData() complete');
        return context;
    }

    activateListeners(html) {
        console.log('🔧 Full activateListeners() called');
        super.activateListeners(html);

        // Always do visual enhancements first
        this._updateVisualDisplay(html);

        // Only add our listeners if sheet is editable
        if (!this.isEditable) {
            console.log('Sheet not editable, skipping interactive listeners');
            return;
        }

        // All event listeners
        this._addAllEventListeners(html);

        console.log('✅ Full activateListeners() complete');
    }


    // Event handlers
    async _onEditToggle(event) {
        event.preventDefault();
        const currentMode = this.actor.getFlag("glog2d6", "editMode") || false;
        await this.actor.setFlag("glog2d6", "editMode", !currentMode);
        this.render();
    }

    async _onAddClassFeatures(event) {
        return addClassFeatures(this, event);
    }

    async _onFeatureToggle(event) {
        return toggleFeature(this, event);
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


    _updateVisualDisplay(html) {
        const editMode = this.actor.getFlag("glog2d6", "editMode") === true;

        if (!editMode) {
            html.find('.attribute-card[data-attribute]').addClass('clickable');
            html.find('.combat-card[data-action]').addClass('clickable');
            html.find('.action-card[data-action]').addClass('clickable');
            html.find('.movement-display').addClass('clickable');
        }

        // Update attribute displays
        html.find('.attribute-card[data-attribute]').each((index, element) => {
            const $card = $(element);
            const attributeKey = $card.attr('data-attribute');
            if (attributeKey && this.actor.system.attributes[attributeKey]) {
                const attribute = this.actor.system.attributes[attributeKey];
                this._updateAttributeDisplay($card, attribute);
            }
        });

        this._updateMovementDisplay(html);
    }

    _addAllEventListeners(html) {
        try {
            // Attribute and combat clicks
            html.find('.attribute-card.clickable').click(this._onAttributeRoll.bind(this));
            html.find('.attribute-save').click(this._onSaveRoll.bind(this));
            html.find('.combat-card.clickable').click(this._getCombatClickHandler.bind(this));
            html.find('.action-card.clickable').click(this._getActionClickHandler.bind(this));
            html.find('.movement-display.clickable').click(this._onMovementRoll.bind(this));
            console.log('✅ Roll listeners added');

            // Weapon and spell actions
            html.find('.weapon-attack-btn').click(this._onWeaponAttack.bind(this));
            html.find('.spell-cast-btn').click(this._onSpellCast.bind(this));
            console.log('✅ Weapon/spell listeners added');

            // Equipment toggles
            html.find('.equipped-toggle').change(this._onEquippedToggle.bind(this));
            html.find('.edit-toggle').click(this._onEditToggle.bind(this));
            console.log('✅ Equipment listeners added');

            // Item management
            html.find('.item-create').click(this._onItemCreate.bind(this));
            html.find('.item-edit').click(this._onItemEdit.bind(this));
            html.find('.item-delete').click(this._onItemDelete.bind(this));
            console.log('✅ Item management listeners added');

            // Feature and torch controls
            html.find('.torch-btn').click(this._onTorchToggle.bind(this));
            html.find('.torch-icon[data-action="toggle-torch"]').click(this._onTorchItemToggle.bind(this));
            html.find('.add-class-features').click(this._onAddClassFeatures.bind(this));
            html.find('.feature-item').click(this._onFeatureToggle.bind(this));
            html.find('.rest-btn').click(this._onRest.bind(this));
            console.log('✅ Feature/torch listeners added');

        } catch (error) {
            console.error('Error adding event listeners:', error);
        }
    }

    // Combat and Roll Event Handlers
    async _onAttributeRoll(event) {
        event.preventDefault();
        const element = event.currentTarget;
        const attribute = element.dataset.attribute;
        console.log(`Rolling ${attribute} attribute`);

        // Use default target of 7, DM will declare if different
        this.actor.rollAttribute(attribute, 7);
    }

    async _onSaveRoll(event) {
        event.preventDefault();
        event.stopPropagation(); // Prevent bubbling to attribute card
        const element = event.currentTarget;
        const attribute = element.dataset.attribute;
        console.log(`Rolling ${attribute} save`);

        this.actor.rollSave(attribute);
    }

    _getCombatClickHandler(event) {
        event.preventDefault();
        const action = event.currentTarget.dataset.action;
        console.log(`Combat action: ${action}`);

        const handlers = {
            'attack': this._onAttackRoll.bind(this),
            'defend': this._onDefenseRoll.bind(this),
            'defend-melee': this._onMeleeDefenseRoll.bind(this),
            'defend-ranged': this._onRangedDefenseRoll.bind(this)
        };

        const handler = handlers[action];
        if (handler) {
            handler(event);
        } else {
            console.warn(`No handler for combat action: ${action}`);
        }
    }

    _getActionClickHandler(event) {
        event.preventDefault();
        const action = event.currentTarget.dataset.action;
        console.log(`Action: ${action}`);

        const handlers = {
            'sneak': () => this.actor.rollSneak(),
            'hide': () => this.actor.rollHide(),
            'disguise': () => this.actor.rollDisguise(),
            'reaction': () => this.actor.rollReaction(),
            'diplomacy': () => this.actor.rollDiplomacy(),
            'intimidate': () => this.actor.rollIntimidate()
        };

        const handler = handlers[action];
        if (handler) {
            handler();
        } else {
            console.warn(`No handler for action: ${action}`);
        }
    }

    async _onAttackRoll(event) {
        event.preventDefault();
        console.log('Attack roll requested');

        const analysis = this.actor.analyzeEquippedWeapons();

        if (!analysis.hasWeapons) {
            const attackType = await this._getAttackTypeDialog();
            if (attackType) this.actor.rollAttack(attackType);
        } else if (analysis.attackButtonType === 'split') {
            const attackType = await this._getAttackTypeDialog();
            if (attackType) this.actor.rollAttack(attackType);
        } else if (analysis.primaryWeapon) {
            this.actor.rollWeaponAttack(analysis.primaryWeapon);
        } else {
            this.actor.rollAttack();
        }
    }

    async _onDefenseRoll(event) {
        event.preventDefault();
        console.log('Defense roll requested');
        this.actor.rollDefense();
    }

    async _onMeleeDefenseRoll(event) {
        event.preventDefault();
        console.log('Melee defense roll requested');
        this.actor.rollMeleeDefense();
    }

    async _onRangedDefenseRoll(event) {
        event.preventDefault();
        console.log('Ranged defense roll requested');
        this.actor.rollRangedDefense();
    }

    async _onMovementRoll(event) {
        event.preventDefault();
        console.log('Movement roll requested');
        this.actor.rollMovement();
    }

    async _onWeaponAttack(event) {
        event.preventDefault();
        const itemId = event.currentTarget.dataset.itemId;
        const weapon = this.actor.items.get(itemId);
        console.log(`Weapon attack: ${weapon?.name}`);

        if (weapon) {
            this.actor.rollWeaponAttack(weapon);
        }
    }

    // Utility methods
    async _getAttackTypeDialog() {
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

    // Torch handlers
    async _onTorchToggle(event) {
        return toggleTorch(this, event);
    }

    async _onTorchItemToggle(event) {
        return toggleTorchItem(this, event);
    }

    async _onSpellCast(event) {
        event.preventDefault();
        const itemId = event.currentTarget.dataset.itemId;
        const spell = this.actor.items.get(itemId);
        console.log(`Casting spell: ${spell?.name}`);

        if (spell) {
            const currentMD = this.actor.system.magicDiceCurrent || 0;

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


    // Equipment management handlers
    async _onEquippedToggle(event) {
        event.preventDefault();
        const itemId = event.currentTarget.dataset.itemId;
        const item = this.actor.items.get(itemId);
        const isEquipping = event.currentTarget.checked;
        console.log(`Toggling equipped: ${item?.name} = ${isEquipping}`);

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

            // Check for weapon type conflicts
            const newWeaponType = newItem.system.weaponType;
            for (let weapon of equippedWeapons) {
                const existingType = weapon.system.weaponType;
                if ((newWeaponType === "ranged" && existingType !== "ranged" && existingType !== "thrown") ||
                    (newWeaponType !== "ranged" && newWeaponType !== "thrown" && existingType === "ranged")) {
                    updates.push({ _id: weapon.id, "system.equipped": false });
                }
            }

            if (newItem.system.size === "heavy") {
                // Heavy weapon unequips all other weapons and shields
                for (let item of [...equippedWeapons, ...equippedShields]) {
                    updates.push({ _id: item.id, "system.equipped": false });
                }
            } else {
                // Handle normal weapon limits
                const remainingWeapons = equippedWeapons.filter(w =>
                    w.system.size !== "heavy" &&
                    !updates.some(u => u._id === w.id)
                );

                if (equippedShields.length > 0) {
                    if (remainingWeapons.length >= 1) {
                        const weakest = this._findWeakestWeapon(remainingWeapons);
                        updates.push({ _id: weakest.id, "system.equipped": false });
                    }
                } else if (remainingWeapons.length >= 2) {
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
        const priority = { heavy: 3, medium: 2, light: 1 };

        return weapons.reduce((weakest, current) => {
            const weakestPriority = priority[weakest.system.size] || 1;
            const currentPriority = priority[current.system.size] || 1;

            if (currentPriority < weakestPriority) {
                return current;
            } else if (currentPriority === weakestPriority) {
                const weakestDamage = weakest.system.damage?.length || 0;
                const currentDamage = current.system.damage?.length || 0;
                return currentDamage < weakestDamage ? current : weakest;
            }
            return weakest;
        });
    }

    // Rest handler
    async _onRest(event) {
        event.preventDefault();
        console.log("Rest button clicked");

        try {
            const restResult = await this.actor.rest();

            if (restResult.hpRestored > 0 || restResult.mdRestored > 0) {
                ui.notifications.info(`${this.actor.name} rests and recovers!`);
            } else {
                ui.notifications.info(`${this.actor.name} rests but is already fully recovered.`);
            }

            this.render();
        } catch (error) {
            console.error("Error during rest:", error);
            ui.notifications.error("Failed to rest: " + error.message);
        }
    }
}
