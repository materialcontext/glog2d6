import { ActorRolls } from "../dice/actor-rolls.mjs";
import { BonusCalculator } from "../systems/bonus-calculator.mjs";
import { safely } from "../systems/safely.mjs";

// Add back features to actor.mjs one at a time
export class GLOG2D6Actor extends Actor {
    constructor(data, context) {
        console.log('🔧 Step-by-step Actor constructor');
        super(data, context);

        // TEST 1: Add back ActorRolls first
        try {
            console.log('Adding ActorRolls...');
            this.rolls = new ActorRolls(this);
            console.log('✅ ActorRolls added successfully');
        } catch (error) {
            console.error('❌ ActorRolls failed:', error);
            this.rolls = null;
        }

        // TEST 2: Comment this out first - test if ActorRolls alone breaks it
        try {
            console.log('Adding safe methods...');
            this._setupSafePublicMethods();
            console.log('✅ Safe methods added successfully');
        } catch (error) {
            console.error('❌ Safe methods failed:', error);
        }

        console.log('✅ Step-by-step Actor constructor complete');
    }

    // Add this method to your actor if ActorRolls works fine
    _setupSafePublicMethods() {
        console.log('🔧 Setting up safe methods...');

        // Test each method individually
        console.log('Method _analyzeEquippedWeapons exists:', typeof this._analyzeEquippedWeapons);
        console.log('Method _hasFeature exists:', typeof this._hasFeature);
        console.log('Method _getClassTemplateCount exists:', typeof this._getClassTemplateCount);

        try {
            console.log('Setting up analyzeEquippedWeapons...');
            this.analyzeEquippedWeapons = safely({
                fallback: { hasWeapons: false, attackButtonType: 'generic' },
                context: 'actor-weapon-analysis'
            })(this._analyzeEquippedWeapons?.bind(this));
            console.log('✅ analyzeEquippedWeapons setup complete');
        } catch (error) {
            console.error('❌ analyzeEquippedWeapons setup failed:', error);
        }

        try {
            console.log('Setting up hasFeature...');
            this.hasFeature = safely.silent(false)(
                this._hasFeature?.bind(this)
            );
            console.log('✅ hasFeature setup complete');
        } catch (error) {
            console.error('❌ hasFeature setup failed:', error);
        }

        try {
            console.log('Setting up getClassTemplateCount...');
            this.getClassTemplateCount = safely.silent(0)(
                this._getClassTemplateCount?.bind(this)
            );
            console.log('✅ getClassTemplateCount setup complete');
        } catch (error) {
            console.error('❌ getClassTemplateCount setup failed:', error);
        }

        console.log('✅ Safe methods setup complete');
    }

    // Keep all your existing methods but add logging
    prepareData() {
        console.log('🔧 Actor prepareData()');
        super.prepareData();
        console.log('✅ Actor prepareData() complete');
    }

    prepareBaseData() {
        console.log('🔧 Enhanced prepareBaseData()');

        // Calculate attribute modifiers
        for (let [_key, attribute] of Object.entries(this.system.attributes)) {
            if (attribute.value == 7) attribute.mod = 0
            if (attribute.value < 7) attribute.mod = Math.floor((8 - attribute.value) / 2) * -1;
            if (attribute.value > 7) attribute.mod = Math.floor((attribute.value - 6) / 2);
        }

        // Calculate inventory and encumbrance for characters
        if (this.type === "character") {
            this._calculateInventoryAndEncumbrance();
        }

        // Calculate attack values for characters
        if (this.type === "character") {
            const level = this.system.details.level || 1;

            // Ensure structure exists
            if (!this.system.combat) this.system.combat = {};
            if (!this.system.combat.attack) this.system.combat.attack = { value: 0, bonus: 0, breakdown: [] };

            this.system.combat.attack.value = level;
            console.log(`Attack base value: ${level} (from level)`);
        }

        console.log('✅ Enhanced prepareBaseData() complete');
    }

    prepareDerivedData() {
        console.log('🔧 Enhanced prepareDerivedData()');

        try {
            // Set effective modifiers for all attributes first
            for (let [_key, attribute] of Object.entries(this.system.attributes)) {
                attribute.effectiveMod = attribute.mod; // Default to original mod
                attribute.effectiveValue = attribute.value; // Default to original value
            }

            // Calculate bonuses for characters
            if (this.type === "character") {
                console.log('Calculating bonuses...');
                try {
                    this.bonusCalculator = new BonusCalculator(this);
                    const bonuses = this.bonusCalculator.calculateBonuses();
                    this._applyBonuses(bonuses);
                    console.log('✅ Bonuses calculated and applied');
                } catch (error) {
                    console.warn('Bonus calculation failed:', error);
                }
            }

            // Apply encumbrance penalty to dexterity
            if (this.type === "character" && this.system.inventory.encumbrance > 0) {
                console.log('Applying encumbrance penalties...');

                const dexAttribute = this.system.attributes.dex;
                const originalValue = dexAttribute.value;
                const encumbrancePenalty = this.system.inventory.encumbrance;

                // Reduce the effective dexterity VALUE by encumbrance
                const effectiveValue = Math.max(1, originalValue - encumbrancePenalty);
                dexAttribute.effectiveValue = effectiveValue;

                // Recalculate the modifier based on the new effective value
                if (effectiveValue == 7) dexAttribute.effectiveMod = 0;
                else if (effectiveValue < 7) dexAttribute.effectiveMod = Math.floor((8 - effectiveValue) / 2) * -1;
                else if (effectiveValue > 7) dexAttribute.effectiveMod = Math.floor((effectiveValue - 6) / 2);

                console.log(`Dex encumbrance: ${originalValue} -> ${effectiveValue}, Mod ${dexAttribute.mod} -> ${dexAttribute.effectiveMod}`);
            }

            // Calculate effective movement
            if (this.type === "character") {
                const baseMovement = this.system.details.movement;
                const movementBonus = this.system.details.movementBonus || 0;
                const encumbrance = this.system.inventory.encumbrance || 0;
                const movePenalty = Math.floor(encumbrance / 2);

                this.system.details.effectiveMovement = Math.max(0, baseMovement + movementBonus - movePenalty);

                if (movePenalty > 0 || movementBonus > 0) {
                    console.log(`Movement: ${baseMovement} base + ${movementBonus} bonus - ${movePenalty} penalty = ${this.system.details.effectiveMovement}`);
                }
            }

            // Calculate defense values
            if (this.type === "character") {
                this._calculateDefenseValues();
            }

            console.log('✅ Enhanced prepareDerivedData() complete');

        } catch (error) {
            console.error("Error in prepareDerivedData for", this.name, ":", error);
            // Continue with basic setup even if complex calculations fail
            for (let [key, attribute] of Object.entries(this.system.attributes)) {
                attribute.effectiveMod = attribute.mod;
                attribute.effectiveValue = attribute.value;
            }
        }
    }
    // Add these methods back to your actor.mjs
    // (Add to the GLOG2D6Actor class)

    /**
     * Check if this actor has specific features (can check multiple)
     */
    _hasFeature(...featureNames) {
        return featureNames.some(name =>
            this.items.some(i =>
                i.type === "feature" &&
                i.system.active &&
                i.name === name
            )
        );
    }

    /**
     * Get the number of templates this character has for a specific class
     */
    _getClassTemplateCount(className) {
        const classFeatures = this.items.filter(i =>
            i.type === "feature" &&
            i.system.active &&
            i.system.classSource === className
        );

        // Count unique templates (A, B, C, D, level-0)
        const templates = new Set();
        for (const feature of classFeatures) {
            if (feature.system.template) {
                templates.add(feature.system.template);
            }
        }

        return templates.size;
    }

    /**
     * Analyze equipped weapons for UI display
     */
    _analyzeEquippedWeapons() {
        const equippedWeapons = this.items.filter(i =>
            i.type === "weapon" && i.system.equipped
        );

        const analysis = {
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

        if (equippedWeapons.length === 0) {
            return analysis;
        }

        // Categorize weapons
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

        // Determine primary weapon
        analysis.primaryWeapon = this._getBestWeapon(equippedWeapons);

        // Determine attack button type
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

        return analysis;
    }

    _getBestWeapon(weapons) {
        if (weapons.length === 0) return null;
        if (weapons.length === 1) return weapons[0];

        // Priority: heavy > medium > light, then by damage approximation
        const priority = { heavy: 3, medium: 2, light: 1 };

        return weapons.reduce((best, current) => {
            const bestPriority = priority[best.system.size] || 1;
            const currentPriority = priority[current.system.size] || 1;

            if (currentPriority > bestPriority) {
                return current;
            } else if (currentPriority === bestPriority) {
                // Same size, compare damage (rough approximation)
                const bestDamage = best.system.damage?.length || 0;
                const currentDamage = current.system.damage?.length || 0;
                return currentDamage > bestDamage ? current : best;
            }
            return best;
        });
    }

    /**
 * Calculate defense values from armor and shields
 */
    _calculateDefenseValues() {
        let armorBonus = 0;

        // Find equipped armor
        const armor = this.items.find(item => item.type === "armor" && item.system.equipped);
        if (armor) {
            armorBonus += armor.system.armorBonus;
        }

        // Find equipped shields
        const shield = this.items.find(item => item.type === "shield" && item.system.equipped);
        if (shield) {
            armorBonus += shield.system.armorBonus;
        }

        // Defense = Armor + Shield + Dex mod (use effective mod)
        const dexMod = this.system.attributes.dex.effectiveMod;
        const dexBonus = dexMod > 0 ? dexMod : 0;

        // Get melee/ranged bonuses from features
        const meleeBonus = this.system.defense?.meleeBonus || 0;
        const rangedBonus = this.system.defense?.rangedBonus || 0;

        this.system.defense = {
            armor: armor?.system.armorBonus || 0,
            shield: shield?.system.armorBonus || 0,
            dexBonus: dexBonus,
            meleeBonus: meleeBonus,
            rangedBonus: rangedBonus,
            meleeTotal: armorBonus + dexBonus + meleeBonus,
            rangedTotal: armorBonus + dexBonus + rangedBonus,
            total: armorBonus + dexBonus // Backwards compatibility
        };

        console.log('Defense calculated:', this.system.defense);
    }

    /**
     * Apply calculated bonuses to actor data
     */
    _applyBonuses(bonuses) {
        for (const [target, bonusData] of bonuses) {
            this._applyBonusToTarget(target, bonusData.total, bonusData.breakdown);
        }
    }

    /**
     * Apply a bonus to a specific target path
     */
    _applyBonusToTarget(target, totalBonus, breakdown) {
        switch (target) {
            case "combat.attack.bonus":
                this.system.combat.attack.bonus = (this.system.combat.attack.bonus || 0) + totalBonus;
                this.system.combat.attack.breakdown = breakdown;
                break;

            case "hp.bonus":
                this.system.hp.bonus = (this.system.hp.bonus || 0) + totalBonus;
                this.system.hp.max += totalBonus;
                this.system.hp.breakdown = breakdown;
                break;

            case "skills.stealth.bonus":
                if (!this.system.skills) this.system.skills = {};
                if (!this.system.skills.stealth) this.system.skills.stealth = {};
                this.system.skills.stealth.bonus = (this.system.skills.stealth.bonus || 0) + totalBonus;
                this.system.skills.stealth.breakdown = breakdown;
                break;

            case "skills.reaction.bonus":
                if (!this.system.skills) this.system.skills = {};
                if (!this.system.skills.reaction) this.system.skills.reaction = {};
                this.system.skills.reaction.bonus = (this.system.skills.reaction.bonus || 0) + totalBonus;
                this.system.skills.reaction.breakdown = breakdown;
                break;

            case "combat.archery.bonus":
                if (!this.system.combat.archery) this.system.combat.archery = {};
                this.system.combat.archery.bonus = (this.system.combat.archery.bonus || 0) + totalBonus;
                this.system.combat.archery.breakdown = breakdown;
                break;

            case "details.movement.bonus":
                this.system.details.movementBonus = totalBonus;
                this.system.details.movementBreakdown = breakdown;
                break;

            case "defense.melee.bonus":
                if (!this.system.defense) this.system.defense = {};
                this.system.defense.meleeBonus = (this.system.defense.meleeBonus || 0) + totalBonus;
                this.system.defense.meleeBreakdown = breakdown;
                break;

            case "spellSlots":
                this.system.spellSlots = (this.system.spellSlots || 0) + totalBonus;
                this.system.spellSlotsBreakdown = breakdown;
                break;

            case "magicDiceMax":
                this.system.magicDiceMax = Math.max(0, (this.system.magicDiceMax || 0) + totalBonus);
                this.system.magicDiceMaxBreakdown = breakdown;
                if (this.system.magicDiceCurrent === undefined) {
                    this.system.magicDiceCurrent = this.system.magicDiceMax;
                }
                break;

            case "saves.int.bonus":
            case "saves.wis.bonus":
                if (!this.system.saves) this.system.saves = {};
                const saveType = target.split('.')[1];
                if (!this.system.saves[saveType]) this.system.saves[saveType] = {};
                this.system.saves[saveType].bonus = (this.system.saves[saveType].bonus || 0) + totalBonus;
                this.system.saves[saveType].breakdown = breakdown;
                break;

            default:
                console.warn(`Unknown bonus target: ${target}`);
        }
    }

    /**
     * Calculate inventory slots and encumbrance penalties
    */
    _calculateInventoryAndEncumbrance() {
        const strMod = this.system.attributes.str.mod;
        const conMod = this.system.attributes.con.mod;
        this.system.inventory.slots.max = 6 + Math.max(strMod, conMod);

        // Calculate used slots by iterating through items
        let usedSlots = 0;
        for (let item of this.items) {
            if (item.system.slots) {
                usedSlots += item.system.slots;
            }
        }
        this.system.inventory.slots.used = usedSlots;

        // Calculate slot-based encumbrance (over carrying capacity)
        const maxSlots = this.system.inventory.slots.max;
        const slotEncumbrance = Math.max(0, usedSlots - maxSlots);

        // Calculate equipment-based encumbrance penalties
        let equipmentEncumbrance = 0;

        // Check equipped armor for encumbrance penalty
        const equippedArmor = this.items.find(item => item.type === "armor" && item.system.equipped);
        if (equippedArmor && equippedArmor.system.encumbrancePenalty) {
            equipmentEncumbrance += equippedArmor.system.encumbrancePenalty;
        }

        // Check equipped weapons for encumbrance penalty
        const equippedWeapons = this.items.filter(item => item.type === "weapon" && item.system.equipped);
        for (let weapon of equippedWeapons) {
            if (weapon.system.encumbrancePenalty) {
                equipmentEncumbrance += weapon.system.encumbrancePenalty;
            }
        }

        // ARMOR TRAINING: Reduce armor encumbrance by 1 if character has the feature
        const hasArmorTraining = this.items.some(item =>
            item.type === "feature" &&
            item.name.includes("Armor Training") &&
            item.system.active
        );
        if (hasArmorTraining && equipmentEncumbrance > 0) {
            equipmentEncumbrance = Math.max(0, equipmentEncumbrance - 1);
            console.log(`Armor Training: Reduced equipment encumbrance by 1`);
        }

        // Total encumbrance is the sum of slot overflow and equipment penalties
        this.system.inventory.encumbrance = slotEncumbrance + equipmentEncumbrance;
        this.system.inventory.slotEncumbrance = slotEncumbrance;
        this.system.inventory.equipmentEncumbrance = equipmentEncumbrance;

        console.log(`Encumbrance: ${usedSlots}/${maxSlots} slots (overflow: ${slotEncumbrance}), equipment: ${equipmentEncumbrance}, total: ${this.system.inventory.encumbrance}`);
    }

    async rollAttribute(...args) {
        return this.rolls?.rollAttribute(...args) || console.warn('ActorRolls not available');
    }

    async rollSave(...args) {
        return this.rolls?.rollSave(...args) || console.warn('ActorRolls not available');
    }

    async rollAttack(...args) {
        return this.rolls?.rollAttack(...args) || console.warn('ActorRolls not available');
    }

    async rollWeaponAttack(...args) {
        return this.rolls?.rollWeaponAttack(...args) || console.warn('ActorRolls not available');
    }

    async rollDefense(...args) {
        return this.rolls?.rollDefense(...args) || console.warn('ActorRolls not available');
    }

    async rollMeleeDefense(...args) {
        return this.rolls?.rollMeleeDefense(...args) || console.warn('ActorRolls not available');
    }

    async rollRangedDefense(...args) {
        return this.rolls?.rollRangedDefense(...args) || console.warn('ActorRolls not available');
    }

    async rollMovement(...args) {
        return this.rolls?.rollMovement(...args) || console.warn('ActorRolls not available');
    }

    async rollWeaponDamage(...args) {
        return this.rolls?.rollWeaponDamage(...args) || console.warn('ActorRolls not available');
    }

    async rollSneak(...args) {
        return this.rolls?.rollSneak(...args) || console.warn('ActorRolls not available');
    }

    async rollHide(...args) {
        return this.rolls?.rollHide(...args) || console.warn('ActorRolls not available');
    }

    async rollDisguise(...args) {
        return this.rolls?.rollDisguise(...args) || console.warn('ActorRolls not available');
    }

    async rollReaction(...args) {
        return this.rolls?.rollReaction(...args) || console.warn('ActorRolls not available');
    }

    async rollDiplomacy(...args) {
        return this.rolls?.rollDiplomacy(...args) || console.warn('ActorRolls not available');
    }

    async rollIntimidate(...args) {
        return this.rolls?.rollIntimidate(...args) || console.warn('ActorRolls not available');
    }

    async rollTraumaSave(...args) {
        return this.rolls?.rollTraumaSave(...args) || console.warn('ActorRolls not available');
    }

    // Rest method
    async rest() {
        const updates = {};
        let restMessages = [];

        // Restore HP to maximum
        const currentHP = this.system.hp.value;
        const maxHP = this.system.hp.max;

        if (currentHP < maxHP) {
            updates["system.hp.value"] = maxHP;
            const healedAmount = maxHP - currentHP;
            restMessages.push(`Restored ${healedAmount} HP (${currentHP} → ${maxHP})`);
        } else {
            restMessages.push("Already at full HP");
        }

        // Restore magic dice to maximum
        const currentMD = this.system.magicDiceCurrent || 0;
        const maxMD = this.system.magicDiceMax || 0;

        if (maxMD > 0) {
            if (currentMD < maxMD) {
                updates["system.magicDiceCurrent"] = maxMD;
                const restoredMD = maxMD - currentMD;
                restMessages.push(`Restored ${restoredMD} Magic Dice (${currentMD} → ${maxMD})`);
            } else {
                restMessages.push("Magic Dice already at maximum");
            }
        }

        // Apply updates if any
        if (Object.keys(updates).length > 0) {
            await this.update(updates);
        }

        // Create rest message
        const restSummary = restMessages.length > 0 ? restMessages.join(" • ") : "No recovery needed";

        ChatMessage.create({
            speaker: ChatMessage.getSpeaker({ actor: this }),
            content: `
            <div class="glog2d6-roll rest-message">
                <h3><i class="fas fa-bed"></i> ${this.name} takes a rest</h3>
                <div class="roll-result">
                    <strong>Recovery:</strong><br>
                    ${restSummary}
                </div>
            </div>
        `,
            type: CONST.CHAT_MESSAGE_TYPES.OTHER
        });

        return {
            hpRestored: updates["system.hp.value"] ? (maxHP - currentHP) : 0,
            mdRestored: updates["system.magicDiceCurrent"] ? (maxMD - currentMD) : 0,
            message: restSummary
        };
    }

    // Add these methods back to your GLOG2D6Actor class

    /**
     * Create a standardized chat message for rolls with special effects support
     */
    _createRollChatMessage(title, roll, extraContent = '') {
        // Get the individual dice results for 2d6 rolls
        const diceResults = this._getDiceResults(roll);
        const diceDisplay = diceResults.length > 0 ?
            `[${diceResults.join(', ')}] + modifiers` : roll.result;

        const specialEffectsHtml = roll.specialEffects?.length > 0 ?
            `<div class="special-effects-notice">
   <i class="fas fa-star"></i> <em>${roll.specialEffects.join(', ')}</em>
 </div>` : '';

        // Auto trigger critical effects
        if (roll.isCriticalHit && title.includes("Attack")) {
            console.log(`${this.name} scored a critical hit - target should make trauma save`);
            // Just log for now, since we don't track targets yet
        }

        if (roll.isCriticalFailure && title.includes("Defense")) {
            setTimeout(() => this.rollTraumaSave("Critical Defense Failure"), 100);
        }

        return ChatMessage.create({
            speaker: ChatMessage.getSpeaker({ actor: this }),
            content: `
  <div class="glog2d6-roll">
    <h3>${title}</h3>
    <div class="roll-result">
      <strong>Roll:</strong> ${diceDisplay}
      <br><strong>Result:</strong> ${roll.total}
      ${extraContent}
      ${specialEffectsHtml}
    </div>
  </div>
`,
            roll: roll
        });
    }

    /**
     * Extract individual dice results from a roll
     */
    _getDiceResults(roll) {
        const diceResults = [];

        // Look through roll terms for dice
        for (const term of roll.terms) {
            if (term.results && Array.isArray(term.results)) {
                // This is a dice term, extract the individual results
                for (const result of term.results) {
                    if (result.result !== undefined) {
                        diceResults.push(result.result);
                    }
                }
            }
        }

        return diceResults;
    }

    /**
     * Create enhanced rolls with special dice mechanics
     */
    createRoll(formula, data = {}, context = null) {
        const needsSpecialFeatures = this.hasSpecialDiceFeatures(context);

        if (needsSpecialFeatures) {
            return new GLOG2D6Roll(formula, data, {
                checkSpecialFeatures: true,
                context: context,
                actor: this
            });
        }

        // Regular roll for characters without special dice features
        return new Roll(formula, data);
    }

    /**
     * Check if actor has features that affect dice rolls
     */
    hasSpecialDiceFeatures(context) {
        const specialFeatures = ['Tricky', 'Superior Combatant', 'Feats of Strength', 'Fast Talker'];
        return this.items.some(item =>
            item.type === "feature" &&
            item.system.active &&
            specialFeatures.includes(item.name)
        );
    }

    /**
     * Get special effects that should trigger for this roll
     */
    getSpecialEffectsForRoll(rollContext, roll) {
        if (!roll.hasDoubles || roll.isSnakeEyes) return [];

        const effects = [];
        const activeFeatures = this.items.filter(i =>
            i.type === "feature" && i.system.active
        );

        // Check for critical hits first
        if (rollContext === 'attack' && roll.isCriticalHit) {
            effects.push("CRITICAL HIT! Target must make a Trauma Save!");
        }

        if (rollContext === 'defense' && roll.isCriticalFailure) {
            effects.push("CRITICAL FAILURE! You must make a Trauma Save!");
        }

        // Check feature-based effects
        for (const feature of activeFeatures) {
            switch (feature.name) {
                case "Tricky":
                    if (rollContext === 'attack') {
                        effects.push("You may attempt a free Combat Maneuver");
                    }
                    break;

                case "Superior Combatant":
                    if (rollContext === 'attack') {
                        effects.push("Critical Hit! (rolled doubles)");
                    }
                    break;

                case "Fast Talker":
                    if (rollContext === 'social') {
                        effects.push("You may re-roll this social check");
                    }
                    break;

                case "Feats of Strength":
                    if (rollContext === 'strength') {
                        effects.push("Double your Strength bonus for this roll");
                    }
                    break;
            }
        }

        return effects;
    }

    // Add these methods back to your GLOG2D6Actor class

    /**
     * Toggle torch lighting for this actor's tokens
     */
    async toggleTorch() {
        if (this.type !== "character") return;

        const currentState = this.system.torch?.lit || false;
        const newState = !currentState;

        // Find available torches
        const availableTorches = this.items.filter(item =>
            item.type === "torch" &&
            (!item.system.duration.enabled || item.system.duration.remaining > 0)
        );

        if (newState && availableTorches.length === 0) {
            ui.notifications.warn("No torches available or all torches are burned out!");
            return;
        }

        // If turning on, select the first available torch or the currently active one
        let activeTorch = null;
        if (newState) {
            const currentTorchId = this.system.torch?.activeTorchId;
            activeTorch = availableTorches.find(t => t.id === currentTorchId) || availableTorches[0];
        }

        // Update actor torch state
        await this.update({
            "system.torch.lit": newState,
            "system.torch.activeTorchId": activeTorch?.id || null
        });

        // Update all tokens for this actor
        const tokens = this.getActiveTokens();
        const updates = [];

        for (let token of tokens) {
            if (newState && activeTorch) {
                // Turn on light with torch properties
                const lightConfig = {
                    alpha: 0.15,
                    angle: activeTorch.system.lightAngle || 360,
                    bright: (activeTorch.system.lightRadius.bright || 20) / canvas.dimensions.distance,
                    coloration: 1,
                    dim: (activeTorch.system.lightRadius.dim || 40) / canvas.dimensions.distance,
                    luminosity: 0.15,
                    saturation: -0.3,
                    contrast: 0.05,
                    shadows: 0.1,
                    animation: {
                        type: activeTorch.system.lightAnimation?.type || null,
                        speed: Math.max(activeTorch.system.lightAnimation?.speed || 1, 1),
                        intensity: Math.min(activeTorch.system.lightAnimation?.intensity || 1, 2),
                        reverse: false
                    },
                    darkness: {
                        min: 0,
                        max: 1
                    },
                    color: activeTorch.system.lightColor || "#ffbb77"
                };

                updates.push({
                    _id: token.id,
                    light: lightConfig
                });
            } else {
                // Turn off light
                updates.push({
                    _id: token.id,
                    light: {
                        alpha: 0,
                        angle: 360,
                        bright: 0,
                        coloration: 1,
                        dim: 0,
                        luminosity: 0,
                        saturation: 0,
                        contrast: 0,
                        shadows: 0,
                        animation: {
                            type: null,
                            speed: 5,
                            intensity: 5,
                            reverse: false
                        },
                        darkness: {
                            min: 0,
                            max: 1
                        },
                        color: null
                    }
                });
            }
        }

        if (updates.length > 0) {
            await canvas.scene.updateEmbeddedDocuments("Token", updates);
        }

        // Provide feedback
        if (newState) {
            const durationInfo = activeTorch.system.duration.enabled
                ? `${activeTorch.system.duration.remaining} hours remaining`
                : "∞ duration";

            ChatMessage.create({
                speaker: ChatMessage.getSpeaker({ actor: this }),
                content: `<div class="glog2d6-roll">
        <h3>${this.name} lights a torch</h3>
        <div class="roll-result">
          <strong>Torch:</strong> ${activeTorch.name}<br>
          <strong>Duration:</strong> ${durationInfo}
        </div>
      </div>`
            });
        } else {
            ChatMessage.create({
                speaker: ChatMessage.getSpeaker({ actor: this }),
                content: `<div class="glog2d6-roll">
        <h3>${this.name} extinguishes their torch</h3>
      </div>`
            });
        }

        return newState;
    }

    /**
     * Get all available torches for this character
     */
    getAvailableTorches() {
        return this.items.filter(item =>
            item.type === "torch" &&
            (!item.system.duration.enabled || item.system.duration.remaining > 0)
        );
    }

    /**
     * Get the currently active torch
     */
    getActiveTorch() {
        const torchId = this.system.torch?.activeTorchId;
        if (!torchId) return null;
        return this.items.get(torchId);
    }

    /**
     * Reduce torch duration (called by GM or on time passage)
     */
    async burnTorch(hours = 0.1) {
        const activeTorch = this.getActiveTorch();
        if (!activeTorch || !this.system.torch?.lit) return;

        // Only burn if duration tracking is enabled
        if (!activeTorch.system.duration.enabled) return;

        const burnRate = activeTorch.system.duration.burnRate || 1.0;
        const actualBurn = hours * burnRate;
        const newRemaining = Math.max(0, activeTorch.system.duration.remaining - actualBurn);

        await activeTorch.update({ "system.duration.remaining": newRemaining });

        if (newRemaining === 0) {
            ui.notifications.info(`${activeTorch.name} has burned out!`);

            // Check if auto-extinguish is enabled
            if (activeTorch.system.duration.autoExtinguish) {
                // Try to switch to another torch
                const otherTorches = this.getAvailableTorches().filter(t => t.id !== activeTorch.id);
                if (otherTorches.length > 0) {
                    await this.update({ "system.torch.activeTorchId": otherTorches[0].id });
                    ui.notifications.info(`Automatically switched to ${otherTorches[0].name}`);
                } else {
                    // No more torches, turn off light
                    await this.toggleTorch();
                }
            } else {
                // Just notify, but keep the torch "lit" (GM can decide what to do)
                ui.notifications.warn(`${activeTorch.name} is burned out but still lit (auto-extinguish disabled)`);
            }
        }
    }
    // Add these methods back to your GLOG2D6Actor class

    /**
     * Check if this actor has any levels in a specific class
     */
    _hasClass(className) {
        return this.items.some(i =>
            i.type === "feature" &&
            i.system.active &&
            i.system.classSource === className
        );
    }

    /**
     * Cast spell with magic dice mechanics
     */
    async castSpellWithDice(spell, diceCount) {
        // Roll the magic dice
        const roll = new Roll(`${diceCount}d6`);
        await roll.evaluate();

        const results = roll.terms[0].results.map(r => r.result);
        const sum = roll.total;

        // Determine which dice are exhausted (4-6) vs returned (1-3)
        const exhausted = results.filter(r => r >= 4).length;
        const returned = results.filter(r => r <= 3).length;

        // Update magic dice
        const newCurrent = Math.max(0, this.system.magicDiceCurrent - exhausted);
        await this.update({ "system.magicDiceCurrent": newCurrent });

        // Create result message
        ChatMessage.create({
            speaker: ChatMessage.getSpeaker({ actor: this }),
            content: `
    <div class="glog2d6-spell-result">
        <h3>${this.name} casts ${spell.name}!</h3>
        <div class="magic-dice-result">
            <strong>Magic Dice:</strong> [${results.join(', ')}] = ${sum}<br>
            <strong>Dice Exhausted:</strong> ${exhausted} (rolled 4-6)<br>
            <strong>Dice Returned:</strong> ${returned} (rolled 1-3)<br>
            <strong>Remaining MD:</strong> ${newCurrent}/${this.system.magicDiceMax}
        </div>
        <div class="spell-effect">
            <p><strong>Spell Effect:</strong> Use [dice] = ${diceCount} and [sum] = ${sum} in spell description</p>
        </div>
    </div>
`,
            roll: roll
        });
    }
}
