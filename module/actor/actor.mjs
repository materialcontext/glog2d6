import { GLOG2D6Roll } from "../dice/glog-roll.mjs";
import { ActorRolls } from "../dice/actor-rolls.mjs";
import { BonusCalculator } from "../systems/bonus-calculator.mjs";
import { safely } from "../systems/safely.mjs";
import { updateTokenLighting } from "./handlers/torch-handlers.mjs";

export class GLOG2D6Actor extends Actor {
    constructor(data, context) {
        super(data, context);
        this.rolls = new ActorRolls(this);
        this._setupSafePublicMethods();
    }

    async _preCreate(data, options, user) {
        await super._preCreate(data, options, user);

        await this.updateSource({
            "flags.glog2d6.editMode": false
        });
    }

    _setupSafePublicMethods() {
        // Create safe public versions of risky methods
        this.analyzeEquippedWeapons = safely({
            fallback: { hasWeapons: false, attackButtonType: 'generic' },
            context: 'actor-weapon-analysis'
        })(this._analyzeEquippedWeapons.bind(this));

        this.hasFeature = safely.silent(false)(
            this._hasFeature.bind(this)
        );

        this.getClassTemplateCount = safely.silent(0)(
            this._getClassTemplateCount.bind(this)
        );
    }

    prepareData() {
        super.prepareData();
    }

    prepareBaseData() {
        // Calculate attribute modifiers
        for (let [_key, attribute] of Object.entries(this.system.attributes)) {
            if (attribute.value == 7) attribute.mod = 0
            if (attribute.value < 7) attribute.mod = Math.floor((8 - attribute.value) / 2) * -1;
            if (attribute.value > 7) attribute.mod = Math.floor((attribute.value - 6) / 2);
        }

        console.log("calculating inventory");
        // Calculate inventory slots for characters
        if (this.type === "character") {
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

            console.log("finalizing encumbrance");
            // Total encumbrance is the sum of slot overflow and equipment penalties
            this.system.inventory.encumbrance = slotEncumbrance + equipmentEncumbrance;
            this.system.inventory.slotEncumbrance = slotEncumbrance;
            this.system.inventory.equipmentEncumbrance = equipmentEncumbrance;

            console.log(`  Slots: ${usedSlots}/${maxSlots} (overflow: ${slotEncumbrance})`);
            console.log(`  Equipment penalties: ${equipmentEncumbrance}`);
            console.log(`  Total encumbrance: ${this.system.inventory.encumbrance}`);
        }

        if (this.type === "character") {
            const level = this.system.details.level || 1;

            // Ensure structure exists
            if (!this.system.combat) this.system.combat = {};
            if (!this.system.combat.attack) this.system.combat.attack = { value: 0, bonus: 0, breakdown: [] };

            this.system.combat.attack.value = level;

            console.log(`Attack calculation for ${this.name}: Base = ${level} (level)`);
        }
    }

    prepareDerivedData() {
        try {
            // Set effective modifiers for all attributes first
            for (let [_key, attribute] of Object.entries(this.system.attributes)) {
                attribute.effectiveMod = attribute.mod; // Default to original mod
                attribute.effectiveValue = attribute.value; // Default to original value
            }

            console.log("bonusing")
            // calculate bonuses
            if (this.type === "character") {
                this.bonusCalculator = new BonusCalculator(this);
                const bonuses = this.bonusCalculator.calculateBonuses();
                this._applyBonuses(bonuses);
            }

            console.log("adjusting for weight")
            // Apply encumbrance penalty to dexterity VALUE (not modifier)
            if (this.type === "character" && this.system.inventory.encumbrance > 0) {
                const dexAttribute = this.system.attributes.dex;
                const originalValue = dexAttribute.value;
                const encumbrancePenalty = this.system.inventory.encumbrance;

                // Reduce the effective dexterity VALUE by encumbrance
                const effectiveValue = Math.max(1, originalValue - encumbrancePenalty); // Don't go below 1
                dexAttribute.effectiveValue = effectiveValue;

                // Recalculate the modifier based on the new effective value
                if (effectiveValue == 7) dexAttribute.effectiveMod = 0;
                else if (effectiveValue < 7) dexAttribute.effectiveMod = Math.floor((8 - effectiveValue) / 2) * -1;
                else if (effectiveValue > 7) dexAttribute.effectiveMod = Math.floor((effectiveValue - 6) / 2);

                console.log(`Dex encumbrance applied: Value ${originalValue} -> ${effectiveValue}, Mod ${dexAttribute.mod} -> ${dexAttribute.effectiveMod}`);
            }

            // calculate effective movement, reduced by encumbrance on a 2:1 basis
            if (this.type === "character") {
                const baseMovement = this.system.details.movement;
                const movementBonus = this.system.details.movementBonus || 0;
                const encumbrance = this.system.inventory.encumbrance || 0;
                const movePenalty = Math.floor(encumbrance / 2);

                this.system.details.effectiveMovement = Math.max(0, baseMovement + movementBonus - movePenalty);

                if (movePenalty > 0 || movementBonus > 0) {
                    console.log(`Movement calculation: ${baseMovement} base + ${movementBonus} bonus - ${movePenalty} penalty = ${this.system.details.effectiveMovement}`);
                }
            }

            // Calculate defense value from armor and shields
            if (this.type === "character") {
                let armorBonus = 0;
                let armorEncumbrance = 0;

                // Find equipped armor
                const armor = this.items.find(item => item.type === "armor" && item.system.equipped);
                if (armor) {
                    armorBonus += armor.system.armorBonus;
                    armorEncumbrance += armor.system.encumbrancePenalty;
                }

                // Find equipped shields
                const shield = this.items.find(item => item.type === "shield" && item.system.equipped);
                if (shield) {
                    armorBonus += shield.system.armorBonus;
                }

                // Defense = Armor + Shield + Dex mod (use effective mod)
                const dexMod = this.system.attributes.dex.effectiveMod;
                const dexBonus = dexMod > 0 ? dexMod : 0;

                // Get melee/ranged bonuses from features (like Acrobat Training)
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
                    total: armorBonus + dexBonus, // Backwards compatibility
                    armorEncumbrance: armorEncumbrance
                };
            }
        } catch (error) {
            console.error("Error in prepareDerivedData for", this.name, ":", error);
        }
    }

    // Roll method delegations - add these to replace the deleted methods
    async rollAttribute(...args) {
        return this.rolls.rollAttribute(...args);
    }

    async rollSave(...args) {
        return this.rolls.rollSave(...args);
    }

    async rollAttack(...args) {
        return this.rolls.rollAttack(...args);
    }

    async rollWeaponAttack(...args) {
        return this.rolls.rollWeaponAttack(...args);
    }

    async rollDefense(...args) {
        return this.rolls.rollDefense(...args);
    }

    // Add these delegations with the other roll methods
    async rollMeleeDefense(...args) {
        return this.rolls.rollMeleeDefense(...args);
    }

    async rollRangedDefense(...args) {
        return this.rolls.rollRangedDefense(...args);
    }

    async rollMovement(...args) {
        return this.rolls.rollMovement(...args);
    }

    async rollWeaponDamage(...args) {
        return this.rolls.rollWeaponDamage(...args);
    }

    async rollSneak(...args) {
        return this.rolls.rollSneak(...args);
    }

    async rollHide(...args) {
        return this.rolls.rollHide(...args);
    }

    async rollDisguise(...args) {
        return this.rolls.rollDisguise(...args);
    }

    async rollReaction(...args) {
        return this.rolls.rollReaction(...args);
    }

    async rollDiplomacy(...args) {
        return this.rolls.rollDiplomacy(...args);
    }

    async rollIntimidate(...args) {
        return this.rolls.rollIntimidate(...args);
    }

    async rollTraumaSave(...args) {
        return this.rolls.rollTraumaSave(...args);
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
                // Store the bonus separately so we can show it in UI
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
                if (!this.system.details.movementBonus) this.system.details.movementBonus = 0;
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
                // Safe initialization
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

        updateTokenLighting(this, newState, newState ? activeTorch : null)

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

    async rest() {
        const updates = {};
        let restMessages = [];

        const recoverStat = (current, max, label, key) => {
            if (max > 0) {
                if (current < max) {
                    updates[key] = max;
                    restMessages.push(`Restored ${max - current} ${label} (${current} → ${max})`);
                    return max - current;
                } else {
                    restMessages.push(`${label} already at maximum`);
                }
            }
            return 0;
        };

        const hpRestored = recoverStat(this.system.hp.value, this.system.hp.max, "HP", "system.hp.value");
        const mdRestored = recoverStat(
            this.system.magicDiceCurrent || 0,
            this.system.magicDiceMax || 0,
            "Magic Dice",
            "system.magicDiceCurrent"
        );

        if (Object.keys(updates).length > 0) await this.update(updates);

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

        return { hpRestored, mdRestored, message: restSummary };
    }

    async castSpellWithDice(spell, diceCount) {
        const roll = new Roll(`${diceCount}d6`);
        await roll.evaluate();
        const results = roll.terms[0].results.map(r => r.result);

        const exhausted = results.filter(r => r >= 4).length;
        const returned = results.length - exhausted;
        const newCurrent = Math.max(0, this.system.magicDiceCurrent - exhausted);
        await this.update({ "system.magicDiceCurrent": newCurrent });

        ChatMessage.create({
            speaker: ChatMessage.getSpeaker({ actor: this }),
            content: `
        <div class="glog2d6-spell-result">
            <h3>${this.name} casts ${spell.name}!</h3>
            <div class="magic-dice-result">
                <strong>Magic Dice:</strong> [${results.join(', ')}] = ${roll.total}<br>
                <strong>Dice Exhausted:</strong> ${exhausted} (rolled 4-6)<br>
                <strong>Dice Returned:</strong> ${returned} (rolled 1-3)<br>
                <strong>Remaining MD:</strong> ${newCurrent}/${this.system.magicDiceMax}
            </div>
            <div class="spell-effect">
                <p><strong>Spell Effect:</strong> Use [dice] = ${diceCount} and [sum] = ${roll.total} in spell description</p>
            </div>
        </div>
    `,
            roll: roll
        });
    }

    _createRollChatMessage(title, roll, extraContent = '') {
        const parseRoll = () => {
            const parts = [];
            for (const term of roll.terms || []) {
                if (Array.isArray(term.results)) {
                    parts.push(`[${term.results.map(r => r.result).join(', ')}]`);
                } else if (term.number !== undefined && term.operator) {
                    parts.push(`${term.operator}${Math.abs(term.number)}`);
                }
            }
            return parts.join(' ') || roll.formula || roll.result;
        };

        const rollDisplay = parseRoll();
        const specialEffectsHtml = roll.specialEffects?.length
            ? `<div class="special-effects-notice"><i class="fas fa-star"></i> <em>${roll.specialEffects.join(', ')}</em></div>`
            : '';

        if (roll.isCriticalHit && title.includes("Attack")) {
            console.log(`${this.name} scored a critical hit - target should make trauma save`);
        }

        if (roll.isCriticalFailure && title.includes("Defense")) {
            setTimeout(() => this.rollTraumaSave("Critical Defense Failure"), 100);
        }

        return ChatMessage.create({
            speaker: ChatMessage.getSpeaker({ actor: this }),
            content: `9
          <div class="glog2d6-roll">
            <h3>${title}</h3>
            <div class="roll-result">
              <strong>Roll:</strong> ${rollDisplay}<br>
              <strong>Total:</strong> ${roll.total}
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

        // Determine primary weapon using our existing method
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
        if (rollContext === 'attack' && roll.isCriticalHit) {
            effects.push("CRITICAL HIT! Target must make a Trauma Save!");
            return effects;
        }

        if (rollContext === 'defense' && roll.isCriticalFailure) {
            effects.push("CRITICAL HIT! You must make a Trauma Save!");
            return effects;
        }

        if (!roll.hasDoubles || roll.isSnakeEyes) return [];

        const effects = [];
        const activeFeatures = this.items.filter(i =>
            i.type === "feature" && i.system.active
        );

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
                    if (rollContext === 'social') { // We'd need to add this context
                        effects.push("You may re-roll this social check");
                    }
                    break;

                case "Feats of Strength":
                    if (rollContext === 'strength') { // We'd need to add this context
                        effects.push("Double your Strength bonus for this roll");
                    }
                    break;
            }
        }

        return effects;
    }

}
