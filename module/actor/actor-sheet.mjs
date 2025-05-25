export class GLOG2D6ActorSheet extends ActorSheet {

    static get defaultOptions() {
        return foundry.utils.mergeObject(super.defaultOptions, {
            classes: ["glog2d6", "sheet", "actor"],
            width: 520,
            height: 760,
            tabs: [{ navSelector: ".sheet-tabs", contentSelector: ".sheet-body", initial: "features" }]
        });
    }

    get template() {
        return `systems/glog2d6/templates/actor/actor-${this.actor.type}-sheet.hbs`;
    }

    async getData() {
        const context = super.getData();

        // Add roll data for formulas
        context.rollData = context.actor.getRollData();
        context.system = context.actor.system;
        context.flags = context.actor.flags;


        // Add edit mode
        context.editMode = this.actor.getFlag("glog2d6", "editMode") === true;

        // Get available classes from compendium pack
        context.availableClasses = await this._getAvailableClasses();

        // Check if character has available class features
        context.hasAvailableFeatures = this._hasAvailableClassFeatures();

        // Debug encumbrance
        if (this.actor.type === "character") {
            console.log(`Sheet getData - Encumbrance: ${context.system.inventory.encumbrance}, Used: ${context.system.inventory.slots.used}/${context.system.inventory.slots.max}`);
        }

        return context;
    }

    activateListeners(html) {
        super.activateListeners(html);

        this._enhanceAttributeDisplay(html);

        // Everything below here is only needed if the sheet is editable
        if (!this.isEditable) return;

        // Attribute rolls - click on card when not in edit mode
        html.find('.attribute-card.clickable').click(this._onAttributeRoll.bind(this));
        html.find('.attribute-save').click(this._onSaveRoll.bind(this));

        // Combat rolls - click on card when not in edit mode
        html.find('.combat-card.clickable[data-action="attack"]').click(this._onAttackRoll.bind(this));
        html.find('.combat-card.clickable[data-action="defend"]').click(this._onDefenseRoll.bind(this));

        // Movement roll
        html.find('.movement-display.clickable').click(this._onMovementRoll.bind(this));

        // Weapon attack buttons
        html.find('.weapon-attack-btn').click(this._onWeaponAttack.bind(this));

        // Equipment toggles
        html.find('.equipped-toggle').change(this._onEquippedToggle.bind(this));

        // Edit mode toggle
        html.find('.edit-toggle').click(this._onEditToggle.bind(this));

        // Item management
        html.find('.item-create').click(this._onItemCreate.bind(this));
        html.find('.item-edit').click(this._onItemEdit.bind(this));
        html.find('.item-delete').click(this._onItemDelete.bind(this));

        // Torch toggle - fixed
        html.find('.torch-btn').click(this._onTorchToggle.bind(this));
        html.find('.torch-icon[data-action="toggle-torch"]').click(this._onTorchItemToggle.bind(this));

        // spells
        html.find('.spell-cast-btn').click(this._onSpellCast.bind(this));

        // Feature management
        html.find('.add-class-features').click(this._onAddClassFeatures.bind(this));
        html.find('.feature-item').click(this._onFeatureToggle.bind(this));
    }

    async _onAttributeRoll(event) {
        event.preventDefault();
        const element = event.currentTarget;
        const attribute = element.dataset.attribute;

        // Use default target of 7, DM will declare if different
        this.actor.rollAttribute(attribute, 7);
    }

    async _onSpellCast(event) {
        event.preventDefault();
        const itemId = event.currentTarget.dataset.itemId;
        const spell = this.actor.items.get(itemId);

        if (spell) {
            // For now, just show the spell in chat - extend this later for actual spell mechanics
            ChatMessage.create({
                speaker: ChatMessage.getSpeaker({ actor: this.actor }),
                content: `
                <div class="glog2d6-roll">
                    <h3>${this.actor.name} casts ${spell.name}</h3>
                    <div class="roll-result">
                        ${spell.system.level ? `<strong>Level:</strong> ${spell.system.level}<br>` : ''}
                        ${spell.system.school ? `<strong>School:</strong> ${spell.system.school}<br>` : ''}
                        ${spell.system.range ? `<strong>Range:</strong> ${spell.system.range}<br>` : ''}
                        ${spell.system.duration ? `<strong>Duration:</strong> ${spell.system.duration}<br>` : ''}
                        ${spell.system.components ? `<strong>Components:</strong> ${spell.system.components}<br>` : ''}
                        <br><strong>Description:</strong><br>
                        ${spell.system.description || 'No description available.'}
                    </div>
                </div>
            `
            });
        }
    }

    async _onTorchToggle(event) {
        event.preventDefault();
        console.log("Main torch toggle clicked");

        try {
            const availableTorches = this.actor.items.filter(item =>
                item.type === "torch" &&
                (!item.system.duration.enabled || item.system.duration.remaining > 0)
            );

            if (availableTorches.length === 0) {
                ui.notifications.warn("No torches available or all torches are burned out!");
                return;
            }

            const result = await this.actor.toggleTorch();
            console.log("Torch toggle result:", result);

            // Force a re-render to update the UI state
            this.render(false);
        } catch (error) {
            console.error("Error toggling torch:", error);
            ui.notifications.error("Failed to toggle torch: " + error.message);
        }
    }

    // NEW: Individual torch item toggle method
    async _onTorchItemToggle(event) {
        event.preventDefault();
        event.stopPropagation(); // Prevent item edit from triggering

        const torchId = event.currentTarget.dataset.itemId;
        const torch = this.actor.items.get(torchId);

        if (!torch) {
            ui.notifications.error("Torch not found!");
            return;
        }

        console.log("Torch item clicked:", torch.name, torchId);

        try {
            // Check if this torch can be used
            if (torch.system.duration.enabled && torch.system.duration.remaining <= 0) {
                ui.notifications.warn(`${torch.name} is burned out!`);
                return;
            }

            const currentlyLit = this.actor.system.torch?.lit || false;
            const currentActiveTorchId = this.actor.system.torch?.activeTorchId;

            if (currentlyLit && currentActiveTorchId === torchId) {
                // This torch is currently active, turn it off
                await this.actor.update({
                    "system.torch.lit": false,
                    "system.torch.activeTorchId": null
                });

                // Turn off token lighting
                await this._updateTokenLighting(false, null);

                ui.notifications.info(`${torch.name} extinguished`);
            } else {
                // Switch to this torch (or turn on if none active)
                await this.actor.update({
                    "system.torch.lit": true,
                    "system.torch.activeTorchId": torchId
                });

                // Update token lighting with this torch's properties
                await this._updateTokenLighting(true, torch);

                ui.notifications.info(`${torch.name} lit`);
            }

            // Force re-render to update UI
            this.render(false);

        } catch (error) {
            console.error("Error toggling torch item:", error);
            ui.notifications.error("Failed to toggle torch: " + error.message);
        }
    }

    // NEW: Helper method to update token lighting
    async _updateTokenLighting(isLit, torch) {
        const tokens = this.actor.getActiveTokens();
        const updates = [];

        for (let token of tokens) {
            if (isLit && torch) {
                // Turn on light with torch properties
                const lightConfig = {
                    alpha: 0.15,
                    angle: torch.system.lightAngle || 360,
                    bright: (torch.system.lightRadius.bright || 20) / canvas.dimensions.distance,
                    coloration: 1,
                    dim: (torch.system.lightRadius.dim || 40) / canvas.dimensions.distance,
                    luminosity: 0.15,
                    saturation: -0.3,
                    contrast: 0.05,
                    shadows: 0.1,
                    animation: {
                        type: torch.system.lightAnimation?.type || null,
                        speed: Math.max(torch.system.lightAnimation?.speed || 1, 1),
                        intensity: Math.min(torch.system.lightAnimation?.intensity || 1, 2),
                        reverse: false
                    },
                    darkness: {
                        min: 0,
                        max: 1
                    },
                    color: torch.system.lightColor || "#ffbb77"
                };

                updates.push({
                    _id: token.id,
                    light: lightConfig
                });
            } else {
                // Turn off light
                updates.push({
                    _id: token.id,
                    light: {
                        alpha: 0,
                        angle: 360,
                        bright: 0,
                        coloration: 1,
                        dim: 0,
                        luminosity: 0,
                        saturation: 0,
                        contrast: 0,
                        shadows: 0,
                        animation: {
                            type: null,
                            speed: 5,
                            intensity: 5,
                            reverse: false
                        },
                        darkness: {
                            min: 0,
                            max: 1
                        },
                        color: null
                    }
                });
            }
        }

        if (updates.length > 0) {
            await canvas.scene.updateEmbeddedDocuments("Token", updates);
        }
    }

    async _onSaveRoll(event) {
        event.preventDefault();
        event.stopPropagation(); // Prevent the event from bubbling up to the attribute card
        const element = event.currentTarget;
        const attribute = element.dataset.attribute;
        this.actor.rollSave(attribute);
    }

    async _onAttackRoll(event) {
        event.preventDefault();

        // Prompt for melee or ranged
        const attackType = await this._getAttackType();
        if (attackType === null) return;

        this.actor.rollAttack(attackType);
    }

    async _onEditToggle(event) {
        event.preventDefault();
        const currentMode = this.actor.getFlag("glog2d6", "editMode") || false;
        await this.actor.setFlag("glog2d6", "editMode", !currentMode);
        this.render();
    }

    async _onDefenseRoll(event) {
        event.preventDefault();
        this.actor.rollDefense();
    }

    async _onEquippedToggle(event) {
        event.preventDefault();
        const itemId = event.currentTarget.dataset.itemId;
        const item = this.actor.items.get(itemId);
        const isEquipping = event.currentTarget.checked;

        if (item && isEquipping) {
            await this._handleEquipment(item);
        } else if (item) {
            await item.update({ "system.equipped": false });
        }

        this.render();
    }

    /**
 * Add class features based on comprehensive feature data
 */
    async _onAddClassFeatures(event) {
        event.preventDefault();

        const className = this.actor.system.details.class;
        const currentLevel = this.actor.system.details.level;

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
            await this._addClassFeaturesEnhanced(className, currentLevel);
            ui.notifications.info(`Added ${className} features for level ${currentLevel}`);
            this.render(); // Refresh the sheet
        } catch (error) {
            console.error("Error adding class features:", error);
            ui.notifications.error("Failed to add class features: " + error.message);
        }
    }

    /**
     * Enhanced class feature addition using detailed feature data
     */
    async _addClassFeaturesEnhanced(className, currentLevel) {
        const classData = window.getGlogClassFeatures(className);
        if (!classData || !classData.features) {
            throw new Error(`No feature data found for class: ${className}`);
        }

        // Get existing features to avoid duplicates
        const existingFeatures = this.actor.items.filter(i =>
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
                img: this._getFeatureIcon(className, "level-0"),
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
                    // Check if this specific feature already exists
                    const exists = existingFeatures.some(f =>
                        f.system.template === template &&
                        f.name === featureData.name
                    );

                    if (!exists) {
                        featuresToAdd.push({
                            name: featureData.name,
                            type: "feature",
                            img: this._getFeatureIcon(className, template),
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
            await this.actor.createEmbeddedDocuments("Item", featuresToAdd);
            console.log(`Added ${featuresToAdd.length} new features for ${className} level ${currentLevel}`);
        } else {
            ui.notifications.info("No new features to add - all appropriate features already exist.");
        }
    }

    /**
     * Updated _getAvailableClasses to use enhanced feature data
     */
    async _getAvailableClasses() {
        const classes = window.getGlogFeatures();
        return classes ? classes.map(cls => cls.name).sort() : [];
    }

    /**
     * Toggle feature active state when clicked
     */
    async _onFeatureToggle(event) {
        if (this.actor.getFlag("glog2d6", "editMode")) return; // Don't toggle in edit mode

        event.preventDefault();
        const itemId = event.currentTarget.dataset.itemId;
        const feature = this.actor.items.get(itemId);

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
    _hasAvailableClassFeatures() {
        const className = this.actor.system.details.class;
        const currentLevel = this.actor.system.details.level;

        if (!className || currentLevel < 1) return false;

        const classData = window.getGlogClassFeatures(className);
        if (!classData || !classData.features) return false;

        // Get existing features
        const existingFeatures = this.actor.items.filter(i =>
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
    _createFeatureData(className, template, featureName, description, level = 1) {
        return {
            name: featureName,
            type: "feature",
            img: this._getFeatureIcon(className, template),
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
    _getFeatureIcon(className, template) {
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

    /**
    * Enhance attribute display with proper coloring, effective values, and modifier handling
    */
    _enhanceAttributeDisplay(html) {
        if (this.actor.getFlag("glog2d6", "editMode")) return; // Skip in edit mode

        html.find('.attribute-card[data-attribute]').each((index, element) => {
            const $card = $(element);
            const attributeKey = $card.attr('data-attribute');

            if (attributeKey) {
                const attribute = this.actor.system.attributes[attributeKey];
                const originalMod = attribute.mod;
                const effectiveMod = attribute.effectiveMod !== undefined ? attribute.effectiveMod : attribute.mod;
                const baseValue = attribute.value;
                const effectiveValue = attribute.effectiveValue !== undefined ? attribute.effectiveValue : attribute.value;

                // FIXED: Show effective attribute value when different from base
                const $attributeValue = $card.find('.attribute-value');
                if (effectiveValue !== baseValue) {
                    // Show effective value with original in parentheses (struck through)
                    $attributeValue.html(`
                    <span class="effective-attr-value">${effectiveValue}</span>
                    <span class="original-attr-value">(${baseValue})</span>
                `);
                } else {
                    // Show normal value
                    $attributeValue.text(baseValue);
                }

                // Update the modifier display
                const $modifierCurrent = $card.find('.modifier-current');
                $modifierCurrent.text((effectiveMod >= 0 ? '+' : '') + effectiveMod);

                // Handle original modifier display
                const $modifierOriginal = $card.find('.modifier-original');
                if (effectiveMod !== originalMod) {
                    $modifierOriginal.text((originalMod >= 0 ? '+' : '') + originalMod).show();
                } else {
                    $modifierOriginal.hide();
                }

                // Apply coloring to attribute value to indicate if value/modifier is affected
                $attributeValue.removeClass('normal negatively-impacted positively-impacted');

                if (effectiveValue < baseValue || effectiveMod < originalMod) {
                    $attributeValue.addClass('negatively-impacted');
                } else if (effectiveValue > baseValue || effectiveMod > originalMod) {
                    $attributeValue.addClass('positively-impacted');
                } else {
                    $attributeValue.addClass('normal');
                }
            }
        });

        // Update movement display to show effective movement (don't touch - it's working)
        const $movementDisplay = html.find('.movement-display');
        if ($movementDisplay.length > 0 && this.actor.type === "character") {
            const baseMovement = this.actor.system.details.movement;
            const effectiveMovement = this.actor.system.details.effectiveMovement;

            if (effectiveMovement !== undefined && effectiveMovement !== baseMovement) {
                // Show effective movement with struck-through original
                $movementDisplay.html(`
                <span>Move</span>
                <span class="effective-value">${effectiveMovement}</span>
                <span class="original-value">(${baseMovement})</span>
            `);
                $movementDisplay.addClass('negatively-impacted');
            } else {
                // Show normal movement
                $movementDisplay.html(`
                <span>Move</span>
                ${baseMovement}
            `);
                $movementDisplay.removeClass('negatively-impacted');
            }
        }
    }

    async _handleEquipment(newItem) {
        const items = this.actor.items;
        const updates = [];

        if (newItem.type === "weapon") {
            const equippedWeapons = items.filter(i => i.type === "weapon" && i.system.equipped);
            const equippedShields = items.filter(i => i.type === "shield" && i.system.equipped);
            const equippedHeavyWeapons = equippedWeapons.filter(w => w.system.size === "heavy");

            if (newItem.system.size === "heavy") {
                // Heavy weapon unequips all other weapons and shields
                for (let item of [...equippedWeapons, ...equippedShields]) {
                    updates.push({ _id: item.id, "system.equipped": false });
                }
            } else {
                // Light/medium weapon
                // First, unequip any heavy weapons (they can't coexist with other weapons)
                for (let weapon of equippedHeavyWeapons) {
                    updates.push({ _id: weapon.id, "system.equipped": false });
                }

                // Then handle normal weapon limits
                const remainingWeapons = equippedWeapons.filter(w => w.system.size !== "heavy");

                if (equippedShields.length > 0) {
                    // Shield prevents second weapon
                    if (remainingWeapons.length >= 1) {
                        // Unequip weakest weapon
                        const weakest = this._findWeakestWeapon(remainingWeapons);
                        updates.push({ _id: weakest.id, "system.equipped": false });
                    }
                } else if (remainingWeapons.length >= 2) {
                    // Two weapons already equipped, unequip weakest
                    const weakest = this._findWeakestWeapon(remainingWeapons);
                    updates.push({ _id: weakest.id, "system.equipped": false });
                }
            }
        } else if (newItem.type === "shield") {
            const equippedWeapons = items.filter(i => i.type === "weapon" && i.system.equipped);
            const equippedShields = items.filter(i => i.type === "shield" && i.system.equipped);
            const equippedHeavyWeapons = equippedWeapons.filter(w => w.system.size === "heavy");

            // Unequip existing shields
            for (let shield of equippedShields) {
                updates.push({ _id: shield.id, "system.equipped": false });
            }

            // Heavy weapons prevent shields
            for (let weapon of equippedHeavyWeapons) {
                updates.push({ _id: weapon.id, "system.equipped": false });
            }

            // If 2 weapons equipped, unequip one
            const remainingWeapons = equippedWeapons.filter(w => w.system.size !== "heavy");
            if (remainingWeapons.length >= 2) {
                const weakest = this._findWeakestWeapon(remainingWeapons);
                updates.push({ _id: weakest.id, "system.equipped": false });
            }
        } else if (newItem.type === "armor") {
            const equippedArmor = items.filter(i => i.type === "armor" && i.system.equipped);

            // Unequip existing armor
            for (let armor of equippedArmor) {
                updates.push({ _id: armor.id, "system.equipped": false });
            }
        }

        // Apply all updates
        if (updates.length > 0) {
            await this.actor.updateEmbeddedDocuments("Item", updates);
        }

        // Equip the new item
        await newItem.update({ "system.equipped": true });
    }

    _findWeakestWeapon(weapons) {
        // Simple logic: heavy > medium > light, then by damage string length
        const priority = { heavy: 3, medium: 2, light: 1 };

        return weapons.reduce((weakest, current) => {
            const weakestPriority = priority[weakest.system.size] || 1;
            const currentPriority = priority[current.system.size] || 1;

            if (currentPriority < weakestPriority) {
                return current;
            } else if (currentPriority === weakestPriority) {
                // Same size, compare damage (rough approximation)
                const weakestDamage = weakest.system.damage?.length || 0;
                const currentDamage = current.system.damage?.length || 0;
                return currentDamage < weakestDamage ? current : weakest;
            }
            return weakest;
        });
    }

    async _onWeaponAttack(event) {
        event.preventDefault();
        const itemId = event.currentTarget.dataset.itemId;
        const weapon = this.actor.items.get(itemId);

        if (weapon) {
            this.actor.rollWeaponAttack(weapon);
        }
    }

    async _onMovementRoll(event) {
        event.preventDefault();
        this.actor.rollMovement();
    }

    async _getAttackType() {
        return new Promise((resolve) => {
            new Dialog({
                title: "Attack Type",
                content: `<p>Choose your attack type:</p>`,
                buttons: {
                    melee: {
                        label: "Melee",
                        callback: () => resolve("melee")
                    },
                    ranged: {
                        label: "Ranged",
                        callback: () => resolve("ranged")
                    }
                },
                default: "melee",
                close: () => resolve(null)
            }).render(true);
        });
    }

    async _onItemCreate(event) {
        event.preventDefault();
        const element = event.currentTarget;
        const type = element.dataset.type;

        const itemData = {
            name: `New ${type.capitalize()}`,
            type: type,
            system: {}
        };

        const cls = getDocumentClass("Item");
        return cls.create(itemData, { parent: this.actor });
    }

    _onItemEdit(event) {
        event.preventDefault();
        const li = $(event.currentTarget).parents(".item");
        const item = this.actor.items.get(li.data("itemId"));
        item.sheet.render(true);
    }

    async _onItemDelete(event) {
        event.preventDefault();
        const li = $(event.currentTarget).parents(".item");
        const item = this.actor.items.get(li.data("itemId"));
        return item.delete();
    }
}
