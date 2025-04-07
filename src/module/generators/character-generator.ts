// src/module/generators/character-generator.ts

/**
 * Character Generator for GLOG 2d6 System
 */
export class CharacterGenerator {

  /**
   * Generate a new character
   * @param {string} classType - The starting class for the character
   * @param {Actor} actor - The actor to update with the generated character
   */
  static async generateCharacter(classType: string, actor: Actor): Promise<void> {
    // Generate attributes
    const attributes = this.generateAttributes();

    // Setup base character data
    const characterData = {
      system: {
        attributes: attributes,
        hp: {
          value: 1 + attributes.constitution.mod,
          max: 1 + attributes.constitution.mod
        },
        details: {
          level: 0,
          xp: {
            value: 0
          },
          templates: {
            list: [],
            max: 4
          }
        },
        traits: {
          quirks: this.generateQuirks()
        }
      }
    };

    // Update the actor with the generated data
    await actor.update(characterData);

    // If a class was specified, add the first template
    if (classType) {
      await this.addStartingTemplate(classType, actor);
      await this.addStartingEquipment(classType, actor);
    }
  }

  /**
   * Generate random attributes using 2d6 for each
   */
  static generateAttributes(): Record<string, {value: number, mod: number}> {
    const attributes = {};
    const attributeNames = ['strength', 'dexterity', 'constitution', 'intelligence', 'wisdom', 'charisma'];

    for (const attr of attributeNames) {
      // Roll 2d6 for each attribute
      const roll = new Roll('2d6');
      roll.evaluate({async: false});
      const value = roll.total;

      // Calculate modifier based on GLOG 2d6 rules
      let mod = 0;
      if (value === 2) mod = -3;
      else if (value >= 3 && value <= 4) mod = -2;
      else if (value >= 5 && value <= 6) mod = -1;
      else if (value === 7) mod = 0;
      else if (value >= 8 && value <= 9) mod = 1;
      else if (value >= 10 && value <= 11) mod = 2;
      else if (value >= 12) mod = 3;

      attributes[attr] = {
        value: value,
        mod: mod
      };
    }

    return attributes;
  }

  /**
   * Generate random quirks for the character
   */
  static generateQuirks(): string[] {
    const quirks = [
      "Always carries a lucky charm",
      "Speaks in third person",
      "Constantly quotes an obscure philosopher",
      "Has an irrational fear of water/heights/crowds",
      "Collects unusual trophies from defeats",
      "Can't resist shiny objects",
      "Always wears a specific color",
      "Never sleeps with their boots off",
      "Refuses to eat certain foods for superstitious reasons",
      "Believes they're destined for greatness",
      "Constantly checks weapons/equipment",
      "Habitually lies about small, inconsequential things",
      "Has a distinctive scar/tattoo with a story",
      "Speaks to inanimate objects",
      "Follows an unusual personal code"
    ];

    // Select 1-3 random quirks
    const numQuirks = Math.floor(Math.random() * 3) + 1;
    const selectedQuirks = [];

    for (let i = 0; i < numQuirks; i++) {
      const index = Math.floor(Math.random() * quirks.length);
      selectedQuirks.push(quirks[index]);
      quirks.splice(index, 1); // Remove selected quirk to avoid duplicates
    }

    return selectedQuirks;
  }

  /**
   * Add starting template based on class
   */
  static async addStartingTemplate(classType: string, actor: Actor): Promise<void> {
    // Create the template item
    const templateData = {
      name: `Level 0 ${this.capitalizeFirstLetter(classType)}`,
      type: "template",
      img: "icons/svg/statue.svg",
      system: {
        class: classType,
        level: "A",
        features: []
      }
    };

    // Add the template to the actor
    await Item.create(templateData, {parent: actor});
  }

  /**
   * Add starting equipment based on class
   */
  static async addStartingEquipment(classType: string, actor: Actor): Promise<void> {
    // Define starting equipment for each class
    const startingEquipment = {
      acrobat: [
        { name: "Rope (50')", type: "gear", img: "icons/svg/coil.svg", system: { quantity: 1, slots: 1 } },
        { name: "Good Shoes", type: "gear", img: "icons/svg/boots.svg", system: { quantity: 1, slots: 1 } },
        { name: "Chalk", type: "gear", img: "icons/svg/stone.svg", system: { quantity: 1, slots: 1 } }
      ],
      assassin: [
        { name: "Fraudulent Papers", type: "gear", img: "icons/svg/book.svg", system: { quantity: 1, slots: 1 } },
        { name: "Black Mask", type: "gear", img: "icons/svg/hood.svg", system: { quantity: 1, slots: 1 } },
        { name: "Knife", type: "weapon", img: "icons/svg/dagger.svg", system: { weaponType: "light", damage: "1d4", slots: 1 } }
      ],
      barbarian: [
        { name: "Axe", type: "weapon", img: "icons/svg/axe.svg", system: { weaponType: "medium", damage: "1d6", slots: 1 } },
        { name: "Olive Oil", type: "gear", img: "icons/svg/bottle.svg", system: { quantity: 1, slots: 1 } },
        { name: "Light Armor", type: "armor", img: "icons/svg/armor.svg", system: { armorType: "light", defense: 1, slots: 0 } }
      ],
      // Add other classes here
      fighter: [
        { name: "Medium Armor", type: "armor", img: "icons/svg/armor.svg", system: { armorType: "medium", defense: 2, slots: 0 } },
        { name: "Sword", type: "weapon", img: "icons/svg/sword.svg", system: { weaponType: "medium", damage: "1d6", slots: 1 } },
        { name: "Shield", type: "armor", img: "icons/svg/shield.svg", system: { armorType: "shield", defense: 1, slots: 2 } }
      ],
      wizard: [
        { name: "Spellbook", type: "gear", img: "icons/svg/book.svg", system: { quantity: 1, slots: 1 } },
        { name: "Dagger", type: "weapon", img: "icons/svg/dagger.svg", system: { weaponType: "light", damage: "1d4", slots: 1 } },
        { name: "Ink and Quill", type: "gear", img: "icons/svg/quill.svg", system: { quantity: 1, slots: 1 } }
      ]
    };

    // Get equipment for the selected class
    const equipment = startingEquipment[classType] || [];

    // Add the equipment to the actor
    for (const item of equipment) {
      await Item.create(item, {parent: actor});
    }
  }

  /**
   * Helper function to capitalize the first letter of a string
   */
  static capitalizeFirstLetter(string: string): string {
    return string.charAt(0).toUpperCase() + string.slice(1);
  }
}
