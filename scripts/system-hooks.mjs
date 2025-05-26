export function setupSystemHooks() {
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

}
