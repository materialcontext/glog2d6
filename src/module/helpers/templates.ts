/**
 * Preload Handlebars templates
 */
export async function preloadHandlebarsTemplates() {
  const templatePaths = [
    // Actor Sheets
    "templates/actor/character-sheet.hbs",
    "templates/actor/npc-sheet.hbs",
    "templates/actor/hireling-sheet.hbs",

    // Item Sheets
    "templates/item/weapon-sheet.hbs",
    "templates/item/armor-sheet.hbs",
    "templates/item/gear-sheet.hbs",
    "templates/item/template-sheet.hbs",
    "templates/item/spell-sheet.hbs",
    "templates/item/feature-sheet.hbs",
    "templates/item/wound-sheet.hbs",

    // Partials
    "templates/partials/attribute-block.hbs",
    "templates/partials/item-list.hbs"
  ];

  return loadTemplates(templatePaths);
}
