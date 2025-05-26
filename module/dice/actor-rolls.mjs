/**
 * Roll functionality for GLOG 2d6 actors
 */
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

        // Determine context based on attribute
        let context = 'save';
        if (attributeKey === 'str') context = 'strength';
        if (attributeKey === 'cha') context = 'social';

        const roll = this.actor.createRoll("2d6 + @mod", { mod: attribute.mod }, context);
        await roll.evaluate();

        const success = roll.total >= 10;
        const extraContent = `
            <br><strong>Target:</strong> 10
            <br><strong>Result:</strong> ${success ? "Success" : "Failure"}
        `;

        this.actor._createRollChatMessage(
            `${this.actor.name} - ${attributeKey.toUpperCase()} Save`,
            roll,
            extraContent
        );

        return roll;
    }

    // Combat rolls
    async rollAttack(attackType = null) {
        const strMod = this.actor.system.attributes.str.mod;
        const atkValue = this.actor.system.combat.attack.value;
        const atkBonus = this.actor.system.combat.attack.bonus || 0;

        // Find equipped weapons
        const equippedWeapons = this.actor.items.filter(i => i.type === "weapon" && i.system.equipped);
        const bestWeapon = this.actor._getBestWeapon(equippedWeapons);

        let roll;
        let description;
        let dualWieldBonus = 0;

        // Check for dual wielding bonus (2 weapons, no shield)
        const equippedShields = this.actor.items.filter(i => i.type === "shield" && i.system.equipped);
        if (equippedWeapons.length === 2 && equippedShields.length === 0) {
            dualWieldBonus = 1;
        }

        if (bestWeapon) {
            // Use best weapon's properties
            const weaponType = bestWeapon.system.weaponType || "melee";
            const weaponPenalty = bestWeapon.system.attackPenalty || 0;

            let archeryBonus = 0;
            if (weaponType === "ranged") {
                archeryBonus = this.actor.system.combat.archery?.bonus || 0;
            }

            if (weaponType === "melee" || weaponType === "thrown") {
                roll = this.actor.createRoll("2d6 + @atk + @str - @penalty + @dual", {
                    atk: atkValue,
                    bonus: atkBonus,
                    str: strMod,
                    penalty: weaponPenalty,
                    dual: dualWieldBonus
                }, 'attack');
                description = `${bestWeapon.name} Attack (${weaponType})`;
            } else {
                roll = this.actor.createRoll("2d6 + @atk - @penalty + @dual", {
                    atk: atkValue,
                    bonus: atkBonus,
                    archery: archeryBonus,
                    penalty: weaponPenalty,
                    dual: dualWieldBonus
                }, 'attack');
                description = `${bestWeapon.name} Attack (ranged)`;
            }

            await roll.evaluate();

            // Create damage roll button
            const damageButton = `<button type="button" class="damage-roll-btn" data-actor-id="${this.actor.id}" data-weapon-id="${bestWeapon.id}" data-attack-result="${roll.total}">Roll Damage</button>`;

            let bonusText = '';
            if (atkBonus > 0) bonusText += `<br><small>Attack bonus: +${atkBonus}</small>`;
            if (archeryBonus > 0) bonusText += `<br><small>Archery bonus: +${archeryBonus}</small>`;

            const extraContent = `
            ${dualWieldBonus > 0 ? '<br><small>Dual wielding: +1</small>' : ''}
            ${bonusText}
            <br><small>Damage: ${bestWeapon.system.damage} + base damage</small>
            <br>${damageButton}
        `;

            this.actor._createRollChatMessage(
                `${this.actor.name} - ${description}`,
                roll,
                extraContent
            );
        } else {
            // No weapon equipped, prompt for attack type
            if (!attackType) {
                // This would be called from the dialog system
                return;
            }

            if (attackType === "melee") {
                roll = this.actor.createRoll("2d6 + @atk + @str + @dual", {
                    atk: atkValue,
                    str: strMod,
                    dual: dualWieldBonus
                }, 'attack');
                description = "Unarmed Attack";
            } else {
                roll = this.actor.createRoll("2d6 + @atk + @dual", {
                    atk: atkValue,
                    dual: dualWieldBonus
                }, 'attack');
                description = "Ranged Attack";
            }

            await roll.evaluate();

            const extraContent = `
                ${dualWieldBonus > 0 ? '<br><small>Dual wielding: +1</small>' : ''}
                <br><small>Damage: Base damage only</small>
            `;

            this.actor._createRollChatMessage(
                `${this.actor.name} - ${description}`,
                roll,
                extraContent
            );
        }

        return roll;
    }

    async rollWeaponAttack(weapon) {
        const strMod = this.actor.system.attributes.str.mod;
        const atkValue = this.actor.system.combat.attack.value;
        const atkBonus = this.actor.system.combat.attack.bonus || 0;
        const weaponPenalty = weapon.system.attackPenalty || 0;

        // Determine attack type
        const weaponType = weapon.system.weaponType || "melee";

        let roll;
        let description;

        if (weaponType === "melee" || weaponType === "thrown") {
            roll = this.actor.createRoll("2d6 + @atk + @str - @penalty", {
                atk: atkValue,
                bonus: atkBonus,
                str: strMod,
                penalty: weaponPenalty
            }, 'attack');
            description = `${weapon.name} Attack (${weaponType})`;
        } else {
            roll = this.actor.createRoll("2d6 + @atk - @penalty", {
                atk: atkValue,
                bonus: atkBonus,
                penalty: weaponPenalty
            }, 'attack');
            description = `${weapon.name} Attack (ranged)`;
        }

        await roll.evaluate();

        // Create damage roll button
        const damageButton = `<button type="button" class="damage-roll-btn" data-actor-id="${this.actor.id}" data-weapon-id="${weapon.id}" data-attack-result="${roll.total}">Roll Damage</button>`;

        const extraContent = `
            <br><small>Damage: ${weapon.system.damage} + base damage</small>
            <br>${damageButton}
        `;

        this.actor._createRollChatMessage(
            `${this.actor.name} - ${description}`,
            roll,
            extraContent
        );

        return roll;
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
