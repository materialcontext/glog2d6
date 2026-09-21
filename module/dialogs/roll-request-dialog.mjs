// module/dialogs/roll-request-dialog.mjs
import { ROLL_TYPES, SKILL_ATTRS } from "../systems/roll-requests.mjs";
import { actorChoices, selectedActorIds, wireActorPicker } from "./actor-picker.mjs";
import { requestParams, typeChoices, wireRequestFields } from "./request-form.mjs";

const ATTRIBUTES = ["str", "dex", "con", "int", "wis", "cha"];

/**
 * One dialog for everything the GM can call for.
 *
 * There were two -- a plain one for group rolls and a better one for recon --
 * which is how recon ended up with a character filter and nothing else did.
 * The type now decides which inputs appear, so a trauma save is asked for the
 * same way a save is.
 */
export class RollRequestDialog extends FormApplication {
    /** @param {string} [type] the kind of request to open on. */
    constructor(type = "attribute") {
        super();
        this.type = type;
    }

    static get defaultOptions() {
        return foundry.utils.mergeObject(super.defaultOptions, {
            id: "glog-roll-request",
            classes: ["glog2d6"],
            title: "Call For a Roll",
            template: "systems/glog2d6/templates/dialogs/roll-request.hbs",
            width: 400,
            height: "auto"
        });
    }

    getData() {
        return {
            types: typeChoices(),
            attributes: ATTRIBUTES,
            skills: Object.keys(SKILL_ATTRS),
            actors: actorChoices(game.actors),
            attackers: this._attackers(),
            tables: game.tables?.map(table => table.name) ?? []
        };
    }

    /** Anything that could have struck someone: the world's NPCs, then the party. */
    _attackers() {
        return [...game.actors]
            .filter(actor => actor?.name)
            .sort((a, b) => (a.type === b.type ? a.name.localeCompare(b.name) : a.type === "npc" ? -1 : 1))
            .map(actor => ({ id: actor.id, name: actor.name }));
    }

    activateListeners(html) {
        super.activateListeners(html);
        const root = html[0] ?? html;

        const select = root.querySelector("[name=type]");
        if (select) select.value = this.type;

        wireRequestFields(root);
        wireActorPicker(root);
    }

    async _updateObject(event, data) {
        const actorIds = selectedActorIds(data);
        if (!actorIds.length) return ui.notifications.warn("Select at least one character");

        try {
            await game.glog2d6.gmRollSystem.create(data.type, actorIds, requestParams(data.type, data));
            ui.notifications.info(`${ROLL_TYPES[data.type].name} called for`);
        } catch (error) {
            ui.notifications.error(error.message);
        }
    }
}
