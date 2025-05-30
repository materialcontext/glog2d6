// module/dialogs/recon-dialog.mjs
export class ReconDialog extends FormApplication {
    static get defaultOptions() {
        return foundry.utils.mergeObject(super.defaultOptions, {
            id: "recon-dialog",
            classes: ["glog2d6"],
            title: "Recon Check",
            template: "systems/glog2d6/templates/dialogs/recon-dialog.hbs",
            width: 400,
            height: "auto"
        });
    }

    getData() {
        return {
            actors: game.actors.filter(a => a.type === 'character'),
            checkTypes: {
                'recon': 'Recon (normal exploration)',
                'ambush': 'Ambush (low/no light conditions)'
            }
        };
    }

    async _updateObject(event, data) {
        console.log('Dialog data:', data);

        const actorIds = [];

        // Look for properties that start with "actors."
        for (const [key, value] of Object.entries(data)) {
            if (key.startsWith('actors.') && value) {
                const actorId = key.replace('actors.', '');
                actorIds.push(actorId);
            }
        }

        console.log('Selected actor IDs:', actorIds);

        if (!actorIds.length) return ui.notifications.warn('Select actors');

        const params = {
            location: data.location,
            checkType: data.checkType || 'recon',
            description: data.description
        };

        try {
            await game.glog2d6.reconSystem.initiate(actorIds, params);
            ui.notifications.info('Recon check initiated');
        } catch (error) {
            ui.notifications.error(error.message);
        }
    }
}
