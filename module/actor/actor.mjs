// module/actor/actor.mjs - Refactored
import { GLOG2D6Roll } from "../dice/glog-roll.mjs";
import { ActorRolls } from "../dice/actor-rolls.mjs";
import { safely } from "../systems/safely.mjs";

// Import our new systems
import { ActorAttributeSystem } from "./systems/actor-attribute-system.mjs";
import { ActorInventorySystem } from "./systems/actor-inventory-system.mjs";
import { ActorBonusSystem } from "./systems/actor-bonus-system.mjs";
import { ActorCombatSystem } from "./systems/actor-combat-system.mjs";
import { ActorMovementSystem } from "./systems/actor-movement-system.mjs";
import { ActorTorchSystem } from "./systems/actor-torch-system.mjs";
import { ActorRestSystem } from "./systems/actor-rest-system.mjs";
import { ActorSpellSystem } from "./systems/actor-spell-system.mjs";

export class GLOG2D6Actor extends Actor {
    constructor(data, context) {
        super(data, context);
    }

    /** @override */
    _initialize(options = {}) {
        this.initializeComponents();
        this.setupSafePublicMethods();

        // Then call Foundry's initialization
        super._initialize(options);
    }

    async _preCreate(data, options, user) {
        await super._preCreate(data, options, user);
        await this.updateSource({
            "flags.glog2d6.editMode": false
        });
    }

    initializeComponents() {
        // Roll system
        this.rolls = new ActorRolls(this);

        // Data calculation systems
        this.attributeSystem = new ActorAttributeSystem(this);
        this.inventorySystem = new ActorInventorySystem(this);
        this.bonusSystem = new ActorBonusSystem(this);
        this.combatSystem = new ActorCombatSystem(this);
        this.movementSystem = new ActorMovementSystem(this);

        // Action systems
        this.torchSystem = new ActorTorchSystem(this);
        this.restSystem = new ActorRestSystem(this);
        this.spellSystem = new ActorSpellSystem(this);
    }

    setupSafePublicMethods() {
        // Create safe public versions of risky methods
        this.analyzeEquippedWeapons = safely({
            fallback: { hasWeapons: false, attackButtonType: 'generic' },
            context: 'actor-weapon-analysis'
        })(this._analyzeEquippedWeapons.bind(this));

        this.hasFeature = safely.silent(false)(this._hasFeature.bind(this));
        this.getClassTemplateCount = safely.silent(0)(this._getClassTemplateCount.bind(this));
    }

    // Data preparation lifecycle
    prepareData() {
        super.prepareData();
    }

    prepareBaseData() {
        console.log("calculating base data");
        this.attributeSystem.calculateAttributeModifiers();
        this.inventorySystem.calculateInventoryData();
        this.combatSystem.calculateAttackValue();
    }

    prepareDerivedData() {
        try {
            console.log("calculating derived data");
            this.attributeSystem.initializeEffectiveModifiers();
            this.bonusSystem.calculateAndApplyAllBonuses();
            this.attributeSystem.applyEncumbranceToAttributes();
            this.movementSystem.calculateEffectiveMovement();
            this.combatSystem.calculateDefenseValues();
        } catch (error) {
            console.error("Error in prepareDerivedData for", this.name, ":", error);
        }
    }

    // Roll method delegations
    async rollAttribute(...args) { return this.rolls.rollAttribute(...args); }
    async rollSave(...args) { return this.rolls.rollSave(...args); }
    async rollAttack(...args) { return this.rolls.rollAttack(...args); }
    async rollWeaponAttack(...args) { return this.rolls.rollWeaponAttack(...args); }
    async rollDefense(...args) { return this.rolls.rollDefense(...args); }
    async rollMeleeDefense(...args) { return this.rolls.rollMeleeDefense(...args); }
    async rollRangedDefense(...args) { return this.rolls.rollRangedDefense(...args); }
    async rollMovement(...args) { return this.rolls.rollMovement(...args); }
    async rollWeaponDamage(...args) { return this.rolls.rollWeaponDamage(...args); }
    async rollSneak(...args) { return this.rolls.rollSneak(...args); }
    async rollHide(...args) { return this.rolls.rollHide(...args); }
    async rollDisguise(...args) { return this.rolls.rollDisguise(...args); }
    async rollReaction(...args) { return this.rolls.rollReaction(...args); }
    async rollDiplomacy(...args) { return this.rolls.rollDiplomacy(...args); }
    async rollIntimidate(...args) { return this.rolls.rollIntimidate(...args); }
    async rollTraumaSave(...args) { return this.rolls.rollTraumaSave(...args); }

    // Feature and class utilities
    _getClassTemplateCount(className) {
        const classFeatures = this.items.filter(i =>
            i.type === "feature" &&
            i.system.active &&
            i.system.classSource === className
        );

        const templates = new Set();
        for (const feature of classFeatures) {
            if (feature.system.template) {
                templates.add(feature.system.template);
            }
        }

        return templates.size;
    }

    _hasClass(className) {
        return this.items.some(i =>
            i.type === "feature" &&
            i.system.active &&
            i.system.classSource === className
        );
    }

    _hasFeature(...featureNames) {
        return featureNames.some(name =>
            this.items.some(i =>
                i.type === "feature" &&
                i.system.active &&
                i.name === name
            )
        );
    }

    // System delegations
    async toggleTorch() { return this.torchSystem.toggleTorch(); }
    getAvailableTorches() { return this.torchSystem.getAvailableTorches(); }
    getActiveTorch() { return this.torchSystem.getActiveTorch(); }
    async burnTorch(hours = 0.1) { return this.torchSystem.burnTorch(hours); }
    async rest() { return this.restSystem.performRest(); }
    async castSpellWithDice(spell, diceCount) { return this.spellSystem.castSpellWithDice(spell, diceCount); }

    // Weapon analysis
    _analyzeEquippedWeapons() {
        const weaponAnalyzer = new WeaponAnalyzer(this.items);
        return weaponAnalyzer.analyzeAll();
    }

    _getBestWeapon(weapons) {
        const weaponRanker = new WeaponRanker();
        return weaponRanker.findBest(weapons);
    }

    // Roll creation utilities
    createRoll(formula, data = {}, context = null) {
        const needsSpecialFeatures = this.hasSpecialDiceFeatures(context);

        if (needsSpecialFeatures) {
            return new GLOG2D6Roll(formula, data, {
                checkSpecialFeatures: true,
                context: context,
                actor: this
            });
        }

        return new Roll(formula, data);
    }

    hasSpecialDiceFeatures(context) {
        const specialFeatures = ['Tricky', 'Superior Combatant', 'Feats of Strength', 'Fast Talker'];
        return this.items.some(item =>
            item.type === "feature" &&
            item.system.active &&
            specialFeatures.includes(item.name)
        );
    }

    getSpecialEffectsForRoll(rollContext, roll) {
        const effectsAnalyzer = new RollSpecialEffectsAnalyzer(this, rollContext, roll);
        return effectsAnalyzer.getEffects();
    }

    // Chat message helper
    _createRollChatMessage(title, roll, extraContent = '') {
        const chatMessageBuilder = new RollChatMessageBuilder(this, title, roll, extraContent);
        return chatMessageBuilder.createAndSend();
    }

    // Dice result extraction helper
    _getDiceResults(roll) {
        const diceExtractor = new DiceResultExtractor(roll);
        return diceExtractor.extractResults();
    }
}

// Helper classes for the remaining complex methods
class WeaponAnalyzer {
    constructor(items) {
        this.items = items;
    }

    analyzeAll() {
        const equippedWeapons = this.getEquippedWeapons();
        const analysis = this.createBaseAnalysis(equippedWeapons);

        if (equippedWeapons.length === 0) {
            return analysis;
        }

        this.categorizeWeapons(equippedWeapons, analysis);
        this.determinePrimaryWeapon(equippedWeapons, analysis);
        this.determineAttackButtonType(analysis);

        return analysis;
    }

    getEquippedWeapons() {
        return this.items.filter(i => i.type === "weapon" && i.system.equipped);
    }

    createBaseAnalysis(equippedWeapons) {
        return {
            hasWeapons: equippedWeapons.length > 0,
            weaponCount: equippedWeapons.length,
            primaryWeapon: null,
            weaponTypes: new Set(),
            hasThrowable: false,
            attackButtonType: 'generic',
            throwableWeapon: null,
            meleeWeapons: [],
            rangedWeapons: []
        };
    }

    categorizeWeapons(equippedWeapons, analysis) {
        for (const weapon of equippedWeapons) {
            const type = weapon.system.weaponType || 'melee';
            analysis.weaponTypes.add(type);

            if (type === 'thrown') {
                analysis.hasThrowable = true;
                analysis.throwableWeapon = weapon;
                analysis.meleeWeapons.push(weapon);
            } else if (type === 'ranged') {
                analysis.rangedWeapons.push(weapon);
            } else {
                analysis.meleeWeapons.push(weapon);
            }
        }
    }

    determinePrimaryWeapon(equippedWeapons, analysis) {
        const weaponRanker = new WeaponRanker();
        analysis.primaryWeapon = weaponRanker.findBest(equippedWeapons);
    }

    determineAttackButtonType(analysis) {
        if (analysis.hasThrowable && analysis.meleeWeapons.length > 1) {
            analysis.attackButtonType = 'split';
        } else if (analysis.rangedWeapons.length > 0 && analysis.meleeWeapons.length === 0) {
            analysis.attackButtonType = 'ranged';
        } else if (analysis.meleeWeapons.length > 0 && analysis.rangedWeapons.length === 0) {
            analysis.attackButtonType = 'melee';
        } else if (analysis.weaponTypes.size > 1) {
            analysis.attackButtonType = 'split';
        } else {
            analysis.attackButtonType = 'generic';
        }
    }
}

class WeaponRanker {
    constructor() {
        this.sizePriority = { heavy: 3, medium: 2, light: 1 };
    }

    findBest(weapons) {
        if (weapons.length === 0) return null;
        if (weapons.length === 1) return weapons[0];

        return weapons.reduce((best, current) => {
            return this.isWeaponBetter(current, best) ? current : best;
        });
    }

    isWeaponBetter(weaponA, weaponB) {
        const priorityA = this.sizePriority[weaponA.system.size] || 1;
        const priorityB = this.sizePriority[weaponB.system.size] || 1;

        if (priorityA !== priorityB) {
            return priorityA > priorityB;
        }

        const damageA = this.calculateDamageScore(weaponA.system.damage);
        const damageB = this.calculateDamageScore(weaponB.system.damage);
        return damageA > damageB;
    }

    calculateDamageScore(damage) {
        if (!damage) return 0;
        const numbers = damage.match(/\d+/g) || [];
        return numbers.reduce((sum, n) => sum + parseInt(n), 0);
    }
}

class RollSpecialEffectsAnalyzer {
    constructor(actor, rollContext, roll) {
        this.actor = actor;
        this.rollContext = rollContext;
        this.roll = roll;
    }

    getEffects() {
        if (this.rollContext === 'attack' && this.roll.isCriticalHit) {
            return ["CRITICAL HIT! Target must make a Trauma Save!"];
        }

        if (this.rollContext === 'defense' && this.roll.isCriticalFailure) {
            return ["CRITICAL HIT! You must make a Trauma Save!"];
        }

        if (!this.roll.hasDoubles || this.roll.isSnakeEyes) {
            return [];
        }

        return this.analyzeFeatureEffects();
    }

    analyzeFeatureEffects() {
        const effects = [];
        const activeFeatures = this.getActiveFeatures();

        for (const feature of activeFeatures) {
            const featureEffects = this.getEffectsForFeature(feature);
            effects.push(...featureEffects);
        }

        return effects;
    }

    getActiveFeatures() {
        return this.actor.items.filter(i => i.type === "feature" && i.system.active);
    }

    getEffectsForFeature(feature) {
        const featureEffectMap = {
            "Tricky": () => this.rollContext === 'attack' ? ["You may attempt a free Combat Maneuver"] : [],
            "Superior Combatant": () => this.rollContext === 'attack' ? ["Critical Hit! (rolled doubles)"] : [],
            "Fast Talker": () => this.rollContext === 'social' ? ["You may re-roll this social check"] : [],
            "Feats of Strength": () => this.rollContext === 'strength' ? ["Double your Strength bonus for this roll"] : []
        };

        const effectFunction = featureEffectMap[feature.name];
        return effectFunction ? effectFunction() : [];
    }
}

class RollChatMessageBuilder {
    constructor(actor, title, roll, extraContent) {
        this.actor = actor;
        this.title = title;
        this.roll = roll;
        this.extraContent = extraContent;
    }

    createAndSend() {
        const content = this.buildContent();
        this.handleSpecialRollEffects();

        return ChatMessage.create({
            speaker: ChatMessage.getSpeaker({ actor: this.actor }),
            content: content,
            roll: this.roll
        });
    }

    buildContent() {
        const rollDisplay = this.parseRollDisplay();
        const specialEffectsHtml = this.buildSpecialEffectsHtml();

        return `
            <div class="glog2d6-roll">
                <h3>${this.title}</h3>
                <div class="roll-result">
                    <strong>Roll:</strong> ${rollDisplay}<br>
                    <strong>Total:</strong> ${this.roll.total}
                    ${this.extraContent}
                    ${specialEffectsHtml}
                </div>
            </div>
        `;
    }

    parseRollDisplay() {
        const parts = [];
        for (const term of this.roll.terms || []) {
            if (Array.isArray(term.results)) {
                parts.push(`[${term.results.map(r => r.result).join(', ')}]`);
            } else if (term.number !== undefined && term.operator) {
                parts.push(`${term.operator}${Math.abs(term.number)}`);
            }
        }
        return parts.join(' ') || this.roll.formula || this.roll.result;
    }

    buildSpecialEffectsHtml() {
        const effects = this.roll.specialEffects;
        if (!effects || effects.length === 0) return '';

        return `<div class="special-effects-notice">
            <i class="fas fa-star"></i> <em>${effects.join(', ')}</em>
        </div>`;
    }

    handleSpecialRollEffects() {
        if (this.roll.isCriticalHit && this.title.includes("Attack")) {
            console.log(`${this.actor.name} scored a critical hit - target should make trauma save`);
        }

        if (this.roll.isCriticalFailure && this.title.includes("Defense")) {
            setTimeout(() => this.actor.rollTraumaSave("Critical Defense Failure"), 100);
        }
    }
}

class DiceResultExtractor {
    constructor(roll) {
        this.roll = roll;
    }

    extractResults() {
        const diceResults = [];

        for (const term of this.roll.terms) {
            if (this.isDiceTerm(term)) {
                this.extractResultsFromTerm(term, diceResults);
            }
        }

        return diceResults;
    }

    isDiceTerm(term) {
        return term.results && Array.isArray(term.results);
    }

    extractResultsFromTerm(term, diceResults) {
        for (const result of term.results) {
            if (result.result !== undefined) {
                diceResults.push(result.result);
            }
        }
    }
}
