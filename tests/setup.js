/**
 * Minimal Foundry VTT test doubles.
 *
 * Just enough of the v13/v14 `foundry.*` surface for the system's modules to be
 * imported and exercised under vitest. The doubles mirror the real API shapes
 * (ApplicationV2 option initialisation, the form submission pipeline,
 * `foundry.utils` object helpers) so behaviour tested here is meaningful.
 */

/* -------------------------------------------- */
/*  foundry.utils                               */
/* -------------------------------------------- */

function deepClone(value) {
    if (Array.isArray(value)) return value.map(deepClone);
    if (value && typeof value === "object" && value.constructor === Object) {
        return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, deepClone(v)]));
    }
    return value;
}

function getProperty(object, path) {
    return String(path).split(".").reduce((o, k) => (o == null ? o : o[k]), object);
}

function setProperty(object, path, value) {
    const keys = String(path).split(".");
    const last = keys.pop();
    let target = object;
    for (const key of keys) {
        if (typeof target[key] !== "object" || target[key] === null) target[key] = {};
        target = target[key];
    }
    target[last] = value;
    return true;
}

function expandObject(flat) {
    const expanded = {};
    for (const [key, value] of Object.entries(flat ?? {})) setProperty(expanded, key, value);
    return expanded;
}

function isPlainObject(value) {
    return !!value && typeof value === "object" && !Array.isArray(value);
}

function mergeObject(original, other = {}, { inplace = true } = {}) {
    const target = inplace ? original : deepClone(original);
    for (const [key, value] of Object.entries(other)) {
        if (isPlainObject(value) && isPlainObject(target[key])) mergeObject(target[key], value);
        else target[key] = deepClone(value);
    }
    return target;
}

/* -------------------------------------------- */
/*  ApplicationV2 / DocumentSheetV2 doubles     */
/* -------------------------------------------- */

class ApplicationV2 {
    constructor(options = {}) {
        this.options = this._initializeApplicationOptions(options);
    }

    static DEFAULT_OPTIONS = {};
    static PARTS = {};

    /** Walks the prototype chain the way ApplicationV2 merges DEFAULT_OPTIONS. */
    _initializeApplicationOptions(options) {
        const chain = [];
        for (let cls = this.constructor; cls && cls !== Function.prototype; cls = Object.getPrototypeOf(cls)) {
            if (Object.hasOwn(cls, "DEFAULT_OPTIONS")) chain.unshift(cls.DEFAULT_OPTIONS);
        }
        const merged = chain.reduce((acc, defaults) => mergeObject(acc, defaults ?? {}), {});
        return mergeObject(merged, options);
    }

    _configureRenderParts() {
        return deepClone(this.constructor.PARTS);
    }

    async _prepareContext() {
        return {};
    }

    /** Mirrors DocumentSheetV2: expand the flat form data into an update object. */
    _processFormData(event, form, formData) {
        return expandObject(formData?.object ?? {});
    }

    /** Mirrors DocumentSheetV2: process, then (in core) validate, the submission. */
    _prepareSubmitData(event, form, formData, updateData) {
        const submitData = this._processFormData(event, form, formData);
        if (updateData) mergeObject(submitData, updateData);
        return submitData;
    }
}

class DocumentSheetV2 extends ApplicationV2 {
    constructor(options = {}) {
        super(options);
        this.#document = options.document;
    }

    #document;

    get document() {
        return this.#document;
    }

    get isEditable() {
        return this.options.editable !== false;
    }
}

class ItemSheetV2 extends DocumentSheetV2 {
    get item() {
        return this.document;
    }
}

const HandlebarsApplicationMixin = Base => class extends Base {};

/* -------------------------------------------- */
/*  Globals                                     */
/* -------------------------------------------- */

globalThis.foundry = {
    utils: { deepClone, getProperty, setProperty, expandObject, mergeObject },
    applications: {
        api: { ApplicationV2, DocumentSheetV2, HandlebarsApplicationMixin },
        sheets: { ItemSheetV2 },
        handlebars: { loadTemplates: async () => [], getTemplate: async () => "" }
    },
    // The actor sheets are still AppV1, so importing them needs a base class to
    // extend. It only has to be constructible -- the behaviour under test lives
    // in the subclass and in the pure modules it delegates to.
    appv1: { sheets: { ActorSheet: class ActorSheet {} } },
    documents: { collections: {} }
};

globalThis.CONFIG = globalThis.CONFIG ?? {};
globalThis.CONFIG.GLOG = globalThis.CONFIG.GLOG ?? {
    REPUTATIONS: {
        reputations: [
            { name: "Honesty", description: "You are known to be truthful" },
            { name: "Violence", description: "You are known to be dangerous" }
        ]
    }
};

globalThis.ui = { notifications: { info() {}, warn() {}, error() {} } };
