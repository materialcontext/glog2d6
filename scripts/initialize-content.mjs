// create the system folder structure
export async function createDefaultFolders() {
    // Only run this once per world to avoid duplicates
    // Add safety check for setting existence
    let hasSetupFolders;
    try {
        hasSetupFolders = game.settings.get("glog2d6", "hasSetupDefaultFolders");
    } catch (error) {
        console.log('glog2d6 | Setting not found, assuming first run');
        hasSetupFolders = false;
    }

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

        // Mark as completed - use safe setting method
        try {
            await game.settings.set("glog2d6", "hasSetupDefaultFolders", true);
        } catch (error) {
            console.warn('glog2d6 | Could not save setting, but folders created successfully');
        }

        ui.notifications.info("GLOG 2d6: Default items, features, and folders created successfully!");

    } catch (error) {
        console.error('glog2d6 | Error creating default folders:', error);
        ui.notifications.error("Failed to create default folders: " + error.message);
    }
}

// Rest of the file remains the same...
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
function getFeatureIcon(className, _template) {
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
