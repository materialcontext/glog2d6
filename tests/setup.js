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

let nextId = 0;
function randomID() {
    return `id${++nextId}`;
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
    utils: { deepClone, getProperty, setProperty, expandObject, mergeObject, randomID },
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

/* -------------------------------------------- */
/*  Document and dice doubles                   */
/* -------------------------------------------- */

/**
 * Enough of the global document and dice classes for the actor module to
 * evaluate. These are deliberately inert -- tests that care about behaviour
 * install their own spies over the top.
 */
class FakeRoll {
    constructor(formula = "", data = {}) {
        this.formula = formula;
        this.data = data;
        this.total = 0;
        this.terms = [];
    }
    async evaluate() { return this; }
    toJSON() { return { formula: this.formula, total: this.total }; }
    static fromData(data) { return Object.assign(new FakeRoll(), data); }
}

globalThis.Roll = FakeRoll;

globalThis.Actor = class Actor {
    constructor(data = {}) { Object.assign(this, data); }
    prepareBaseData() {}
    prepareDerivedData() {}
    getRollData() { return {}; }
    getFlag() {}
    async setFlag() {}
    async update() {}
};

globalThis.Item = class Item {
    constructor(data = {}) { Object.assign(this, data); }
    prepareBaseData() {}
    prepareDerivedData() {}
};

globalThis.ChatMessage = class ChatMessage {
    static async create(data) { return { id: "msg", ...data }; }
    static getSpeaker() { return { alias: "Someone" }; }
    static getWhisperRecipients() { return []; }
};

/** The v1 application globals the dialog modules extend at module scope. */
globalThis.Application = class Application {
    constructor(options = {}) { this.options = options; }
    static get defaultOptions() { return {}; }
    render() { return this; }
    activateListeners() {}
};

globalThis.FormApplication = class FormApplication extends globalThis.Application {
    constructor(object, options) { super(options); this.object = object; }
};

/** Tests that care install their own; the default resolves nothing. */
globalThis.fromUuid = globalThis.fromUuid ?? (async () => null);

globalThis.Dialog = class Dialog {
    static async confirm() { return false; }
    render() {}
};

globalThis.game = globalThis.game ?? {
    user: { id: "u1", isGM: false, getFlag() {}, async setFlag() {} },
    settings: { register() {}, get() {}, async set() {} },
    i18n: { localize: k => k, format: k => k },
    messages: { get() {} }
};

