// module/actions/documents/attack-document.mjs

import { ActionDocument } from '../core/action-document.mjs';
import { ActionValidation } from '../core/action-validation.mjs';

/**
 * AttackDocument - Handles all attack actions
 *
 * This is a concrete example of how ActionDocument is used.
 * It shows the complete flow from validation through chat message creation.
 *
 * Usage:
 *   const attack = new AttackDocument(actor, { weapon: selectedWeapon });
 *   const result = await attack.execute();
 */
export class AttackDocument extends ActionDocument {
    constructor(actor, options = {}) {
        super('Attack', actor, options);

        // Attack-specific options
        this.selectedWeapon = options.weapon || null;
        this.targetActor = options.target || null;
        this.attackType = options.attackType || null; // 'melee', 'ranged', 'thrown'
    }

    /**
     * Phase 1: Attack-specific validation (minimal - matching original system)
     */
    async performSpecificValidation() {
        // Only validate the absolute basics
        ActionValidation.requireOwnership(this.actor);

        // If specific weapon provided, make sure it exists and is equipped
        if (this.selectedWeapon) {
            ActionValidation.requireSpecificWeapon(this.actor, this.selectedWeapon.id);
        }

        // Validate target if provided (for targeted attacks)
        if (this.targetActor) {
            ActionValidation.requireTarget(this.targetActor);
        }

        // That's it! The original system is very permissive:
        // - Unarmed attacks are totally fine
        // - Broken weapons can still be used (just penalized)
        // - No ammo? You can still try (just won't work well)
        // - Dead characters can't act, but that's handled by the UI layer
    }

    /**
     * Phase 2: Gather attack-specific data (permissive weapon selection)
     */
    async gatherSpecificData() {
        // Auto-select weapon if none provided (including "no weapon" = unarmed)
        if (!this.selectedWeapon) {
            this.selectedWeapon = this.selectBestWeapon();
        }

        // Weapon data (null for unarmed)
        this.weaponData = this.selectedWeapon ? {
            id: this.selectedWeapon.id,
            name: this.selectedWeapon.name,
            damage: this.selectedWeapon.system.damage,
            weaponType: this.selectedWeapon.system.weaponType,
            size: this.selectedWeapon.system.size,
            attackPenalty: this.selectedWeapon.system.attackPenalty || 0,
            encumbrancePenalty: this.selectedWeapon.system.encumbrancePenalty || 0,
            breakageLevel: this.selectedWeapon.system.breakage?.level || 0
        } : null;

        // Determine attack type (unarmed if no weapon)
        this.attackType = this.attackType || this.weaponData?.weaponType || 'unarmed';

        // Combat stats from actor
        this.combatData = {
            attackValue: this.actorData.level || 1,
            attackBonus: this.actor.system.combat?.attack?.bonus || 0,
            archeryBonus: this.actor.system.combat?.archery?.bonus || 0,
            dualWieldBonus: this.calculateDualWieldBonus()
        };

        // Target data if available
        this.targetData = this.targetActor ? {
            id: this.targetActor.id,
            name: this.targetActor.name,
            defenseTotal: this.targetActor.system.defense?.total || 0
        } : null;

        // Soft checks (warnings, not blocks)
        if (this.selectedWeapon) {
            ActionValidation.checkWeaponCondition(this.selectedWeapon);
            ActionValidation.checkAmmo(this.actor, this.selectedWeapon);
        }

        // Record gathered data
        this.calculationTracker.recordInput('weapon', this.weaponData);
        this.calculationTracker.recordInput('attackType', this.attackType);
        this.calculationTracker.recordInput('combat', this.combatData);
        this.calculationTracker.recordInput('target', this.targetData);
    }

    /**
     * Phase 3: Perform attack calculations
     */
    async performCalculations() {
        // Build attack formula
        const formula = this.buildAttackFormula();
        const rollData = this.buildAttackRollData();

        // Make the attack roll
        const attackRoll = this.actor.createRoll(formula, rollData, 'attack');
        await attackRoll.evaluate();

        // Record the roll
        const rollResult = this.recordRoll('attack', formula, attackRoll, {
            weapon: this.weaponData?.name || 'unarmed',
            attackType: this.attackType
        });

        // Add base modifiers to tracking
        this.recordModifier('level', 'attack', this.combatData.attackValue, 'Base attack equals character level');

        if (this.combatData.attackBonus > 0) {
            this.recordModifier('combat_training', 'attack', this.combatData.attackBonus, 'Combat training bonus');
        }

        if (this.attackType === 'ranged' && this.combatData.archeryBonus > 0) {
            this.recordModifier('archery', 'attack', this.combatData.archeryBonus, 'Archery training bonus');
        }

        if (this.combatData.dualWieldBonus > 0) {
            this.recordModifier('dual_wield', 'attack', this.combatData.dualWieldBonus, 'Dual wielding bonus');
        }

        if (this.weaponData?.attackPenalty > 0) {
            this.recordModifier('weapon_penalty', 'attack', -this.weaponData.attackPenalty, `${this.weaponData.name} is difficult to wield`);
        }

        if (this.weaponData?.breakageLevel > 0) {
            this.recordModifier('weapon_damage', 'attack', -this.weaponData.breakageLevel, `${this.weaponData.name} is damaged`);
        }

        // Store results for use in other phases
        this.attackTotal = attackRoll.total;
        this.attackRollResult = rollResult;

        // Check for special dice results
        this.checkForSpecialResults(attackRoll);
    }

    /**
     * Phase 6: Apply attack-specific state changes
     */
    async applyStateChanges() {
        // Consume ammunition if ranged attack
        if (this.weaponData?.weaponType === 'ranged') {
            this.queueAmmoConsumption();
        }

        // Handle weapon breakage on snake eyes
        if (this.attackRollResult.dice.length === 2 &&
            this.attackRollResult.dice.every(d => d === 1)) {
            this.queueWeaponBreakage();
        }

        // Apply any queued changes
        await super.applyStateChanges();
    }

    // === Helper Methods ===

    selectBestWeapon() {
        const equippedWeapons = this.actor.items.filter(i =>
            i.type === "weapon" && i.system.equipped
        );

        // No weapons? That's fine - unarmed attack
        if (equippedWeapons.length === 0) return null;

        // One weapon? Use it
        if (equippedWeapons.length === 1) return equippedWeapons[0];

        // Multiple weapons? Pick the best one (simple priority system)
        const sizePriority = { heavy: 3, medium: 2, light: 1 };

        return equippedWeapons.reduce((best, current) => {
            const bestPriority = sizePriority[best.system.size] || 1;
            const currentPriority = sizePriority[current.system.size] || 1;
            return currentPriority > bestPriority ? current : best;
        });
    }

    calculateDualWieldBonus() {
        const equippedWeapons = this.actor.items.filter(i =>
            i.type === "weapon" && i.system.equipped
        );
        const equippedShields = this.actor.items.filter(i =>
            i.type === "shield" && i.system.equipped
        );

        return (equippedWeapons.length === 2 && equippedShields.length === 0) ? 1 : 0;
    }

    buildAttackFormula() {
        let formula = "2d6 + @attack + @bonus";

        if (this.attackType === 'ranged') {
            formula += " + @archery";
        }

        if (this.combatData.dualWieldBonus > 0) {
            formula += " + @dual";
        }

        if (this.weaponData?.attackPenalty > 0) {
            formula += " - @weaponPenalty";
        }

        if (this.weaponData?.breakageLevel > 0) {
            formula += " - @breakage";
        }

        return formula;
    }

    buildAttackRollData() {
        return {
            attack: this.combatData.attackValue,
            bonus: this.combatData.attackBonus,
            archery: this.attackType === 'ranged' ? this.combatData.archeryBonus : 0,
            dual: this.combatData.dualWieldBonus,
            weaponPenalty: this.weaponData?.attackPenalty || 0,
            breakage: this.weaponData?.breakageLevel || 0
        };
    }

    checkForSpecialResults(roll) {
        const dice = this.extractDiceResults(roll);

        if (dice.length === 2) {
            if (dice[0] === dice[1]) {
                if (dice[0] === 6) {
                    this.recordSpecialEffect("Critical Hit", "Target must make Trauma Save");
                } else if (dice[0] === 1) {
                    this.recordSpecialEffect("Snake Eyes", "Weapon may break");
                } else {
                    this.checkForFeatureEffects(dice[0]);
                }
            }
        }
    }

    checkForFeatureEffects(doubleValue) {
        const activeFeatures = this.actorData.features;

        if (activeFeatures.includes('Tricky')) {
            this.recordSpecialEffect("Tricky", "You may attempt a free Combat Maneuver");
        }

        if (activeFeatures.includes('Superior Combatant')) {
            this.recordSpecialEffect("Superior Combatant", "Doubles count as critical hits");
        }
    }

    recordSpecialEffect(effectName, description) {
        if (!this.specialEffects) {
            this.specialEffects = [];
        }
        this.specialEffects.push({ name: effectName, description });
    }

    queueAmmoConsumption() {
        // Find appropriate ammo and consume 1
        const ammo = this.findAmmoForWeapon(this.weaponData);
        if (ammo && ammo.system.quantity > 0) {
            this.queueStateChange(
                `items.${ammo.id}.system.quantity`,
                ammo.system.quantity - 1,
                `Fired ${this.weaponData.name}`
            );
        }
    }

    queueWeaponBreakage() {
        if (this.weaponData) {
            const currentBreakage = this.weaponData.breakageLevel;
            const maxBreakage = this.selectedWeapon.system.breakage?.maxLevel || 2;

            if (currentBreakage < maxBreakage) {
                this.queueStateChange(
                    `items.${this.weaponData.id}.system.breakage.level`,
                    currentBreakage + 1,
                    'Snake eyes rolled on attack'
                );
            }
        }
    }

    findAmmoForWeapon(weaponData) {
        const weaponType = weaponData.weaponType;
        let ammoNames = [];

        switch (weaponType) {
            case 'bow':
                ammoNames = ['arrows', 'arrow'];
                break;
            case 'crossbow':
                ammoNames = ['bolts', 'bolt', 'crossbow bolts'];
                break;
            case 'pistol':
            case 'rifle':
            case 'shotgun':
                ammoNames = ['bullets', 'ammunition', 'rounds'];
                break;
        }

        return this.actor.items.find(i =>
            i.type === "gear" &&
            ammoNames.some(name => i.name.toLowerCase().includes(name)) &&
            (i.system.quantity || 0) > 0
        );
    }

    // === ActionDocument Overrides ===

    determineSuccess() {
        if (!this.targetData) {
            return null; // No target to hit
        }

        return this.attackTotal >= this.targetData.defenseTotal;
    }

    getPrimaryOutcome() {
        const weaponName = this.weaponData?.name || 'Unarmed Attack';

        if (!this.targetData) {
            return `${weaponName}: ${this.attackTotal}`;
        }

        const success = this.determineSuccess();
        const hitMiss = success ? 'HIT' : 'MISS';
        return `${weaponName}: ${this.attackTotal} vs ${this.targetData.defenseTotal} - ${hitMiss}`;
    }

    getSecondaryEffects() {
        const effects = [];

        if (this.specialEffects) {
            effects.push(...this.specialEffects.map(e => `${e.name}: ${e.description}`));
        }

        if (this.weaponData?.weaponType === 'ranged') {
            const reload = this.selectedWeapon.system.reload;
            if (reload && this.attackRollResult.dice.some(d => d <= reload)) {
                effects.push(`Reload required (rolled ${reload} or lower)`);
            }
        }

        return effects;
    }

    getInteractionHandlers() {
        const handlers = new Map();

        // Always offer damage roll if we have a weapon
        if (this.weaponData && this.weaponData.damage !== "0") {
            handlers.set('damage', 'rollDamage');
        }

        // Offer trauma save button on critical hits
        const hasCritical = this.specialEffects?.some(e => e.name === 'Critical Hit');
        if (hasCritical && this.targetData) {
            handlers.set('trauma', 'rollTraumaSave');
        }

        // Offer reroll if certain features are active
        const canReroll = this.actorData.features.includes('Lucky') ||
                         this.actorData.features.includes('Fast Talker');
        if (canReroll) {
            handlers.set('reroll', 'rerollAttack');
        }

        return handlers;
    }
}
