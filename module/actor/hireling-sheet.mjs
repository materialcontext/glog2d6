import { GLOG2D6ActorSheet } from "./actor-sheet.mjs";

export class GLOG2D6HirelingSheet extends GLOG2D6ActorSheet {
    static get defaultOptions() {
        return foundry.utils.mergeObject(super.defaultOptions, {
            width: 400,
            height: 550
        });
    }
}
