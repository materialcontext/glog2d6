import { GLOG2D6Actor } from "./module/actor/actor.mjs";
import { GLOG2D6Item } from "./module/item/item.mjs";
import { GLOG2D6ActorSheet } from "./module/actor/actor-sheet.mjs";
import { GLOG2D6HirelingSheet } from "./module/actor/hireling-sheet.mjs";
import { GLOG2D6ItemSheet } from "./module/item/item-sheet.mjs";
import { ITEM_SHEET_TYPES, itemSheetTemplates } from "./module/item/item-sheet-config.mjs";
import { SubtleRollReveal } from './module/dice/subtle-roll-reveal.mjs';
import { SUBTLE_HIDDEN_CLASS, hidesSubtleMessage } from './module/dice/subtle-roll-visibility.mjs';
import { setupGlobalUtils } from "./scripts/system-utils.mjs";
import { loadSpellData, loadSystemData } from "./data/data-loader.mjs";
import { createDefaultFolders, migrateContent } from "./scripts/initialize-content.mjs";
import { setupSystemHooks } from './scripts/system-hooks.mjs';
import { blowFrom, initGMRolls } from "./module/systems/gm-roll-system.mjs";
import { applyDamage, initContestFlow } from "./module/systems/contest-flow.mjs";
import { RollRequestDialog } from "./module/dialogs/roll-request-dialog.mjs";
import { BreakageCalculator } from "./module/systems/breakage-calculator.mjs";
import { WOUND_STATE_LABELS, combatEffectLabel } from "./module/systems/wounds.mjs";
import { featureBadge, itemSummary } from "./module/actor/sheet-readouts.mjs";
import { initiativeConfig } from "./module/systems/initiative.mjs";

/**
 * Unregister core's default sheets for a document collection, tolerating classes
 * that no longer exist on the running core version.
 */
function unregisterCoreSheets(collection, classes) {
    for (const cls of classes) {
        if (!cls) continue;
        try {
            collection.unregisterSheet("core", cls);
        } catch (error) {
            console.debug(`glog2d6 | Core sheet ${cls.name} was not registered:`, error);
        }
    }
}

/**
 * Register every sheet this system provides.
 *
 * This MUST be called synchronously, before the init hook's first `await`.
 * Foundry fires init with `Hooks.callAll`, which does not await its callbacks,
 * so anything after an `await` in an async hook runs a tick later -- after core
 * has moved past init and settled the sheet registry. Registering from there is
 * a race against however long the data files take to fetch: a small world wins
 * it, a world with real content and a dozen modules loses, and the loser gets a
 * silently empty registry and core's fallback sheet on every actor.
 *
 * None of this depends on the loaded data, so there is nothing to wait for.
 */
function registerDocumentSheets() {
    // Register sheet application classes.
    // Core's default sheet class differs between the AppV1 and AppV2 eras, so try
    // both and ignore the one that isn't registered on this core version.
    unregisterCoreSheets(foundry.documents.collections.Actors, [
        foundry.applications?.sheets?.ActorSheetV2,
        foundry.appv1?.sheets?.ActorSheet
    ]);
    foundry.documents.collections.Actors.registerSheet("glog2d6", GLOG2D6ActorSheet, {
        types: ["character"],
        makeDefault: true,
        label: "GLOG2D6.SheetLabels.Actor"
    });

    foundry.documents.collections.Actors.registerSheet("glog2d6", GLOG2D6HirelingSheet, {
        types: ["hireling"],
        makeDefault: true,
        label: "GLOG2D6.SheetLabels.Hireling"
    });

    unregisterCoreSheets(foundry.documents.collections.Items, [
        foundry.applications?.sheets?.ItemSheetV2,
        foundry.appv1?.sheets?.ItemSheet
    ]);
    foundry.documents.collections.Items.registerSheet("glog2d6", GLOG2D6ItemSheet, {
        types: [...ITEM_SHEET_TYPES],
        makeDefault: true,
        label: "GLOG2D6.SheetLabels.Item"
    });
}

// Define custom Document classes
CONFIG.Actor.documentClass = GLOG2D6Actor;
CONFIG.Item.documentClass = GLOG2D6Item;

Hooks.once('init', async function() {
    // Before anything that can yield -- see registerDocumentSheets.
    registerDocumentSheets();

    // Without this the combat tracker has no formula at all: Foundry's default
    // is null and the manifest declares none.
    CONFIG.Combat.initiative = initiativeConfig();

    // Registers chat-message wiring, so like the sheets it must be set up
    // before init can yield -- see registerDocumentSheets.
    initGMRolls();
    initContestFlow();

    // Every kind of request -- a save, a recon check, a trauma save -- is
    // called for through the one dialog.
    game.glog2d6 ??= {};
    game.glog2d6.rollRequest = (type) => new RollRequestDialog(type).render(true);

    // Load all JSON data files
    await loadSystemData();
    await loadSpellData();

    // Register Handlebars helpers
    // The facts a 28px row has no width for, on the row's tooltip instead.
    Handlebars.registerHelper('itemSummary', itemSummary);

    // "Fighter D" -- the class and the template that granted it, together.
    Handlebars.registerHelper('featureBadge', featureBadge);

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

    Handlebars.registerHelper('woundStateLabel', function(state) {
        return WOUND_STATE_LABELS[state] || state || '';
    });

    Handlebars.registerHelper('combatEffectLabel', function(effect) {
        return combatEffectLabel(effect);
    });

    // The wounds panel stamps every wound with the date it was taken.
    Handlebars.registerHelper('formatDate', function(value) {
        if (!value) return '';
        const date = new Date(value);
        return Number.isNaN(date.valueOf()) ? '' : date.toLocaleDateString();
    });

    // Condition helpers -- every template reads the breakage track through
    // these so weapons, armor and shields can never drift apart again.
    Handlebars.registerHelper('isBroken', level => BreakageCalculator.isBroken(level));
    Handlebars.registerHelper('isDamaged', level => BreakageCalculator.isDamaged(level));
    Handlebars.registerHelper('breakageLabel', level => BreakageCalculator.label(level));

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

    game.settings.register("glog2d6", "contentVersion", {
        name: "Content Version",
        scope: "world",
        config: false,
        type: String,
        default: ""
    });

    console.log('glog2d6 | System initialization complete');
});

Hooks.once("ready", async function() {
    console.log('glog2d6 | System Ready');

    // Preload templates
    await foundry.applications.handlebars.loadTemplates([
        // sheets
        "systems/glog2d6/templates/actor/actor-character-sheet.hbs",
        "systems/glog2d6/templates/actor/actor-character-compact.hbs",
        "systems/glog2d6/templates/actor/actor-hireling-sheet.hbs",
        ...itemSheetTemplates(),
        "systems/glog2d6/templates/dialogs/roll-request.hbs"
    ]);

    // Register partials. Compact and full share the four parts that carry the
    // things you click; the rest belong to the full sheet alone.
    for (const name of [
        "combat-tiles",
        "attribute-tiles",
        "skill-chips",
        "utility-stack",
        "band",
        "tests",
        "panel-carry",
        "panel-character",
        "panel-magic"
    ]) {
        Handlebars.registerPartial(
            name,
            await foundry.applications.handlebars.getTemplate(
                `systems/glog2d6/templates/actor/parts/${name}.hbs`
            )
        );
    }

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
        const rollableFeatures = [
            'Barbarian Heritage', 'Tracker', 'Stalker', 'Danger Sense', 'Acrobat Training',
            'Nimble', 'Escape Artist', 'Poisoner', 'At the Gates', 'Tough', 'Courtly Education',
            'Welcome Guest', 'Never Forget a Face', 'Trapper', 'Thievery Training',
            'Well-Planned Heist', 'Black Market Gossip', 'Ancient Tongues', 'Unassuming',
            'Academic Debater', 'Adjutant', 'Field Promoted', 'Rakish Lieutenant', 'Deconstructor'
        ];
        return rollableFeatures.includes(featureName);
    });

    document.addEventListener('error', (event) => {
        if (event.target.tagName === 'IMG' && !event.target.dataset.fallbackApplied) {
            event.target.dataset.fallbackApplied = 'true';
            event.target.src = 'icons/svg/item-bag.svg';
        }
    }, true);

    setupGlobalUtils();

    if (game.user.isGM) {
        await createDefaultFolders();
        await migrateContent();
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

// Calling for a roll, as a one-shot tool under the Token scene controls.
//
// This used to inject an icon into the chat controls on `renderSidebarTab`.
// That hook stopped firing when the sidebar moved to ApplicationV2 in v13, and
// the chat input and its controls are now re-parented outside the normal render
// pass, so there is no stable place to splice into. Scene controls are a
// documented, supported extension point.
Hooks.on("getSceneControlButtons", controls => {
    if (!game.user?.isGM) return;

    // v13+ passes a record of controls, each with a record of tools.
    const tokenControls = controls?.tokens;
    if (!tokenControls?.tools) {
        console.warn("glog2d6 | Token scene controls unavailable; skipping Recon tool");
        return;
    }

    tokenControls.tools.glog2d6RollRequest = {
        name: "glog2d6RollRequest",
        title: "Call For a Roll",
        icon: "fas fa-dice",
        button: true,
        visible: true,
        order: Object.keys(tokenControls.tools).length,
        onChange: () => game.glog2d6.rollRequest()
    };
});

// GM Chat Commands
Hooks.on("chatMessage", (log, msg) => {
    if (!game.user.isGM) return;

    if (msg === "/recon") {
        game.glog2d6.rollRequest("recon");
        return false;
    }
});

Hooks.on("renderChatMessageHTML", (message, html) => {
    // Each viewer keeps the half of a subtle roll addressed to them; see
    // dice/subtle-roll-visibility.
    if (hidesSubtleMessage(message.flags, { isGM: game.user.isGM })) {
        const row = html.closest?.("[data-message-id]") ?? html;
        row.classList?.add(SUBTLE_HIDDEN_CLASS);
        return;
    }

    const $html = $(html);

    if (game.user.isGM) {
        const messageId = html.dataset?.messageId
            ?? html.closest?.('[data-message-id]')?.dataset.messageId;
        const msg = messageId ? game.messages.get(messageId) : null;
        if (!msg) return;

        const subtleData = msg.flags?.glog2d6?.subtleRoll;
        if (subtleData && !subtleData.revealed) {
            const revealBtn = $(`
                <div class="subtle-controls mt-8 pt-8" style="border-top: 1px solid var(--color-border-light-tertiary);">
                    <button type="button" class="btn btn-secondary p-4 text-small w-full subtle-reveal-btn">
                        <i class="fas fa-eye"></i> Reveal to Players
                    </button>
                </div>
            `);
            $html.find('.glog2d6-roll').append(revealBtn);
            revealBtn.find('.subtle-reveal-btn').click(async (e) => {
                e.preventDefault();
                await SubtleRollReveal.reveal(msg.id);
            });
        }
    }

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
            // What struck, where the GM said so, so the wound is drawn from
            // that attacker's table and rolled against the right anatomy.
            await actor.applyWound(damage, blowFrom({
                attacker: button.dataset.attacker,
                weapon: button.dataset.weapon,
                woundTable: button.dataset.woundTable
            }));
            button.disabled = true;
            button.textContent = "Applied";
        } else {
            ui.notifications.error("Actor not found!");
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
            'Barbarian Heritage', 'Tracker', 'Stalker', 'Danger Sense', 'Acrobat Training',
            'Nimble', 'Escape Artist', 'Poisoner', 'At the Gates', 'Tough', 'Courtly Education',
            'Welcome Guest', 'Never Forget a Face', 'Trapper', 'Thievery Training',
            'Well-Planned Heist', 'Black Market Gossip', 'Ancient Tongues', 'Unassuming',
            'Academic Debater', 'Adjutant', 'Field Promoted', 'Rakish Lieutenant', 'Deconstructor'
        ];

        // check for any version of "Reputation for..."
        const hasReputation = featureName.toLowerCase().includes('reputation for');
        return rollableFeatures.includes(featureName) || hasReputation;
    });

    $html.find('.damage-roll-btn').click(async (event) => {
        event.preventDefault();
        const button = event.currentTarget;
        const { actorId, weaponId, targetId, crit } = button.dataset;

        const actor = game.actors.get(actorId);
        const weapon = actor?.items.get(weaponId);

        if (actor && weapon) {
            // The margin the contest was won by, worked out where the contest
            // was. This used to be the literal string "{{roll.total}}".
            await actor.rollWeaponDamage(weapon, parseInt(button.dataset.baseDamage) || 0, {
                crit: Boolean(crit),
                targetId: targetId ?? ""
            });
            button.disabled = true;
            button.textContent = "Rolled";
        } else {
            ui.notifications.error("Actor or weapon not found!");
        }
    });

    $html.find('.apply-damage-btn').click(async (event) => {
        event.preventDefault();
        const button = event.currentTarget;
        const { targetId, attackerId, weaponId, crit } = button.dataset;

        await applyDamage({
            targetId,
            amount: parseInt(button.dataset.damage) || 0,
            dieTotal: parseInt(button.dataset.dieTotal) || 0,
            crit: Boolean(crit),
            attackerId,
            weaponId
        });

        button.disabled = true;
        button.textContent = "Applied";
    });
});
