import {
    ITEM_SHEET_CONFIG,
    autoFieldsChanged,
    deriveSystemUpdate,
    itemSheetChoices,
    itemSheetTemplate
} from "./item-sheet-config.mjs";

const { HandlebarsApplicationMixin } = foundry.applications.api;
const { ItemSheetV2 } = foundry.applications.sheets;

/**
 * Render context that has to be read off Foundry globals rather than the item
 * itself. Keyed by item type so new types stay a one-line addition.
 * @type {Record<string, () => object>}
 */
const RUNTIME_CHOICES = {
    feature: () => ({ reputationTypes: reputationChoices() })
};

/** Reputation picker options, sourced from the loaded JSON content. */
function reputationChoices() {
    const reputations = CONFIG.GLOG?.REPUTATIONS?.reputations ?? [];
    return Object.fromEntries(reputations.map(rep => [
        rep.name,
        rep.description ? `${rep.name} - ${rep.description}` : rep.name
    ]));
}

/** The checked weapon type tags currently present in the form. */
function readWeaponTypeTags(form) {
    const inputs = form?.querySelectorAll?.('input[name="system.weaponType"]');
    if (!inputs?.length) return null;
    return [...inputs].filter(el => el.checked).map(el => el.value);
}

/**
 * Item sheet for every GLOG2D6 item type.
 *
 * Built on ApplicationV2 / ItemSheetV2. The per-type differences (template,
 * window size, choice lists, derived stats) live in `item-sheet-config.mjs`;
 * this class is only the Foundry adapter around them.
 */
export class GLOG2D6ItemSheet extends HandlebarsApplicationMixin(ItemSheetV2) {

    /** @override */
    static DEFAULT_OPTIONS = {
        classes: ["glog2d6", "sheet", "item"],
        position: { width: 520, height: 480 },
        window: { resizable: true },
        form: { submitOnChange: true, closeOnSubmit: false }
    };

    /**
     * Placeholder part; the real template is chosen per item type in
     * `_configureRenderParts`.
     * @override
     */
    static PARTS = {
        body: { template: itemSheetTemplate("gear") }
    };

    /* -------------------------------------------- */
    /*  Configuration                               */
    /* -------------------------------------------- */

    /** @override */
    _initializeApplicationOptions(options) {
        const type = options.document?.type;
        const initialized = super._initializeApplicationOptions(options);

        if (type) {
            const config = ITEM_SHEET_CONFIG[type];
            if (config?.position) Object.assign(initialized.position ??= {}, config.position);
            initialized.classes ??= [];
            if (!initialized.classes.includes(`item-${type}`)) initialized.classes.push(`item-${type}`);
        }

        return initialized;
    }

    /** @override */
    _configureRenderParts(options) {
        return { body: { template: itemSheetTemplate(this.document.type) } };
    }

    /* -------------------------------------------- */
    /*  Rendering                                   */
    /* -------------------------------------------- */

    /** @override */
    async _prepareContext(options) {
        const context = await super._prepareContext(options);
        const item = this.document;

        return Object.assign(context, {
            item,
            name: item.name,
            system: item.system,
            source: item.toObject().system,
            flags: item.flags,
            editable: this.isEditable,
            rollData: item.getRollData?.() ?? {},
            ...itemSheetChoices(item.type, item),
            ...(RUNTIME_CHOICES[item.type]?.() ?? {})
        });
    }

    /* -------------------------------------------- */
    /*  Submission                                  */
    /* -------------------------------------------- */

    /**
     * Normalise the submitted data before it is validated and written.
     *
     * Two things happen here that the plain form pipeline cannot do on its own:
     *   1. Weapon type is a set of same-named checkboxes, which has to collapse
     *      into a single array field.
     *   2. Changing a governing field (armor type, weapon size/type) re-applies
     *      that profile's baseline stats, as part of the same atomic update.
     *
     * @override
     */
    _processFormData(event, form, formData) {
        const submitData = super._processFormData(event, form, formData);
        const type = this.document.type;

        if (type === "weapon") {
            const tags = readWeaponTypeTags(form);
            if (tags) foundry.utils.setProperty(submitData, "system.weaponType", tags);
        }

        // Work off the source object: it is always plain data, whether or not
        // the item type is backed by a DataModel.
        const currentSystem = this.document.toObject().system ?? {};
        const pendingSystem = foundry.utils.mergeObject(
            currentSystem,
            submitData.system ?? {},
            { inplace: false }
        );

        if (autoFieldsChanged(type, currentSystem, pendingSystem)) {
            const derived = deriveSystemUpdate(type, pendingSystem);
            if (derived) foundry.utils.mergeObject(submitData, foundry.utils.expandObject(derived));
        }

        return submitData;
    }
}
