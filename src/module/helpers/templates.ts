// src/module/helpers/templates.ts
export async function preloadHandlebarsTemplates() {
  const templatePaths = [
    // Add paths to your templates here
    "systems/my-foundry-system/templates/actor/character-sheet.hbs",
    "systems/my-foundry-system/templates/actor/npc-sheet.hbs",
    "systems/my-foundry-system/templates/item/item-sheet.hbs",
    "systems/my-foundry-system/templates/item/weapon-sheet.hbs",
    "systems/my-foundry-system/templates/item/armor-sheet.hbs",
    "systems/my-foundry-system/templates/item/spell-sheet.hbs",
    "systems/my-foundry-system/templates/item/feature-sheet.hbs"
  ];

  return loadTemplates(templatePaths);
}
