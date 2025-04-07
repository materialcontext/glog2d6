// src/glog2d6.ts

// Import document classes
import { GlogActor } from "./module/documents/actor.js";
import { GlogItem } from "./module/documents/item.js";

// Import sheet classes
import { GlogActorSheet } from "./module/sheets/actor-sheet.js";
import { GlogItemSheet } from "./module/sheets/item-sheet.js";

// Import helper/utility classes and constants
import { registerSettings } from "./module/helpers/settings.js";
import { preloadHandlebarsTemplates } from "./module/helpers/templates.js";
import { GLOG } from "./module/helpers/config.js";
import { ContentPacks } from "./module/helpers/content-packs.js";

/**
 * Initialize system
 */
Hooks.once('init', async function() {
  console.log("GLOG2D6 | Initializing GLOG 2d6 System");

  // Add utility classes to the global game object
  // @ts-ignore
  game.glog2d6 = {
    GlogActor,
    GlogItem,
    rollItemMacro
  };

  // Define custom Document classes
  CONFIG.Actor.documentClass = GlogActor;
  CONFIG.Item.documentClass = GlogItem;

  // Add GLOG configuration to CONFIG
  CONFIG.GLOG = GLOG;

  // Register sheet application classes
  Actors.unregisterSheet("core", ActorSheet);
  Items.unregisterSheet("core", ItemSheet);

  Actors.registerSheet("glog2d6", GlogActorSheet, {
    makeDefault: true,
    label: "GLOG.SheetLabels.Actor"
  });

  Items.registerSheet("glog2d6", GlogItemSheet, {
    makeDefault: true,
    label: "GLOG.SheetLabels.Item"
  });

  // Register system settings
  registerSettings();

  // Register Handlebars helpers
  registerHandlebarsHelpers();

  // Preload Handlebars templates
  await preloadHandlebarsTemplates();
});

/**
 * Setup system
 */
Hooks.once('setup', function() {
  // Do anything after initialization but before ready
});

/**
 * When ready
 */
Hooks.once('ready', async function() {
  // Initialize content packs
  await ContentPacks.createInitialPacks();
});

/**
 * Register Handlebars helpers
 */
function registerHandlebarsHelpers() {
  // Example helper
  Handlebars.registerHelper('concat', function() {
    let outStr = '';
    for (let arg in arguments) {
      if (typeof arguments[arg] !== 'object') {
        outStr += arguments[arg];
      }
    }
    return outStr;
  });

  // Capitalize first letter
  Handlebars.registerHelper('capitalize', function(str) {
    if (typeof str !== 'string') return '';
    return str.charAt(0).toUpperCase() + str.slice(1);
  });

  // Equal comparison helper
  Handlebars.registerHelper('eq', function(arg1, arg2) {
    return arg1 === arg2;
  });
}

/**
 * Create a Macro from an Item drop.
 * @param {Object} data The dropped data
 * @param {number} slot The hotbar slot to use
 * @returns {Promise}
 */
async function createGlogMacro(data: any, slot: number) {
  // First, determine if this is a valid owned item.
  if (data.type !== "Item") return;
  if (!data.uuid.includes('Actor.') && !data.uuid.includes('Token.')) {
    return ui.notifications.warn("You can only create macro buttons for owned Items");
  }

  // If it is, retrieve it based on the uuid.
  const item = await fromUuid(data.uuid);
  if (!item) return;

  // Create the macro command
  const command = `game.glog2d6.rollItemMacro("${item.name}");`;
  let macro = game.macros.find(m => (m.name === item.name) && (m.command === command));
  if (!macro) {
    macro = await Macro.create({
      name: item.name,
      type: "script",
      img: item.img,
      command: command,
      flags: { "glog2d6.itemMacro": true }
    });
  }

  game.user.assignHotbarMacro(macro, slot);
  return false;
}

/**
 * Roll an Item from a macro.
 * @param {string} itemName
 * @return {Promise}
 */
function rollItemMacro(itemName: string) {
  const speaker = ChatMessage.getSpeaker();
  let actor;

  if (speaker.token) actor = game.actors.tokens[speaker.token];
  if (!actor) actor = game.actors.get(speaker.actor);
  if (!actor) return ui.notifications.warn(`Your controlled Actor does not have an item named ${itemName}`);

  const item = actor.items.find(i => i.name === itemName);
  if (!item) return ui.notifications.warn(`Your controlled Actor does not have an item named ${itemName}`);

  return item.roll();
}

// Add drop handler for hotbar macro creation
Hooks.on("hotbarDrop", (bar, data, slot) => createGlogMacro(data, slot));
