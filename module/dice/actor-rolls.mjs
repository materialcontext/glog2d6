/**
 * Roll functionality for GLOG 2d6 actors
 */
import { findBestWeapon } from "../utils/actor-analysis.mjs"
import { hasWeaponType, getWeaponTypes } from '../utils/weapon-utils.mjs';
import { CONTEST } from "../systems/contest.mjs";
import { applyDamageButton, contestAgainst, contestLine, damageButton, fumbleBreakage, opponentActor } from "../systems/contest-flow.mjs";
import { actorRef } from "../systems/actor-ref.mjs";
export class ActorRolls {
    constructor(actor) {
        this.actor = actor;
    }

    // Attribute rolls
    async rollAttribute(attributeKey, _targetNumber = 7) {
        const attribute = this.actor.system.attributes[attributeKey];

        // Determine context based on attribute
        const contextMap = {
            str: 'strength',
            dex: 'dexterity',
            con: 'constitution',
            int: 'intellect',
            wis: 'wisdom',
            cha: 'social'
        };
        const context = contextMap[attributeKey] ?? 'attribute';

        const roll = this.actor.createRoll("2d6 + @mod", { mod: attribute.mod }, context);
        await roll.evaluate();

        let extraContent = '';
        if (attribute.mod !== 0) {
            extraContent = `<br><small>${attributeKey.toUpperCase()}: ${attribute.mod >= 0 ? '+' : ''}${attribute.mod}</small>`;
        }

        this.actor._createRollChatMessage(`${this.actor.name} - ${attributeKey.toUpperCase()} Check`, roll, extraContent, context);

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
        const context = 'save';

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
            extraContent,
            context
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

        // Against a target, the roll is half of a contest; against nobody it
        // is what it has always been -- a number the GM reads.
        const contest = contestAgainst({
            mode: CONTEST.ATTACK,
            actor: this.actor,
            roll,
            weaponType: attackData.weaponType,
            strMod: this.actor.system.attributes.str.mod
        });

        // A fumble costs the weapon a step, whoever has to write it.
        await fumbleBreakage(contest);

        const extraContent = this._buildAttackChatContent(attackData, roll, contest);

        this.actor._createRollChatMessage(
            `${this.actor.name} - ${attackData.description}`,
            roll,
            extraContent,
            'attack'
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
            firearmBonus: this.actor.system.combat.firearm?.bonus || 0,
            explosiveBonus: this.actor.system.combat.explosive?.bonus || 0,
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
        const penalty = weapon.system.attackPenalty || 0;
        const isThrown = hasWeaponType(weapon, "thrown");
        const isMelee = hasWeaponType(weapon, "melee");
        const isRanged = hasWeaponType(weapon, "ranged");
        const isFirearm = hasWeaponType(weapon, "firearm");
        const isExplosive = hasWeaponType(weapon, "explosive");
        const primaryType = getWeaponTypes(weapon)[0];

        return {
            weapon: weapon,
            weaponType: primaryType,
            description: `${weapon.name} Attack (${primaryType})`,
            damageFormula: weapon.system.damage || "0",
            bonuses: {
                penalty: penalty,
                useStr: isMelee || (isThrown && !isExplosive),
                useArchery: isRanged,
                useFirearm: isFirearm,
                useExplosive: isExplosive
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

        if (context.bonuses.useArchery) {
            formula += " + @archery";
        }

        if (context.bonuses.useFirearm) {
            formula += " + @firearm";
        }

        if (context.bonuses.useExplosive) {
            formula += " + @explosive";
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
            archery: context.bonuses.useArchery ? baseStats.archeryBonus : 0,
            firearm: context.bonuses.useFirearm ? baseStats.firearmBonus : 0,
            explosive: context.bonuses.useExplosive ? baseStats.explosiveBonus : 0,
            penalty: context.bonuses.penalty || 0
        };

        return data;
    }

    // Private helper: Build chat message content
    _buildAttackChatContent(attackData, roll, contest = null) {
        const bonuses = [
            { key: 'atk', label: 'Base attack', value: attackData.data.atk },
            { key: 'bonus', label: 'Attack bonus', value: attackData.data.bonus },
            { key: 'dual', label: 'Dual wielding', value: attackData.data.dual },
            { key: 'archery', label: 'Archery bonus', value: attackData.data.archery },
            { key: 'firearm', label: 'Firearm bonus', value: attackData.data.firearm }
        ].filter(b => b.value > 0)
            .map(b => `${b.label}: +${b.value}`)
            .join(', ');

        const parts = [];
        if (bonuses) parts.push(`<br><small>${bonuses}</small>`);

        // Damage and buttons
        const damageText = attackData.damageFormula === "0" ? "Base damage only" :
            `${attackData.damageFormula} + base damage`;
        parts.push(`<br><small>Damage: ${damageText}</small>`);

        if (contest) {
            parts.push(contestLine(contest));
            parts.push(damageButton(contest, { attacker: actorRef(this.actor), weaponId: attackData.weapon?.id }));
            if (contest.fumble && attackData.weapon) {
                parts.push(`<br><small class="text-danger">${attackData.weapon.name} takes a step on the breakage track.</small>`);
            }
        } else if (attackData.weapon) {
            // No target: the old behaviour, where the GM decides what it beat.
            parts.push(`<br><button type="button" class="damage-roll-btn" data-attacker="${actorRef(this.actor)}" data-weapon-id="${attackData.weapon.id}" data-base-damage="0">Roll Damage</button>`);
        }

        // reload
        if (attackData.weapon?.system.reload) {
            const hasReload = roll.total <= attackData.weapon.system.reload;

            if (hasReload) {
                parts.push(`<br><div class="reload-notice text-danger"><strong>OUT OF AMMO!</strong> Rolled ${attackData.weapon.system.reload} or lower</div>`);
            }
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
        return this._rollDefense({ stat: "meleeTotal", title: "Melee Defense", against: "melee", extra: ["Melee", "meleeBonus"] });
    }

    async rollRangedDefense() {
        return this._rollDefense({ stat: "rangedTotal", title: "Ranged Defense", against: "ranged", extra: ["Ranged", "rangedBonus"] });
    }

    async rollDefense() {
        return this._rollDefense({ stat: "total", title: "Defense", against: "melee" });
    }

    /**
     * Defending is the same contest an attack is, rolled from the other end:
     * the defender rolls and the attacker stands on seven plus what they would
     * have added. With nobody targeted it stays the bare roll it always was.
     */
    async _rollDefense({ stat, title, against, extra = null }) {
        const defense = this.actor.system.defense?.[stat] || 0;
        const roll = this.actor.createRoll("2d6 + @def", { def: defense }, 'defense');
        await roll.evaluate();

        const attacker = this._attackerContext();
        const contest = contestAgainst({
            mode: CONTEST.DEFENSE,
            actor: this.actor,
            roll,
            weaponType: attacker?.weaponType ?? against,
            strMod: attacker?.strMod ?? 0,
            attackData: attacker?.data ?? null
        });

        const parts = [];
        const breakdown = this.actor.system.defense;
        if (breakdown) {
            const extraBonus = extra ? `, ${extra[0]}: +${breakdown[extra[1]] ?? 0}` : "";
            parts.push(`<br><small>Armor: +${breakdown.armor}, Dex: +${breakdown.dexBonus}${extraBonus}</small>`);
        }
        if (contest) {
            parts.push(contestLine(contest));
            parts.push(damageButton(contest, {
                attacker: actorRef(contest.attacker),
                weaponId: attacker?.weapon?.id
            }));
            // The fumbling weapon is the attacker's, which this client may
            // have no business editing -- fumbleBreakage asks the GM.
            await fumbleBreakage(contest);
        }

        this.actor._createRollChatMessage(`${this.actor.name} - ${title}`, roll, parts.join(''), 'defense');

        return roll;
    }

    /**
     * What the targeted attacker brings to the contest. Read through their own
     * roll builder rather than a second copy of it, so a defender is measured
     * against exactly the attack that actor would have rolled.
     */
    _attackerContext() {
        const attacker = opponentActor(this.actor);
        if (!attacker?.rolls) return null;

        const attackData = attacker.rolls._buildAttackData();
        if (!attackData) return null;

        return {
            data: attackData.data,
            weapon: attackData.weapon,
            weaponType: attackData.weaponType,
            strMod: attacker.system.attributes?.str?.mod ?? 0
        };
    }

    async rollMovement() {
        const movement = this.actor.system.details.effectiveMovement || this.actor.system.details.movement;
        const roll = this.actor.createRoll("1d6 + @move", { move: movement }, 'movement');
        await roll.evaluate();

        const diceResult = roll.terms[0].results[0].result;
        const rollDisplayOverride = `[${movement}, ${diceResult}]`;

        this.actor._createRollChatMessage(`${this.actor.name} - Movement`, roll, '', 'movement', { rollDisplayOverride });
        return roll;
    }

    /**
     * Roll a weapon's damage on top of what the contest already earned.
     *
     * The base damage is the margin the contest was won by, worked out where
     * the contest was -- it is passed in rather than re-derived, because the
     * two ends of a contest arrive at it by different arithmetic.
     *
     * A critical hit doubles the weapon dice and is not subtracted from
     * anything: it puts them on the floor, and the doubled die is what the
     * wound is rolled on.
     */
    async rollWeaponDamage(weapon, baseDamage = 0, { crit = false, targetUuid = "" } = {}) {
        const base = Math.max(0, Math.floor(Number(baseDamage) || 0));
        const weaponDamage = weapon.system.damage || "0";
        const hasDice = weaponDamage !== "0" && weaponDamage !== "";

        const dice = hasDice ? new Roll(crit ? `2 * (${weaponDamage})` : weaponDamage) : null;
        if (dice) await dice.evaluate();

        const dieTotal = dice?.total ?? 0;
        const damageRoll = new Roll("@die + @base", { die: dieTotal, base });
        await damageRoll.evaluate();

        const parts = [
            hasDice ? `<br><strong>Weapon Damage:</strong> ${weaponDamage}${crit ? ' (doubled)' : ''} = ${dieTotal}` : '',
            `<br><strong>Base Damage:</strong> ${base}`,
            targetUuid ? '' : '<br><small>Note: base damage assumes a hit vs defense</small>',
            applyDamageButton({
                targetUuid,
                amount: damageRoll.total,
                dieTotal,
                crit,
                attacker: actorRef(this.actor),
                weaponId: weapon.id
            })
        ];

        this.actor._createRollChatMessage(
            `${this.actor.name} - ${weapon.name} Damage`,
            damageRoll,
            parts.join(''),
            'damage'
        );

        return damageRoll.total;
    }

    // Stealth rolls
    async rollSneak() {
        const dexMod = this.actor.system.attributes.dex.effectiveMod;
        const sneakBonus = this.actor.system.skills?.sneak?.bonus || 0;
        const roll = this.actor.createRoll("2d6 + @dex + @sneak", {
            dex: dexMod,
            sneak: sneakBonus
        }, 'stealth');
        await roll.evaluate();

        let extraContent = '';
        if (sneakBonus > 0) {
            extraContent = `<br><small>Sneak bonus: +${sneakBonus}</small>`;
        }

        this.actor._createRollChatMessage(
            `${this.actor.name} - Sneak`,
            roll,
            extraContent,
            'stealth'
        );

        return roll;
    }

    async rollHide() {
        const wisMod = this.actor.system.attributes.wis.effectiveMod;
        const hideBonus = this.actor.system.skills?.hide?.bonus || 0;
        const roll = this.actor.createRoll("2d6 + @wis + @hide", {
            wis: wisMod,
            hide: hideBonus
        }, 'stealth');
        await roll.evaluate();

        let extraContent = '';
        if (hideBonus > 0) {
            extraContent = `<br><small>Hide bonus: +${hideBonus}</small>`;
        }

        this.actor._createRollChatMessage(
            `${this.actor.name} - Hide`,
            roll,
            extraContent,
            'stealth'
        );

        return roll;
    }

    async rollDisguise() {
        const intMod = this.actor.system.attributes.int.effectiveMod;
        const disguiseBonus = this.actor.system.skills?.disguise?.bonus || 0;
        const roll = this.actor.createRoll("2d6 + @int + @stealth", {
            int: intMod,
            disguise: disguiseBonus
        }, 'stealth');
        await roll.evaluate();

        let extraContent = '';
        if (disguiseBonus > 0) {
            extraContent = `<br><small>Stealth bonus: +${disguiseBonus}</small>`;
        }

        this.actor._createRollChatMessage(
            `${this.actor.name} - Disguise`,
            roll,
            extraContent,
            'stealth'
        );

        return roll;
    }

    // social rolls
    async rollReaction() {
        const reactionBonus = this.actor.system.skills?.reaction?.bonus || 0;
        const roll = this.actor.createRoll("2d6 + @reaction", {
            reaction: reactionBonus
        }, 'reaction');
        await roll.evaluate();

        let extraContent = '';
        if (reactionBonus > 0) {
            extraContent = `<br><small>Reaction bonus: +${reactionBonus}</small>`;
        }

        this.actor._createRollChatMessage(
            `${this.actor.name} - Reaction`,
            roll,
            extraContent,
            'social'
        );

        return roll;
    }

    async rollDiplomacy() {
        const diplomacyBonus = this.actor.system.skills?.diplomacy?.bonus || 0;
        const chaMod = this.actor.system.attributes.cha.effectiveMod;
        const roll = this.actor.createRoll("2d6 + @cha", { cha: chaMod }, 'social');
        await roll.evaluate();

        let extraContent = '';
        if (diplomacyBonus > 0) {
            extraContent = `<br><small>Diplomacy bonus: +${diplomacyBonus}</small>`;
        }

        this.actor._createRollChatMessage(
            `${this.actor.name} - Diplomacy`,
            roll,
            extraContent,
            'social'
        );

        return roll;
    }

    async rollIntimidate() {
        const intimidateBonus = this.actor.system.skills?.intimidate?.bonus || 0;
        const chaMod = this.actor.system.attributes.cha.effectiveMod;
        const roll = this.actor.createRoll("2d6 + @cha", { cha: chaMod }, 'social');
        await roll.evaluate();

        let extraContent = '';
        if (intimidateBonus > 0) {
            extraContent = `<br><small>Intimidate bonus: +${intimidateBonus}</small>`;
        }

        this.actor._createRollChatMessage(
            `${this.actor.name} - Intimidate`,
            roll,
            extraContent,
            'social'
        );

        return roll;
    }
}
