import { RuleEngine } from './rules-engine.mjs';
import { ActionValidation } from './action-validation.mjs';

/**
 * Base class for all game actions in GLOG 2d6
 *
 * This is the core of our display-first architecture. Every action creates
 * a comprehensive breakdown showing what happened and why.
 *
 * Flow:
 * 1. validate() - check preconditions, throw ValidationError for user issues
 * 2. gatherData() - collect actor stats, environment, etc.
 * 3. performCalculations() - do the math, roll dice
 * 4. applyRules() - run calculation rules for modifiers, display rules for UI
 * 5. sendChatMessage() - create comprehensive breakdown in chat
 * 6. applyStateChanges() - update actor HP, resources, etc.
 */
export class ActionDocument {
    constructor(actionType, actor, options = {}) {
        this.actionType = actionType;
        this.actor = actor;
        this.options = options;

        // Core tracking systems
        this.calculationTracker = new CalculationTracker();
        this.ruleEngine = new RuleEngine(options.context || {});

        // Result data - these get filled during execution
        this.rollResults = [];
        this.modifierBreakdowns = new Map();
        this.stateChanges = [];

        // Metadata for debugging and interaction
        this.metadata = {
            timestamp: Date.now(),
            actionId: foundry.utils.randomID(),
            userId: game.user.id,
            context: options.context || {},
            executionPhase: 'created'
        };

        // Execution state
        this.isExecuted = false;
        this.hasErrors = false;
        this.validationErrors = [];
    }

    /**
     * Main execution flow - template method pattern
     * Each phase can be overridden by subclasses for specific behavior
     */
    async execute() {
        if (this.isExecuted) {
            throw new Error("ActionDocument can only be executed once");
        }

        try {
            this.metadata.executionPhase = 'validating';
            await this.validate();

            this.metadata.executionPhase = 'gathering-data';
            await this.gatherData();

            this.metadata.executionPhase = 'calculating';
            await this.performCalculations();

            this.metadata.executionPhase = 'applying-rules';
            await this.applyRules();

            this.metadata.executionPhase = 'creating-chat';
            await this.sendChatMessage();

            this.metadata.executionPhase = 'applying-changes';
            await this.applyStateChanges();

            this.metadata.executionPhase = 'completed';
            this.isExecuted = true;
            return this.getExecutionSummary();

        } catch (error) {
            this.metadata.executionPhase = 'error';
            this.handleExecutionError(error);
            throw error;
        }
    }

    /**
     * Phase 1: Validation
     * Check preconditions, permissions, resource availability
     * Use ActionValidation helper functions for consistency
     */
    async validate() {
        // Always validate actor ownership
        ActionValidation.requireActor(this.actor);
        ActionValidation.requireOwnership(this.actor);

        // Record validation inputs for debugging
        this.calculationTracker.recordInput('actor.id', this.actor.id);
        this.calculationTracker.recordInput('actor.type', this.actor.type);
        this.calculationTracker.recordInput('user.id', game.user.id);
        this.calculationTracker.recordInput('user.isGM', game.user.isGM);

        // Subclasses override to add specific validation
        await this.performSpecificValidation();

        if (this.validationErrors.length > 0) {
            throw new ValidationError(this.validationErrors);
        }
    }

    /**
     * Phase 2: Data Gathering
     * Collect all information needed for calculations
     * Always gather actor fundamentals, subclasses add specifics
     */
    async gatherData() {
        // Base actor data that all actions need
        this.actorData = {
            name: this.actor.name,
            type: this.actor.type,
            attributes: this.actor.system.attributes,
            level: this.actor.system.details?.level || 1,
            hp: this.actor.system.hp,
            skills: this.actor.system.skills || {},
            features: this.getActiveFeatures()
        };

        // Environmental context from options
        this.environmentalData = this.options.context?.environmental || {};
        this.tacticalData = this.options.context?.tactical || {};

        // Record core inputs
        this.calculationTracker.recordInput('actor.name', this.actorData.name);
        this.calculationTracker.recordInput('actor.level', this.actorData.level);
        this.calculationTracker.recordInput('environmental', this.environmentalData);
        this.calculationTracker.recordInput('tactical', this.tacticalData);

        // Subclasses gather specific data (weapons, spells, etc.)
        await this.gatherSpecificData();
    }

    /**
     * Phase 3: Calculations
     * Perform dice rolls, apply base modifiers, determine outcomes
     * This is where the actual game mechanics happen
     */
    async performCalculations() {
        // Subclasses must implement this - each action type is different
        throw new Error(`performCalculations must be implemented by ${this.constructor.name}`);
    }

    /**
     * Phase 4: Rule Application
     * Apply configurable rules for modifiers and display decisions
     */
    async applyRules() {
        // Build context for rule engine
        const ruleContext = {
            actorData: this.actorData,
            weaponData: this.weaponData,
            targetData: this.targetData,
            environmental: this.environmentalData,
            tactical: this.tacticalData,
            actionData: {
                actionType: this.actionType,
                rollResults: this.rollResults
            }
        };

        // Apply calculation rules to get additional modifiers
        const ruleModifiers = this.ruleEngine.applyCalculationRules(this.actionType, ruleContext);

        // Add rule-based modifiers to our tracking
        ruleModifiers.forEach(modifier => {
            this.recordModifier(modifier.source, modifier.category, modifier.value, modifier.reason);
        });

        // Apply display rules to determine what to show
        const calculationResults = this.getResultSummary();
        this.displayRules = this.ruleEngine.applyDisplayRules(ruleContext, calculationResults);

        // Record rule decisions for debugging
        this.calculationTracker.recordDecision('rule_evaluation', {
            modifiersApplied: ruleModifiers.length,
            displayDecisions: this.displayRules,
            ruleContext: ruleContext
        });
    }

    /**
     * Phase 5: Chat Message Creation
     * Create comprehensive, interactive chat message showing full breakdown
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
                        // Store calculation data for button interactions
                        calculationBreakdown: this.calculationTracker.getBreakdownSummary(),
                        interactionHandlers: this.getInteractionHandlers()
                    }
                }
            }
        });

        this.calculationTracker.recordDecision('chat_message_created', {
            messageId: this.chatMessage.id,
            sectionsIncluded: Object.keys(this.displayRules).filter(k => this.displayRules[k])
        });

        return this.chatMessage;
    }

    /**
     * Phase 6: State Changes
     * Apply HP changes, resource consumption, status effects, etc.
     * This is where the actor document gets updated
     */
    async applyStateChanges() {
        if (this.stateChanges.length === 0) {
            return; // No changes to apply
        }

        const updates = {};
        for (const change of this.stateChanges) {
            this.applyStateChange(updates, change);
        }

        if (Object.keys(updates).length > 0) {
            await this.actor.update(updates);
            this.calculationTracker.recordDecision('state_changes_applied', {
                changesCount: this.stateChanges.length,
                updates: updates
            });
        }
    }

    // === Helper Methods ===

    addValidationError(message) {
        this.validationErrors.push(message);
        this.hasErrors = true;
    }

    /**
     * Record a modifier for display and calculation tracking
     */
    recordModifier(source, type, value, reason) {
        if (value === 0) return; // Don't record zero modifiers

        if (!this.modifierBreakdowns.has(type)) {
            this.modifierBreakdowns.set(type, []);
        }

        const modifier = { source, value, reason, applied: true };
        this.modifierBreakdowns.get(type).push(modifier);
        this.calculationTracker.recordModifier(source, type, value, reason);

        return modifier;
    }

    /**
     * Record a dice roll with full context
     */
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

    /**
     * Queue a state change to be applied after calculations
     */
    queueStateChange(path, newValue, reason) {
        this.stateChanges.push({ path, newValue, reason });
    }

    /**
     * Get active features from actor for rule evaluation
     */
    getActiveFeatures() {
        return this.actor.items.filter(i =>
            i.type === "feature" &&
            i.system.active
        ).map(f => f.name);
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

    applyStateChange(updates, change) {
        updates[change.path] = change.newValue;
        this.calculationTracker.recordDecision('state_change_queued', change);
    }

    getResultSummary() {
        return {
            success: this.determineSuccess(),
            primaryOutcome: this.getPrimaryOutcome(),
            secondaryEffects: this.getSecondaryEffects(),
            totalModifiers: this.getTotalModifierMagnitude(),
            rollSummary: this.rollResults.map(r => ({
                type: r.rollType,
                total: r.total,
                dice: r.dice
            }))
        };
    }

    getTotalModifierMagnitude() {
        let total = 0;
        for (const modifiers of this.modifierBreakdowns.values()) {
            total += modifiers.reduce((sum, mod) => sum + Math.abs(mod.value), 0);
        }
        return total;
    }

    getExecutionSummary() {
        return {
            actionId: this.metadata.actionId,
            actionType: this.actionType,
            success: this.isExecuted && !this.hasErrors,
            chatMessageId: this.chatMessage?.id,
            resultSummary: this.getResultSummary(),
            calculationBreakdown: this.calculationTracker.getBreakdownSummary(),
            metadata: this.metadata
        };
    }

    handleExecutionError(error) {
        this.hasErrors = true;

        if (error instanceof ValidationError) {
            // User-facing errors go to notifications
            error.messages.forEach(msg => ui.notifications.error(msg));
        } else {
            // System errors go to console with context
            console.error(`ActionDocument execution failed in phase ${this.metadata.executionPhase}:`, {
                actionType: this.actionType,
                actorId: this.actor?.id,
                phase: this.metadata.executionPhase,
                error: error
            });
            ui.notifications.error("Action failed due to system error");
        }

        // Always record error for debugging
        this.calculationTracker.recordError(error, this.metadata.executionPhase);
    }

    // === Methods for Subclasses to Override ===

    async performSpecificValidation() {
        // Override in subclasses for action-specific validation
    }

    async gatherSpecificData() {
        // Override in subclasses to gather weapon, spell, target data, etc.
    }

    determineSuccess() {
        // Override in subclasses to define what success means
        return null;
    }

    getPrimaryOutcome() {
        // Override in subclasses
        return "Action completed";
    }

    getSecondaryEffects() {
        // Override in subclasses to return array of effect descriptions
        return [];
    }

    getInteractionHandlers() {
        // Override in subclasses to return Map of buttonId -> handlerName
        // These become buttons in the chat message
        return new Map();
    }
}

/**
 * Tracks all calculations, decisions, and data flow during action execution
 * Provides complete audit trail for debugging and transparency
 */
class CalculationTracker {
    constructor() {
        this.inputs = new Map();
        this.calculations = [];
        this.modifiers = [];
        this.rolls = [];
        this.decisions = [];
        this.errors = [];
        this.startTime = Date.now();
    }

    recordInput(key, value, source = 'system') {
        this.inputs.set(key, {
            value,
            source,
            timestamp: Date.now() - this.startTime
        });
    }

    recordCalculation(operation, inputs, result, explanation) {
        this.calculations.push({
            operation,
            inputs: { ...inputs },
            result,
            explanation,
            timestamp: Date.now() - this.startTime
        });
    }

    recordModifier(source, type, value, reason) {
        this.modifiers.push({
            source,
            type,
            value,
            reason,
            timestamp: Date.now() - this.startTime
        });
    }

    recordRoll(rollType, rollData) {
        this.rolls.push({
            rollType,
            ...rollData,
            timestamp: Date.now() - this.startTime
        });
    }

    recordDecision(decisionType, decision, reasoning = '') {
        this.decisions.push({
            decisionType,
            decision,
            reasoning,
            timestamp: Date.now() - this.startTime
        });
    }

    recordError(error, phase = 'unknown') {
        this.errors.push({
            error: error.message,
            stack: error.stack,
            phase,
            timestamp: Date.now() - this.startTime
        });
    }

    getBreakdownSummary() {
        // Return condensed version for chat message flags
        return {
            totalInputs: this.inputs.size,
            totalCalculations: this.calculations.length,
            totalModifiers: this.modifiers.length,
            totalRolls: this.rolls.length,
            totalDecisions: this.decisions.length,
            errors: this.errors.length,
            executionTimeMs: Date.now() - this.startTime
        };
    }

    getFullBreakdown() {
        // Return complete version for debugging
        return {
            inputs: Object.fromEntries(this.inputs),
            calculations: [...this.calculations],
            modifiers: [...this.modifiers],
            rolls: [...this.rolls],
            decisions: [...this.decisions],
            errors: [...this.errors],
            executionTimeMs: Date.now() - this.startTime
        };
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

/**
 * Builds comprehensive chat messages for actions
 * Uses display rules to determine what information to include
 */
class ActionChatMessageBuilder {
    constructor(actionDocument) {
        this.action = actionDocument;
        this.displayRules = actionDocument.displayRules || {};
    }

    build() {
        const sections = [];

        // Always include header with primary outcome
        sections.push(this.buildHeader());

        // Conditionally include sections based on display rules
        if (this.shouldShowRollResults()) {
            sections.push(this.buildRollResultsSection());
        }

        if (this.shouldShowModifierBreakdown()) {
            sections.push(this.buildModifierBreakdownSection());
        }

        if (this.shouldShowEnvironmentalFactors()) {
            sections.push(this.buildEnvironmentalSection());
        }

        if (this.shouldShowSecondaryEffects()) {
            sections.push(this.buildSecondaryEffectsSection());
        }

        // Always include interaction buttons if any exist
        const buttons = this.buildInteractionButtons();
        if (buttons) {
            sections.push(buttons);
        }

        // Debug section for GMs if enabled
        if (this.shouldShowCalculationBreakdown()) {
            sections.push(this.buildDebugSection());
        }

        return {
            speaker: ChatMessage.getSpeaker({ actor: this.action.actor }),
            content: this.wrapSections(sections),
            type: CONST.CHAT_MESSAGE_TYPES.ROLL,
            roll: this.action.rollResults[0]?.result // Primary roll for Foundry integration
        };
    }

    // === Section Builders ===

    buildHeader() {
        const result = this.action.getResultSummary();
        const outcomeClass = result.success === true ? 'success' :
                            result.success === false ? 'failure' : 'neutral';

        return `
            <div class="glog2d6-action-header ${outcomeClass}">
                <h3>${this.action.actor.name} - ${this.action.actionType}</h3>
                <div class="primary-outcome">${result.primaryOutcome}</div>
            </div>
        `;
    }

    buildRollResultsSection() {
        if (this.action.rollResults.length === 0) return '';

        const rollsHtml = this.action.rollResults.map(roll => {
            const diceDisplay = roll.dice.length > 0 ? `[${roll.dice.join(', ')}]` : '';
            return `
                <div class="roll-result">
                    <strong>${this.formatRollType(roll.rollType)}:</strong>
                    ${diceDisplay} = ${roll.total}
                </div>
            `;
        }).join('');

        return `
            <div class="roll-results-section">
                ${rollsHtml}
            </div>
        `;
    }

    buildModifierBreakdownSection() {
        if (this.action.modifierBreakdowns.size === 0) return '';

        let modifiersHtml = '';
        for (const [type, modifiers] of this.action.modifierBreakdowns) {
            const total = modifiers.reduce((sum, mod) => sum + mod.value, 0);
            const modList = modifiers.map(mod => `
                <div class="modifier-item">
                    ${mod.source}: ${mod.value >= 0 ? '+' : ''}${mod.value}
                    <span class="modifier-reason">(${mod.reason})</span>
                </div>
            `).join('');

            modifiersHtml += `
                <div class="modifier-group">
                    <strong>${this.formatModifierType(type)} Total: ${total >= 0 ? '+' : ''}${total}</strong>
                    <div class="modifier-details">${modList}</div>
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
        const env = this.action.environmentalData;
        if (!env || Object.keys(env).length === 0) return '';

        const factorsHtml = Object.entries(env).map(([key, value]) => `
            <span class="environmental-factor">
                <strong>${this.formatEnvironmentalKey(key)}:</strong> ${value}
            </span>
        `).join('');

        return `
            <div class="environmental-section">
                <h4>Environmental Factors</h4>
                <div class="environmental-factors">${factorsHtml}</div>
            </div>
        `;
    }

    buildSecondaryEffectsSection() {
        const effects = this.action.getSecondaryEffects();
        if (effects.length === 0) return '';

        const effectsHtml = effects.map(effect => `
            <div class="secondary-effect">${effect}</div>
        `).join('');

        return `
            <div class="secondary-effects-section">
                <h4>Additional Effects</h4>
                ${effectsHtml}
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
                        class="glog2d6-action-btn"
                        data-action-id="${this.action.metadata.actionId}"
                        data-handler="${handlerName}"
                        data-button-id="${buttonId}">
                    ${this.getButtonLabel(buttonId)}
                </button>
            `;
        }

        return `
            <div class="action-interaction-buttons">
                ${buttonsHtml}
            </div>
        `;
    }

    buildDebugSection() {
        const breakdown = this.action.calculationTracker.getFullBreakdown();

        return `
            <details class="debug-section">
                <summary>Calculation Debug (GM)</summary>
                <div class="debug-content">
                    <div><strong>Execution Time:</strong> ${breakdown.executionTimeMs}ms</div>
                    <div><strong>Inputs:</strong> ${Object.keys(breakdown.inputs).length}</div>
                    <div><strong>Calculations:</strong> ${breakdown.calculations.length}</div>
                    <div><strong>Modifiers:</strong> ${breakdown.modifiers.length}</div>
                    <div><strong>Rolls:</strong> ${breakdown.rolls.length}</div>
                    <pre class="debug-data">${JSON.stringify(breakdown, null, 2)}</pre>
                </div>
            </details>
        `;
    }

    // === Display Rules ===

    shouldShowRollResults() {
        return this.displayRules.showRollResults !== false; // Default to true
    }

    shouldShowModifierBreakdown() {
        return this.displayRules.showDetailedModifiers === true ||
               this.action.getTotalModifierMagnitude() > 2;
    }

    shouldShowEnvironmentalFactors() {
        return this.displayRules.showEnvironmentalFactors === true ||
               Object.keys(this.action.environmentalData).length > 0;
    }

    shouldShowSecondaryEffects() {
        return this.action.getSecondaryEffects().length > 0;
    }

    shouldShowCalculationBreakdown() {
        return (game.user.isGM && this.displayRules.showCalculationBreakdown === true) ||
               game.settings.get('glog2d6', 'showCalculationSteps');
    }

    // === Formatting Helpers ===

    formatRollType(rollType) {
        const labels = {
            'attack': 'Attack',
            'damage': 'Damage',
            'save': 'Save',
            'skill': 'Skill Check',
            'attribute': 'Attribute Check'
        };
        return labels[rollType] || rollType.replace(/([A-Z])/g, ' $1').trim();
    }

    formatModifierType(type) {
        return type.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
    }

    formatEnvironmentalKey(key) {
        return key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
    }

    getButtonLabel(buttonId) {
        const labels = {
            'damage': 'Roll Damage',
            'save': 'Make Save',
            'reroll': 'Reroll',
            'apply': 'Apply Effect',
            'details': 'Show Details'
        };
        return labels[buttonId] || buttonId.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
    }

    wrapSections(sections) {
        return `
            <div class="glog2d6-action-result" data-action-id="${this.action.metadata.actionId}">
                ${sections.join('')}
            </div>
        `;
    }
}
