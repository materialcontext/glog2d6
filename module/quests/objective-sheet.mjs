/**
 * The sheet for one objective page.
 *
 * Journal pages render twice: inline in the journal as prose, and in a form
 * when someone edits them. `JournalEntryPageHandlebarsSheet` gives both, so
 * an objective reads as part of its quest rather than only inside the log.
 */

import { objectiveKind, objectiveProgress } from "../systems/quests.mjs";

const { JournalEntryPageHandlebarsSheet } = foundry.applications.sheets.journal;

export class ObjectiveSheet extends JournalEntryPageHandlebarsSheet {
    static DEFAULT_OPTIONS = {
        classes: ["glog2d6", "glog-objective-sheet"],
        form: { submitOnChange: true }
    };

    static EDIT_PARTS = {
        content: { template: "systems/glog2d6/templates/quests/objective-edit.hbs" },
        footer: { template: "templates/journal/parts/page-footer.hbs", classes: ["journal-footer", "flexrow"] }
    };

    static VIEW_PARTS = {
        content: { template: "systems/glog2d6/templates/quests/objective-view.hbs" }
    };

    async _prepareContext(options) {
        const context = await super._prepareContext(options);
        const system = this.document.system ?? {};

        return {
            ...context,
            progress: objectiveProgress(system),
            kind: objectiveKind(system.kind, CONFIG.GLOG.OBJECTIVE_KINDS),
            kinds: Object.entries(CONFIG.GLOG.OBJECTIVE_KINDS ?? {})
                .map(([key, entry]) => ({ key, label: entry.label })),
            // The GM's note travels with the page, so a player who may not
            // read the page never receives it either.
            isGM: game.user.isGM
        };
    }
}
