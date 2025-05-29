/**
 * Roll functionality for GLOG 2d6 actors
 */
import { findBestWeapon } from "../utils/actor-analysis.mjs"
export class ActorRolls {
    constructor(actor) {
        this.actor = actor;
    }

    // Attribute rolls
    async rollAttribute(attributeKey, targetNumber = 7) {
        const attribute = this.actor.system.attributes[attributeKey];

        // Determine context based on attribute
        let context = 'attribute';
        if (attributeKey === 'str') context = 'strength';
        if (attributeKey === 'cha') context = 'social';

        const roll = this.actor.createRoll("2d6 + @mod", { mod: attribute.mod }, context);
        await roll.evaluate();

        this.actor._createRollChatMessage(
            `${this.actor.name} - ${attributeKey.toUpperCase()} Check`,
            roll
        );

        return roll;
    }

    async rollSave(attributeKey) {
        const attribute = this.actor.system.attributes[attributeKey];

        // Get save-specific bonuses (like from Intellect Fortress)
        let saveBonus = 0;
        if (this.actor.system.saves?.[attributeKey]?.bonus) {
            saveBonus = this.actor.system.saves[attributeKey].bonus;
        }

        // Determine context based on attribute
        let context = 'save';
        if (attributeKey === 'str') context = 'strength';
        if (attributeKey === 'cha') context = 'social';

        const roll = this.actor.createRoll("2d6 + @mod + @saveBonus", {
            mod: attribute.mod,
            saveBonus: saveBonus
        }, context);
        await roll.evaluate();

        const success = roll.total >= 10;

        let extraContent = `
        <br><strong>Target:</strong> 10
        <br><strong>Result:</strong> ${success ? "Success" : "Failure"}
    `;

        // Show save bonus breakdown if present
        if (saveBonus > 0) {
            extraContent += `<br><small>Save bonus: +${saveBonus}</small>`;

            // Show breakdown if available
            const breakdown = this.actor.system.saves?.[attributeKey]?.breakdown;
            if (breakdown && breakdown.length > 0) {
                const sources = breakdown.map(b => `${b.source}: +${b.value}`).join(', ');
                extraContent += `<br><small>Bonus from: ${sources}</small>`;
            }
        }

        this.actor._createRollChatMessage(
            `${this.actor.name} - ${attributeKey.toUpperCase()} Save`,
            roll,
            extraContent
        );

        return roll;
    }

    // Main attack method - handles all attack scenarios
    async rollAttack(weapon = null, attackType = null) {
        const attackData = this._buildAttackData(weapon, attackType);

        if (!attackData) {
            console.warn("Could not determine attack data");
            return;
        }

        const roll = this.actor.createRoll(attackData.formula, attackData.data, 'attack');
        await roll.evaluate();

        const extraContent = this._buildAttackChatContent(attackData);

        this.actor._createRollChatMessage(
            `${this.actor.name} - ${attackData.description}`,
            roll,
            extraContent
        );

        return roll;
    }

    // Specific weapon attack (now just calls main method)
    async rollWeaponAttack(weapon) {
        return this.rollAttack(weapon);
    }

    // Private helper: Build all attack data based on context
    _buildAttackData(weapon = null, attackType = null) {
        const baseStats = this._getBaseAttackStats();

        // Determine what we're attacking with
        const attackContext = this._determineAttackContext(weapon, attackType);
        if (!attackContext) return null;

        // Build the roll formula and data
        const formula = this._buildAttackFormula(attackContext, baseStats);
        const rollData = this._buildRollData(attackContext, baseStats);

        return {
            formula: formula,
            data: rollData,
            description: attackContext.description,
            weapon: attackContext.weapon,
            weaponType: attackContext.weaponType,
            damageFormula: attackContext.damageFormula,
            bonuses: attackContext.bonuses
        };
    }

    // Private helper: Get base attack stats (same for all attacks)
    _getBaseAttackStats() {
        return {
            strMod: this.actor.system.attributes.str.mod,
            atkValue: this.actor.system.combat.attack.value,
            atkBonus: this.actor.system.combat.attack.bonus || 0,
            archeryBonus: this.actor.system.combat.archery?.bonus || 0,
            dualWieldBonus: this._getDualWieldBonus()
        };
    }

    // Private helper: Figure out what kind of attack this is
    _determineAttackContext(weapon, attackType) {
        console.log("🎯 _determineAttackContext called with:", {
            weapon: weapon,
            weaponName: weapon?.name,
            weaponSystem: weapon?.system,
            attackType: attackType
        });

        if (weapon) {
            console.log("🎯 Taking weapon path");
            return this._getWeaponContext(weapon);
        }

        console.log("🎯 No specific weapon, analyzing equipped weapons");
        const equippedWeapons = this.actor.items.filter(i =>
            i && i.type === "weapon" && i.system && i.system.equipped
        );

        console.log("🎯 Found equipped weapons:", equippedWeapons.length);

        if (equippedWeapons.length === 0) {
            console.log("🎯 No equipped weapons, going unarmed");
            return this._getUnarmedContext(attackType || "melee");
        }

        // Use best equipped weapon
        const bestWeapon = findBestWeapon(equippedWeapons);
        return this._getWeaponContext(bestWeapon);
    }

    // Private helper: Get weapon-specific attack context
    _getWeaponContext(weapon) {
        console.log(weapon);
        const weaponType = weapon.system.weaponType || "melee";
        const penalty = weapon.system.attackPenalty || 0;

        return {
            weapon: weapon,
            weaponType: weaponType,
            description: `${weapon.name} Attack (${weaponType})`,
            damageFormula: weapon.system.damage || "0",
            bonuses: {
                penalty: penalty,
                useStr: weaponType === "melee" || weaponType === "thrown",
                useArchery: weaponType === "ranged"
            }
        };
    }

    // Private helper: Get unarmed attack context
    _getUnarmedContext(attackType) {
        if (!attackType) {
            // Need to prompt for attack type - this could be handled by the sheet
            console.warn("Unarmed attack requires attack type specification");
            return null;
        }

        return {
            weapon: null,
            weaponType: attackType,
            description: attackType === "melee" ? "Unarmed Attack" : "Ranged Attack",
            damageFormula: "0",
            bonuses: {
                penalty: 0,
                useStr: attackType === "melee",
                useArchery: false
            }
        };
    }

    // Private helper: Build the dice formula string
    _buildAttackFormula(context, baseStats) {
        let formula = "2d6 + @atk + @bonus + @dual";

        if (context.bonuses.useStr) {
            formula += " + @str";
        }

        if (context.bonuses.useArchery) {
            formula += " + @archery";
        }

        if (context.bonuses.penalty > 0) {
            formula += " - @penalty";
        }

        return formula;
    }

    // Private helper: Build roll data object
    _buildRollData(context, baseStats) {
        const data = {
            atk: baseStats.atkValue,
            bonus: baseStats.atkBonus,
            dual: baseStats.dualWieldBonus,
            str: context.bonuses.useStr ? baseStats.strMod : 0,
            archery: context.bonuses.useArchery ? baseStats.archeryBonus : 0,
            penalty: context.bonuses.penalty || 0
        };

        return data;
    }

    // Private helper: Build chat message content
    _buildAttackChatContent(attackData) {
        const parts = [];

        // Dual wield bonus
        if (attackData.data.dual > 0) {
            parts.push(`<br><small>Dual wielding: +${attackData.data.dual}</small>`);
        }

        // Attack bonus breakdown
        if (attackData.data.bonus > 0) {
            parts.push(`<br><small>Attack bonus: +${attackData.data.bonus}</small>`);
        }

        // Archery bonus
        if (attackData.data.archery > 0) {
            parts.push(`<br><small>Archery bonus: +${attackData.data.archery}</small>`);
        }

        // Damage info
        const damageText = attackData.damageFormula === "0" ? "Base damage only" :
            `${attackData.damageFormula} + base damage`;
        parts.push(`<br><small>Damage: ${damageText}</small>`);

        // Damage button
        if (attackData.weapon) {
            const damageButton = `<button type="button" class="damage-roll-btn" data-actor-id="${this.actor.id}" data-weapon-id="${attackData.weapon.id}" data-attack-result="{{roll.total}}">Roll Damage</button>`;
            parts.push(`<br>${damageButton}`);
        }

        return parts.join('');
    }

    // Private helper: Check for dual wielding bonus
    _getDualWieldBonus() {
        const equippedWeapons = this.actor.items.filter(i => i.type === "weapon" && i.system.equipped);
        const equippedShields = this.actor.items.filter(i => i.type === "shield" && i.system.equipped);

        return (equippedWeapons.length === 2 && equippedShields.length === 0) ? 1 : 0;
    }

    // Defense rolls - separate melee and ranged
    async rollMeleeDefense() {
        const defense = this.actor.system.defense?.meleeTotal || 0;
        const roll = this.actor.createRoll("2d6 + @def", { def: defense }, 'defense');
        await roll.evaluate();

        const extraContent = this.actor.system.defense ?
            `<br><small>Armor: +${this.actor.system.defense.armor}, Dex: +${this.actor.system.defense.dexBonus}, Melee: +${this.actor.system.defense.meleeBonus}</small>` : '';

        this.actor._createRollChatMessage(
            `${this.actor.name} - Melee Defense`,
            roll,
            extraContent
        );

        return roll;
    }

    async rollRangedDefense() {
        const defense = this.actor.system.defense?.rangedTotal || 0;
        const roll = this.actor.createRoll("2d6 + @def", { def: defense }, 'defense');
        await roll.evaluate();

        const extraContent = this.actor.system.defense ?
            `<br><small>Armor: +${this.actor.system.defense.armor}, Dex: +${this.actor.system.defense.dexBonus}, Ranged: +${this.actor.system.defense.rangedBonus}</small>` : '';

        this.actor._createRollChatMessage(
            `${this.actor.name} - Ranged Defense`,
            roll,
            extraContent
        );

        return roll;
    }

    async rollDefense() {
        const defense = this.actor.system.defense?.total || 0;
        const roll = this.actor.createRoll("2d6 + @def", { def: defense }, 'defense');
        await roll.evaluate();

        const extraContent = this.actor.system.defense ?
            `<br><small>Armor: +${this.actor.system.defense.armor}, Dex: +${this.actor.system.defense.dexBonus}</small>` : '';

        this.actor._createRollChatMessage(
            `${this.actor.name} - Defense`,
            roll,
            extraContent
        );

        return roll;
    }

    async rollMovement() {
        const movement = this.actor.system.details.effectiveMovement || this.actor.system.details.movement;
        const roll = this.actor.createRoll("2d6 + @move", { move: movement }, 'movement');
        await roll.evaluate();

        this.actor._createRollChatMessage(
            `${this.actor.name} - Movement`,
            roll
        );

        return roll;
    }

    async rollWeaponDamage(weapon, attackResult, defenseResult = null) {
        const strMod = this.actor.system.attributes.str.mod;
        const weaponType = weapon.system.weaponType || "melee";

        // Calculate base damage (attack - defense + str for melee)
        let baseDamage = 0;
        if (defenseResult !== null) {
            baseDamage = Math.max(0, attackResult - defenseResult);
            if (weaponType === "melee" || weaponType === "thrown") {
                baseDamage += strMod;
            }
        }

        // Roll weapon damage
        const weaponDamage = weapon.system.damage || "0";

        if (weaponDamage === "0" || weaponDamage === "") {
            // No weapon damage, just show base damage
            const extraContent = `
                <br><strong>Base Damage:</strong> ${baseDamage}
                ${defenseResult === null ? '<br><small>Note: Base damage assumes hit vs defense</small>' : ''}
            `;

            // Create a "fake" roll just for display purposes
            const displayRoll = new Roll("0 + @base", { base: baseDamage });
            await displayRoll.evaluate();

            this.actor._createRollChatMessage(
                `${this.actor.name} - ${weapon.name} Damage`,
                displayRoll,
                extraContent
            );

            return baseDamage;
        } else {
            // Roll weapon damage and add base damage
            const damageRoll = new Roll(`${weaponDamage} + @base`, { base: baseDamage });
            await damageRoll.evaluate();

            const extraContent = `
                <br><strong>Weapon Damage:</strong> ${weaponDamage}
                <br><strong>Base Damage:</strong> ${baseDamage}
                ${defenseResult === null ? '<br><small>Note: Base damage assumes hit vs defense</small>' : ''}
            `;

            this.actor._createRollChatMessage(
                `${this.actor.name} - ${weapon.name} Damage`,
                damageRoll,
                extraContent
            );

            return damageRoll.total;
        }
    }

    // Stealth rolls
    async rollSneak() {
        const dexMod = this.actor.system.attributes.dex.effectiveMod;
        const stealthBonus = this.actor.system.skills?.stealth?.bonus || 0;
        const roll = this.actor.createRoll("2d6 + @dex + @stealth", {
            dex: dexMod,
            stealth: stealthBonus
        }, 'stealth');
        await roll.evaluate();

        let extraContent = '';
        if (stealthBonus > 0) {
            extraContent = `<br><small>Stealth bonus: +${stealthBonus}</small>`;
        }

        this.actor._createRollChatMessage(
            `${this.actor.name} - Sneak`,
            roll,
            extraContent
        );

        return roll;
    }

    async rollHide() {
        const wisMod = this.actor.system.attributes.wis.effectiveMod;
        const stealthBonus = this.actor.system.skills?.stealth?.bonus || 0;
        const roll = this.actor.createRoll("2d6 + @wis + @stealth", {
            wis: wisMod,
            stealth: stealthBonus
        }, 'stealth');
        await roll.evaluate();

        let extraContent = '';
        if (stealthBonus > 0) {
            extraContent = `<br><small>Stealth bonus: +${stealthBonus}</small>`;
        }

        this.actor._createRollChatMessage(
            `${this.actor.name} - Hide`,
            roll,
            extraContent
        );

        return roll;
    }

    async rollDisguise() {
        const intMod = this.actor.system.attributes.int.effectiveMod;
        const stealthBonus = this.actor.system.skills?.stealth?.bonus || 0;
        const roll = this.actor.createRoll("2d6 + @int + @stealth", {
            int: intMod,
            stealth: stealthBonus
        }, 'stealth');
        await roll.evaluate();

        let extraContent = '';
        if (stealthBonus > 0) {
            extraContent = `<br><small>Stealth bonus: +${stealthBonus}</small>`;
        }

        this.actor._createRollChatMessage(
            `${this.actor.name} - Disguise`,
            roll,
            extraContent
        );

        return roll;
    }

    // social rolls
    async rollReaction() {
        const reactionBonus = this.actor.system.skills?.reaction?.bonus || 0;
        const roll = this.actor.createRoll("2d6 + @reaction", {
            reaction: reactionBonus
        }, 'social');
        await roll.evaluate();

        let extraContent = '';
        if (reactionBonus > 0) {
            extraContent = `<br><small>Reaction bonus: +${reactionBonus}</small>`;
        }

        this.actor._createRollChatMessage(
            `${this.actor.name} - Reaction`,
            roll,
            extraContent
        );

        return roll;
    }

    async rollDiplomacy() {
        const chaMod = this.actor.system.attributes.cha.effectiveMod;
        const roll = this.actor.createRoll("2d6 + @cha", { cha: chaMod }, 'social');
        await roll.evaluate();

        this.actor._createRollChatMessage(
            `${this.actor.name} - Diplomacy`,
            roll
        );

        return roll;
    }

    async rollIntimidate() {
        const chaMod = this.actor.system.attributes.cha.effectiveMod;
        const roll = this.actor.createRoll("2d6 + @cha", { cha: chaMod }, 'social');
        await roll.evaluate();

        this.actor._createRollChatMessage(
            `${this.actor.name} - Intimidate`,
            roll
        );

        return roll;
    }

    // Trauma system (placeholder)
    async rollTraumaSave(reason = "Critical Hit") {
        ui.notifications.warn(`${this.actor.name} needs to make a Trauma Save (${reason}) - System not yet implemented!`);

        // TODO: Implement trauma save mechanics
        // - Roll 2d6 + Con modifier?
        // - Target number based on current wounds?
        // - Apply trauma effects on failure

        console.log(`TODO: Implement trauma save for ${this.actor.name} due to ${reason}`);
    }
}
