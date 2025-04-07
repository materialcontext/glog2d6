// src/module/applications/character-generator-dialog.ts

import { CharacterGenerator } from "../generators/character-generator.js";
import { GLOG } from "../helpers/config.js";

/**
 * Dialog for generating new characters
 */
export class CharacterGeneratorDialog extends Dialog {

  /**
   * Show the character generator dialog
   * @param {Actor} actor - The actor to generate data for
   */
  static async show(actor: Actor): Promise<void> {
    // Create the dialog content
    const content = `
      <form>
        <div class="form-group">
          <label>Starting Class</label>
          <select id="class-select">
            <option value="">Random</option>
            ${Object.entries(GLOG.classes).map(([key, value]) =>
              `<option value="${key}">${game.i18n.localize(value as string)}</option>`
            ).join('')}
          </select>
        </div>
      </form>
    `;

    // Create and show the dialog
    new Dialog({
      title: "Generate Character",
      content: content,
      buttons: {
        generate: {
          icon: '<i class="fas fa-dice"></i>',
          label: "Generate",
          callback: (html) => {
            const classType = (html.find('#class-select')[0] as HTMLSelectElement).value;
            this.generateCharacter(actor, classType);
          }
        },
        cancel: {
          icon: '<i class="fas fa-times"></i>',
          label: "Cancel"
        }
      },
      default: "generate"
    }).render(true);
  }

  /**
   * Generate the character
   * @param {Actor} actor - The actor to generate data for
   * @param {string} classType - The selected class type
   */
  static async generateCharacter(actor: Actor, classType: string): Promise<void> {
    // If no class was selected, pick a random one
    if (!classType) {
      const classes = Object.keys(GLOG.classes);
      const randomIndex = Math.floor(Math.random() * classes.length);
      classType = classes[randomIndex];
    }

    // Generate the character
    await CharacterGenerator.generateCharacter(classType, actor);

    // Show a notification
    ui.notifications.info(`Generated a new ${game.i18n.localize(GLOG.classes[classType])} character!`);
  }
}
