// module/actor/event-registry.mjs
export class EventHandlerRegistry {
    constructor(sheet) {
        this.sheet = sheet;
        this.eventMappings = this.defineEventMappings();
    }

    defineEventMappings() {
        return [
            // Clickable elements - delegate to roll handler
            { selector: '.attribute-card.clickable', event: 'click', handler: '_onAttributeRoll' },
            { selector: '.attribute-save', event: 'click', handler: '_onSaveRoll' },
            { selector: '.combat-card.clickable', event: 'click', handler: 'handleCombatAction' },
            { selector: '.action-card.clickable', event: 'click', handler: 'handleGenericAction' },
            { selector: '.movement-display.clickable', event: 'click', handler: '_onMovementRoll' },

            // Item interactions
            { selector: '.weapon-attack-btn', event: 'click', handler: '_onWeaponAttack' },
            { selector: '.spell-cast-btn', event: 'click', handler: 'handleSpellCast' },
            { selector: '.equipped-toggle', event: 'change', handler: 'handleEquipmentToggle' },

            // UI controls
            { selector: '.edit-toggle', event: 'click', handler: 'handleEditModeToggle' },
            { selector: '.rest-btn', event: 'click', handler: 'handleRest' },

            // Item management
            { selector: '.item-create', event: 'click', handler: 'handleItemCreate' },
            { selector: '.item-edit', event: 'click', handler: 'handleItemEdit' },
            { selector: '.item-delete', event: 'click', handler: 'handleItemDelete' },

            // Feature and torch controls
            { selector: '.torch-btn', event: 'click', handler: 'handleTorchToggle' },
            { selector: '.torch-icon[data-action="toggle-torch"]', event: 'click', handler: 'handleTorchItemToggle' },
            { selector: '.add-class-features', event: 'click', handler: 'handleAddClassFeatures' },
            { selector: '.feature-item', event: 'click', handler: 'handleFeatureToggle' },

            // trauma and wounds
            { selector: '.trauma-save-btn', event: 'click', handler: 'handleTraumaSave' },
            { selector: '.remove-wound-btn', event: 'click', handler: 'handleRemoveWound' },
        ];
    }

    registerAllEventHandlers(html) {
        this.eventMappings.forEach(mapping => {
            this.registerEventHandler(html, mapping);
        });
    }

    registerEventHandler(html, { selector, event, handler }) {
        const handlerMethod = this.sheet[handler];

        if (!handlerMethod) {
            console.warn(`Handler method ${handler} not found on sheet`);
            return;
        }

        html.find(selector)[event](handlerMethod.bind(this.sheet));
    }
}

export class ActionHandlerMap {
    constructor(sheet) {
        this.sheet = sheet;
        this.actionHandlers = this.defineActionHandlers();
    }

    defineActionHandlers() {
        return {
            // Combat actions
            'attack': (event) => this.sheet.rollHandler.handleAttackRoll(event),
            'defend': (event) => this.sheet.rollHandler.handleDefenseRoll(event),
            'defend-melee': (event) => this.sheet.rollHandler.handleMeleeDefenseRoll(event),
            'defend-ranged': (event) => this.sheet.rollHandler.handleRangedDefenseRoll(event),

            // Skill actions
            'sneak': (event) => this.sheet.rollHandler.handleSneakRoll(event),
            'hide': (event) => this.sheet.rollHandler.handleHideRoll(event),
            'disguise': (event) => this.sheet.rollHandler.handleDisguiseRoll(event),
            'reaction': (event) => this.sheet.rollHandler.handleReactionRoll(event),
            'diplomacy': (event) => this.sheet.rollHandler.handleDiplomacyRoll(event),
            'intimidate': (event) => this.sheet.rollHandler.handleIntimidateRoll(event)
        };
    }

    executeAction(actionName, event) {
        const handler = this.actionHandlers[actionName];

        if (!handler) {
            console.warn(`No handler found for action: ${actionName}`);
            return;
        }

        return handler(event);
    }
}
