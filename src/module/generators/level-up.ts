/**
 * Level Up functionality for GLOG 2d6 System
 */
export class LevelUp {

  /**
   * Handle leveling up a character
   * @param {Actor} actor - The actor to level up
   */
  static async levelUp(actor: Actor): Promise<void> {
    // Get current level and XP
    const actorData = actor.system;
    const currentLevel = actorData.details.level;
    const currentXP = actorData.details.xp.value;

    // XP requirements for each level
    const xpRequirements = [0, 1, 2000, 7000, 12000, 24000, 42000, 60000, 80000];

    // Check if character has enough XP to level up
    if (currentLevel >= 8) {
      ui.notifications.warn("You've reached the maximum level!");
      return;
    }

    const requiredXP = xpRequirements[currentLevel + 1];
    if (currentXP < requiredXP) {
      ui.notifications.warn(`You need ${requiredXP - currentXP} more XP to reach level ${currentLevel + 1}!`);
      return;
    }

    // Apply level up effects
    const updates = await this.applyLevelUpEffects(actor, currentLevel);

    // Show level up message
    ui.notifications.info(`Congratulations! ${actor.name} has reached level ${currentLevel + 1}!`);

    // Create a chat message to announce the level up
    await ChatMessage.create({
      speaker: ChatMessage.getSpeaker({actor: actor}),
      content: `
        <div class="glog2d6">
          <h2>Level Up!</h2>
          <p>${actor.name} has reached level ${currentLevel + 1}!</p>
          ${updates.map(update => `<p>${update}</p>`).join('')}
        </div>
      `
    });
  }

  /**
   * Apply the effects of leveling up
   * @param {Actor} actor - The actor to level up
   * @param {number} currentLevel - The actor's current level
   * @returns {Promise<string[]>} Array of update messages
   */
  static async applyLevelUpEffects(actor: Actor, currentLevel: number): Promise<string[]> {
    const updates = [];
    const updateData = {};

    // Increase level
    updateData["system.details.level"] = currentLevel + 1;
    updates.push("Level increased");

    // Update XP requirements for next level
    const xpRequirements = [0, 1, 2000, 7000, 12000, 24000, 42000, 60000, 80000];
    if (currentLevel + 1 < xpRequirements.length) {
      updateData["system.details.xp.max"] = xpRequirements[currentLevel + 2];
    }

    // Roll for HP increase (only for levels 1-4)
    if (currentLevel < 4) {
      const hpRoll = new Roll("1d6");
      await hpRoll.evaluate({async: true});
      const hpIncrease = hpRoll.total + (actor.system.attributes.constitution.mod || 0);
      const newHP = (actor.system.hp.max || 0) + hpIncrease;

      updateData["system.hp.max"] = newHP;
      updateData["system.hp.value"] = newHP;
      updates.push(`HP increased by ${hpIncrease} (${hpRoll.result} + ${actor.system.attributes.constitution.mod || 0} CON)`);
    }

    // Increase Attack bonus
    if (currentLevel < 4) {
      // Attack is calculated automatically in derived stats
      updates.push("Attack bonus increased");
    }

    // Increase template slots at appropriate levels
    // Note: this is to track how many templates a character can have,
    // not to actually add templates, which will be done in the next step
    if (currentLevel < 4) {
      updateData["system.details.templates.max"] = currentLevel + 1;
      updates.push(`Template slots increased to ${currentLevel + 1}`);
    }

    // Increase Hires at appropriate levels
    if (currentLevel < 5) {
      updates.push(`Hires increased to ${currentLevel + 1}`);
    } else if (currentLevel === 4) {
      updates.push(`Hires increased to ${currentLevel + 1} + CHA modifier`);
    }

    // Apply attribute tests on level up
    const testedAttribute = await this.attributeTest(actor);
    if (testedAttribute) {
      updates.push(`${testedAttribute.name} increased to ${testedAttribute.newValue}`);
    }

    // Update the actor
    await actor.update(updateData);

    // Prompt for new template selection if applicable (for levels 1-4)
    if (currentLevel < 4) {
      // This only reminds the player, actual template selection will be manual
      updates.push("Don't forget to select a new template!");
    }

    return updates;
  }

  /**
   * Test an attribute to see if it improves on level up
   * @param {Actor} actor - The actor to test attributes for
   * @returns {Promise<{name: string, newValue: number} | null>} The improved attribute or null
   */
  static async attributeTest(actor: Actor): Promise<{name: string, newValue: number} | null> {
    // Create a dialog to let the player choose which attribute to test
    return new Promise((resolve) => {
      const attributes = actor.system.attributes;

      // Create dialog content
      const content = `
        <form>
          <div class="form-group">
            <label>Select an attribute to test:</label>
            <select id="attribute-select">
              ${Object.entries(attributes).map(([key, attr]) => {
                const attrName = game.i18n.localize(`GLOG.Attribute${key.charAt(0).toUpperCase() + key.slice(1)}`);
                return `<option value="${key}">${attrName} (${attr.value})</option>`;
              }).join('')}
            </select>
          </div>
        </form>
      `;

      // Create the dialog
      new Dialog({
        title: "Attribute Test",
        content: content,
        buttons: {
          test: {
            icon: '<i class="fas fa-dice"></i>',
            label: "Test",
            callback: async (html) => {
              const selectedAttr = (html.find('#attribute-select')[0] as HTMLSelectElement).value;
              const result = await this.performAttributeTest(actor, selectedAttr);
              resolve(result);
            }
          },
          cancel: {
            icon: '<i class="fas fa-times"></i>',
            label: "Cancel",
            callback: () => resolve(null)
          }
        },
        default: "test"
      }).render(true);
    });
  }

  /**
   * Perform the attribute test roll
   * @param {Actor} actor - The actor to test attributes for
   * @param {string} attribute - The attribute key to test
   * @returns {Promise<{name: string, newValue: number} | null>} The improved attribute or null
   */
  static async performAttributeTest(actor: Actor, attribute: string): Promise<{name: string, newValue: number} | null> {
    // Get the current attribute value
    const currentValue = actor.system.attributes[attribute].value;

    // Roll 2d6 to test
    const roll = new Roll("2d6");
    await roll.evaluate({async: true});

    // Show the roll result
    await roll.toMessage({
      speaker: ChatMessage.getSpeaker({actor: actor}),
      flavor: `Testing ${game.i18n.localize(`GLOG.Attribute${attribute.charAt(0).toUpperCase() + attribute.slice(1)}`)} (current: ${currentValue})`
    });

    // Check if the roll is higher than the current value
    if (roll.total > currentValue) {
      // Success! Increase the attribute
      const newValue = currentValue + 1;

      // Update the actor
      const updateData = {};
      updateData[`system.attributes.${attribute}.value`] = newValue;
      await actor.update(updateData);

      return {
        name: game.i18n.localize(`GLOG.Attribute${attribute.charAt(0).toUpperCase() + attribute.slice(1)}`),
        newValue: newValue
      };
    }

    return null;
  }
}
