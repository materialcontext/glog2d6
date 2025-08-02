// module/actor/hireling-sheet.mjs
import { GLOG2D6ActorSheet } from "./actor-sheet.mjs";

export class GLOG2D6HirelingSheet extends GLOG2D6ActorSheet {
    static get defaultOptions() {
        return foundry.utils.mergeObject(super.defaultOptions, {
            width: 400,
            height: 550
        });
    }

    /**
     * Override getData to ensure torch state is included
     */
    async getData() {
        const context = await super.getData();

        // Ensure torch system exists for hirelings
        if (!context.system.torch) {
            context.system.torch = {
                lit: false,
                activeTorchId: null
            };
        }

        return context;
    }

    /**
     * Override activateListeners to ensure torch handlers work
     * The parent class already has the torch handling logic via the event registry
     */
    activateListeners(html) {
        super.activateListeners(html);

        // The parent class EventHandlerRegistry already includes:
        // { selector: '.torch-icon[data-action="toggle-torch"]', event: 'click', handler: 'handleTorchItemToggle' }
        // So torches should work automatically!
    }
}
