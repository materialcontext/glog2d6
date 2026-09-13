import { toggleTorch, toggleTorchItem } from './handlers/torch-handlers.mjs';
import { addClassFeatures, displayFeature } from './handlers/feature-handlers.mjs';

import { EventHandlerRegistry, ActionHandlerMap } from './event-registry.mjs';
import { revealNote, openNote } from './handlers/note-handlers.mjs';
import { SheetRollHandler } from './handlers/sheet-roll-handler.mjs';
import { EquipmentHandler } from './handlers/equipment-handler.mjs';
import { ItemManagementHandler } from './handlers/item-management-handler.mjs';
import { DataContextBuilder } from './data-context-builder.mjs';
import { classUpdateFor } from './class-identity.mjs';
import {
    SHEET_MODES,
    allowsEditMode,
    modeFlagPath,
    modeSize,
    modeTemplate,
    modeToggleIcon,
    modeToggleLabel,
    normalizeMode,
    otherMode
} from './sheet-mode.mjs';

export class GLOG2D6ActorSheet extends foundry.appv1.sheets.ActorSheet {
    constructor(...args) {
        super(...args);
        this.initializeMixinsAndComponents();
        this._applyModeOptions();
    }

    /**
     * NPCs share this class and keep their own template, so the defaults stay
     * theirs. The character layout -- its window class and its two sizes -- is
     * applied per instance, below.
     */
    static get defaultOptions() {
        return foundry.utils.mergeObject(super.defaultOptions, {
            classes: ["glog2d6", "sheet", "actor"],
            width: 600,
            height: 850,
            tabs: [{ navSelector: ".sheet-tabs", contentSelector: ".tabbed-content", initial: "inventory" }]
        });
    }

    initializeMixinsAndComponents() {
        this.eventRegistry = new EventHandlerRegistry(this);
        this.actionMap = new ActionHandlerMap(this);
        this.rollHandler = new SheetRollHandler(this);
        this.equipmentHandler = new EquipmentHandler(this.actor);
        this.itemManager = new ItemManagementHandler(this);
        this.dataContextBuilder = new DataContextBuilder(this.actor);
        this.noteHandler = {
            openNote: (e) => openNote(this.actor, e),
            revealNote: (e) => revealNote(this.actor, e)
        };
    }

    /**
     * Compact vs full is a preference of *this user* about *this actor*: a GM
     * running someone else's character in compact must not change what its
     * player sees when they open the same document.
     */
    get sheetMode() {
        if (this.actor.type !== "character") return SHEET_MODES.FULL;
        return normalizeMode(game.user?.getFlag("glog2d6", modeFlagPath(this.actor.id)));
    }

    get isEditModeActive() {
        return this.actor.getFlag("glog2d6", "editMode") === true;
    }

    _applyModeOptions() {
        if (this.actor.type !== "character") return;

        if (!this.options.classes.includes("glog-character")) {
            this.options.classes = [...this.options.classes, "glog-character"];
        }

        const size = modeSize(this.sheetMode);
        this.options.width = size.width;
        this.options.height = size.height;
    }

    get template() {
        if (this.actor.type === "character") return modeTemplate(this.sheetMode);
        return `systems/glog2d6/templates/actor/actor-${this.actor.type}-sheet.hbs`;
    }

    /**
     * Edit and the mode switch are window controls, not sheet content, so they
     * live on the window frame where Foundry already puts controls.
     */
    _getHeaderButtons() {
        const buttons = super._getHeaderButtons();
        if (this.actor.type !== "character" || !this.isEditable) return buttons;

        const mode = this.sheetMode;
        const extra = [{
            label: modeToggleLabel(mode),
            class: "glog-mode-toggle",
            icon: modeToggleIcon(mode),
            onclick: event => this.handleModeToggle(event)
        }];

        if (allowsEditMode(mode)) {
            extra.unshift({
                label: this.isEditModeActive ? "Done" : "Edit",
                class: "glog-edit-toggle",
                icon: this.isEditModeActive ? "fa-solid fa-lock" : "fa-solid fa-pen-to-square",
                onclick: event => this.handleEditModeToggle(event)
            });
        }

        return [...extra, ...buttons];
    }

    async getData() {
        const context = super.getData();
        return this.dataContextBuilder.buildCompleteContext(context, { mode: this.sheetMode });
    }

    activateListeners(html) {
        super.activateListeners(html);

        if (this.isEditable) {
            this.eventRegistry.registerAllEventHandlers(html);
        }
    }

    async handleModeToggle(event) {
        event?.preventDefault();

        const next = otherMode(this.sheetMode);
        await game.user.setFlag("glog2d6", modeFlagPath(this.actor.id), next);

        const size = modeSize(next);
        this.options.width = size.width;
        this.options.height = size.height;

        await this.render(true);
        this.setPosition({ width: size.width, height: size.height });
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

    // Action delegation
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

    async handleEditModeToggle(event) {
        event?.preventDefault();
        await this.actor.setFlag("glog2d6", "editMode", !this.isEditModeActive);
        this.render();
    }

    /**
     * The class is two fields: a label you can type anything into, and a key
     * that feature lookup uses. The dropdown writes both, so picking Custom
     * frees the label without pointing the lookup at a name it cannot resolve.
     */
    async handleClassSelect(event) {
        event.preventDefault();

        const update = classUpdateFor(
            event.currentTarget.value,
            this.actor.system?.details,
            (CONFIG.GLOG?.CLASSES ?? []).map(cls => cls.name).filter(Boolean)
        );

        await this.actor.update(update);
        this.render();
    }

    /**
     * One point off or on, for the damage you take between proper rolls.
     */
    async handleHpStep(event) {
        event.preventDefault();

        const step = Number(event.currentTarget.dataset.step) || 0;
        const max = Number(this.actor.system?.hp?.max) || 0;
        const current = Number(this.actor.system?.hp?.value) || 0;
        const next = Math.max(0, Math.min(current + step, max));

        if (next === current) return;
        await this.actor.update({ "system.hp.value": next });
        this.render();
    }

    async handleAddClassFeatures(event) {
        return addClassFeatures(this, event);
    }

    async handleFeatureToggle(event) {
        return displayFeature(this, event);
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
            title: "Clear Wound",
            content: "<p>Clear this wound? It will reroll max HP and leave a scar.</p>",
            defaultYes: false
        });

        if (confirm) {
            await this.actor.removeWound(woundId);
            this.render();
        }
    }

    async handleAdvanceWound(event) {
        event.preventDefault();
        event.stopPropagation();
        await this.actor.advanceWound(event.currentTarget.dataset.woundId);
        this.render();
    }

    async handleAddWound(event) {
        event.preventDefault();
        const damage = await this._promptWoundDamage();
        if (damage === null) return;

        await this.actor.applyWound(damage);
        this.render();
    }

    async _promptWoundDamage() {
        const content = `
            <div class="form-group flex flex-col flex-gap-4 p-6">
                <label class="text-small text-bold text-upper text-muted">Excess damage</label>
                <input type="number" name="damage" value="1" min="1" class="input text-center" />
            </div>`;

        return new Promise(resolve => {
            new Dialog({
                title: "Roll a Wound",
                content,
                buttons: {
                    roll: {
                        label: "Roll",
                        callback: html => {
                            const value = parseInt(html.find('input[name="damage"]').val(), 10);
                            resolve(Number.isFinite(value) && value > 0 ? value : 1);
                        }
                    },
                    cancel: { label: "Cancel", callback: () => resolve(null) }
                },
                default: "roll",
                close: () => resolve(null)
            }).render(true);
        });
    }

    // note delegation
    async handleNoteOpen(event) {
        return this.noteHandler.openNote(event);
    }
    async handleNoteReveal(event) {
        return this.noteHandler.revealNote(event);
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

    /**
     * Spending dice is the commitment, so the dice buttons are the commitment:
     * they cast straight away rather than posting a card that then asks again.
     */
    async handleSpellCastDice(event) {
        event.preventDefault();
        event.stopPropagation();

        const spell = this.extractSpellFromEvent(event);
        const diceCount = Number(event.currentTarget.dataset.diceCount) || 0;
        if (!spell || diceCount < 1) return;

        await this.actor.castSpellWithDice(spell, diceCount);
        this.render(false);
    }

    /**
     * The spell's name describes it to the table and spends nothing.
     */
    async handleSpellDetails(event) {
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
