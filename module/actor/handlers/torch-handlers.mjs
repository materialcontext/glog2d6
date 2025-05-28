async function toggleTorch(actor, event) {
    event.preventDefault();
    console.log("Main torch toggle clicked");

    try {
        const availableTorches = actor.items.filter(item =>
            item.type === "torch" &&
            (!item.system.duration.enabled || item.system.duration.remaining > 0)
        );

        if (availableTorches.length === 0) {
            return ui.notifications.warn("No torches available or all are burned out!");
        }

        const result = await actor.toggleTorch();
        console.log("Torch toggle result:", result);
        return { "ok": true }
        sheet.render(false); // MOVE MEEEEE Re-render sheet UI
    } catch (err) {
        console.error("Error toggling torch:", err);
        ui.notifications.error("Failed to toggle torch: " + err.message);
        return { "ok": false }
    }

}

async function toggleTorchItem(actor, event) {
    event.preventDefault();
    event.stopPropagation();

    const torchId = event.currentTarget.dataset.itemId;
    const torch = actor.items.get(torchId);

    if (!torch) return ui.notifications.error("Torch not found!");

    console.log("Torch item clicked:", torch.name, torchId);

    try {
        if (torch.system.duration.enabled && torch.system.duration.remaining <= 0) {
            return ui.notifications.warn(`${torch.name} is burned out!`);
        }

        const { lit, activeTorchId } = actor.system.torch || {};
        const isActive = lit && activeTorchId === torchId;

        await actor.update({
            "system.torch.lit": !isActive,
            "system.torch.activeTorchId": isActive ? null : torchId
        });

        await updateTokenLighting(actor, !isActive, isActive ? null : torch);

        ui.notifications.info(`${torch.name} ${isActive ? "extinguished" : "lit"}`);
        return { "ok": true }
        sheet.render(false); // MOVE MEEEEE
    } catch (err) {
        console.error("Error toggling torch item:", err);
        ui.notifications.error("Failed to toggle torch: " + err.message);
        return { "ok": false}
    }
}

async function updateTokenLighting(actor, isLit, torch) {
    const tokens = actor.getActiveTokens();
    const updates = tokens.map(token => ({
        _id: token.id,
        light: isLit && torch ? getTorchLightConfig(torch) : lightsOff
    }));

    if (updates.length) {
        await canvas.scene.updateEmbeddedDocuments("Token", updates);
    }
}

function getTorchLightConfig(torch, canvasDistance) {
    return {
        alpha: 0.15,
        angle: torch.system.lightAngle || 360,
        bright: (torch.system.lightRadius?.bright || 20) / canvasDistance,
        coloration: 1,
        dim: (torch.system.lightRadius?.dim || 40) / canvasDistance,
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
        color: "#ffbb77"
    };
}

const lightsOff = {
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
};

export {
    toggleTorch,
    toggleTorchItem,
    updateTokenLighting,
    getTorchLightConfig,
    lightsOff
}
