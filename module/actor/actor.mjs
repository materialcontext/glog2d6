import { GLOG2D6Roll } from "../dice/glog-roll.mjs";
import { ActorRolls } from "../dice/actor-rolls.mjs";

export class GLOG2D6Actor extends Actor {
    constructor(data, context) {
        super(data, context);
        this.rolls = new ActorRolls(this);
    }

    async _preCreate(data, options, user) {
        await super._preCreate(data, options, user);

        await this.updateSource({
            "flags.glog2d6.editMode": false
        });
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

            // FIXED: Calculate equipment-based encumbrance penalties
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

            console.log(`Encumbrance Debug - ${this.name}:`);
            console.log(`  Slots: ${usedSlots}/${maxSlots} (overflow: ${slotEncumbrance})`);
            console.log(`  Equipment penalties: ${equipmentEncumbrance}`);
            console.log(`  Total encumbrance: ${this.system.inventory.encumbrance}`);
        }
    }

    prepareDerivedData() {
        // Set effective modifiers for all attributes first
        for (let [key, attribute] of Object.entries(this.system.attributes)) {
            attribute.effectiveMod = attribute.mod; // Default to original mod
            attribute.effectiveValue = attribute.value; // Default to original value
        }

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

        // Calculate effective movement speed (reduced by encumbrance on 2:1 basis)
        if (this.type === "character") {
            const encumbrance = this.system.inventory.encumbrance || 0;
            const movePenalty = Math.floor(encumbrance / 2);
            this.system.details.effectiveMovement = Math.max(0, this.system.details.movement - movePenalty);

            if (movePenalty > 0) {
                console.log(`Movement penalty applied: ${this.system.details.movement} -> ${this.system.details.effectiveMovement} (encumbrance: ${encumbrance}, penalty: ${movePenalty})`);
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

            this.system.defense = {
                armor: armor?.system.armorBonus || 0,
                shield: shield?.system.armorBonus || 0,
                dexBonus: dexBonus,
                total: armorBonus + dexBonus,
                armorEncumbrance: armorEncumbrance
            };
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
                    color: "#ffbb77"
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

        // auto trigger critical
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
