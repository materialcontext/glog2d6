// module/dialogs/recon-dialog.mjs
import { reconActorChoices, selectedActorIds, wireReconSelection } from "./recon-selection.mjs";

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
            actors: reconActorChoices(game.actors),
            checkTypes: {
                'recon': 'Recon (normal exploration)',
                'ambush': 'Ambush (low/no light conditions)'
            }
        };
    }

    activateListeners(html) {
        super.activateListeners(html);
        wireReconSelection(html[0] ?? html);
    }

    async _updateObject(event, data) {
        const actorIds = selectedActorIds(data);
        if (!actorIds.length) return ui.notifications.warn('Select at least one character');

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
