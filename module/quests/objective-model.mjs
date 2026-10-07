/**
 * An objective: one page of a quest.
 *
 * Subtypes of documents other than Actor and Item do not come from
 * template.json -- they are a `TypeDataModel` registered into
 * `CONFIG.JournalEntryPage.dataModels` under the namespaced key Foundry gives
 * a package's subtypes. The manifest declares the type and which of its
 * fields hold rich text.
 *
 * The schema is only shape and bounds. What the numbers mean lives in
 * systems/quests, which knows nothing about Foundry.
 */

import { DEFAULT_OBJECTIVE_KIND, objectiveProgress } from "../systems/quests.mjs";

export class ObjectiveModel extends foundry.abstract.TypeDataModel {
    static defineSchema() {
        const fields = foundry.data.fields;

        return {
            description: new fields.HTMLField({ required: false, blank: true, initial: "" }),

            // What it is counting, and how far it has got. Everything is a
            // counter, including the ones that only ever reach one.
            kind: new fields.StringField({ required: true, blank: false, initial: DEFAULT_OBJECTIVE_KIND }),
            current: new fields.NumberField({ required: true, integer: true, initial: 0, min: 0 }),
            required: new fields.NumberField({ required: true, integer: true, initial: 1, min: 1 }),

            // The GM's own note, which players never receive: a page they may
            // not see is not sent to them, and this rides along with it.
            secret: new fields.HTMLField({ required: false, blank: true, initial: "" })
        };
    }

    /** The reading the sheet and the log both use, worked out once. */
    prepareDerivedData() {
        this.progress = objectiveProgress(this);
    }
}
