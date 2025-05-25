import { GLOG2D6Actor } from "./module/actor/actor.mjs";
import { GLOG2D6Item } from "./module/item/item.mjs";
import { GLOG2D6ActorSheet } from "./module/actor/actor-sheet.mjs";
import { GLOG2D6ItemSheet } from "./module/item/item-sheet.mjs";

Hooks.once('init', async function() {
  console.log('glog2d6 | Initializing GLOG 2d6 System');

  // Register system settings
  game.settings.register("glog2d6", "autoBurnTorches", {
    name: "Auto-burn Torches with Time",
    hint: "Automatically reduce torch duration when world time advances (only affects torches with duration tracking enabled)",
    scope: "world",
    config: true,
    default: false,
    type: Boolean
  });

  // Register Handlebars helpers
  Handlebars.registerHelper('upperCase', function(str) {
    return str.toUpperCase();
  });

  Handlebars.registerHelper('capitalize', function(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
  });

  // Define custom Document classes
  CONFIG.Actor.documentClass = GLOG2D6Actor;
  CONFIG.Item.documentClass = GLOG2D6Item;

  // Register sheet application classes
  Actors.unregisterSheet("core", ActorSheet);
  Actors.registerSheet("glog2d6", GLOG2D6ActorSheet, {
    types: ["character", "npc"],
    makeDefault: true,
    label: "GLOG2D6.SheetLabels.Actor"
  });

  Items.unregisterSheet("core", ItemSheet);
  Items.registerSheet("glog2d6", GLOG2D6ItemSheet, {
    types: ["weapon", "armor", "gear", "shield", "torch"],
    makeDefault: true,
    label: "GLOG2D6.SheetLabels.Item"
  });

  // Preload templates
  return loadTemplates([
    "systems/glog2d6/templates/actor/actor-character-sheet.hbs",
    "systems/glog2d6/templates/actor/actor-npc-sheet.hbs",
    "systems/glog2d6/templates/item/item-weapon-sheet.hbs",
    "systems/glog2d6/templates/item/item-armor-sheet.hbs",
    "systems/glog2d6/templates/item/item-gear-sheet.hbs",
    "systems/glog2d6/templates/item/item-shield-sheet.hbs",
    "systems/glog2d6/templates/item/item-torch-sheet.hbs"
  ]);
});

Hooks.once("ready", async function() {
  console.log('glog2d6 | System Ready');

  // Handle damage roll buttons in chat
  $(document).on('click', '.damage-roll-btn', async function(event) {
    const button = event.currentTarget;
    const actorId = button.dataset.actorId;
    const weaponId = button.dataset.weaponId;
    const attackResult = parseInt(button.dataset.attackResult);

    const actor = game.actors.get(actorId);
    const weapon = actor.items.get(weaponId);

    if (actor && weapon) {
      await actor.rollWeaponDamage(weapon, attackResult);

      // Disable the button after use
      button.disabled = true;
      button.textContent = "Damage Rolled";
    }
  });

  // Add torch burn macro for GMs
  if (game.user.isGM) {
    game.glog2d6 = {
      burnTorches: async function(hours = 0.1, onlyDurationEnabled = true) {
        const characters = game.actors.filter(a =>
          a.type === "character" &&
          a.system.torch?.lit
        );

        let burnedCount = 0;
        for (let character of characters) {
          const activeTorch = character.getActiveTorch();
          if (activeTorch && (!onlyDurationEnabled || activeTorch.system.duration.enabled)) {
            await character.burnTorch(hours);
            burnedCount++;
          }
        }

        if (burnedCount > 0) {
          ui.notifications.info(`Burned ${hours} hours from ${burnedCount} torches with duration tracking enabled`);
        } else {
          ui.notifications.info("No torches with duration tracking are currently lit");
        }
      }
    };
  }
});

// Add torch time tracking hook (optional)
Hooks.on("updateWorldTime", async function(worldTime, delta) {
  if (!game.user.isGM) return;

  // Only process if auto-burn is enabled in settings
  const autoBurnEnabled = game.settings.get("glog2d6", "autoBurnTorches") || false;
  if (!autoBurnEnabled) return;

  // Convert game time delta to hours (assuming 1 game hour = 1 real hour for simplicity)
  const hoursElapsed = Math.abs(delta) / 3600; // Convert seconds to hours

  if (hoursElapsed > 0) {
    const litTorches = game.actors.filter(a =>
      a.type === "character" &&
      a.system.torch?.lit
    );

    for (let actor of litTorches) {
      const activeTorch = actor.getActiveTorch();
      if (activeTorch?.system.duration.enabled) {
        await actor.burnTorch(hoursElapsed);
      }
    }
  }
});
