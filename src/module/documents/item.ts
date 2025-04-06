export class GlogItem extends Item {
  /**
   * Augment the basic Item data model with additional dynamic data.
   */
  prepareData() {
    super.prepareData();
  }

  /**
   * Handle clickable rolls.
   * @param {Event} event   The originating click event
   * @private
   */
  async roll() {
    const item = this;
    const actor = this.actor;

    if (!actor) return;

    // Handle different item types
    switch (item.type) {
      case 'weapon':
        return this._rollWeapon(this);
      case 'spell':
        return this._rollSpell(this);
      case 'feature':
        return this._rollFeature(this);
    }
  }

  /**
   * Roll a weapon to attack
   * @param {Item} item   The weapon item
   * @private
   */
  async _rollWeapon(item) {
    if (!this.actor) return;

    // Get weapon data
    const weaponData = item.system;
    const attackFormula = '2d6';
    let attackBonus = this.actor.system.derived.attack.value || 0;
    attackBonus += weaponData.attackBonus || 0;

    // For attributes, add strength for melee or dexterity for ranged
    if (['light', 'medium', 'heavy'].includes(weaponData.weaponType)) {
      attackBonus += this.actor.system.attributes.strength.mod || 0;
    } else if (['ranged', 'firearm'].includes(weaponData.weaponType)) {
      attackBonus += this.actor.system.attributes.dexterity.mod || 0;
    }

    // Create attack roll
    const attackRoll = new Roll(`${attackFormula}+${attackBonus}`);

    // Show dialog for difficulty
    this._showAttackDialog(item, attackRoll);
  }

  /**
   * Show attack dialog for a weapon
   * @param {Item} item       The weapon
   * @param {Roll} attackRoll   The prepared attack roll
   * @private
   */
  _showAttackDialog(item, attackRoll) {
    new Dialog({
      title: game.i18n.format("GLOG.RollAttack", {name: item.name}),
      content: `
        <form>
          <div class="form-group">
            <label>${game.i18n.localize("GLOG.DefenseTarget")}</label>
            <input type="number" id="defense-target" value="10" min="0" step="1"/>
          </div>
        </form>
      `,
      buttons: {
        roll: {
          icon: '<i class="fas fa-dice-d6"></i>',
          label: game.i18n.localize("GLOG.Roll"),
          callback: html => {
            const defenseTarget = parseInt(html.find('#defense-target').val());
            this._rollAttack(item, attackRoll, defenseTarget);
          }
        },
        cancel: {
          icon: '<i class="fas fa-times"></i>',
          label: game.i18n.localize("GLOG.Cancel")
        }
      },
      default: "roll"
    }).render(true);
  }

  /**
   * Roll attack against a defense target
   * @param {Item} item         The weapon
   * @param {Roll} attackRoll     The prepared attack roll
   * @param {number} defenseTarget  The defense target number
   * @private
   */
  async _rollAttack(item, attackRoll, defenseTarget) {
    await attackRoll.evaluate({async: true});

    // Determine success or failure
    const isSuccess = attackRoll.total >= defenseTarget;
    const isCrit = attackRoll.dice[0].results[0].result === 6 && attackRoll.dice[0].results[1].result === 6;
    const isFumble = attackRoll.dice[0].results[0].result === 1 && attackRoll.dice[0].results[1].result === 1;

    // Calculate damage
    let damageValue = isSuccess ? attackRoll.total - defenseTarget : 0;

    // For items that have their own damage formula
    if (isSuccess && item.system.damage) {
      let damageRoll;

      // Add strength to damage for melee weapons
      if (['light', 'medium', 'heavy'].includes(item.system.weaponType)) {
        const strMod = this.actor.system.attributes.strength.mod || 0;
        damageRoll = new Roll(`${item.system.damage}+${damageValue}+${strMod}`);
      } else {
        damageRoll = new Roll(`${item.system.damage}+${damageValue}`);
      }

      await damageRoll.evaluate({async: true});
      damageValue = damageRoll.total;
    }

    // Create chat message
    let resultText;
    if (isCrit) {
      resultText = `<h3 class="success">${game.i18n.localize("GLOG.CriticalHit")}</h3>`;
    } else if (isFumble) {
      resultText = `<h3 class="failure">${game.i18n.localize("GLOG.CriticalMiss")}</h3>`;
    } else if (isSuccess) {
      resultText = `<h3 class="success">${game.i18n.localize("GLOG.Hit")}</h3>`;
    } else {
      resultText = `<h3 class="failure">${game.i18n.localize("GLOG.Miss")}</h3>`;
    }

    if (isSuccess) {
      resultText += `<p>${game.i18n.format("GLOG.DamageResult", {damage: damageValue})}</p>`;
    }

    attackRoll.toMessage({
      speaker: ChatMessage.getSpeaker({ actor: this.actor }),
      flavor: `${item.name} - ${game.i18n.format("GLOG.AttackVsDefense", {defense: defenseTarget})}`,
      content: resultText
    });
  }

  /**
   * Roll a spell
   * @param {Item} item   The spell item
   * @private
   */
  async _rollSpell(item) {
    if (!this.actor) return;

    // Trigger spellcasting dialog through actor
    if (typeof this.actor.sheet._onSpellCast === 'function') {
      this.actor.sheet._onSpellCast(item);
    }
  }

  /**
   * Roll a feature
   * @param {Item} item   The feature item
   * @private
   */
  async _rollFeature(item) {
    if (!this.actor) return;

    // Simply display feature info in chat
    ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor: this.actor }),
      flavor: item.name,
      content: `<div class="glog2d6"><p>${item.system.description}</p></div>`
    });
  }
}
