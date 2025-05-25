import { GLOG2D6Actor } from "./module/actor/actor.mjs";
import { GLOG2D6Item } from "./module/item/item.mjs";
import { GLOG2D6ActorSheet } from "./module/actor/actor-sheet.mjs";
import { GLOG2D6ItemSheet } from "./module/item/item-sheet.mjs";

let GLOG_CLASSES = null;
let GLOG_WEAPONS = null;
let GLOG_ARMOR = null;
let GLOG_FEATURES = null;
let GLOG_TORCHES = null;
let GLOG_SPELLS = null;

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
        types: ["weapon", "armor", "gear", "shield", "spell", "feature", "torch"],
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
        "systems/glog2d6/templates/item/item-spell-sheet.hbs",
        "systems/glog2d6/templates/item/item-feature-sheet.hbs",
        "systems/glog2d6/templates/item/item-torch-sheet.hbs"
    ]);
});

async function loadSystemData() {
    try {
        // Load features (classes)
        const featuresResponse = await fetch('systems/glog2d6/data/features.json');
        if (featuresResponse.ok) {
            const featureData = await featuresResponse.json();
            GLOG_FEATURES = featureData.classes;
            console.log('glog2d6 | Loaded', GLOG_FEATURES.length, 'classes with detailed features');
        } else {
            console.warn('glog2d6 | Could not load features.json, status:', featuresResponse.status);
            GLOG_FEATURES = getDefaultClasses();
        }
    } catch (error) {
        console.error('glog2d6 | Error loading features.json:', error);
        GLOG_FEATURES = getDefaultClasses();
    }

    // Load weapons
    try {
        const weaponsResponse = await fetch('systems/glog2d6/data/weapons.json');
        if (weaponsResponse.ok) {
            const weaponData = await weaponsResponse.json();
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
        const armorResponse = await fetch('systems/glog2d6/data/armor.json');
        if (armorResponse.ok) {
            const armorData = await armorResponse.json();
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

    // Load torches
    try {
        const torchesResponse = await fetch('systems/glog2d6/data/torches.json');
        if (torchesResponse.ok) {
            const torchData = await torchesResponse.json();
            GLOG_TORCHES = torchData;
            console.log('glog2d6 | Loaded', torchData.torches.length, 'torch types');
        } else {
            console.warn('glog2d6 | Could not load torches.json');
            GLOG_TORCHES = { torches: [] };
        }
    } catch (error) {
        console.error('glog2d6 | Error loading torches.json:', error);
        GLOG_TORCHES = { torches: [] };
    }

    // Load spells from multiple files
    await loadSpellData();
}

// Load spell data from multiple files
async function loadSpellData() {
    GLOG_SPELLS = { spells: [] };

    // List of spell files to load (add more as needed)
    const spellFiles = [
        'spells-1-25.json',
        'spells-26-50.json',
        'spells-51-75.json',
        'spells-76-100.json',  // Add this line
    ];

    for (const filename of spellFiles) {
        try {
            const response = await fetch(`systems/glog2d6/data/${filename}`);
            if (response.ok) {
                const spellData = await response.json();
                if (spellData.spells && Array.isArray(spellData.spells)) {
                    GLOG_SPELLS.spells.push(...spellData.spells);
                    console.log(`glog2d6 | Loaded ${spellData.spells.length} spells from ${filename}`);
                }
            } else if (response.status !== 404) {
                // Only warn if it's not a 404 (file not found is expected for optional files)
                console.warn(`glog2d6 | Could not load ${filename}, status:`, response.status);
            }
        } catch (error) {
            console.error(`glog2d6 | Error loading ${filename}:`, error);
        }
    }

    console.log(`glog2d6 | Total spells loaded: ${GLOG_SPELLS.spells.length}`);
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

    // Set up global functions
    window.getGlogClasses = function() {
        return GLOG_CLASSES || getDefaultClasses();
    };

    window.getGlogClass = function(className) {
        if (!GLOG_CLASSES) return null;
        return GLOG_CLASSES.find(cls => cls.name === className);
    };

    window.getGlogFeatures = function() {
        return GLOG_FEATURES || [];
    };

    window.getGlogClassFeatures = function(className) {
        if (!GLOG_FEATURES) return null;
        return GLOG_FEATURES.find(cls => cls.name === className);
    };

    window.getGlogWeapons = function() {
        return GLOG_WEAPONS || { weapons: [], ammunition: [] };
    };

    window.getGlogArmor = function() {
        return GLOG_ARMOR || { armor: [], shields: [] };
    };

    window.getGlogTorches = function() {
        return GLOG_TORCHES || { torches: [] };
    };

    window.getGlogSpells = function() {
        return GLOG_SPELLS || { spells: [] };
    };

    window.getGlogItems = function() {
        const weapons = GLOG_WEAPONS || { weapons: [], ammunition: [] };
        const armor = GLOG_ARMOR || { armor: [], shields: [] };
        const torches = GLOG_TORCHES || { torches: [] };
        const spells = GLOG_SPELLS || { spells: [] };

        return [
            ...weapons.weapons,
            ...weapons.ammunition,
            ...armor.armor,
            ...armor.shields,
            ...torches.torches,
            ...spells.spells
        ];
    };

    // Rest of the ready hook...
    if (game.user.isGM) {
        await createDefaultFolders();
    }

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
        const featureFolder = await createFolderIfNotExists("Class Features", "Item", "#9932CC");

        // Create subfolders for weapons
        const meleeFolder = await createFolderIfNotExists("Melee Weapons", "Item", "#A0522D", weaponFolder.id);
        const rangedFolder = await createFolderIfNotExists("Ranged Weapons", "Item", "#8B4513", weaponFolder.id);
        const ammunitionFolder = await createFolderIfNotExists("Ammunition", "Item", "#654321", weaponFolder.id);

        // FIXED: Create class subfolders for features using the loaded data
        const classFolders = {};
        const featureData = window.getGlogFeatures(); // Get the loaded feature data

        console.log('glog2d6 | Creating class folders for', featureData ? featureData.length : 0, 'classes');

        if (featureData && Array.isArray(featureData)) {
            for (const classData of featureData) {
                console.log('glog2d6 | Creating folder for class:', classData.name);
                classFolders[classData.name] = await createFolderIfNotExists(
                    classData.name, "Item", "#9932CC", featureFolder.id
                );
            }
        } else {
            console.warn('glog2d6 | No feature data available for folder creation');
            // Fallback: create folders for default classes
            const defaultClasses = ["Acrobat", "Assassin", "Barbarian", "Courtier", "Fighter", "Hunter", "Thief", "Wizard"];
            for (const className of defaultClasses) {
                classFolders[className] = await createFolderIfNotExists(
                    className, "Item", "#9932CC", featureFolder.id
                );
            }
        }

        console.log('glog2d6 | Created', Object.keys(classFolders).length, 'class folders');

        // Create items from data files
        await createItemsFromData(meleeFolder.id, rangedFolder.id, ammunitionFolder.id, armorFolder.id, gearFolder.id, classFolders);

        // Mark as completed
        await game.settings.set("glog2d6", "hasSetupDefaultFolders", true);

        ui.notifications.info("GLOG 2d6: Default items, features, and folders created successfully!");

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
async function createItemsFromData(meleeFolderId, rangedFolderId, ammunitionFolderId, armorFolderId, gearFolderId, classFolders) {
    const weaponData = window.getGlogWeapons();
    const armorData = window.getGlogArmor();
    const torchData = window.getGlogTorches();
    const spellData = window.getGlogSpells();
    const featureData = window.getGlogFeatures();

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

    // FIXED: Process torches properly
    if (torchData.torches) {
        // Create torch folder
        const torchFolder = await createFolderIfNotExists("Torches & Light", "Item", "#ff8800");

        for (const torch of torchData.torches) {
            itemsToCreate.push({
                name: torch.name,
                type: "torch",
                img: torch.img || "icons/sundries/lights/torch-brown-lit.webp",
                system: torch.system,
                folder: torchFolder.id,
                sort: itemsToCreate.length * 100
            });
        }
        console.log(`glog2d6 | Added ${torchData.torches.length} torches to creation queue`);
    }

    // FIXED: Process spells properly
    if (spellData.spells && spellData.spells.length > 0) {
        // Create spell folders
        const spellFolder = await createFolderIfNotExists("Spells", "Item", "#9966cc");

        // Create subfolders for spell levels
        const spellFolders = {};
        const levels = [...new Set(spellData.spells.map(s => s.system.level))].sort((a, b) => a - b);
        for (const level of levels) {
            const levelName = level === 0 ? "Cantrips (Level 0)" : `Level ${level} Spells`;
            spellFolders[level] = await createFolderIfNotExists(levelName, "Item", "#9966cc", spellFolder.id);
        }

        for (const spell of spellData.spells) {
            const spellLevel = spell.system.level || 0;
            const folderId = spellFolders[spellLevel]?.id || spellFolder.id;

            itemsToCreate.push({
                name: spell.name,
                type: "spell",
                img: spell.img || "icons/magic/symbols/runes-star-pentagon-blue.webp",
                system: spell.system,
                folder: folderId,
                sort: itemsToCreate.length * 100
            });
        }
        console.log(`glog2d6 | Added ${spellData.spells.length} spells to creation queue`);
    }

    // Process class features (existing code)
    if (featureData && Array.isArray(featureData)) {
        console.log('glog2d6 | Processing', featureData.length, 'classes for features');

        for (const classData of featureData) {
            const classFolderId = classFolders[classData.name]?.id;
            if (!classFolderId) {
                console.warn(`glog2d6 | No folder found for class: ${classData.name}`);
                continue;
            }

            let sortOrder = 0;

            // Add level-0 feature
            if (classData.features && classData.features["level-0"]) {
                const levelZeroFeature = classData.features["level-0"];
                itemsToCreate.push({
                    name: `${classData.name}: ${levelZeroFeature.name}`,
                    type: "feature",
                    img: getFeatureIcon(classData.name, "level-0"),
                    system: {
                        classSource: classData.name,
                        template: "level-0",
                        level: 1,
                        description: levelZeroFeature.description,
                        active: true,
                        prerequisites: "None"
                    },
                    folder: classFolderId,
                    sort: sortOrder * 100
                });
                sortOrder++;
            }

            // Add template features A-D
            const templates = ["A", "B", "C", "D"];
            for (let i = 0; i < templates.length; i++) {
                const template = templates[i];
                const templateFeatures = classData.features?.[template];

                if (templateFeatures && Array.isArray(templateFeatures)) {
                    for (const feature of templateFeatures) {
                        itemsToCreate.push({
                            name: `${classData.name}: ${feature.name}`,
                            type: "feature",
                            img: getFeatureIcon(classData.name, template),
                            system: {
                                classSource: classData.name,
                                template: template,
                                level: i + 1,
                                description: feature.description,
                                active: true,
                                prerequisites: `${classData.name} Template ${template}`
                            },
                            folder: classFolderId,
                            sort: sortOrder * 100
                        });
                        sortOrder++;
                    }
                }
            }
        }
    }

    // Create all items at once
    if (itemsToCreate.length > 0) {
        console.log(`glog2d6 | Creating ${itemsToCreate.length} total items`);
        await Item.createDocuments(itemsToCreate);
        console.log(`glog2d6 | Successfully created ${itemsToCreate.length} default items and features`);
    } else {
        console.warn('glog2d6 | No items to create');
    }
}

/**
 * Get appropriate icon for features based on class and template
 */
function getFeatureIcon(className, template) {
    const classIcons = {
        "Fighter": "icons/skills/melee/blade-tip-chipped-blood-red.webp",
        "Wizard": "icons/magic/symbols/runes-star-pentagon-blue.webp",
        "Thief": "icons/skills/social/theft-pickpocket-bribery-brown.webp",
        "Barbarian": "icons/skills/melee/strike-hammer-destructive-orange.webp",
        "Hunter": "icons/weapons/bows/bow-recurve-yellow.webp",
        "Acrobat": "icons/skills/movement/feet-winged-boots-brown.webp",
        "Assassin": "icons/weapons/daggers/dagger-curved-poison-green.webp",
        "Courtier": "icons/skills/social/diplomacy-handshake.webp"
    };

    return classIcons[className] || "icons/sundries/scrolls/scroll-bound-brown.webp";
}

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
