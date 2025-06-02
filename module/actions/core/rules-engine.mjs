// module/actions/core/rule-engine.mjs

/**
 * RuleEngine - Configurable system for both calculations and display
 *
 * This engine determines:
 * 1. WHAT calculations to perform (do we apply environmental penalties?)
 * 2. HOW to perform them (what's the formula for lighting penalties?)
 * 3. WHAT to display (should players see the breakdown?)
 * 4. HOW to display it (detailed vs summary format?)
 */
export class RuleEngine {
    constructor(context = {}) {
        this.context = context;
        this.rules = this.loadRules();
        this.calculationResults = new Map();
        this.displayDecisions = new Map();
    }

    loadRules() {
        // In production, these would come from game settings, modules, or config files
        // GMs can override any rule through the settings system
        return {
            // CALCULATION RULES - determine what math happens

            environmentalPenalties: {
                enabled: (ctx) => true, // Always consider environment

                lighting: {
                    enabled: (ctx) => ctx.environmental?.lighting !== 'bright',
                    calculate: (ctx) => {
                        const lighting = ctx.environmental?.lighting;
                        switch (lighting) {
                            case 'dim': return -1;
                            case 'dark': return -2;
                            case 'magical_darkness': return -4;
                            default: return 0;
                        }
                    },
                    appliesTo: ['attack', 'skill:sneak', 'skill:hide'],
                    reason: (penalty, lighting) => `${lighting} lighting impairs accuracy`
                },

                weather: {
                    enabled: (ctx) => ctx.environmental?.weather && ctx.environmental.weather !== 'clear',
                    calculate: (ctx) => {
                        const weather = ctx.environmental?.weather;
                        const isRanged = ctx.actionData?.attackType === 'ranged';

                        switch (weather) {
                            case 'light_rain': return isRanged ? -1 : 0;
                            case 'heavy_rain': return isRanged ? -2 : -1;
                            case 'storm': return -2;
                            case 'blizzard': return -3;
                            default: return 0;
                        }
                    },
                    appliesTo: ['attack', 'movement'],
                    reason: (penalty, weather) => `${weather} conditions reduce effectiveness`
                },

                terrain: {
                    enabled: (ctx) => ctx.environmental?.terrain && ctx.environmental.terrain !== 'normal',
                    calculate: (ctx) => {
                        const terrain = ctx.environmental?.terrain;
                        switch (terrain) {
                            case 'difficult': return -1;
                            case 'unstable': return -2;
                            case 'treacherous': return -3;
                            default: return 0;
                        }
                    },
                    appliesTo: ['attack', 'movement', 'skill:sneak'],
                    reason: (penalty, terrain) => `${terrain} terrain hampers movement and balance`
                }
            },

            attributeModifiers: {
                enabled: (ctx) => true,

                strengthToMelee: {
                    enabled: (ctx) => ctx.actionData?.attackType === 'melee' || ctx.actionData?.attackType === 'thrown',
                    calculate: (ctx) => ctx.actorData?.attributes?.str?.effectiveMod || 0,
                    appliesTo: ['attack', 'damage'],
                    reason: (bonus) => `Strength enhances melee combat effectiveness`
                },

                dexterityToRanged: {
                    enabled: (ctx) => ctx.actionData?.attackType === 'ranged',
                    calculate: (ctx) => {
                        const archeryBonus = ctx.actorData?.combat?.archery?.bonus || 0;
                        return archeryBonus; // Dex is already baked into archery training
                    },
                    appliesTo: ['attack'],
                    reason: (bonus) => `Archery training improves ranged accuracy`
                }
            },

            weaponModifiers: {
                enabled: (ctx) => ctx.weaponData !== null,

                attackPenalty: {
                    enabled: (ctx) => (ctx.weaponData?.attackPenalty || 0) > 0,
                    calculate: (ctx) => -(ctx.weaponData?.attackPenalty || 0),
                    appliesTo: ['attack'],
                    reason: (penalty, weaponName) => `${weaponName} is difficult to wield effectively`
                },

                breakagePenalty: {
                    enabled: (ctx) => (ctx.weaponData?.breakageLevel || 0) > 0,
                    calculate: (ctx) => -(ctx.weaponData?.breakageLevel || 0),
                    appliesTo: ['attack', 'damage'],
                    reason: (penalty, weaponName) => `${weaponName} is damaged and less effective`
                }
            },

            specialFeatures: {
                enabled: (ctx) => ctx.actorData?.features?.length > 0,

                // Feature-specific rules would be dynamically loaded
                // Example: Fighter's combat training
                combatTraining: {
                    enabled: (ctx) => ctx.actorData?.features?.includes('Combat Training'),
                    calculate: (ctx) => 2,
                    appliesTo: ['attack'],
                    reason: () => 'Fighter combat training provides attack bonus'
                }
            },

            // DISPLAY RULES - determine what players see

            displayRules: {
                showModifierBreakdown: {
                    enabled: (ctx, results) => {
                        // Show breakdown if:
                        // - In combat mode
                        // - Player requested details
                        // - There are significant modifiers (> 2 total)
                        // - GM setting is "always show"

                        if (ctx.ui?.showDetails) return true;
                        if (ctx.tactical?.inCombat) return true;

                        const totalModifiers = this.getTotalModifierMagnitude(results);
                        if (totalModifiers > 2) return true;

                        const gmSetting = game.settings.get('glog2d6', 'alwaysShowModifiers');
                        return gmSetting;
                    }
                },

                showEnvironmentalFactors: {
                    enabled: (ctx, results) => {
                        // Show if environment affected the roll
                        const envModifiers = results.modifiers?.filter(m =>
                            m.source.includes('lighting') ||
                            m.source.includes('weather') ||
                            m.source.includes('terrain')
                        );
                        return envModifiers && envModifiers.length > 0;
                    }
                },

                showCalculationSteps: {
                    enabled: (ctx, results) => {
                        // Debug mode for GMs or if specifically requested
                        return game.user.isGM && (ctx.ui?.showCalculations ||
                               game.settings.get('glog2d6', 'showCalculationSteps'));
                    }
                },

                useDetailedFormat: {
                    enabled: (ctx, results) => {
                        // Use detailed format for complex actions
                        const hasMultipleRolls = results.rolls?.length > 1;
                        const hasComplexModifiers = this.getTotalModifierMagnitude(results) > 3;
                        return hasMultipleRolls || hasComplexModifiers || ctx.ui?.useDetailedFormat;
                    }
                }
            }
        };
    }

    /**
     * Apply all calculation rules for a given action type
     */
    applyCalculationRules(actionType, context) {
        const modifiers = [];
        this.context = { ...this.context, ...context };

        // Apply each rule category
        for (const [categoryName, category] of Object.entries(this.rules)) {
            if (categoryName === 'displayRules') continue; // Skip display rules in calculation phase

            if (!this.evaluateCondition(category.enabled, this.context)) continue;

            // Apply each rule in the category
            for (const [ruleName, rule] of Object.entries(category)) {
                if (ruleName === 'enabled') continue;

                if (!this.evaluateCondition(rule.enabled, this.context)) continue;

                // Check if this rule applies to the current action type
                if (rule.appliesTo && !this.ruleAppliesToAction(rule.appliesTo, actionType)) continue;

                // Calculate the modifier
                const modifierValue = this.evaluateCalculation(rule.calculate, this.context);

                if (modifierValue !== 0) {
                    const modifier = {
                        source: `${categoryName}.${ruleName}`,
                        category: categoryName,
                        rule: ruleName,
                        value: modifierValue,
                        reason: this.evaluateReason(rule.reason, modifierValue, this.context),
                        appliesTo: rule.appliesTo
                    };

                    modifiers.push(modifier);
                    this.calculationResults.set(`${categoryName}.${ruleName}`, modifier);
                }
            }
        }

        return modifiers;
    }

    /**
     * Apply display rules to determine what to show
     */
    applyDisplayRules(context, calculationResults) {
        const displayDecisions = {};

        for (const [ruleName, rule] of Object.entries(this.rules.displayRules)) {
            try {
                displayDecisions[ruleName] = this.evaluateCondition(
                    rule.enabled,
                    context,
                    calculationResults
                );

                this.displayDecisions.set(ruleName, displayDecisions[ruleName]);
            } catch (error) {
                console.warn(`Display rule ${ruleName} failed:`, error);
                displayDecisions[ruleName] = false; // Fail safe
            }
        }

        return displayDecisions;
    }

    /**
     * Get rule modifications from game settings
     * GMs can override any rule through the settings system
     */
    applySettingsOverrides() {
        const overrides = game.settings.get('glog2d6', 'ruleOverrides') || {};

        for (const [rulePath, override] of Object.entries(overrides)) {
            this.setNestedRule(this.rules, rulePath, override);
        }
    }

    // === Helper Methods ===

    evaluateCondition(condition, context, results = null) {
        if (typeof condition === 'function') {
            return condition(context, results, this);
        }
        return Boolean(condition);
    }

    evaluateCalculation(calculation, context) {
        if (typeof calculation === 'function') {
            return calculation(context, this);
        }
        return Number(calculation) || 0;
    }

    evaluateReason(reasonFn, value, context) {
        if (typeof reasonFn === 'function') {
            return reasonFn(value, context.environmental?.lighting || context.environmental?.weather || context.environmental?.terrain, context);
        }
        return String(reasonFn) || 'Modifier applied';
    }

    ruleAppliesToAction(appliesTo, actionType) {
        if (!Array.isArray(appliesTo)) return true;

        return appliesTo.some(target => {
            if (target === actionType) return true;
            if (target.includes(':') && actionType.includes(target.split(':')[1])) return true;
            return false;
        });
    }

    getTotalModifierMagnitude(results) {
        if (!results || !results.modifiers) return 0;
        return results.modifiers.reduce((total, mod) => total + Math.abs(mod.value), 0);
    }

    setNestedRule(obj, path, value) {
        const keys = path.split('.');
        let current = obj;

        for (let i = 0; i < keys.length - 1; i++) {
            if (!current[keys[i]]) current[keys[i]] = {};
            current = current[keys[i]];
        }

        current[keys[keys.length - 1]] = value;
    }

    /**
     * Get debugging information about rule evaluation
     */
    getEvaluationDebug() {
        return {
            appliedCalculations: Object.fromEntries(this.calculationResults),
            displayDecisions: Object.fromEntries(this.displayDecisions),
            context: this.context,
            evaluationTimestamp: Date.now()
        };
    }
}

/**
 * Rule configuration system for GMs
 */
export class RuleConfiguration {
    /**
     * Register game settings for rule customization
     */
    static registerSettings() {
        game.settings.register('glog2d6', 'ruleOverrides', {
            name: 'Rule System Overrides',
            hint: 'JSON object with rule modifications',
            scope: 'world',
            config: false, // Hidden from basic settings, available through advanced config
            type: Object,
            default: {}
        });

        game.settings.register('glog2d6', 'alwaysShowModifiers', {
            name: 'Always Show Modifier Breakdown',
            hint: 'Show detailed modifier breakdown for all actions',
            scope: 'world',
            config: true,
            type: Boolean,
            default: false
        });

        game.settings.register('glog2d6', 'showCalculationSteps', {
            name: 'Show Calculation Steps (GM)',
            hint: 'Show detailed calculation steps in chat messages',
            scope: 'world',
            config: true,
            type: Boolean,
            default: false
        });

        game.settings.register('glog2d6', 'environmentalRulesEnabled', {
            name: 'Environmental Rules',
            hint: 'Apply penalties for lighting, weather, and terrain',
            scope: 'world',
            config: true,
            type: Boolean,
            default: true
        });

        game.settings.register('glog2d6', 'weaponBreakageRules', {
            name: 'Weapon Breakage Rules',
            hint: 'Apply penalties for damaged weapons',
            scope: 'world',
            config: true,
            type: Boolean,
            default: true
        });
    }

    /**
     * Create a rule override
     */
    static setRuleOverride(rulePath, newValue) {
        const overrides = game.settings.get('glog2d6', 'ruleOverrides');
        overrides[rulePath] = newValue;
        return game.settings.set('glog2d6', 'ruleOverrides', overrides);
    }

    /**
     * Remove a rule override
     */
    static removeRuleOverride(rulePath) {
        const overrides = game.settings.get('glog2d6', 'ruleOverrides');
        delete overrides[rulePath];
        return game.settings.set('glog2d6', 'ruleOverrides', overrides);
    }

    /**
     * GM interface for rule customization
     */
    static openRuleEditor() {
        new RuleEditorDialog().render(true);
    }
}

/**
 * Dialog for GMs to customize rules
 */
class RuleEditorDialog extends FormApplication {
    static get defaultOptions() {
        return foundry.utils.mergeObject(super.defaultOptions, {
            id: 'rule-editor',
            classes: ['glog2d6'],
            title: 'Rule System Configuration',
            template: 'systems/glog2d6/templates/dialogs/rule-editor.hbs',
            width: 800,
            height: 600,
            tabs: [
                { navSelector: '.tabs', contentSelector: '.content', initial: 'calculation' }
            ]
        });
    }

    getData() {
        const engine = new RuleEngine();
        return {
            rules: engine.rules,
            overrides: game.settings.get('glog2d6', 'ruleOverrides'),
            presets: this.getPresets()
        };
    }

    getPresets() {
        return {
            'gritty': {
                name: 'Gritty Realism',
                description: 'Harsh environmental penalties, weapon breakage common',
                overrides: {
                    'environmentalPenalties.lighting.calculate': (ctx) => {
                        const lighting = ctx.environmental?.lighting;
                        switch (lighting) {
                            case 'dim': return -2;
                            case 'dark': return -4;
                            case 'magical_darkness': return -6;
                            default: return 0;
                        }
                    }
                }
            },
            'heroic': {
                name: 'Heroic Fantasy',
                description: 'Reduced penalties, more forgiving conditions',
                overrides: {
                    'environmentalPenalties.weather.enabled': () => false,
                    'weaponModifiers.breakagePenalty.enabled': () => false
                }
            },
            'tactical': {
                name: 'Tactical Combat',
                description: 'Detailed modifiers always shown, complex calculations',
                overrides: {
                    'displayRules.showModifierBreakdown.enabled': () => true,
                    'displayRules.showCalculationSteps.enabled': () => true
                }
            }
        };
    }

    async _updateObject(event, formData) {
        // Process form data and update rule overrides
        const overrides = {};

        for (const [key, value] of Object.entries(formData)) {
            if (key.startsWith('rule.')) {
                const rulePath = key.substring(5);
                overrides[rulePath] = value;
            }
        }

        await game.settings.set('glog2d6', 'ruleOverrides', overrides);
        ui.notifications.info('Rule configuration updated');
    }
}
