// module/actor/actor-sheet.mjs - Refactored
import { ErrorTrackingMixin } from '../systems/error-tracking.mjs';
import { toggleTorch, toggleTorchItem } from './handlers/torch-handlers.mjs';
import { addClassFeatures, toggleFeature, hasAvailableClassFeatures } from './handlers/feature-handlers.mjs';

import { EventHandlerRegistry, ActionHandlerMap } from './event-registry.mjs';
import { SheetRollHandler } from './handlers/sheet-roll-handler.mjs';
import { SheetStateManager } from './sheet-state-manager.mjs';
import { EquipmentHandler } from './handlers/equipment-handler.mjs';
import { ItemManagementHandler } from './handlers/item-management-handler.mjs';
import { DataContextBuilder } from './data-context-builder.mjs';

export class GLOG2D6ActorSheet extends ActorSheet {
    constructor(...args) {
        super(...args);
        this.initializeMixinsAndComponents();
    }

    static get defaultOptions() {
        return foundry.utils.mergeObject(super.defaultOptions, {
            classes: ["glog2d6", "sheet", "actor"],
            width: 520,
            height: 760,
            tabs: [{ navSelector: ".sheet-tabs", contentSelector: ".sheet-body", initial: "inventory" }]
        });
    }

    initializeMixinsAndComponents() {
        Object.assign(this, ErrorTrackingMixin);
        this._initializeErrorTracking();

        // Component initialization
        this.eventRegistry = new EventHandlerRegistry(this);
        this.actionMap = new ActionHandlerMap(this);
        this.rollHandler = new SheetRollHandler(this);
        this.stateManager = new SheetStateManager(this);
        this.equipmentHandler = new EquipmentHandler(this.actor);
        this.itemManager = new ItemManagementHandler(this);
        this.dataContextBuilder = new DataContextBuilder(this.actor);
    }

    get template() {
        return `systems/glog2d6/templates/actor/actor-${this.actor.type}-sheet.hbs`;
    }

    async getData() {
        const context = super.getData();
        return this.dataContextBuilder.buildCompleteContext(context);
    }

    activateListeners(html) {
        super.activateListeners(html);

        this.stateManager.updateAllVisualElements(html);

        if (this.isEditable) {
            this.eventRegistry.registerAllEventHandlers(html);
        }
    }

    // Direct event handlers that delegate to roll handler
    async _onAttributeRoll(event) {
        return this.rollHandler.handleAttributeRoll(event);
    }

    async _onSaveRoll(event) {
        return this.rollHandler.handleSaveRoll(event);
    }

    async _onMovementRoll(event) {
        return this.rollHandler.handleMovementRoll(event);
    }

    async _onWeaponAttack(event) {
        return this.rollHandler.handleWeaponAttack(event);
    }

    // Action handlers - now just delegation
    async handleCombatAction(event) {
        event.preventDefault();
        const action = event.currentTarget.dataset.action;
        return this.actionMap.executeAction(action, event);
    }

    async handleGenericAction(event) {
        event.preventDefault();
        const action = event.currentTarget.dataset.action;
        return this.actionMap.executeAction(action, event);
    }

    // Equipment handling
    async handleEquipmentToggle(event) {
        event.preventDefault();
        const itemId = event.currentTarget.dataset.itemId;
        const isEquipping = event.currentTarget.checked;

        await this.equipmentHandler.handleEquipmentToggle(itemId, isEquipping);
        this.render();
    }

    // UI state handlers
    async handleEditModeToggle(event) {
        event.preventDefault();
        const currentEditMode = this.actor.getFlag("glog2d6", "editMode") || false;

        await this.actor.setFlag("glog2d6", "editMode", !currentEditMode);
        this.render();
    }

    // Feature and torch handlers - delegation to existing modules
    async handleAddClassFeatures(event) {
        return addClassFeatures(this, event);
    }

    async handleFeatureToggle(event) {
        return toggleFeature(this, event);
    }

    async handleTorchToggle(event) {
        const result = await toggleTorch(this.actor, event);
        if (result.ok) this.render();
    }

    async handleTorchItemToggle(event) {
        const result = await toggleTorchItem(this.actor, event);
        if (result.ok) this.render();
    }

    // Rest handling
    async handleRest(event) {
        event.preventDefault();

        try {
            const restResult = await this.actor.rest();
            this.notifyRestResult(restResult);
            this.render();
        } catch (error) {
            this.handleRestError(error);
        }
    }

    notifyRestResult(restResult) {
        const hasRecovery = restResult.hpRestored > 0 || restResult.mdRestored > 0;
        const message = hasRecovery
            ? `${this.actor.name} rests and recovers!`
            : `${this.actor.name} rests but is already fully recovered.`;

        ui.notifications.info(message);
    }

    handleRestError(error) {
        console.error("Error during rest:", error);
        ui.notifications.error("Failed to rest: " + error.message);
    }

    // Item management - delegation
    async handleItemCreate(event) {
        return this.itemManager.handleItemCreate(event);
    }

    async handleItemEdit(event) {
        return this.itemManager.handleItemEdit(event);
    }

    async handleItemDelete(event) {
        return this.itemManager.handleItemDelete(event);
    }

    // Spell casting
    async handleSpellCast(event) {
        event.preventDefault();
        const spell = this.extractSpellFromEvent(event);

        if (spell) {
            await this.createSpellCastingMessage(spell);
        }
    }

    extractSpellFromEvent(event) {
        const itemId = event.currentTarget.dataset.itemId;
        return this.actor.items.get(itemId);
    }

    async createSpellCastingMessage(spell) {
        const magicDiceData = this.getMagicDiceData();
        const spellCastingMessage = new SpellCastingMessageBuilder(this.actor, spell, magicDiceData);

        await spellCastingMessage.createAndSendMessage();
    }

    getMagicDiceData() {
        return {
            current: this.actor.system.magicDiceCurrent || 0,
            max: this.actor.system.magicDiceMax || 0
        };
    }
}

class SpellCastingMessageBuilder {
    constructor(actor, spell, magicDiceData) {
        this.actor = actor;
        this.spell = spell;
        this.magicDiceData = magicDiceData;
    }

    async createAndSendMessage() {
        const messageContent = this.buildMessageContent();
        const messageFlags = this.buildMessageFlags();

        await ChatMessage.create({
            speaker: ChatMessage.getSpeaker({ actor: this.actor }),
            content: messageContent,
            flags: messageFlags
        });
    }

    buildMessageContent() {
        const spellInfo = this.buildSpellInfoSection();
        const diceSelection = this.buildDiceSelectionSection();

        return `
            <div class="glog2d6-spell-cast">
                <h3>${this.actor.name} prepares to cast ${this.spell.name}</h3>
                ${spellInfo}
                ${diceSelection}
            </div>
        `;
    }

    buildSpellInfoSection() {
        const spellProperties = this.extractSpellProperties();
        const description = this.spell.system.description || 'No description available.';

        return `
            <div class="spell-info">
                ${spellProperties}
                <br><strong>Description:</strong><br>
                ${description}
            </div>
        `;
    }

    extractSpellProperties() {
        const properties = [];
        const propertyMapping = {
            range: 'Range',
            duration: 'Duration',
            components: 'Components'
        };

        for (const [key, label] of Object.entries(propertyMapping)) {
            const value = this.spell.system[key];
            if (value) {
                properties.push(`<strong>${label}:</strong> ${value}<br>`);
            }
        }

        return properties.join('');
    }

    buildDiceSelectionSection() {
        const diceButtons = this.generateDiceButtons();

        return `
            <div class="magic-dice-selection">
                <p><strong>Choose Magic Dice to invest:</strong></p>
                ${diceButtons}
            </div>
        `;
    }

    generateDiceButtons() {
        if (this.magicDiceData.current === 0) {
            return '<p><em>No magic dice available!</em></p>';
        }

        const buttons = [];
        for (let i = 1; i <= this.magicDiceData.current; i++) {
            const buttonText = `${i} Die${i > 1 ? 's' : ''}`;
            buttons.push(`
                <button type="button" class="magic-die-btn"
                        data-dice-count="${i}"
                        data-spell-id="${this.spell.id}">
                    ${buttonText}
                </button>
            `);
        }

        return buttons.join('');
    }

    buildMessageFlags() {
        return {
            glog2d6: {
                actorId: this.actor.id,
                spellId: this.spell.id
            }
        };
    }
}
