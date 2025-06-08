import { ErrorTrackingMixin } from '../systems/error-tracking.mjs';
import { toggleTorch, toggleTorchItem } from './handlers/torch-handlers.mjs';
import { addClassFeatures, displayFeature } from './handlers/feature-handlers.mjs';
import { ActorSheetDiagnostics } from './sheet-diagnostics.mjs';

import { EventHandlerRegistry, ActionHandlerMap } from './event-registry.mjs';
import { SheetRollHandler } from './handlers/sheet-roll-handler.mjs';
import { SheetStateManager } from './sheet-state-manager.mjs';
import { EquipmentHandler } from './handlers/equipment-handler.mjs';
import { ItemManagementHandler } from './handlers/item-management-handler.mjs';
import { DataContextBuilder } from './data-context-builder.mjs';

export class GLOG2D6ActorSheet extends foundry.appv1.sheets.ActorSheet {
    constructor(...args) {
        console.log(`🏗️ [SHEET] Constructor called for actor:`, args[0]?.name, `by user:`, game.user?.name);
        super(...args);
        this._componentsInitialized = false;

        this.diagnostics = new ActorSheetDiagnostics(this);
        this._initializationAttempts = 0;
        this.MAX_INIT_ATTEMPTS = 3;
    }

    static get defaultOptions() {
        return foundry.utils.mergeObject(super.defaultOptions, {
            classes: ["glog2d6", "sheet", "actor"],
            width: 600,
            height: 1050,
            tabs: [{ navSelector: ".sheet-tabs", contentSelector: ".sheet-body", initial: "inventory" }]
        });
    }

    _ensureComponentsInitialized() {
        console.log(`🔧 [SHEET] _ensureComponentsInitialized called for ${this.actor.name} by ${game.user.name}`);
        if (this._componentsInitialized) return;

        this.diagnostics.checkpoint('component_init_start', {
            attempt: ++this._initializationAttempts
        });

        try {
            // CRITICAL: Verify actor systems exist before proceeding
            if (!this.actor.attributeSystem) {
                // Try to initialize actor systems first
                if (!this.actor._systemsInitialized && this.actor.initializeComponents) {
                    console.warn(`Actor ${this.actor.name} systems not initialized, attempting to fix...`);
                    this.actor.initializeComponents();
                    this.actor._validateAllSystems();
                    this.actor._systemsInitialized = true;
                }

                // If still no attribute system, throw error
                if (!this.actor.attributeSystem) {
                    throw new Error(`FATAL: Actor ${this.actor.name} systems not initialized. Sheet cannot render safely.`);
                }
            }

            this.initializeMixinsAndComponents();
            this._componentsInitialized = true;

            this.diagnostics.checkpoint('component_init_success');

        } catch (error) {
            this.diagnostics.recordFailure('component_initialization', error);

            if (this._initializationAttempts >= this.MAX_INIT_ATTEMPTS) {
                console.error(`🚨 COMPONENT INIT FAILED AFTER ${this.MAX_INIT_ATTEMPTS} ATTEMPTS FOR ${this.actor.name}`);
                // Create emergency fallback components
                this._createEmergencyComponents();
                this._componentsInitialized = true;
                this._emergencyMode = true;
            } else {
                // Retry after brief delay
                setTimeout(() => this._ensureComponentsInitialized(), 100);
            }
        }
    }

    _createEmergencyComponents() {
        console.warn(`Creating emergency components for ${this.actor.name}`);

        // Create stub components that won't crash
        this.eventRegistry = { registerAllEventHandlers: () => { } };
        this.actionMap = {};
        this.rollHandler = {
            handleAttributeRoll: (event) => {
                const attr = event.currentTarget.dataset.attribute;
                return this.actor.rollAttribute?.(attr, 7);
            }
        };
        this.stateManager = { updateAllVisualElements: () => { } };
        this.equipmentHandler = {};
        this.itemManager = {};
        this.dataContextBuilder = {
            buildCompleteContext: (context) => this._buildEmergencyContext(context)
        };
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
        console.log(`📊 [SHEET] getData called for ${this.actor.name} by ${game.user.name}`);
        this.diagnostics.checkpoint('getData_start');

        try {
            // Ensure actor systems are ready BEFORE sheet components
            this._ensureComponentsInitialized();
            this.diagnostics.checkpoint('components_ready');

            const context = super.getData();
            this.diagnostics.checkpoint('super_getData_complete');

            let result;
            if (this._emergencyMode) {
                result = this._buildEmergencyContext(context);
                this.diagnostics.checkpoint('emergency_context_built');
            } else {
                result = this.dataContextBuilder.buildCompleteContext(context);
                this.diagnostics.checkpoint('full_context_built');
            }

            console.log('Template context:', result.system);
            this.diagnostics.checkpoint('getData_success');
            return result;

        } catch (error) {
            this.diagnostics.recordFailure('getData', error);
            console.error(`getData failed for ${this.actor.name}:`, error);

            // Last resort emergency context
            return this._buildEmergencyContext(super.getData());
        }
    }

    _buildEmergencyContext(baseContext) {
        console.warn(`Building emergency context for ${this.actor.name}`);

        return {
            ...baseContext,
            rollData: this.actor.getRollData?.() || {},
            system: this.actor.system || {},
            flags: this.actor.flags || {},
            editMode: this.actor.getFlag?.("glog2d6", "editMode") === true,
            emergencyMode: true,
            emergencyMessage: 'Sheet loaded in emergency mode. Some features may be unavailable.',
            weaponAnalysis: { hasWeapons: false, attackButtonType: 'generic' },
            hasAvailableFeatures: false,
            availableClasses: [],
            hasAcrobatTraining: false
        };
    }

    activateListeners(html) {
        this.diagnostics.checkpoint('activateListeners_start');

        try {
            this._ensureComponentsInitialized();
            this.diagnostics.checkpoint('activateListeners_components_ready');

            super.activateListeners(html);
            this.diagnostics.checkpoint('super_activateListeners_complete');

            this.stateManager.updateAllVisualElements(html);
            this.diagnostics.checkpoint('visual_elements_updated');

            if (this.isEditable) {
                if (this._emergencyMode) {
                    this._setupEmergencyModeHandlers(html);
                } else {
                    this.eventRegistry.registerAllEventHandlers(html);
                }
                this.diagnostics.checkpoint('event_handlers_registered');
            }

        } catch (error) {
            this.diagnostics.recordFailure('activateListeners', error);
            console.error(`activateListeners failed for ${this.actor.name}:`, error);

            // Try to set up minimal handlers
            this._setupMinimalHandlers(html);
        }
    }

    // ADD: Emergency mode handlers
    _setupEmergencyModeHandlers(html) {
        console.warn(`Setting up emergency mode handlers for ${this.actor.name}`);

        // Show emergency mode notice
        if (!html.find('.emergency-notice').length) {
            html.prepend(`
                <div class="emergency-notice" style="background: #ff9800; color: white; padding: 8px; text-align: center; font-weight: bold;">
                    ⚠️ EMERGENCY MODE: Some features disabled due to initialization errors
                    <button type="button" onclick="game.glog2d6?.resetActor?.('${this.actor.id}')" style="margin-left: 10px; padding: 2px 6px;">
                        Reset Actor
                    </button>
                </div>
            `);
        }

        // Basic edit mode toggle
        html.find('.edit-toggle').click(async (event) => {
            event.preventDefault();
            const currentEditMode = this.actor.getFlag?.("glog2d6", "editMode") || false;
            await this.actor.setFlag?.("glog2d6", "editMode", !currentEditMode);
            this.render();
        });
    }

    // ADD: Minimal fallback handlers
    _setupMinimalHandlers(html) {
        console.warn(`Setting up minimal fallback handlers for ${this.actor.name}`);

        // Basic attribute rolls only
        html.find('.attribute-card.clickable').click(async (event) => {
            event.preventDefault();
            try {
                const attr = event.currentTarget.dataset.attribute;
                await this.actor.rollAttribute?.(attr, 7);
            } catch (error) {
                console.error('Minimal attribute roll failed:', error);
                ui.notifications.error('Roll failed - sheet in emergency mode');
            }
        });
    }

    async _onAttributeRoll(event) {
        try {
            this.diagnostics.checkpoint('attribute_roll_start');
            const result = this.rollHandler.handleAttributeRoll(event);
            this.diagnostics.checkpoint('attribute_roll_success');
            return result;
        } catch (error) {
            this.diagnostics.recordFailure('_onAttributeRoll', error);
            throw error;
        }
    }

    // ADD: Diagnostic method for debugging
    getSheetDiagnostics() {
        return this.diagnostics.generateReport();
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

    async handleFeatureRoll(event) {
        event.preventDefault();
        event.stopPropagation();

        const featureName = event.currentTarget.dataset.featureName;

        if (!this.featureRollHandler) {
            const { FeatureRollHandler } = await import('./handlers/feature-roll-handler.mjs');
            this.featureRollHandler = new FeatureRollHandler(this.actor);
        }

        await this.featureRollHandler.rollFeature(featureName);
    }

    async handleGenericAction(event) {
        event.preventDefault();
        const action = event.currentTarget.dataset.action;
        return this.actionMap.executeAction(action, event);
    }

    async handleEditModeToggle(event) {
        event.preventDefault();
        this.diagnostics.checkpoint('editModeToggle_start');

        try {
            const currentEditMode = this.actor.getFlag("glog2d6", "editMode") || false;
            await this.actor.setFlag("glog2d6", "editMode", !currentEditMode);
            this.render();
            this.diagnostics.checkpoint('editModeToggle_success');
        } catch (error) {
            this.diagnostics.recordFailure('handleEditModeToggle', error);
            throw error;
        }
    }

    // ADD: Override close to cleanup diagnostics
    async close(options = {}) {
        if (this.diagnostics && this.diagnostics.failures.length > 0) {
            console.log(`Sheet diagnostics for ${this.actor.name}:`, this.diagnostics.generateReport());
        }
        return super.close(options);
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
        return displayFeature(this, event);
        // return toggleFeature(this, event);
        //  move ^ this ^ later when you want to use it
    }

    // Add this single method to your GLOG2D6ActorSheet class
    async handleEquipmentToggle(event) {
        event.preventDefault();
        const itemId = event.currentTarget.dataset.itemId;
        const isEquipping = event.currentTarget.checked;

        try {
            await this.equipmentHandler.handleEquipmentToggle(itemId, isEquipping);
            this.render();
        } catch (error) {
            console.error(`Equipment toggle failed for ${this.actor.name}:`, error);
            ui.notifications.error('Equipment toggle failed');
            event.currentTarget.checked = !isEquipping; // Revert checkbox
        }
    }

    async handleSpellCast(event) {
        event.preventDefault();
        const spellId = event.currentTarget.dataset.itemId;
        const spell = this.actor.items.get(spellId);

        if (spell) {
            // Your spell casting logic here
            spell.sheet.render(true); // or implement spell casting
        }
    }

    async handleReputationSelect(event) {
        event.preventDefault();
        event.stopPropagation();

        const itemId = event.currentTarget.dataset.itemId;
        const reputationType = event.currentTarget.value;

        const item = this.actor.items.get(itemId);
        if (item && reputationType) {
            await item.update({ "system.reputationType": reputationType });
            this.render(false);
        }
    }

    async rollFeature(featureName) {
        const config = this.rollConfigs[featureName];
        if (!config) {
            ui.notifications.warn(`No roll configuration for ${featureName}`);
            return;
        }

        if (config.dialog) {
            return this.openAttributeDialog(featureName);
        }

        return this.executeRoll(featureName, config);
    }
    async handleTorchToggle(event) {
        const result = await toggleTorch(this.actor, event);
        if (result.ok) this.render();
    }

    async handleTorchItemToggle(event) {
        const result = await toggleTorchItem(this.actor, event);
        if (result.ok) this.render();
    }

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

    async handleTraumaSave(event) {
        event.preventDefault();
        console.log('Trauma save button clicked');

        if (!this.actor.traumaSystem) {
            console.error('Trauma system not initialized');
            return;
        }

        try {
            await this.actor.initiateTraumaSave();
        } catch (error) {
            console.error('Error initiating trauma save:', error);
            ui.notifications.error('Failed to open trauma save dialog: ' + error.message);
        }
    }

    async handleRemoveWound(event) {
        event.preventDefault();
        const woundId = event.currentTarget.dataset.woundId;

        const confirm = await Dialog.confirm({
            title: "Remove Wound",
            content: "<p>Are you sure you want to remove this wound?</p>",
            defaultYes: false
        });

        if (confirm) {
            await this.actor.removeWound(woundId);
            this.render();
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

    async handleHeal(event) {
        event.preventDefault();

        try {
            const healResult = await this.actor.heal();
            this.notifyHealResult(healResult);
            this.render(false);
        } catch (error) {
            console.error("Error during healing:", error);
            ui.notifications.error("Failed to heal: " + error.message);
        }
    }

    notifyHealResult(healResult) {
        if (healResult.healed > 0) {
            ui.notifications.info(`${this.actor.name} heals ${healResult.healed} HP!`);
        } else {
            ui.notifications.info(`${this.actor.name} is already at full health.`);
        }
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
