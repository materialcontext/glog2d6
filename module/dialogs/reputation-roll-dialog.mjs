export class ReputationRollDialog extends FormApplication {
    constructor(actor, featureName, callback) {
        super();
        this.actor = actor;
        this.featureName = featureName;
        this.callback = callback;
    }

    static get defaultOptions() {
        return foundry.utils.mergeObject(super.defaultOptions, {
            id: "reputation-roll-dialog",
            classes: ["glog2d6"],
            title: "Reputation Roll",
            template: "systems/glog2d6/templates/dialogs/reputation-roll.hbs",
            width: 350,
            height: "auto"
        });
    }

    getData() {
        return {
            featureName: this.featureName,
            chaMod: this.actor.system.attributes.cha.effectiveMod,
            reactionBonus: this.actor.system.skills.reaction.bonus || 0,
            diplomacyBonus: this.actor.system.skills.diplomacy.bonus || 0
        };
    }

    async _updateObject(event, formData) {
        const rollType = formData.rollType;
        if (rollType && this.callback) {
            await this.callback(rollType);
        }
    }
}
