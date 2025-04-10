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
import { CharacterGenerator } from "./module/generators/character-generator.js";

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
    rollItemMacro,
    CharacterGenerator
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
 * Add character generator button to the actors directory
 */
Hooks.on("renderActorDirectory", (app, html, data) => {
  // Create the button
  const generateButton = $(`
    <button class="generate-character">
      <i class="fas fa-dice"></i> ${game.i18n.localize("GLOG.GenerateCharacter")}
    </button>
  `);

  // Find the header-actions div and append the button there
  const headerActions = html.find(".directory-header .header-actions");
  headerActions.append(generateButton);

  // Add click event
  generateButton.click(ev => {
    ev.preventDefault();
    _onGenerateCharacter();
  });

  // Add custom styles
  const styleElement = document.createElement('style');
  styleElement.textContent = `
    .generate-character {
      background: var(--color-button);
      color: var(--color-text-light-highlight);
      border: none;
      border-radius: 3px;
      padding: 3px 6px;
      margin-left: 5px;
      display: flex;
      align-items: center;
      gap: 5px;
      cursor: pointer;
    }

    .generate-character:hover {
      background: var(--color-button-hover);
    }
  `;
  html.find(".directory-header").append(styleElement);
});

/**
 * Handle character generation from the directory
 */
function _onGenerateCharacter() {
  // Create prompt for new character name and class
  new Dialog({
    title: game.i18n.localize("GLOG.NewCharacter"),
    content: `
      <form class="glog2d6">
        <div class="form-group">
          <label for="character-name">${game.i18n.localize("GLOG.Name")}</label>
          <input type="text" id="character-name" placeholder="${game.i18n.localize("GLOG.Name")}" value="New Character">
        </div>
        <div class="form-group">
          <label for="character-class">${game.i18n.localize("GLOG.Class")}</label>
          <select id="character-class">
            <option value="">Random</option>
            ${Object.entries(CONFIG.GLOG.classes).map(([key, value]) =>
              `<option value="${key}">${game.i18n.localize(value)}</option>`
            ).join('')}
          </select>
        </div>
      </form>
    `,
    buttons: {
      generate: {
        icon: '<i class="fas fa-dice"></i>',
        label: game.i18n.localize("GLOG.GenerateCharacter"),
        callback: (html) => {
          const name = html.find('#character-name').val();
          const classType = html.find('#character-class').val() as string;

          // Create new actor
          Actor.create({
            name: name,
            type: "character",
            img: _getRandomPortrait()
          }).then(actor => {
            // Generate character
            if (actor) {
              game.glog2d6.CharacterGenerator.generateCharacter(classType, actor);
            }
          });
        }
      },
      cancel: {
        icon: '<i class="fas fa-times"></i>',
        label: game.i18n.localize("GLOG.Cancel")
      }
    },
    default: "generate"
  }).render(true);
}

/**
 * Get a random portrait for the character
 */
function _getRandomPortrait(): string {
  // Default list of portrait paths - could be expanded or made configurable
  const portraits = [
    "icons/svg/mystery-man.svg",
    "systems/glog2d6/assets/portraits/fighter.webp",
    "systems/glog2d6/assets/portraits/wizard.webp",
    "systems/glog2d6/assets/portraits/thief.webp",
    "systems/glog2d6/assets/portraits/barbarian.webp"
  ];

  // Select a random portrait
  return portraits[Math.floor(Math.random() * portraits.length)];
}

/**
 * Customize the actors directory list items
 */
Hooks.on("renderActorDirectory", (app, html, data) => {
  // Add custom styling to actor list items
  html.find(".directory-item").each((i, item) => {
    const actorId = item.dataset.documentId;
    if (!actorId) return;

    const actor = game.actors?.get(actorId);
    if (!actor) return;

    // Add actor type as a class
    $(item).addClass(`actor-${actor.type}`);

    // Add level badge for characters
    if (actor.type === 'character') {
      const level = actor.system.details?.level || 0;
      const levelBadge = $(`<div class="level-badge">Lvl ${level}</div>`);
      $(item).find('.document-name').append(levelBadge);
    }
  });

  // Add styling
  const styleElement = document.createElement('style');
  styleElement.textContent = `
    .directory-item {
      border-radius: var(--border-radius);
      margin-bottom: 3px;
      transition: background-color 0.2s;
    }

    .directory-item:hover {
      background-color: rgba(255, 255, 255, 0.1);
    }

    .actor-character .document-name {
      display: flex;
      align-items: center;
      justify-content: space-between;
    }

    .level-badge {
      font-size: 0.8em;
      background-color: var(--color-accent);
      color: white;
      padding: 2px 5px;
      border-radius: 10px;
    }
  `;
  html.append(styleElement);
});

/**
 * Fix tab display issue - add this hook to make sure tabs work correctly
 */
Hooks.on("renderActorSheet", (app, html, data) => {
  // Ensure proper tab activation
  const tabs = html.find('.sheet-tabs .item');
  const tabContents = html.find('.tab');

  // Set first tab as active by default if none are active
  if (!tabs.hasClass('active')) {
    tabs.first().addClass('active');
    tabContents.hide();
    tabContents.first().show();
  }

  // Fix tab click behavior
  tabs.click(ev => {
    const tab = $(ev.currentTarget);
    const tabGroup = tab.parents('.tabs').data('group');
    const tabTarget = tab.data('tab');

    // Update tabs
    tabs.removeClass('active');
    tab.addClass('active');

    // Update tab content
    tabContents.hide();
    html.find(`.tab[data-tab="${tabTarget}"][data-group="${tabGroup}"]`).show();
  });
});

// Add this interface to your types file (src/module/glog2d6.d.ts or similar)
interface GlogActorDataSource {
  details: {
    level: number;
    xp: {
      value: number;
      max: number;
    };
    spellDice?: {
      value: number;
      max: number;
    };
    spellSlots?: {
      value: number;
    };
    templates: {
      list: any[];
      max: number;
    };
  };
  hp: {
    value: number;
    max: number;
    pct?: number;
    temp?: number;
  };
  attributes: Record<string, any>;
  derived: Record<string, any>;
  traits?: {
    quirks?: string[];
    languages?: {
      value: string[];
    };
    ci?: {
      value: string[];
    };
    dr?: {
      value: string[];
    };
    di?: {
      value: string[];
    };
    dv?: {
      value: string[];
    };
    senses?: string;
    size?: string;
  };
  type?: {
    label: string;
  };
  morale?: {
    value: number;
  };
  reaction?: {
    value: number;
  };
  legendary?: {
    value: number;
    max: number;
    lair: boolean;
  };
  deathSaves?: {
    successes: number;
    failures: number;
  };
}

/**
 * Default Foundry variables
 */
declare const game: Game;
declare const DEFAULT_TOKEN: string;
declare interface Game {
  user: User | null;
  users: Collection<string, User>;
  actors: Collection<string, Actor>;
  packs: Collection<string, CompendiumCollection>;
  i18n: I18n;
  settings: any;
  macros: Collection<string, Macro>;
}

declare interface User {
  id: string;
  assignHotbarMacro(macro: Macro, slot: number): Promise<boolean>;
}

declare interface I18n {
  localize(key: string): string;
  format(key: string, data?: object): string;
}

// UUID
declare function fromUuid(uuid: string): Promise<any>;

//Roll interface
declare class Roll {
  constructor(formula: string, data?: object);
  dice: {
    0: {
      results: {
        result: number;
      }[];
    };
  }[];
  total: number;
  evaluate(options?: { async: boolean }): Promise<Roll>;
  toMessage(messageData?: object): Promise<ChatMessage>;
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
