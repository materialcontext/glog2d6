export class AttributeSelectionDialog extends FormApplication {
    constructor(actor, featureName, callback) {
        super();
        this.actor = actor;
        this.featureName = featureName;
        this.callback = callback;
    }

    static get defaultOptions() {
        return foundry.utils.mergeObject(super.defaultOptions, {
            id: "attribute-selection-dialog",
            classes: ["glog2d6"],
            title: "Choose Attribute",
            template: "systems/glog2d6/templates/dialogs/attribute-selection.hbs",
            width: 300,
            height: "auto"
        });
    }

    getData() {
        return {
            featureName: this.featureName,
            attributes: [
                { key: 'str', name: 'Strength', mod: this.actor.system.attributes.str.effectiveMod },
                { key: 'dex', name: 'Dexterity', mod: this.actor.system.attributes.dex.effectiveMod },
                { key: 'con', name: 'Constitution', mod: this.actor.system.attributes.con.effectiveMod },
                { key: 'int', name: 'Intelligence', mod: this.actor.system.attributes.int.effectiveMod },
                { key: 'wis', name: 'Wisdom', mod: this.actor.system.attributes.wis.effectiveMod },
                { key: 'cha', name: 'Charisma', mod: this.actor.system.attributes.cha.effectiveMod }
            ]
        };
    }

    async _updateObject(event, formData) {
        const selectedAttribute = formData.attribute;
        if (selectedAttribute && this.callback) {
            await this.callback(selectedAttribute);
        }
    }
}
