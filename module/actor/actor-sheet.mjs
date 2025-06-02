export class GLOG2D6ActorSheet extends foundry.appv1.sheets.ActorSheet {
    constructor(...args) {
        super(...args);
    }

    static get defaultOptions() {
        return foundry.utils.mergeObject(super.defaultOptions, {
            classes: ["glog2d6", "sheet", "actor"],
            width: 600,
            height: 1050,
            tabs: [{ navSelector: ".sheet-tabs", contentSelector: ".sheet-body", initial: "inventory" }]
        });
    }


    get template() { return ``; }

    async getData() {
        const context = super.getData();
    }

    activateListeners(html) {
            super.activateListeners(html);
    }
}