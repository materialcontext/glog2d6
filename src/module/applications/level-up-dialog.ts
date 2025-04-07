// src/module/applications/level-up-dialog.ts

import { LevelUp } from "../generators/level-up.js";

/**
 * Dialog for leveling up characters
 */
export class LevelUpDialog extends Dialog {

  /**
   * Show the level up dialog
   * @param {Actor} actor - The actor to level up
   */
  static async show(actor: Actor): Promise<void> {
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
    const canLevelUp = currentXP >= requiredXP;

    // Create the dialog content
    let content = `
      <div class="form-group">
        <label>Current Level: ${currentLevel}</label>
      </div>
      <div class="form-group">
        <label>Current XP: ${currentXP}</label>
      </div>
      <div class="form-group">
        <label>XP Needed for Level ${currentLevel + 1}: ${requiredXP}</label>
      </div>
    `;

    if (!canLevelUp) {
      content += `
        <div class="form-group">
          <p class="notification warning">You need ${requiredXP - currentXP} more XP to reach level ${currentLevel + 1}!</p>
        </div>
      `;
    } else {
      content += `
        <div class="form-group">
          <p class="notification success">You have enough XP to reach level ${currentLevel + 1}!</p>
        </div>
      `;
    }

    // Create the dialog
    new Dialog({
      title: "Level Up",
      content: content,
      buttons: {
        levelUp: {
          icon: '<i class="fas fa-arrow-up"></i>',
          label: "Level Up",
          callback: () => LevelUp.levelUp(actor),
          disabled: !canLevelUp
        },
        cancel: {
          icon: '<i class="fas fa-times"></i>',
          label: "Cancel"
        }
      },
      default: canLevelUp ? "levelUp" : "cancel"
    }).render(true);
  }
}
