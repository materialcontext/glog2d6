import { GLOG2D6Actor } from "./module/actor/actor.mjs";
import { GLOG2D6Item } from "./module/item/item.mjs";
import { GLOG2D6ActorSheet } from "./module/actor/actor-sheet.mjs";
import { GLOG2D6ItemSheet } from "./module/item/item-sheet.mjs";
import { setupGlobalUtils } from "./scripts/system-utils.mjs";
import { loadSpellData, loadSystemData } from "./data/data-loader.mjs";
import { createDefaultFolders } from "./scripts/initialize-content.mjs";
import { setupSystemHooks } from './scripts/system-hooks.mjs';
import { setupGlobalErrorHandler } from './module/systems/global-error-handler.mjs';
import { initGMRolls } from "./module/systems/gm-roll-system.mjs";
import { initReconSystem } from "./module/systems/recon-system.mjs";
import { ReconDialog } from "./module/dialogs/recon-dialog.mjs";

// Define custom Document classes
CONFIG.Actor.documentClass = GLOG2D6Actor;
CONFIG.Item.documentClass = GLOG2D6Item;

Hooks.once('init', async function() {
    console.log('glog2d6 | Initializing GLOG 2d6 System');

    setupGlobalErrorHandler();

    // Load all JSON data files
    await loadSystemData();
    await loadSpellData();

    // Register Handlebars helpers
    Handlebars.registerHelper('upperCase', function(str) {
        return str.toUpperCase();
    });

    Handlebars.registerHelper('capitalize', function(str) {
        return str.charAt(0).toUpperCase() + str.slice(1);
    });

    Handlebars.registerHelper('add', function(...args) {
        // Remove the last argument which is the handlebars options object
        const numbers = args.slice(0, -1);
        return numbers.reduce((sum, num) => sum + (num || 0), 0);
    });

    Handlebars.registerHelper('subtract', function(a, b) {
        return (a || 0) - (b || 0);
    });

    Handlebars.registerHelper('gt', function(a, b) {
        return a > b;
    });

    Handlebars.registerHelper('lt', function(a, b) {
        return a < b;
    });

    // Register sheet application classes
    Actors.unregisterSheet("core", ActorSheet);
    Actors.registerSheet("glog2d6", GLOG2D6ActorSheet, {
        types: ["character", "npc"],
        makeDefault: true,
        label: "GLOG2D6.SheetLabels.Actor"
    });

    Items.unregisterSheet("core", ItemSheet);
    Items.registerSheet("glog2d6", GLOG2D6ItemSheet, {
        types: ["weapon", "armor", "gear", "shield", "spell", "feature", "torch"],
        makeDefault: true,
        label: "GLOG2D6.SheetLabels.Item"
    });

    // Register game settinngs
    game.settings.register("glog2d6", "hasSetupDefaultFolders", {
        name: "Default Folders Created",
        hint: "Tracks whether default item folders have been created",
        scope: "world",
        config: false,
        type: Boolean,
        default: false
    });

    game.settings.register("glog2d6", "autoBurnTorches", {
        name: "Auto-burn Torches",
        hint: "Automatically reduce torch duration when world time advances",
        scope: "world",
        config: true,
        type: Boolean,
        default: false
    });

    game.settings.register("glog2d6", "gridDistance", {
        name: "Grid Distance",
        hint: "Distance represented by each grid square",
        scope: "world",
        config: true,
        type: String,
        choices: {
            "5": "5 feet per square",
            "10": "10 feet per square"
        },
        default: "5",
        onChange: value => {
            // Update existing scenes if desired
            ui.notifications.info(`Grid distance changed to ${value} feet per square`);
        }
    });

    initGMRolls();
    initReconSystem();

    console.log('glog2d6 | System initialization complete');
});

// Load spell data from multiple files
Hooks.once("ready", async function() {
    console.log('glog2d6 | System Ready');

    // Preload templates
    await loadTemplates([
        // sheets
        "systems/glog2d6/templates/actor/actor-character-sheet.hbs",
        "systems/glog2d6/templates/actor/actor-npc-sheet.hbs",
        "systems/glog2d6/templates/item/item-weapon-sheet.hbs",
        "systems/glog2d6/templates/item/item-armor-sheet.hbs",
        "systems/glog2d6/templates/item/item-gear-sheet.hbs",
        "systems/glog2d6/templates/item/item-shield-sheet.hbs",
        "systems/glog2d6/templates/item/item-spell-sheet.hbs",
        "systems/glog2d6/templates/item/item-feature-sheet.hbs",
        "systems/glog2d6/templates/item/item-torch-sheet.hbs",
        "systems/glog2d6/templates/dialogs/gm-roll.hbs",
        "systems/glog2d6/templates/dialogs/recon-dialog.hbs"
    ]);

    // Register partials
    Handlebars.registerPartial('character-header',
        await getTemplate('systems/glog2d6/templates/actor/character-header.hbs'));
    Handlebars.registerPartial('character-stats',
        await getTemplate('systems/glog2d6/templates/actor/character-stats.hbs'));
    Handlebars.registerPartial('character-tabs',
        await getTemplate('systems/glog2d6/templates/actor/character-tabs.hbs'));
    Handlebars.registerPartial('inventory-tab',
        await getTemplate('systems/glog2d6/templates/actor/inventory-tab.hbs'));
    Handlebars.registerPartial('features-tab',
        await getTemplate('systems/glog2d6/templates/actor/features-tab.hbs'));
    Handlebars.registerPartial('spells-tab',
        await getTemplate('systems/glog2d6/templates/actor/spells-tab.hbs'));

    setupGlobalUtils();

    if (game.user.isGM) {
        await createDefaultFolders();
    }

    setupSystemHooks();

    // Add torch burn macro for GMs
    if (game.user.isGM) {
        game.glog2d6 = {
            ...(game.glog2d6 || {}),
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

Hooks.on('renderChatLog', (chatLog, html) => {
    if (!game.user.isGM) return;

    // Make sure we don't add multiple buttons
    if (html.find('#recon-chat-btn').length) return;

    const reconBtn = $(`
        <a id="recon-chat-btn" class="chat-control-icon" title="Recon Check" style="margin-left: 4px;">
            <i class="fas fa-search"></i>
        </a>
    `);

    reconBtn.click(() => {
        import("./module/dialogs/recon-dialog.mjs").then(({ReconDialog}) => {
            new ReconDialog().render(true);
        });
    });

    // Add some spacing and prevent overlap
    html.find('#chat-controls').css('gap', '2px');
    html.find('#chat-controls .chat-control-icon').last().after(reconBtn);
});

// GM Chat Commands
Hooks.on("chatMessage", (log, msg) => {
    if (!game.user.isGM) return;

    if (msg === "/recon") {
        new ReconDialog().render(true);
        return false;
    }
});

Hooks.on("renderChatMessage", (message, html) => {
    html.find('.magic-die-btn').click(async (event) => {
        event.preventDefault();
        const button = event.currentTarget;
        const diceCount = parseInt(button.dataset.diceCount);
        const spellId = button.dataset.spellId;
        const actorId = message.flags?.glog2d6?.actorId;

        const actor = game.actors.get(actorId);
        const spell = actor?.items.get(spellId);

        if (actor && spell) {
            await actor.castSpellWithDice(spell, diceCount);
            // Disable all buttons in this message
            html.find('.magic-die-btn').prop('disabled', true).text('Cast!');
        }
    });

    html.find('[data-recon-id]').click(async e => {
        e.preventDefault();
        const { reconId, actorId } = e.currentTarget.dataset;
        try {
            await game.glog2d6.reconSystem.execute(reconId, actorId);
            e.currentTarget.disabled = true;
            e.currentTarget.textContent = 'Rolled';
        } catch (error) {
            ui.notifications.error(error.message);
        }
    });

    html.find('.damage-roll-btn').click(async (event) => {
        event.preventDefault();
        const button = event.currentTarget;
        const actorId = button.dataset.actorId;
        const weaponId = button.dataset.weaponId;
        const attackResult = parseInt(button.dataset.attackResult);

        const actor = game.actors.get(actorId);
        const weapon = actor?.items.get(weaponId);

        if (actor && weapon) {
            await actor.rollWeaponDamage(weapon, attackResult);
            button.disabled = true;
            button.textContent = "Rolled";
        } else {
            ui.notifications.error("Actor or weapon not found!");
        }
    });
});
