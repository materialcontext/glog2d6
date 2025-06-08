import { GLOG2D6Roll } from "../dice/glog-roll.mjs";
import { ActorRolls } from "../dice/actor-rolls.mjs";
import { ActorAttributeSystem } from "./systems/actor-attribute-system.mjs";
import { ActorInventorySystem } from "./systems/actor-inventory-system.mjs";
import { ActorBonusSystem } from "./systems/actor-bonus-system.mjs";
import { ActorCombatSystem } from "./systems/actor-combat-system.mjs";
import { ActorMovementSystem } from "./systems/actor-movement-system.mjs";
import { ActorTorchSystem } from "./systems/actor-torch-system.mjs";
import { ActorRestSystem } from "./systems/actor-rest-system.mjs";
import { ActorSpellSystem } from "./systems/actor-spell-system.mjs";
import { ActorTraumaSystem } from "./systems/actor-trauma-system.mjs";

export class GLOG2D6Actor extends Actor {
    constructor(data, context) {
        super(data, context);

        console.log(`🏗️ [${this.name || 'Unknown'}] GLOG2D6Actor constructor called`);
        console.log(`   - User: ${game.user.name}`);
        console.log(`   - Context:`, context);
        console.log(`   - Is this a fresh instance?`, !this._alreadyConstructed);

        this._alreadyConstructed = true;
    }

    /** @override */
    async _preCreate(data, options, user) {
        console.log(`📋 [${this.name}] _preCreate called by user ${user.name}`);
        await super._preCreate(data, options, user);
        await this.updateSource({
            "flags.glog2d6.editMode": false
        });
    }

    initializeComponents() {
        console.log(`🔧 [${this.name}] initializeComponents START`);
        console.log(`   - ActorRolls available: ${typeof ActorRolls}`);
        console.log(`   - ActorAttributeSystem available: ${typeof ActorAttributeSystem}`);

        // Check if CONFIG.GLOG is available
        if (!CONFIG.GLOG) {
            console.error(`❌ [${this.name}] CONFIG.GLOG not available during initializeComponents!`);
            throw new Error('CONFIG.GLOG not available - system data not loaded');
        }

        // Check if required classes are available
        const requiredClasses = [
            'ActorRolls', 'ActorAttributeSystem', 'ActorInventorySystem',
            'ActorBonusSystem', 'ActorCombatSystem', 'ActorMovementSystem'
        ];

        for (const className of requiredClasses) {
            const ClassRef = eval(className); // In real code, import properly
            if (!ClassRef) {
                console.error(`❌ [${this.name}] Required class ${className} not available!`);
                throw new Error(`Required class ${className} not available`);
            }
        }

        try {
            // Roll system
            this.rolls = new ActorRolls(this);
            console.log("1/9")

            // Data calculation systems
            this.attributeSystem = new ActorAttributeSystem(this);
            console.log("2/9")
            this.inventorySystem = new ActorInventorySystem(this);
            console.log("3/9")
            this.bonusSystem = new ActorBonusSystem(this);
            console.log("4/9")
            this.combatSystem = new ActorCombatSystem(this);
            console.log("5/9")
            this.movementSystem = new ActorMovementSystem(this);
            console.log("6/9")

            // Action systems
            this.torchSystem = new ActorTorchSystem(this);
            console.log("7/9")
            this.restSystem = new ActorRestSystem(this);
            console.log("8/9")
            this.spellSystem = new ActorSpellSystem(this);
            console.log("9/9")

            console.log(`✅ [${this.name}] initializeComponents completed successfully`);
        } catch (error) {
            console.error(`   ❌ Failed during system creation:`, error);
            throw error;
        }
    }

    // Data preparation lifecycle
    prepareData() {
        console.log(`📊 [${this.name}] prepareData called by user ${game.user?.name}`);
        console.log(`   - _systemsInitialized: ${this._systemsInitialized}`);
        console.log(`   - CONFIG.GLOG exists: ${!!CONFIG.GLOG}`);
        console.log(`   - CONFIG.GLOG.FEATURES exists: ${!!CONFIG.GLOG?.FEATURES}`);
        console.log(`   - game.ready: ${game.ready}`);

        // ATOMIC: Either all systems initialize or actor is dead
        if (!this._systemsInitialized) {
            console.log(`🔄 [${this.name}] Systems not initialized, calling initializeComponents...`);
            try {
                this.initializeComponents();
                this._validateAllSystems();
                this._systemsInitialized = true;
                console.log(`✅ [${this.name}] Systems initialization completed`);
            } catch (error) {
                console.error(`🚨 FATAL: Actor ${this.name} (${this.id}) system initialization failed`);
                console.error('Error details:', error);
                console.error('Stack trace:', error.stack);

                // Additional debugging
                console.error('Debug info:');
                console.error('  - CONFIG.GLOG exists:', !!CONFIG.GLOG);
                console.error('  - Game user:', game.user.name);
                console.error('  - Game ready:', game.ready);
                console.error('  - System ready:', game.system.ready);

                throw new Error(`Actor ${this.name} is corrupted and cannot be used. Delete and recreate this actor.`);
            }
        } else {
            console.log(`✅ [${this.name}] Systems already initialized, skipping`);
        }

        super.prepareData();
    }

    prepareBaseData() {
        console.log(`📈 [${this.name}] prepareBaseData called`);

        if (!this.attributeSystem) {
            console.error(`❌ [${this.name}] attributeSystem missing in prepareBaseData!`);
            return;
        }

        this.attributeSystem.calculateAttributeModifiers();
        this.inventorySystem.calculateInventoryData();
        this.combatSystem.calculateAttackValue();
        this.traumaSystem = new ActorTraumaSystem(this);
    }

    prepareDerivedData() {
        console.log(`📊 [${this.name}] prepareDerivedData called`);

        if (!this.attributeSystem) {
            console.error(`❌ [${this.name}] attributeSystem missing in prepareDerivedData!`);
            return;
        }

        try {
            this.attributeSystem.initializeEffectiveModifiers();
            this.bonusSystem.calculateAndApplyAllBonuses();
            this.attributeSystem.applyEncumbranceToAttributes();
            this.movementSystem.calculateEffectiveMovement();
            this.combatSystem.calculateDefenseValues();
        } catch (error) {
            console.error("Error in prepareDerivedData for", this.name, ":", error);
        }
    }

    _validateAllSystems() {
        console.log(`✅ [${this.name}] Validating all systems...`);

        const requiredSystems = [
            'attributeSystem', 'inventorySystem', 'bonusSystem',
            'combatSystem', 'movementSystem', 'rolls'
        ];

        for (const system of requiredSystems) {
            if (!this[system]) {
                console.error(`❌ [${this.name}] System validation failed: ${system} is missing`);
                throw new Error(`Required system '${system}' failed to initialize`);
            }
        }

        console.log(`✅ [${this.name}] All systems validated successfully`);
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
    async rollTraumaSave(...args) { return this.traumaSystem.rollTraumaSave(...args); }
    async initiateTraumaSave() { return this.traumaSystem.initiateTraumaSave(); }
    async applyWound(...args) { return this.traumaSystem.applyWound(...args); }
    async removeWound(...args) { return this.traumaSystem.removeWound(...args); }

    _hasClass(className) {
        return this.items.some(i =>
            i.type === "feature" &&
            i.system.active &&
            i.system.classSource === className
        );
    }

    async breakEquippedItem(itemType) {
        const equippedItem = this.items.find(i =>
            i.type === itemType && i.system.equipped
        );

        if (!equippedItem) {
            ui.notifications.warn(`No equipped ${itemType} to break!`);
            return;
        }

        const currentLevel = equippedItem.system.breakage?.level || 0;
        const maxLevel = equippedItem.system.breakage?.maxLevel || 2;

        if (currentLevel >= maxLevel) {
            ui.notifications.warn(`${equippedItem.name} is already broken!`);
            return;
        }

        const newLevel = currentLevel + 1;
        await equippedItem.update({ "system.breakage.level": newLevel });

        const statusText = newLevel >= maxLevel ? "broken" : "damaged";
        ui.notifications.info(`${equippedItem.name} is now ${statusText}!`);
    }


    // System delegations
    async toggleTorch() { return this.torchSystem.toggleTorch(); }
    getAvailableTorches() { return this.torchSystem.getAvailableTorches(); }
    getActiveTorch() { return this.torchSystem.getActiveTorch(); }
    async burnTorch(hours = 0.1) { return this.torchSystem.burnTorch(hours); }
    async rest() { return this.restSystem.performRest(); }
    async castSpellWithDice(spell, diceCount) { return this.spellSystem.castSpellWithDice(spell, diceCount); }

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

    async heal() {
        const healRoll = new Roll("1d6");
        await healRoll.evaluate();

        const currentHP = this.system.hp.value;
        const maxHP = this.system.hp.max;
        const healAmount = healRoll.total;

        const newHP = Math.min(currentHP + healAmount, maxHP);
        const actualHealed = newHP - currentHP;

        if (actualHealed > 0) {
            await this.update({ "system.hp.value": newHP });

            // Send chat message
            await this._createHealChatMessage(healRoll, actualHealed);
        }

        return { healed: actualHealed, rolled: healAmount };
    }

    async _createHealChatMessage(roll, actualHealed) {
        const content = `
        <div class="glog2d6-roll">
            <h3>${this.name} - Healing</h3>
            <div class="roll-result">
                <strong>Roll:</strong> [${roll.terms[0].results.map(r => r.result).join(', ')}]<br>
                <strong>Healed:</strong> ${actualHealed} HP
            </div>
        </div>
    `;

        await ChatMessage.create({
            speaker: ChatMessage.getSpeaker({ actor: this }),
            content: content,
            roll: roll
        });
    }

    // Chat message helper
    async _createRollChatMessage(title, roll, extraContent = '') {
        const chatMessageBuilder = new RollChatMessageBuilder(this, title, roll, extraContent);
        return await chatMessageBuilder.createAndSend();
    }

    // Dice result extraction helper
    _getDiceResults(roll) {
        const diceExtractor = new DiceResultExtractor(roll);
        return diceExtractor.extractResults();
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

    async createAndSend() {
        const content = this.buildContent();
        this.handleSpecialRollEffects();

        const message = await ChatMessage.create({
            speaker: ChatMessage.getSpeaker({ actor: this.actor }),
            content: content,
            roll: this.roll
        });

        return message;
    }

    buildContent() {
        const rollDisplay = this.parseRollDisplay();
        const specialEffectsHtml = this.buildSpecialEffectsHtml();
        const breakageButtonHtml = this.buildBreakageButtonHtml();
        const safeExtraContent = this.extraContent || "";

        return `
        <div class="glog2d6-roll">
            <h3>${this.title}</h3>
            <div class="roll-result">
                <strong>Roll:</strong> ${rollDisplay}<br>
                <strong>Total:</strong> ${this.roll.total}
                ${safeExtraContent}
                ${specialEffectsHtml}
                ${breakageButtonHtml}
            </div>
        </div>
    `;
    }

    buildBreakageButtonHtml() {
        if (!this.title.includes("Attack") && !this.title.includes("Defense")) {
            return '';
        }

        const diceResults = this.roll.terms[0]?.results?.map(r => r.result) || [];
        const hasSnakeEyes = diceResults.length === 2 &&
            diceResults[0] === 1 &&
            diceResults[1] === 1;

        if (!hasSnakeEyes) return '';

        const isAttack = this.title.includes("Attack");

        // For attacks, only show break button if there's an equipped weapon
        if (isAttack) {
            const equippedWeapon = this.actor.items.find(i =>
                i.type === "weapon" && i.system.equipped
            );
            if (!equippedWeapon) return ''; // No equipped weapon = unarmed
        }

        const buttonText = isAttack ? "Break Weapon" : "Break Armor";
        const itemType = isAttack ? "weapon" : "armor";

        return `
        <div class="breakage-button mt-8">
            <button type="button" class="btn btn-danger p-4 text-small break-item-btn"
                    data-actor-id="${this.actor.id}"
                    data-item-type="${itemType}">
                <i class="fas fa-hammer"></i> ${buttonText}
            </button>
        </div>
    `;
    }

    parseRollDisplay() {
        const parts = [];
        let totalBonus = 0;

        for (const term of this.roll.terms || []) {
            if (Array.isArray(term.results)) {
                parts.push(`[${term.results.map(r => r.result).join(', ')}]`);
            } else if (term.number !== undefined && term.operator) {
                totalBonus += term.operator === '+' ? term.number : -term.number;
            }
        }

        const diceDisplay = parts.join(' ');
        return totalBonus !== 0 ? `${diceDisplay} + ${totalBonus}` : diceDisplay;
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
