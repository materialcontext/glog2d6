export class GLOG2D6Actor extends Actor {

  prepareData() {
    super.prepareData();
  }

  prepareBaseData() {
    // Calculate attribute modifiers
    for (let [key, attribute] of Object.entries(this.system.attributes)) {
      if (attribute.value === 2) {
        attribute.mod = -3;
      } else {
        attribute.mod = Math.floor((attribute.value - 7) / 2);
      }
    }

    // Calculate inventory slots
    if (this.type === "character") {
      const strMod = this.system.attributes.str.mod;
      const conMod = this.system.attributes.con.mod;
      this.system.inventory.slots.max = 6 + Math.max(strMod, conMod);

      // Calculate encumbrance
      const usedSlots = this.system.inventory.slots.used;
      const maxSlots = this.system.inventory.slots.max;
      this.system.inventory.encumbrance = Math.max(0, usedSlots - maxSlots);
    }
  }

  prepareDerivedData() {
    // Apply encumbrance penalty to dexterity
    if (this.type === "character" && this.system.inventory.encumbrance > 0) {
      this.system.attributes.dex.effectiveMod =
        this.system.attributes.dex.mod - this.system.inventory.encumbrance;
    } else if (this.type === "character") {
      this.system.attributes.dex.effectiveMod = this.system.attributes.dex.mod;
    }

    // Calculate effective movement speed (reduced by encumbrance on 2:1 basis)
    if (this.type === "character") {
      const movePenalty = Math.floor(this.system.inventory.encumbrance / 2);
      this.system.details.effectiveMovement = Math.max(0, this.system.details.movement - movePenalty);
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

      // Defense = Armor + Shield + Dex mod (only if Dex mod > 0)
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

  async rollAttribute(attributeKey, targetNumber = 7) {
    const attribute = this.system.attributes[attributeKey];
    const roll = new Roll("2d6 + @mod", { mod: attribute.mod });
    await roll.evaluate();

    ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor: this }),
      content: `
        <div class="glog2d6-roll">
          <h3>${this.name} - ${attributeKey.toUpperCase()} Check</h3>
          <div class="roll-result">
            <strong>Roll:</strong> ${roll.result}
            <br><strong>Result:</strong> ${roll.total}
          </div>
        </div>
      `,
      roll: roll
    });

    return roll;
  }

  async rollSave(attributeKey) {
    const attribute = this.system.attributes[attributeKey];
    const roll = new Roll("2d6 + @mod", { mod: attribute.mod });
    await roll.evaluate();

    const success = roll.total >= 10;

    ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor: this }),
      content: `
        <div class="glog2d6-roll">
          <h3>${this.name} - ${attributeKey.toUpperCase()} Save</h3>
          <div class="roll-result">
            <strong>Roll:</strong> ${roll.result}
            <br><strong>Target:</strong> 10
            <br><strong>Result:</strong> ${success ? "Success" : "Failure"}
          </div>
        </div>
      `,
      roll: roll
    });

    return roll;
  }

  async rollAttack(attackType = null) {
    const strMod = this.system.attributes.str.mod;
    const atkValue = this.system.combat.attack.value;

    // Find equipped weapons
    const equippedWeapons = this.items.filter(i => i.type === "weapon" && i.system.equipped);
    const bestWeapon = this._getBestWeapon(equippedWeapons);

    let roll;
    let description;
    let dualWieldBonus = 0;

    // Check for dual wielding bonus (2 weapons, no shield)
    const equippedShields = this.items.filter(i => i.type === "shield" && i.system.equipped);
    if (equippedWeapons.length === 2 && equippedShields.length === 0) {
      dualWieldBonus = 1;
    }

    if (bestWeapon) {
      // Use best weapon's properties
      const weaponType = bestWeapon.system.weaponType || "melee";
      const weaponPenalty = bestWeapon.system.attackPenalty || 0;

      if (weaponType === "melee" || weaponType === "thrown") {
        roll = new Roll("2d6 + @atk + @str - @penalty + @dual", {
          atk: atkValue,
          str: strMod,
          penalty: weaponPenalty,
          dual: dualWieldBonus
        });
        description = `${bestWeapon.name} Attack (${weaponType})`;
      } else {
        roll = new Roll("2d6 + @atk - @penalty + @dual", {
          atk: atkValue,
          penalty: weaponPenalty,
          dual: dualWieldBonus
        });
        description = `${bestWeapon.name} Attack (ranged)`;
      }

      await roll.evaluate();

      // Create damage roll button
      const damageButton = `<button type="button" class="damage-roll-btn" data-actor-id="${this.id}" data-weapon-id="${bestWeapon.id}" data-attack-result="${roll.total}">Roll Damage</button>`;

      ChatMessage.create({
        speaker: ChatMessage.getSpeaker({ actor: this }),
        content: `
          <div class="glog2d6-roll">
            <h3>${this.name} - ${description}</h3>
            <div class="roll-result">
              <strong>Roll:</strong> ${roll.result}
              <br><strong>Result:</strong> ${roll.total}
              ${dualWieldBonus > 0 ? '<br><small>Dual wielding: +1</small>' : ''}
              <br><small>Damage: ${bestWeapon.system.damage} + base damage</small>
              <br>${damageButton}
            </div>
          </div>
        `,
        roll: roll
      });
    } else {
      // No weapon equipped, prompt for attack type
      if (!attackType) {
        // This would be called from the dialog system
        return;
      }

      if (attackType === "melee") {
        roll = new Roll("2d6 + @atk + @str + @dual", {
          atk: atkValue,
          str: strMod,
          dual: dualWieldBonus
        });
        description = "Unarmed Attack";
      } else {
        roll = new Roll("2d6 + @atk + @dual", {
          atk: atkValue,
          dual: dualWieldBonus
        });
        description = "Ranged Attack";
      }

      await roll.evaluate();

      ChatMessage.create({
        speaker: ChatMessage.getSpeaker({ actor: this }),
        content: `
          <div class="glog2d6-roll">
            <h3>${this.name} - ${description}</h3>
            <div class="roll-result">
              <strong>Roll:</strong> ${roll.result}
              <br><strong>Result:</strong> ${roll.total}
              ${dualWieldBonus > 0 ? '<br><small>Dual wielding: +1</small>' : ''}
              <br><small>Damage: Base damage only</small>
            </div>
          </div>
        `,
        roll: roll
      });
    }

    return roll;
  }

  _getBestWeapon(weapons) {
    if (weapons.length === 0) return null;
    if (weapons.length === 1) return weapons[0];

    // Priority: heavy > medium > light, then by damage approximation
    const priority = {heavy: 3, medium: 2, light: 1};

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

  async rollWeaponAttack(weapon) {
    const strMod = this.system.attributes.str.mod;
    const atkValue = this.system.combat.attack.value;
    const weaponPenalty = weapon.system.attackPenalty || 0;

    // Determine attack type
    const weaponType = weapon.system.weaponType || "melee";

    let roll;
    let description;

    if (weaponType === "melee" || weaponType === "thrown") {
      roll = new Roll("2d6 + @atk + @str - @penalty", {
        atk: atkValue,
        str: strMod,
        penalty: weaponPenalty
      });
      description = `${weapon.name} Attack (${weaponType})`;
    } else {
      roll = new Roll("2d6 + @atk - @penalty", {
        atk: atkValue,
        penalty: weaponPenalty
      });
      description = `${weapon.name} Attack (ranged)`;
    }

    await roll.evaluate();

    // Create damage roll button
    const damageButton = `<button type="button" class="damage-roll-btn" data-actor-id="${this.id}" data-weapon-id="${weapon.id}" data-attack-result="${roll.total}">Roll Damage</button>`;

    ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor: this }),
      content: `
        <div class="glog2d6-roll">
          <h3>${this.name} - ${description}</h3>
          <div class="roll-result">
            <strong>Roll:</strong> ${roll.result}
            <br><strong>Result:</strong> ${roll.total}
            <br><small>Damage: ${weapon.system.damage} + base damage</small>
            <br>${damageButton}
          </div>
        </div>
      `,
      roll: roll
    });

    return roll;
  }

  async rollWeaponDamage(weapon, attackResult, defenseResult = null) {
    const strMod = this.system.attributes.str.mod;
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
    let totalDamage;

    if (weaponDamage === "0" || weaponDamage === "") {
      // No weapon damage, just base damage
      totalDamage = baseDamage;
    } else {
      // Roll weapon damage and add base damage
      const damageRoll = new Roll(`${weaponDamage} + @base`, { base: baseDamage });
      await damageRoll.evaluate();
      totalDamage = damageRoll.total;

      ChatMessage.create({
        speaker: ChatMessage.getSpeaker({ actor: this }),
        content: `
          <div class="glog2d6-roll">
            <h3>${this.name} - ${weapon.name} Damage</h3>
            <div class="roll-result">
              <strong>Weapon:</strong> ${damageRoll.result}
              <br><strong>Base Damage:</strong> ${baseDamage}
              <br><strong>Total Damage:</strong> ${totalDamage}
              ${defenseResult === null ? '<br><small>Note: Base damage assumes hit vs defense</small>' : ''}
            </div>
          </div>
        `,
        roll: damageRoll
      });
    }

    return totalDamage;
  }

  async rollDefense() {
    const defense = this.system.defense?.total || 0;
    const roll = new Roll("2d6 + @def", { def: defense });
    await roll.evaluate();

    ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor: this }),
      content: `
        <div class="glog2d6-roll">
          <h3>${this.name} - Defense</h3>
          <div class="roll-result">
            <strong>Roll:</strong> ${roll.result}
            <br><strong>Result:</strong> ${roll.total}
            ${this.system.defense ? `<br><small>Armor: +${this.system.defense.armor}, Dex: +${this.system.defense.dexBonus}</small>` : ''}
          </div>
        </div>
      `,
      roll: roll
    });

    return roll;
  }

  async rollMovement() {
    const movement = this.system.details.effectiveMovement || this.system.details.movement;
    const roll = new Roll("2d6 + @move", { move: movement });
    await roll.evaluate();

    ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor: this }),
      content: `
        <div class="glog2d6-roll">
          <h3>${this.name} - Movement</h3>
          <div class="roll-result">
            <strong>Roll:</strong> ${roll.result}
            <br><strong>Result:</strong> ${roll.total}
          </div>
        </div>
      `,
      roll: roll
    });

    return roll;
  }
}
