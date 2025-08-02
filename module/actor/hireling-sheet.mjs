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
     * Override component check since hirelings don't have full actor systems
     */
    _ensureComponentsInitialized() {
        if (this._componentsInitialized) return;

        // Skip the attributeSystem check that would fail for hirelings
        this.initializeMixinsAndComponents();
        this._componentsInitialized = true;
    }
}
