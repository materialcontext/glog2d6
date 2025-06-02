// module/actions/core/action-document.mjs

/**
 * Base class for all game actions in GLOG 2d6
 *
 * This is the core of our display-first architecture. Every action creates
 * a comprehensive breakdown showing what happened and why.
 */
export class ActionDocument {
    constructor(actionType, actor, options = {}) {
        this.actionType = actionType;
        this.actor = actor;
        this.options = options;

        // Core tracking systems
        this.calculationTracker = new CalculationTracker();
        this.ruleEngine = new RuleEngine(options.context || {});

        // Result data
        this.rollResults = [];
        this.modifierBreakdowns = new Map();
        this.metadata = {
            timestamp: Date.now(),
            actionId: foundry.utils.randomID(),
            userId: game.user.id,
            context: options.context || {}
        };

        // State tracking
        this.isExecuted = false;
        this.hasErrors = false;
        this.validationErrors = [];
    }

    /**
     * Main execution flow - template method pattern
     * Subclasses implement the specific steps
     */
    async execute() {
        if (this.isExecuted) {
            throw new Error("ActionDocument can only be executed once");
        }

        try {
            await this.validate();
            await this.gatherData();
            await this.performCalculations();
            await this.applyRules();
            await this.sendChatMessage();
            await this.applyStateChanges();

            this.isExecuted = true;
            return this.getExecutionSummary();

        } catch (error) {
            this.handleExecutionError(error);
            throw error;
        }
    }

    /**
     * Validation phase - override in subclasses
     * Should use ActionValidation helper functions
     */
    async validate() {
        // Base validation - actor exists and is owned
        if (!this.actor) {
            this.addValidationError("No actor provided for action");
        }

        if (!this.actor.isOwner && !game.user.isGM) {
            this.addValidationError("You don't have permission to control this actor");
        }

        if (this.validationErrors.length > 0) {
            throw new ValidationError(this.validationErrors);
        }
    }

    /**
     * Data gathering phase - override in subclasses
     * Collect all actor stats, modifiers, environmental factors, etc.
     */
    async gatherData() {
        // Base implementation gathers actor fundamentals
        this.actorData = {
            name: this.actor.name,
            type: this.actor.type,
            attributes: this.actor.system.attributes,
            level: this.actor.system.details?.level || 1
        };

        this.calculationTracker.recordInput('actor.name', this.actorData.name);
        this.calculationTracker.recordInput('actor.level', this.actorData.level);
    }

    /**
     * Calculation phase - override in subclasses
     * Perform dice rolls, apply modifiers, determine outcomes
     */
    async performCalculations() {
        // Base implementation - subclasses will override
        throw new Error("performCalculations must be implemented by subclasses");
    }

    /**
     * Rule application phase
     * Apply calculation rules to determine modifiers, then display rules for presentation
     */
    async applyRules() {
        // Apply calculation rules to get modifiers
        const ruleModifiers = this.ruleEngine.applyCalculationRules(this.actionType, {
            actorData: this.actorData,
            weaponData: this.weaponData,
            targetData: this.targetData,
            environmental: this.metadata.context.environmental,
            tactical: this.metadata.context.tactical,
            actionData: { actionType: this.actionType }
        });

        // Add rule-based modifiers to our tracking
        ruleModifiers.forEach(modifier => {
            this.recordModifier(modifier.source, modifier.category, modifier.value, modifier.reason);
        });

        // Apply display rules
        this.displayRules = this.ruleEngine.applyDisplayRules(
            this.metadata.context,
            this.getResultSummary()
        );

        // Record rule decisions for debugging
        this.calculationTracker.recordDecision('rule_evaluation', this.ruleEngine.getEvaluationDebug());
    }

    /**
     * Chat message creation
     * Creates comprehensive, interactive chat message with full breakdown
     */
    async sendChatMessage() {
        const messageBuilder = new ActionChatMessageBuilder(this);
        const messageData = messageBuilder.build();

        this.chatMessage = await ChatMessage.create({
            ...messageData,
            flags: {
                glog2d6: {
                    actionDocument: {
                        actionId: this.metadata.actionId,
                        actionType: this.actionType,
                        actorId: this.actor.id,
                        timestamp: this.metadata.timestamp,
                        calculationBreakdown: this.calculationTracker.getFullBreakdown(),
                        interactionHandlers: this.getInteractionHandlers()
                    }
                }
            }
        });

        return this.chatMessage;
    }

    /**
     * State changes phase - override in subclasses
     * Apply HP changes, resource consumption, etc.
     */
    async applyStateChanges() {
        // Base implementation does nothing
        // Subclasses implement specific state changes
    }

    // === Helper Methods ===

    addValidationError(message) {
        this.validationErrors.push(message);
        this.hasErrors = true;
    }

    recordModifier(source, type, value, reason) {
        if (!this.modifierBreakdowns.has(type)) {
            this.modifierBreakdowns.set(type, []);
        }

        const modifier = { source, value, reason, applied: true };
        this.modifierBreakdowns.get(type).push(modifier);
        this.calculationTracker.recordModifier(source, type, value, reason);

        return modifier;
    }

    recordRoll(rollType, formula, result, context = {}) {
        const rollData = {
            rollType,
            formula,
            result,
            total: result.total,
            dice: this.extractDiceResults(result),
            context,
            timestamp: Date.now()
        };

        this.rollResults.push(rollData);
        this.calculationTracker.recordRoll(rollType, rollData);

        return rollData;
    }

    extractDiceResults(roll) {
        const results = [];
        for (const term of roll.terms) {
            if (term.results && Array.isArray(term.results)) {
                results.push(...term.results.map(r => r.result));
            }
        }
        return results;
    }

    getResultSummary() {
        return {
            success: this.determineSuccess(),
            primaryOutcome: this.getPrimaryOutcome(),
            secondaryEffects: this.getSecondaryEffects(),
            rollSummary: this.rollResults.map(r => ({
                type: r.rollType,
                total: r.total,
                dice: r.dice
            }))
        };
    }

    // Override in subclasses to define success conditions
    determineSuccess() {
        return null; // Base implementation doesn't know what success means
    }

    getPrimaryOutcome() {
        return "Action completed"; // Override in subclasses
    }

    getSecondaryEffects() {
        return []; // Override in subclasses
    }

    getInteractionHandlers() {
        // Return map of button IDs to handler function names
        // Subclasses can override to add action-specific buttons
        return new Map();
    }

    getExecutionSummary() {
        return {
            actionId: this.metadata.actionId,
            actionType: this.actionType,
            success: this.isExecuted && !this.hasErrors,
            chatMessageId: this.chatMessage?.id,
            resultSummary: this.getResultSummary(),
            calculationBreakdown: this.calculationTracker.getFullBreakdown()
        };
    }

    handleExecutionError(error) {
        this.hasErrors = true;

        if (error instanceof ValidationError) {
            // User-facing validation errors go to notifications
            error.messages.forEach(msg => ui.notifications.error(msg));
        } else {
            // System errors go to console and generic notification
            console.error(`ActionDocument execution failed:`, error);
            ui.notifications.error("Action failed due to system error");
        }

        // Record error in calculation tracker for debugging
        this.calculationTracker.recordError(error);
    }
}

/**
 * Tracks all calculations performed during an action
 * Provides complete audit trail for debugging and player transparency
 */
class CalculationTracker {
    constructor() {
        this.inputs = new Map();
        this.calculations = [];
        this.modifiers = [];
        this.rolls = [];
        this.decisions = [];
        this.errors = [];
    }

    recordInput(key, value, source = 'system') {
        this.inputs.set(key, { value, source, timestamp: Date.now() });
    }

    recordCalculation(operation, inputs, result, explanation) {
        this.calculations.push({
            operation,
            inputs: { ...inputs },
            result,
            explanation,
            timestamp: Date.now()
        });
    }

    recordModifier(source, type, value, reason) {
        this.modifiers.push({
            source,
            type,
            value,
            reason,
            timestamp: Date.now()
        });
    }

    recordRoll(rollType, rollData) {
        this.rolls.push({
            rollType,
            ...rollData,
            timestamp: Date.now()
        });
    }

    recordDecision(decisionType, decision, reasoning = '') {
        this.decisions.push({
            decisionType,
            decision,
            reasoning,
            timestamp: Date.now()
        });
    }

    recordError(error) {
        this.errors.push({
            error: error.message,
            stack: error.stack,
            timestamp: Date.now()
        });
    }

    getFullBreakdown() {
        return {
            inputs: Object.fromEntries(this.inputs),
            calculations: [...this.calculations],
            modifiers: [...this.modifiers],
            rolls: [...this.rolls],
            decisions: [...this.decisions],
            errors: [...this.errors]
        };
    }
}

/**
 * Determines what information should be displayed based on context
 * Uses configurable JS expression rules
 */
class ExpectationEngine {
    constructor(context = {}) {
        this.context = context;
        this.rules = this.loadDisplayRules();
    }

    loadDisplayRules() {
        // In a real implementation, these would come from configuration
        // For now, hardcode some basic rules
        return {
            showRollResults: () => true,
            showDetailedModifiers: (ctx) =>
                ctx.tactical?.inCombat || ctx.ui?.showDetails || false,
            showEnvironmentalFactors: (ctx) =>
                ctx.environmental && Object.keys(ctx.environmental).length > 0,
            showSecondaryEffects: (ctx, results) =>
                results.secondaryEffects && results.secondaryEffects.length > 0,
            showCalculationBreakdown: (ctx) =>
                game.user.isGM || ctx.ui?.showCalculations || false
        };
    }

    determineDisplayRules(params) {
        const rules = {};

        for (const [ruleName, ruleFunction] of Object.entries(this.rules)) {
            try {
                rules[ruleName] = ruleFunction(params.context, params.results, params);
            } catch (error) {
                console.warn(`Display rule ${ruleName} failed:`, error);
                rules[ruleName] = false; // Fail safe
            }
        }

        return rules;
    }
}

/**
 * Builds comprehensive chat messages for actions
 * Uses display rules to determine what information to include
 */
class ActionChatMessageBuilder {
    constructor(actionDocument) {
        this.action = actionDocument;
        this.displayRules = actionDocument.displayRules;
    }

    build() {
        const sections = [];

        // Always include header
        sections.push(this.buildHeader());

        // Conditionally include other sections based on display rules
        if (this.displayRules.showRollResults) {
            sections.push(this.buildRollResultsSection());
        }

        if (this.displayRules.showDetailedModifiers) {
            sections.push(this.buildModifierBreakdownSection());
        }

        if (this.displayRules.showEnvironmentalFactors) {
            sections.push(this.buildEnvironmentalSection());
        }

        if (this.displayRules.showSecondaryEffects) {
            sections.push(this.buildSecondaryEffectsSection());
        }

        // Always include interaction buttons if any exist
        const buttons = this.buildInteractionButtons();
        if (buttons) {
            sections.push(buttons);
        }

        // Debug section for GMs
        if (this.displayRules.showCalculationBreakdown) {
            sections.push(this.buildDebugSection());
        }

        return {
            speaker: ChatMessage.getSpeaker({ actor: this.action.actor }),
            content: this.wrapSections(sections),
            type: CONST.CHAT_MESSAGE_TYPES.ROLL,
            roll: this.action.rollResults[0]?.result // Primary roll for Foundry's roll handling
        };
    }

    buildHeader() {
        const result = this.action.getResultSummary();
        const outcomeClass = result.success === true ? 'success' :
                            result.success === false ? 'failure' : 'neutral';

        return `
            <div class="action-header ${outcomeClass}">
                <h3>${this.action.actor.name} - ${this.action.actionType}</h3>
                <div class="primary-outcome">${result.primaryOutcome}</div>
            </div>
        `;
    }

    buildRollResultsSection() {
        if (this.action.rollResults.length === 0) return '';

        const rollsHtml = this.action.rollResults.map(roll => `
            <div class="roll-result">
                <strong>${roll.rollType}:</strong>
                [${roll.dice.join(', ')}] = ${roll.total}
            </div>
        `).join('');

        return `
            <div class="roll-results-section">
                <h4>Roll Results</h4>
                ${rollsHtml}
            </div>
        `;
    }

    buildModifierBreakdownSection() {
        if (this.action.modifierBreakdowns.size === 0) return '';

        let modifiersHtml = '';
        for (const [type, modifiers] of this.action.modifierBreakdowns) {
            const modList = modifiers.map(mod => `
                <li>${mod.source}: ${mod.value >= 0 ? '+' : ''}${mod.value} (${mod.reason})</li>
            `).join('');

            modifiersHtml += `
                <div class="modifier-group">
                    <strong>${type}:</strong>
                    <ul>${modList}</ul>
                </div>
            `;
        }

        return `
            <div class="modifier-breakdown-section">
                <h4>Modifier Breakdown</h4>
                ${modifiersHtml}
            </div>
        `;
    }

    buildEnvironmentalSection() {
        const env = this.action.metadata.context.environmental;
        if (!env || Object.keys(env).length === 0) return '';

        const factorsHtml = Object.entries(env).map(([key, value]) => `
            <li><strong>${key}:</strong> ${value}</li>
        `).join('');

        return `
            <div class="environmental-section">
                <h4>Environmental Factors</h4>
                <ul>${factorsHtml}</ul>
            </div>
        `;
    }

    buildSecondaryEffectsSection() {
        const effects = this.action.getSecondaryEffects();
        if (effects.length === 0) return '';

        const effectsHtml = effects.map(effect => `
            <li>${effect}</li>
        `).join('');

        return `
            <div class="secondary-effects-section">
                <h4>Secondary Effects</h4>
                <ul>${effectsHtml}</ul>
            </div>
        `;
    }

    buildInteractionButtons() {
        const handlers = this.action.getInteractionHandlers();
        if (handlers.size === 0) return '';

        let buttonsHtml = '';
        for (const [buttonId, handlerName] of handlers) {
            buttonsHtml += `
                <button type="button"
                        class="action-interaction-btn"
                        data-action-id="${this.action.metadata.actionId}"
                        data-handler="${handlerName}">
                    ${this.getButtonLabel(buttonId)}
                </button>
            `;
        }

        return `
            <div class="interaction-buttons">
                ${buttonsHtml}
            </div>
        `;
    }

    buildDebugSection() {
        const breakdown = this.action.calculationTracker.getFullBreakdown();

        return `
            <details class="debug-section">
                <summary>Calculation Breakdown (Debug)</summary>
                <pre>${JSON.stringify(breakdown, null, 2)}</pre>
            </details>
        `;
    }

    getButtonLabel(buttonId) {
        const labels = {
            'damage': 'Roll Damage',
            'save': 'Make Save',
            'reroll': 'Reroll',
            'apply': 'Apply Effect'
        };
        return labels[buttonId] || buttonId;
    }

    wrapSections(sections) {
        return `
            <div class="glog2d6-action-result">
                ${sections.join('')}
            </div>
        `;
    }
}

/**
 * Custom error class for user-facing validation errors
 */
export class ValidationError extends Error {
    constructor(messages) {
        const messageList = Array.isArray(messages) ? messages : [messages];
        super(messageList.join('; '));
        this.name = 'ValidationError';
        this.messages = messageList;
    }
}
