export async function preloadHandlebarsTemplates() {
  const templatePaths = [
    // Actor Sheets
    "systems/glog2d6/templates/actor/character-sheet.hbs",
    "systems/glog2d6/templates/actor/npc-sheet.hbs",
    "systems/glog2d6/templates/actor/hireling-sheet.hbs",

    // Item Sheets
    "systems/glog2d6/templates/item/weapon-sheet.hbs",
    "systems/glog2d6/templates/item/armor-sheet.hbs",
    "systems/glog2d6/templates/item/gear-sheet.hbs",
    "systems/glog2d6/templates/item/template-sheet.hbs",
    "systems/glog2d6/templates/item/spell-sheet.hbs",
    "systems/glog2d6/templates/item/feature-sheet.hbs",
    "systems/glog2d6/templates/item/wound-sheet.hbs",

    // Partials
    "systems/glog2d6/templates/partials/attribute-block.hbs",
    "systems/glog2d6/templates/partials/item-list.hbs"
  ];

  return loadTemplates(templatePaths);
}
