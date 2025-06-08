import { GLOG2D6Actor } from "./module/actor/actor.mjs";
import { GLOG2D6Item } from "./module/item/item.mjs";
import { GLOG2D6ActorSheet } from "./module/actor/actor-sheet.mjs";
import { GLOG2D6HirelingSheet } from "./module/actor/hireling-sheet.mjs";
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

    Handlebars.registerHelper('range', function(start, end) {
        const result = [];
        for (let i = start; i <= end; i++) {
            result.push(i);
        }
        return result;
    });

    Handlebars.registerHelper('contains', function(str, substring) {
        return str && str.toLowerCase().includes(substring.toLowerCase());
    });

    Handlebars.registerHelper('getReputations', function() {
        return CONFIG.GLOG?.REPUTATIONS?.reputations || [];
    });

    Handlebars.registerHelper('getReputationDescription', function(reputationType) {
        const reputations = CONFIG.GLOG?.REPUTATIONS?.reputations || [];
        return reputations.find(rep => rep.name === reputationType) || {};
    });

    Handlebars.registerHelper('hasFeatureTip', function(featureName) {
        const tippedFeatures = ['Barbarian Heritage'];
        return tippedFeatures.includes(featureName);
    });

    Handlebars.registerHelper('getFeatureTip', function(featureName) {
        const tips = {
            'Barbarian Heritage': 'Choose one exotic weapon and set its Attack Penalty to -1 to represent your +1 exotic weapon bonus.'
        };
        return tips[featureName] || '';
    });

    Handlebars.registerHelper('hasFeatureRoll', function(featureName) {
        if (!featureName) return false;
        const rollableFeatures = ['Barbarian Heritage', 'Tracker', 'Stalker', 'Danger Sense', 'Acrobat Training'];
        return rollableFeatures.includes(featureName);
    });

    // Register sheet application classes
    foundry.documents.collections.Actors.unregisterSheet("core", foundry.appv1.sheets.ActorSheet);
    foundry.documents.collections.Actors.registerSheet("glog2d6", GLOG2D6ActorSheet, {
        types: ["character", "npc"],
        makeDefault: true,
        label: "GLOG2D6.SheetLabels.Actor"
    });

    foundry.documents.collections.Items.unregisterSheet("core", foundry.appv1.sheets.ItemSheet);
    foundry.documents.collections.Items.registerSheet("glog2d6", GLOG2D6ItemSheet, {
        types: ["weapon", "armor", "gear", "shield", "spell", "feature", "torch"],
        makeDefault: true,
        label: "GLOG2D6.SheetLabels.Item"
    });

    foundry.documents.collections.Actors.registerSheet("glog2d6", GLOG2D6HirelingSheet, {
        types: ["hireling"],
        makeDefault: true,
        label: "GLOG2D6.SheetLabels.Hireling"
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

Hooks.once("ready", async function() {
    console.log('glog2d6 | System Ready');

    // Preload templates
    await foundry.applications.handlebars.loadTemplates([
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
        await foundry.applications.handlebars.getTemplate('systems/glog2d6/templates/actor/character-header.hbs'));
    Handlebars.registerPartial('character-stats',
        await foundry.applications.handlebars.getTemplate('systems/glog2d6/templates/actor/character-stats.hbs'));
    Handlebars.registerPartial('character-tabs',
        await foundry.applications.handlebars.getTemplate('systems/glog2d6/templates/actor/character-tabs.hbs'));
    Handlebars.registerPartial('inventory-tab',
        await foundry.applications.handlebars.getTemplate('systems/glog2d6/templates/actor/inventory-tab.hbs'));
    Handlebars.registerPartial('features-tab',
        await foundry.applications.handlebars.getTemplate('systems/glog2d6/templates/actor/features-tab.hbs'));
    Handlebars.registerPartial('spells-tab',
        await foundry.applications.handlebars.getTemplate('systems/glog2d6/templates/actor/spells-tab.hbs'));
    Handlebars.registerPartial('wounds-tab',
        await foundry.applications.handlebars.getTemplate('systems/glog2d6/templates/actor/wounds-tab.hbs'));

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
    console.log('glog2d6 | Initializing diagnostic system...');
    await initializeDiagnosticSystem();
});

async function initializeDiagnosticSystem() {
    try {
        // Run system health check
        const healthCheck = await runSystemHealthCheck();

        if (healthCheck.critical.length > 0) {
            console.error('🚨 CRITICAL SYSTEM ISSUES DETECTED:', healthCheck.critical);
            ui.notifications.error(`GLOG2D6 System has critical issues: ${healthCheck.critical.join(', ')}`, { permanent: true });
        }

        if (healthCheck.warnings.length > 0) {
            console.warn('⚠️ System warnings:', healthCheck.warnings);
            ui.notifications.warn(`GLOG2D6 warnings: ${healthCheck.warnings.join(', ')}`);
        }

        // Set up diagnostic commands for GMs
        if (game.user.isGM) {
            await setupDiagnosticCommands();
            console.log('🔧 Diagnostic commands available: game.glog2d6.diagnoseActor(id), game.glog2d6.forceActorRecovery(id)');
        }

        // Set up actor sheet monitoring
        setupActorSheetMonitoring();

        console.log('✅ GLOG2D6 Diagnostic system ready');

    } catch (error) {
        console.error('❌ Failed to initialize diagnostic system:', error);
        // Don't let diagnostic system failure break the main system
    }
}

async function runSystemHealthCheck() {
    const results = { critical: [], warnings: [], info: [] };

    try {
        // Check core system registration
        if (game.system.id !== "glog2d6") {
            results.critical.push("System ID mismatch");
        }

        // Check document classes are properly registered
        if (!CONFIG.Actor.documentClass?.name === 'GLOG2D6Actor') {
            results.warnings.push("Actor document class registration issue");
        }

        if (!CONFIG.Item.documentClass?.name === 'GLOG2D6Item') {
            results.warnings.push("Item document class registration issue");
        }

        // Check for existing actors and their states
        const actorIssues = await checkExistingActors();
        results.warnings.push(...actorIssues);

        // Check settings exist
        const settingsIssues = checkSystemSettings();
        results.warnings.push(...settingsIssues);

        // Check that your existing systems are properly loaded
        if (!game.glog2d6?.reconSystem) {
            results.warnings.push("Recon system not initialized");
        }

        results.info.push(`Checked ${game.actors.size} actors`);
        results.info.push(`System version: ${game.system.version}`);

    } catch (error) {
        results.critical.push(`Health check failed: ${error.message}`);
    }

    return results;
}

async function checkExistingActors() {
    const issues = [];
    let corruptedActors = 0;
    let uninitializedActors = 0;

    for (const actor of game.actors) {
        try {
            // Check for basic corruption
            if (!actor.system) {
                corruptedActors++;
                console.error(`Actor ${actor.name} (${actor.id}) has no system data`);
                continue;
            }

            // Check if your custom systems are initialized
            if (!actor._systemsInitialized && actor.initializeComponents) {
                uninitializedActors++;

                // Try to auto-fix
                try {
                    actor.initializeComponents();
                    actor._validateAllSystems();
                    actor._systemsInitialized = true;
                    console.log(`✅ Auto-fixed actor systems for ${actor.name}`);
                } catch (fixError) {
                    console.error(`❌ Failed to auto-fix ${actor.name}:`, fixError);
                }
            }

        } catch (error) {
            corruptedActors++;
            console.error(`Error checking actor ${actor.name}:`, error);
        }
    }

    if (corruptedActors > 0) {
        issues.push(`${corruptedActors} actors have system corruption`);
    }

    if (uninitializedActors > 0) {
        issues.push(`${uninitializedActors} actors had uninitialized systems (auto-fixed)`);
    }

    return issues;
}

function checkSystemSettings() {
    const issues = [];

    try {
        // Check your actual system settings
        const expectedSettings = [
            'gridDistance',
            'autoBurnTorches',
            // Add any other settings your system uses
        ];

        for (const setting of expectedSettings) {
            try {
                game.settings.get("glog2d6", setting);
            } catch (error) {
                issues.push(`Setting '${setting}' not properly registered`);
            }
        }
    } catch (error) {
        issues.push(`Settings check failed: ${error.message}`);
    }

    return issues;
}

function setupActorSheetMonitoring() {
    // Monitor sheet render failures
    Hooks.on("renderActorSheet", (sheet, html, data) => {
        try {
            // Check if this is your actor sheet type
            if (!(sheet instanceof GLOG2D6ActorSheet)) return;

            // Check if sheet rendered in emergency mode
            if (data.emergencyMode) {
                console.warn(`🚨 Actor sheet ${sheet.actor.name} rendered in emergency mode`);

                // Add recovery button if not present
                if (!html.find('.recovery-button').length) {
                    const recoveryButton = $(`
                        <button type="button" class="recovery-button" style="position: absolute; top: 5px; right: 60px; z-index: 1000; background: #ff9800; color: white; border: none; padding: 4px 8px; border-radius: 3px; font-size: 11px;">
                            🔧 Recover
                        </button>
                    `);

                    recoveryButton.click(() => {
                        game.glog2d6?.forceActorRecovery?.(sheet.actor.id);
                    });

                    html.find('.window-header').append(recoveryButton);
                }
            }
        } catch (error) {
            console.error('Sheet monitoring error:', error);
        }
    });

    // Monitor for sheet close/render cycles that might indicate problems
    let sheetRenderCounts = new Map();

    Hooks.on("renderActorSheet", (sheet) => {
        if (!(sheet instanceof GLOG2D6ActorSheet)) return;

        const actorId = sheet.actor.id;
        const count = sheetRenderCounts.get(actorId) || 0;
        sheetRenderCounts.set(actorId, count + 1);

        // If a sheet is rendering excessively, log it
        if (count > 10) {
            console.warn(`🔄 Actor sheet ${sheet.actor.name} has rendered ${count} times - possible render loop`);
        }
    });

    // Clear render counts when sheets close
    Hooks.on("closeActorSheet", (sheet) => {
        if (sheet instanceof GLOG2D6ActorSheet) {
            sheetRenderCounts.delete(sheet.actor.id);
        }
    });

    // Monitor actor data updates that might cause sheet issues
    Hooks.on("updateActor", (actor, updateData, options, userId) => {
        try {
            // Only monitor GLOG2D6 actors
            if (!(actor instanceof GLOG2D6Actor)) return;

            // Check for potentially problematic updates
            if (updateData.system && !actor.system) {
                console.error(`🚨 Actor ${actor.name} system data updated but actor.system is missing`);
            }

            // If an actor sheet is open and gets updated, ensure it's still functional
            if (actor.sheet?.rendered && actor.sheet instanceof GLOG2D6ActorSheet) {
                setTimeout(() => {
                    if (actor.sheet.diagnostics && actor.sheet.diagnostics.failures.length > 0) {
                        console.warn(`Actor ${actor.name} sheet has recorded failures after update`);
                    }
                }, 100);
            }
        } catch (error) {
            console.error('Actor update monitoring error:', error);
        }
    });
}

// Enhanced diagnostic commands that work with your existing system
async function setupDiagnosticCommands() {
    // Ensure the glog2d6 namespace exists (it should from your existing code)
    game.glog2d6 = game.glog2d6 || {};

    // Import the diagnostic functions
    try {
        const { setupDiagnosticCommands: setupSheetDiagnostics } = await import('./module/actor/sheet-diagnostics.mjs');
        setupSheetDiagnostics();
    } catch (error) {
        console.warn('Could not load sheet diagnostics module:', error);
    }

    // Additional system-level diagnostic commands
    game.glog2d6.runHealthCheck = async function() {
        console.log('🔍 Running system health check...');
        const results = await runSystemHealthCheck();

        console.group('🏥 System Health Report');
        if (results.critical.length) {
            console.error('Critical Issues:', results.critical);
        }
        if (results.warnings.length) {
            console.warn('Warnings:', results.warnings);
        }
        if (results.info.length) {
            console.info('Info:', results.info);
        }
        console.groupEnd();

        return results;
    };

    game.glog2d6.fixAllActors = async function() {
        if (!game.user.isGM) {
            ui.notifications.error("Only GMs can run this command");
            return;
        }

        console.log('🔧 Attempting to fix all actors...');
        let fixed = 0;
        let failed = 0;

        for (const actor of game.actors) {
            if (!(actor instanceof GLOG2D6Actor)) continue;

            try {
                if (!actor._systemsInitialized && actor.initializeComponents) {
                    actor.initializeComponents();
                    actor._validateAllSystems();
                    actor._systemsInitialized = true;
                    fixed++;
                    console.log(`✅ Fixed ${actor.name}`);
                }
            } catch (error) {
                failed++;
                console.error(`❌ Failed to fix ${actor.name}:`, error);
            }
        }

        const message = `Fixed ${fixed} actors, ${failed} failed`;
        console.log(message);
        ui.notifications.info(message);

        return { fixed, failed };
    };

    game.glog2d6.resetActor = async function(actorId) {
        if (!game.user.isGM) {
            ui.notifications.error("Only GMs can run this command");
            return;
        }

        const actor = game.actors.get(actorId);
        if (!actor || !(actor instanceof GLOG2D6Actor)) {
            console.error('GLOG2D6 Actor not found:', actorId);
            return;
        }

        console.log(`🔄 Resetting actor ${actor.name}...`);

        try {
            // Close sheet if open
            if (actor.sheet?.rendered) {
                await actor.sheet.close();
            }

            // Reset all cached state
            delete actor._systemsInitialized;
            delete actor._preparedSystemData;

            // Reinitialize your actor systems
            actor.initializeComponents();
            actor._validateAllSystems();
            actor._systemsInitialized = true;

            // Refresh sheet
            setTimeout(() => {
                actor.sheet.render(true);
            }, 200);

            ui.notifications.info(`Reset ${actor.name} successfully`);
            return { success: true };

        } catch (error) {
            console.error(`Failed to reset ${actor.name}:`, error);
            ui.notifications.error(`Failed to reset ${actor.name}: ${error.message}`);
            return { success: false, error: error.message };
        }
    };

    game.glog2d6.debugSheet = function(actorId) {
        const actor = game.actors.get(actorId);
        if (!actor || !(actor instanceof GLOG2D6Actor)) {
            console.error('GLOG2D6 Actor not found:', actorId);
            return;
        }

        const sheet = actor.sheet;
        const diagnostics = sheet.diagnostics?.generateReport() || { error: 'No diagnostics' };

        console.group(`🐛 Debug Info: ${actor.name}`);
        console.log('Actor State:', {
            hasSystem: !!actor.system,
            systemsInitialized: actor._systemsInitialized,
            hasAttributeSystem: !!actor.attributeSystem,
            hasInventorySystem: !!actor.inventorySystem,
            hasBonusSystem: !!actor.bonusSystem,
            hasItems: !!actor.items,
            itemCount: actor.items?.size || 0
        });
        console.log('Sheet State:', {
            rendered: sheet.rendered,
            componentsInitialized: sheet._componentsInitialized,
            emergencyMode: sheet._emergencyMode,
            hasEventRegistry: !!sheet.eventRegistry,
            hasDiagnostics: !!sheet.diagnostics
        });
        console.log('Diagnostics:', diagnostics);
        console.groupEnd();

        return { actor: actor, sheet: sheet, diagnostics: diagnostics };
    };

    console.log('🎯 Diagnostic commands loaded:');
    console.log('  - game.glog2d6.runHealthCheck()');
    console.log('  - game.glog2d6.fixAllActors()');
    console.log('  - game.glog2d6.resetActor(id)');
    console.log('  - game.glog2d6.debugSheet(id)');
}

Hooks.on('renderSidebarTab', (app, html) => {
    if (app.tabName !== 'chat' || !game.user.isGM) return;

    // Convert to jQuery if needed
    const $html = html instanceof jQuery ? html : $(html);

    // Make sure we don't add multiple buttons
    if ($html.find('#recon-chat-btn').length) return;

    const reconBtn = $(`
       <a id="recon-chat-btn" class="chat-control-icon" title="Recon Check" style="margin-left: 4px;">
           <i class="fas fa-search"></i>
       </a>
   `);

    reconBtn.click(() => {
        import("./module/dialogs/recon-dialog.mjs").then(({ ReconDialog }) => {
            new ReconDialog().render(true);
        });
    });

    // Add some spacing and prevent overlap
    $html.find('#chat-controls').css('gap', '2px');
    $html.find('#chat-controls .chat-control-icon').last().after(reconBtn);
});

// GM Chat Commands
Hooks.on("chatMessage", (log, msg) => {
    if (!game.user.isGM) return;

    if (msg === "/recon") {
        new ReconDialog().render(true);
        return false;
    }
});

Hooks.on("renderChatMessageHTML", (message, html) => {
    const $html = $(html);

    $html.find('.magic-die-btn').click(async (event) => {
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
            $html.find('.magic-die-btn').prop('disabled', true).text('Cast!');
        }
    });

    $html.find('.apply-wound-btn').click(async (event) => {
        event.preventDefault();
        const button = event.currentTarget;
        const actorId = button.dataset.actorId;
        const damage = parseInt(button.dataset.damage);

        const actor = game.actors.get(actorId);
        if (actor) {
            await actor.applyWound(damage);
            button.disabled = true;
            button.textContent = "Applied";
        } else {
            ui.notifications.error("Actor not found!");
        }
    });

    $html.find('[data-recon-id]').click(async e => {
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

    $html.find('.break-item-btn').click(async (event) => {
        event.preventDefault();
        const button = event.currentTarget;
        const actorId = button.dataset.actorId;
        const itemType = button.dataset.itemType;

        const actor = game.actors.get(actorId);
        console.log('Actor found:', actor);
        console.log('Actor methods:', Object.getOwnPropertyNames(Object.getPrototypeOf(actor)));
        console.log('breakEquippedItem exists:', typeof actor.breakEquippedItem);

        if (actor && typeof actor.breakEquippedItem === 'function') {
            await actor.breakEquippedItem(itemType);
            button.disabled = true;
            button.textContent = "Broken!";
        } else {
            ui.notifications.error("Actor or method not found!");
        }
    });

    Handlebars.registerHelper('hasFeatureRoll', function(featureName) {
        const rollableFeatures = [
            'Nimble', 'Escape Artist', 'Poisoner', 'At the Gates',
            'Tough', 'Courtly Education', 'Welcome Guest', 'Never Forget a Face',
            'Trapper', 'Thievery Training', 'Well-Planned Heist', 'Black Market Gossip',
            'Ancient Tongues'
        ];

        // check for any version of "Reputation for..."
        const hasReputation = featureName.toLowerCase().includes('reputation for');
        return rollableFeatures.includes(featureName) || hasReputation;
    });

    $html.find('.damage-roll-btn').click(async (event) => {
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
