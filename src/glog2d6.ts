// Import document classes
import { MySystemActor } from "./module/documents/actor";
import { MySystemItem } from "./module/documents/item";

// Import sheet classes
import { MySystemActorSheet } from "./module/sheets/actor-sheet";
import { MySystemItemSheet } from "./module/sheets/item-sheet";

// Import helper/utility classes and constants
import { registerSettings } from "./module/helpers/settings";
import { preloadHandlebarsTemplates } from "./module/helpers/templates";

// Initialize system
Hooks.once('init', async function() {
  console.log("Initializing My Foundry System");

  // Register custom document classes
  CONFIG.Actor.documentClass = MySystemActor;
  CONFIG.Item.documentClass = MySystemItem;

  // Register sheet application classes
  Actors.unregisterSheet("core", ActorSheet);
  Items.unregisterSheet("core", ItemSheet);

  Actors.registerSheet("glog2d6", MySystemActorSheet, {
    makeDefault: true,
    label: "MY-SYSTEM.SheetLabels.Actor"
  });

  Items.registerSheet("glog2d6", MySystemItemSheet, {
    makeDefault: true,
    label: "MY-SYSTEM.SheetLabels.Item"
  });

  // Register system settings
  registerSettings();

  // Register Handlebars helpers
  registerHandlebarsHelpers();

  // Preload Handlebars templates
  await preloadHandlebarsTemplates();
});

// Setup system
Hooks.once('setup', function() {
  // Do anything after initialization but before ready
});

// When ready
Hooks.once('ready', async function() {
  // Do anything once the system is ready
});

// Register Handlebars helpers
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
}
