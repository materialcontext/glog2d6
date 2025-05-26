/**
 * Add class features based on comprehensive feature data
 */
async function addClassFeatures(sheet, event) {
    event.preventDefault();

    const className = sheet.actor.system.details.class;
    const currentLevel = sheet.actor.system.details.level;

    if (!className) {
        ui.notifications.warn("No class selected. Set your class first.");
        return;
    }

    // Confirm with user
    const confirm = await Dialog.confirm({
        title: "Add Class Features",
        content: `<p>Add features for <strong>${className}</strong> up to level <strong>${currentLevel}</strong>?</p>
             <p><small>This will add all appropriate template features with detailed descriptions. Existing features won't be duplicated.</small></p>`
    });

    if (!confirm) return;

    try {
        await addClassFeaturesEnhanced(className, currentLevel);
        ui.notifications.info(`Added ${className} features for level ${currentLevel}`);
        sheet.render(); // Refresh the sheet
    } catch (error) {
        console.error("Error adding class features:", error);
        ui.notifications.error("Failed to add class features: " + error.message);
    }
}

/**
 * Enhanced class feature addition using detailed feature data
 */
async function addClassFeaturesEnhanced(sheet, className, currentLevel) {
    const classData = window.getGlogClassFeatures(className);
    if (!classData || !classData.features) {
        throw new Error(`No feature data found for class: ${className}`);
    }

    // Get existing features to avoid duplicates
    const existingFeatures = sheet.actor.items.filter(i =>
        i.type === "feature" &&
        i.system.classSource === className
    );

    const featuresToAdd = [];

    // Add level-0 feature if not already present
    if (classData.features["level-0"] &&
        !existingFeatures.some(f => f.system.template === "level-0")) {
        const levelZeroFeature = classData.features["level-0"];
        featuresToAdd.push({
            name: levelZeroFeature.name,
            type: "feature",
            img: getFeatureIcon(className, "level-0"),
            system: {
                classSource: className,
                template: "level-0",
                level: 1,
                description: levelZeroFeature.description,
                active: true,
                prerequisites: "None"
            }
        });
    }

    // Add template features based on current level
    const templates = ["A", "B", "C", "D"];
    for (let i = 0; i < Math.min(currentLevel, 4); i++) {
        const template = templates[i];
        const templateFeatures = classData.features[template];

        if (templateFeatures && Array.isArray(templateFeatures)) {
            for (const featureData of templateFeatures) {
                // Check if sheet specific feature already exists
                const exists = existingFeatures.some(f =>
                    f.system.template === template &&
                    f.name === featureData.name
                );

                if (!exists) {
                    featuresToAdd.push({
                        name: featureData.name,
                        type: "feature",
                        img: getFeatureIcon(className, template),
                        system: {
                            classSource: className,
                            template: template,
                            level: i + 1,
                            description: featureData.description,
                            active: true,
                            prerequisites: `${className} Template ${template}`
                        }
                    });
                }
            }
        }
    }

    // Create the features on the actor
    if (featuresToAdd.length > 0) {
        await sheet.actor.createEmbeddedDocuments("Item", featuresToAdd);
        console.log(`Added ${featuresToAdd.length} new features for ${className} level ${currentLevel}`);
    } else {
        ui.notifications.info("No new features to add - all appropriate features already exist.");
    }
}

/**
 * Updated _getAvailableClasses to use enhanced feature data
 */
async function getAvailableClasses() {
    const classes = window.getGlogFeatures();
    return classes ? classes.map(cls => cls.name).sort() : [];
}

/**
 * Toggle feature active state when clicked
 */
async function toggleFeature(sheet, event) {
    if (sheet.actor.getFlag("glog2d6", "editMode")) return; // Don't toggle in edit mode

    event.preventDefault();
    const itemId = event.currentTarget.dataset.itemId;
    const feature = sheet.actor.items.get(itemId);

    if (feature) {
        const newState = !feature.system.active;
        await feature.update({ "system.active": newState });

        const message = newState ? "activated" : "deactivated";
        ui.notifications.info(`${feature.name} ${message}`);
    }
}

/**
* Check if character has available class features to add
*/
function hasAvailableClassFeatures(sheet) {
    const className = sheet.actor.system.details.class;
    const currentLevel = sheet.actor.system.details.level;

    if (!className || currentLevel < 1) return false;

    const classData = window.getGlogClassFeatures(className);
    if (!classData || !classData.features) return false;

    // Get existing features
    const existingFeatures = sheet.actor.items.filter(i =>
        i.type === "feature" &&
        i.system.classSource === className
    );

    // Check level-0 feature
    if (classData.features["level-0"] &&
        !existingFeatures.some(f => f.system.template === "level-0")) {
        return true;
    }

    // Check template features
    const templates = ["A", "B", "C", "D"];
    for (let i = 0; i < Math.min(currentLevel, 4); i++) {
        const template = templates[i];
        const templateFeatures = classData.features[template];

        if (templateFeatures && Array.isArray(templateFeatures)) {
            for (const featureData of templateFeatures) {
                const exists = existingFeatures.some(f =>
                    f.system.template === template &&
                    f.name === featureData.name
                );
                if (!exists) return true;
            }
        }
    }

    return false;
}

/**
 * Create feature data object
 */
function createFeatureData(className, template, featureName, description, level = 1) {
    return {
        name: featureName,
        type: "feature",
        img: getFeatureIcon(className, template),
        system: {
            classSource: className,
            template: template,
            level: level,
            description: description,
            active: true,
            prerequisites: template === "level-0" ? "None" : `${className} Template ${template}`
        }
    };
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

export {
    addClassFeatures,
    addClassFeaturesEnhanced,
    getAvailableClasses,
    toggleFeature,
    hasAvailableClassFeatures,
    createFeatureData,
    getFeatureIcon
};
