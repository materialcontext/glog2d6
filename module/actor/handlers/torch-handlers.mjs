
/**
 *  Torch related fucntions for actor-sheet handlers
 * */
async function toggleTorch(sheet, event) {
    event.preventDefault();
    console.log("Main torch toggle clicked");

    try {
        const availableTorches = sheet.actor.items.filter(item =>
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
async function toggleTorchItem(sheet, event) {
    event.preventDefault();
    event.stopPropagation(); // Prevent item edit from triggering

    const torchId = event.currentTarget.dataset.itemId;
    const torch = sheet.actor.items.get(torchId);

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

        const currentlyLit = sheet.actor.system.torch?.lit || false;
        const currentActiveTorchId = sheet.actor.system.torch?.activeTorchId;

        if (currentlyLit && currentActiveTorchId === torchId) {
            // This torch is currently active, turn it off
            await this.actor.update({
                "system.torch.lit": false,
                "system.torch.activeTorchId": null
            });

            // Turn off token lighting
            await updateTokenLighting(false, null);

            ui.notifications.info(`${torch.name} extinguished`);
        } else {
            // Switch to this torch (or turn on if none active)
            await sheet.actor.update({
                "system.torch.lit": true,
                "system.torch.activeTorchId": torchId
            });

            // Update token lighting with this torch's properties
            await updateTokenLighting(true, torch);

            ui.notifications.info(`${torch.name} lit`);
        }

        // Force re-render to update UI
        sheet.render(false);

    } catch (error) {
        console.error("Error toggling torch item:", error);
        ui.notifications.error("Failed to toggle torch: " + error.message);
    }
}

// NEW: Helper method to update token lighting
async function updateTokenLighting(sheet, isLit, torch) {
    const tokens = sheet.actor.getActiveTokens();
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

export {
    toggleTorch,
    toggleTorchItem,
    updateTokenLighting
}
