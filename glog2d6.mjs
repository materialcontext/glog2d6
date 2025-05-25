import { GLOG2D6Actor } from "./module/actor/actor.mjs";
import { GLOG2D6Item } from "./module/item/item.mjs";
import { GLOG2D6ActorSheet } from "./module/actor/actor-sheet.mjs";
import { GLOG2D6ItemSheet } from "./module/item/item-sheet.mjs";


// Store data globally when system initializes
let GLOG_CLASSES = null;
let GLOG_WEAPONS = null;
let GLOG_ARMOR = null;

Hooks.once('init', async function() {
    console.log('glog2d6 | Initializing GLOG 2d6 System');

    // Load all JSON data files
    await loadSystemData();

    // Register Handlebars helpers
    Handlebars.registerHelper('upperCase', function(str) {
        return str.toUpperCase();
    });

    Handlebars.registerHelper('capitalize', function(str) {
        return str.charAt(0).toUpperCase() + str.slice(1);
    });

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
        types: ["weapon", "armor", "gear", "shield", "spell"], // Add "spell" here
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
        "systems/glog2d6/templates/item/item-spell-sheet.hbs"
    ]);
});

// Load all system data from JSON files
async function loadSystemData() {
    // Load classes
    try {
        const response = await fetch('systems/glog2d6/data/classes.json');
        if (response.ok) {
            const classData = await response.json();
            GLOG_CLASSES = classData.classes;
            console.log('glog2d6 | Loaded', GLOG_CLASSES.length, 'classes');
        } else {
            console.warn('glog2d6 | Could not load classes.json');
            GLOG_CLASSES = getDefaultClasses();
        }
    } catch (error) {
        console.error('glog2d6 | Error loading classes.json:', error);
        GLOG_CLASSES = getDefaultClasses();
    }

    // Load weapons
    try {
        const response = await fetch('systems/glog2d6/data/weapons.json');
        if (response.ok) {
            const weaponData = await response.json();
            GLOG_WEAPONS = weaponData;
            console.log('glog2d6 | Loaded', weaponData.weapons.length, 'weapons and', weaponData.ammunition.length, 'ammunition types');
        } else {
            console.warn('glog2d6 | Could not load weapons.json');
            GLOG_WEAPONS = { weapons: [], ammunition: [] };
        }
    } catch (error) {
        console.error('glog2d6 | Error loading weapons.json:', error);
        GLOG_WEAPONS = { weapons: [], ammunition: [] };
    }

    // Load armor
    try {
        const response = await fetch('systems/glog2d6/data/armor.json');
        if (response.ok) {
            const armorData = await response.json();
            GLOG_ARMOR = armorData;
            console.log('glog2d6 | Loaded', armorData.armor.length, 'armor pieces and', armorData.shields.length, 'shields');
        } else {
            console.warn('glog2d6 | Could not load armor.json');
            GLOG_ARMOR = { armor: [], shields: [] };
        }
    } catch (error) {
        console.error('glog2d6 | Error loading armor.json:', error);
        GLOG_ARMOR = { armor: [], shields: [] };
    }
}

// Fallback class data
function getDefaultClasses() {
    return [
        { name: "Acrobat" },
        { name: "Assassin" },
        { name: "Barbarian" },
        { name: "Courtier" },
        { name: "Fighter" },
        { name: "Hunter" },
        { name: "Thief" },
        { name: "Wizard" }
    ];
}

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

        if (game.user.isGM) {
            await createDefaultFolders();
        }
    });

    async function createDefaultFolders() {
        // Only run this once per world to avoid duplicates
        const hasSetupFolders = game.settings.get("glog2d6", "hasSetupDefaultFolders");
        if (hasSetupFolders) {
            console.log('glog2d6 | Default folders already created');
            return;
        }

        console.log('glog2d6 | Creating default item folders and items...');

        try {
            // Create folder structure
            const weaponFolder = await createFolderIfNotExists("Weapons", "Item", "#8B4513");
            const armorFolder = await createFolderIfNotExists("Armor & Shields", "Item", "#4682B4");
            const gearFolder = await createFolderIfNotExists("Equipment & Gear", "Item", "#228B22");

            // Create subfolders for weapons
            const meleeFolder = await createFolderIfNotExists("Melee Weapons", "Item", "#A0522D", weaponFolder.id);
            const rangedFolder = await createFolderIfNotExists("Ranged Weapons", "Item", "#8B4513", weaponFolder.id);
            const ammunitionFolder = await createFolderIfNotExists("Ammunition", "Item", "#654321", weaponFolder.id);

            // Create items from data files
            await createItemsFromData(meleeFolder.id, rangedFolder.id, ammunitionFolder.id, armorFolder.id, gearFolder.id);

            // Mark as completed
            await game.settings.set("glog2d6", "hasSetupDefaultFolders", true);

            ui.notifications.info("GLOG 2d6: Default items and folders created successfully!");

        } catch (error) {
            console.error('glog2d6 | Error creating default folders:', error);
            ui.notifications.error("Failed to create default folders: " + error.message);
        }
    }

    /**
     * Creates a folder if it doesn't already exist
     */
    async function createFolderIfNotExists(name, type, color = "#000000", parentId = null) {
        // Check if folder already exists
        const existingFolder = game.folders.find(f =>
            f.name === name &&
            f.type === type &&
            f.folder === parentId
        );

        if (existingFolder) {
            console.log(`glog2d6 | Folder "${name}" already exists`);
            return existingFolder;
        }

        // Create new folder
        const folderData = {
            name: name,
            type: type,
            color: color,
            folder: parentId,
            sort: 0
        };

        const folder = await Folder.create(folderData);
        console.log(`glog2d6 | Created folder: ${name}`);
        return folder;
    }

    /**
     * Creates items from the loaded JSON data and organizes them into folders
     */
    async function createItemsFromData(meleeFolderId, rangedFolderId, ammunitionFolderId, armorFolderId, gearFolderId) {
        const weaponData = window.getGlogWeapons();
        const armorData = window.getGlogArmor();

        const itemsToCreate = [];

        // Process weapons
        if (weaponData.weapons) {
            for (const weapon of weaponData.weapons) {
                const folderId = weapon.system.weaponType === "ranged" ? rangedFolderId : meleeFolderId;

                itemsToCreate.push({
                    name: weapon.name,
                    type: "weapon",
                    img: weapon.img || "icons/weapons/swords/sword-guard-worn.webp",
                    system: weapon.system,
                    folder: folderId,
                    sort: itemsToCreate.length * 100
                });
            }
        }

        // Process ammunition
        if (weaponData.ammunition) {
            for (const ammo of weaponData.ammunition) {
                itemsToCreate.push({
                    name: ammo.name,
                    type: "gear",
                    img: ammo.img || "icons/weapons/ammunition/arrows-flight-wood.webp",
                    system: ammo.system,
                    folder: ammunitionFolderId,
                    sort: itemsToCreate.length * 100
                });
            }
        }

        // Process armor
        if (armorData.armor) {
            for (const armor of armorData.armor) {
                itemsToCreate.push({
                    name: armor.name,
                    type: "armor",
                    img: armor.img || "icons/equipment/chest/breastplate-leather-brown.webp",
                    system: armor.system,
                    folder: armorFolderId,
                    sort: itemsToCreate.length * 100
                });
            }
        }

        // Process shields
        if (armorData.shields) {
            for (const shield of armorData.shields) {
                itemsToCreate.push({
                    name: shield.name,
                    type: "shield",
                    img: shield.img || "icons/equipment/shield/heater-steel-boss.webp",
                    system: shield.system,
                    folder: armorFolderId,
                    sort: itemsToCreate.length * 100
                });
            }
        }

        // Create all items at once
        if (itemsToCreate.length > 0) {
            await Item.createDocuments(itemsToCreate);
            console.log(`glog2d6 | Created ${itemsToCreate.length} default items`);
        }
    }

    // Global function to get class data
    window.getGlogClasses = function() {
        return GLOG_CLASSES || getDefaultClasses();
    };

    // Global function to get a specific class by name
    window.getGlogClass = function(className) {
        if (!GLOG_CLASSES) return null;
        return GLOG_CLASSES.find(cls => cls.name === className);
    };


    window.getGlogWeapons = function() {
        return GLOG_WEAPONS || { weapons: [], ammunition: [] };
    };

    window.getGlogArmor = function() {
        return GLOG_ARMOR || { armor: [], shields: [] };
    };

    window.getGlogItems = function() {
        const weapons = GLOG_WEAPONS || { weapons: [], ammunition: [] };
        const armor = GLOG_ARMOR || { armor: [], shields: [] };

        return [
            ...weapons.weapons,
            ...weapons.ammunition,
            ...armor.armor,
            ...armor.shields
        ];
    };
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
