// module/actor/systems/actor-trauma-system.mjs
import {
    SEVERITY_DIE,
    WOUND_STATES,
    aggregateWoundEffects,
    bodyPartFor,
    hpRerollFormula,
    nextWoundState,
    normalizeWound,
    scarFromWound,
    woundItemData,
    woundsFromItems,
    woundCount,
    woundRemoval,
    woundSeverity
} from "../../systems/wounds.mjs";

import {
    anatomyTags,
    damageSource,
    describeSource,
    unknownSource,
    woundTableFor
} from "../../systems/damage-source.mjs";

export const WOUND_TABLE_NAME = "GLOG Wounds Table";
class ActorTraumaSystem {
    constructor(actor) {
        this.actor = actor;
    }

    get wounds() {
        if (!this.actor.system.wounds) {
            // This shouldn't happen with proper templates, but ensures safety
            this.actor.system.wounds = {
                count: 0,
                list: [],
                effects: {
                    statReductions: {},
                    movementReduction: 0,
                    noHealing: false,
                    attackPenalty: 0,
                    defensePenalty: 0,
                    reactionPenalty: 0
                }
            };
        }
        return this.actor.system.wounds;
    }

    async initiateTraumaSave() {
        const dialog = new TraumaSaveDialog(this.actor);
        return dialog.render(true);
    }

    async rollTraumaSave(excessDamage, customBonus = 0) {
        const traumaRoller = new TraumaSaveRoller(this.actor, excessDamage, customBonus);
        return traumaRoller.execute();
    }

    /**
     * @param {number} damage   Damage in excess of what was left.
     * @param {object} [source] What hit you -- see systems/damage-source.
     */
    async applyWound(damage, source = null) {
        const woundApplier = new WoundApplier(this.actor, damage, { source });
        return woundApplier.apply();
    }

    /** The wound Items this actor is carrying, flattened for the rules. */
    get woundList() {
        return woundsFromItems(this.actor.items);
    }

    /** The document behind a flattened wound. */
    _woundItem(woundId) {
        const item = this.actor.items.get(woundId);
        return item?.type === "wound" ? item : null;
    }

    /**
     * Move a wound one step along untreated -> treated -> healing.
     */
    async advanceWound(woundId) {
        const wounds = this.woundList;
        const wound = wounds.find(w => w.id === woundId);
        if (!wound) return null;

        const state = nextWoundState(wound.state);
        if (!state) {
            ui.notifications.info(`${wound.name} is already healing.`);
            return null;
        }

        await this._woundItem(woundId)?.update({ "system.state": state });
        ui.notifications.info(`${wound.name} is now ${state}.`);
        return state;
    }

    /**
     * Clear a wound, which is gated on its recovery state, rerolls max HP and
     * leaves a scar behind.
     */
    async removeWound(woundId, { force = false } = {}) {
        const wounds = this.woundList;
        const wound = wounds.find(w => w.id === woundId);
        if (!wound) return null;

        const removal = woundRemoval(wound, wounds);
        if (!removal.allowed && !force) {
            ui.notifications.warn(`${wound.name}: ${removal.reason}`);
            return null;
        }

        await this._woundItem(woundId)?.delete();

        const reroll = await this._rerollMaxHp(wound);
        const scar = await this._leaveScar(wound);
        await this._sendRecoveryMessage(wound, reroll, scar);

        return { wound, reroll, scar };
    }

    /**
     * Every wound promises a max-HP reroll on removal, which nothing used to
     * honour. The roll is always reported; it is only written when it strictly
     * beats the current maximum, so it can never cost a character hit points.
     */
    async _rerollMaxHp(wound) {
        const formula = hpRerollFormula(wound);
        if (!formula) return null;

        const roll = new Roll(formula);
        await roll.evaluate();

        const current = Number(this.actor.system.hp?.max) || 0;
        const applied = roll.total > current;
        if (applied) await this.actor.update({ "system.hp.max": roll.total });

        return { formula, total: roll.total, previous: current, applied };
    }

    /** A healed wound leaves an inactive feature rather than nothing. */
    async _leaveScar(wound) {
        try {
            const [scar] = await this.actor.createEmbeddedDocuments("Item", [scarFromWound(wound)]);
            return scar ?? null;
        } catch (error) {
            console.error("glog2d6 | Could not create scar for", wound?.name, error);
            return null;
        }
    }

    async _sendRecoveryMessage(wound, reroll, scar) {
        const parts = [`<div class="text-small mb-4"><strong>Recovered:</strong> ${wound.name}</div>`];

        if (reroll) {
            const verdict = reroll.applied
                ? `max HP raised to <strong>${reroll.total}</strong>`
                : `rolled ${reroll.total}, keeping ${reroll.previous}`;
            parts.push(`<div class="text-small mb-4"><strong>Max HP ${reroll.formula}:</strong> ${verdict}</div>`);
        }

        if (scar) parts.push(`<div class="text-small"><strong>Left behind:</strong> ${scar.name}</div>`);

        await ChatMessage.create({
            speaker: ChatMessage.getSpeaker({ actor: this.actor }),
            content: `
                <div class="glog2d6-roll section p-10 wound-recovery">
                    <h3 class="mb-8">${this.actor.name} recovers</h3>
                    <div class="p-8 section">${parts.join("")}</div>
                </div>
            `
        });
    }

    getWoundPenalties() {
        return aggregateWoundEffects(this.woundList, CONFIG.GLOG.WOUNDS?.wounds || []);
    }
}

class TraumaSaveDialog extends FormApplication {
    constructor(actor) {
        super();
        this.actor = actor;
    }

    static get defaultOptions() {
        return foundry.utils.mergeObject(super.defaultOptions, {
            id: "trauma-save-dialog",
            classes: ["glog2d6"],
            title: "Trauma Save",
            template: "systems/glog2d6/templates/dialogs/trauma-save.hbs",
            width: 400,
            height: "auto"
        });
    }

    getData() {
        const conMod = this.actor.system.attributes.con.effectiveMod;
        const traumaBonuses = this._getTraumaBonuses();

        return {
            actor: this.actor,
            conMod: conMod,
            traumaBonuses: traumaBonuses,
            totalBonus: conMod + traumaBonuses,
            woundsPreview: this._getWoundsPreview()
        };
    }

    _getTraumaBonuses() {
        const toughFeature = this.actor.items.find(i =>
            i.type === "feature" &&
            i.system.active &&
            i.name === "Tough"
        );

        return toughFeature ? 1 : 0;
    }

    _getWoundsPreview() {
        const woundsData = CONFIG.GLOG.WOUNDS?.wounds || [];
        return woundsData.map((wound, index) => ({
            damage: index + 1,
            name: wound.name,
            shortDesc: this._getShortDescription(wound)
        }));
    }

    _getShortDescription(wound) {
        const effects = wound.effects;
        if (effects.statReduction) {
            const stats = Object.keys(effects.statReduction).join('/').toUpperCase();
            return `${stats} penalty`;
        }
        if (effects.movementReduction) return `movement ${effects.movementReduction}'`;
        if (effects.noHealing) return 'no healing';
        if (effects.multipleWounds) return `${effects.multipleWounds} wounds`;
        return 'special effect';
    }

    async _updateObject(event, formData) {
        const excessDamage = parseInt(formData.excessDamage) || 1;
        const customBonus = parseInt(formData.customBonus) || 0;

        await this.actor.traumaSystem.rollTraumaSave(excessDamage, customBonus);
    }
}

class TraumaSaveRoller {
    constructor(actor, excessDamage, customBonus = 0) {
        this.actor = actor;
        this.excessDamage = excessDamage;
        this.customBonus = customBonus;
    }

    async execute() {
        const rollData = this._buildRollData();
        const roll = this.actor.createRoll("2d6 + @con + @trauma + @custom", rollData, 'trauma');
        await roll.evaluate();

        const success = roll.total >= 10;
        const chatMessage = await this._createChatMessage(roll, success);

        if (!success) {
            this._addApplyWoundButton(chatMessage, roll); // Pass the roll separately
        }

        return { roll, success };
    }

    _buildRollData() {
        const conMod = this.actor.system.attributes.con.effectiveMod;
        const traumaBonus = this._getTraumaBonuses();

        return {
            con: conMod,
            trauma: traumaBonus,
            custom: this.customBonus
        };
    }

    _getTraumaBonuses() {
        const toughFeature = this.actor.items.find(i =>
            i.type === "feature" &&
            i.system.active &&
            (i.name === "Tough" || i.name.includes("Trauma"))
        );

        return toughFeature ? 1 : 0;
    }

    async _createChatMessage(roll, success) {
        const breakdown = this._buildBreakdown();
        const resultText = success ? "SUCCESS" : "FAILURE";
        const resultClass = success ? "text-success" : "text-danger";

        const content = `
            <div class="glog2d6-roll section p-10" style="border-left: 4px solid var(--danger);">
                <h3 class="text-danger mb-8">${this.actor.name} - Trauma Save</h3>
                <div class="p-8 section mb-8" style="background: linear-gradient(135deg, #fff8f8 0%, white 100%);">
                    <div class="text-small mb-4"><strong>Roll:</strong> ${this._formatRollDisplay(roll)}</div>
                    <div class="text-small mb-4"><strong>Total:</strong> ${roll.total}</div>
                    <div class="text-small mb-4"><strong>Target:</strong> 10</div>
                    <div class="text-small mb-4"><strong>Result:</strong> <span class="${resultClass} text-bold">${resultText}</span></div>
                    <div class="text-small"><strong>Excess Damage:</strong> ${this.excessDamage}</div>
                    ${breakdown}
                </div>
                ${!success ? `<div id="wound-application-${roll._id}"></div>` : ''}
            </div>
        `;

        return ChatMessage.create({
            speaker: ChatMessage.getSpeaker({ actor: this.actor }),
            content: content,
            roll: roll,
            flags: {
                glog2d6: {
                    traumaSave: true,
                    actorId: this.actor.id,
                    excessDamage: this.excessDamage,
                    rollId: roll._id
                }
            }
        });
    }

    _buildBreakdown() {
        const rollData = this._buildRollData();
        const parts = [];

        if (rollData.con !== 0) {
            parts.push(`Constitution: ${rollData.con >= 0 ? '+' : ''}${rollData.con}`);
        }

        if (rollData.trauma > 0) {
            parts.push(`Trauma Bonus: +${rollData.trauma}`);
        }

        if (rollData.custom !== 0) {
            parts.push(`Custom: ${rollData.custom >= 0 ? '+' : ''}${rollData.custom}`);
        }

        return parts.length > 0 ? `<div class="text-small text-muted mt-4">${parts.join(', ')}</div>` : '';
    }

    _formatRollDisplay(roll) {
        const diceResults = roll.terms[0]?.results?.map(r => r.result) || [];
        return `[${diceResults.join(', ')}]`;
    }

    async _addApplyWoundButton(chatMessage, roll) {
        const buttonHtml = `
        <button type="button" class="btn btn-danger p-8 mt-8 apply-wound-btn w-full"
                data-actor-id="${this.actor.id}"
                data-damage="${this.excessDamage}"
                data-roll-id="${roll._id}">
            <i class="fas fa-plus"></i> Apply Wound (${this.excessDamage} damage)
        </button>
    `;

        setTimeout(async () => {
            const message = game.messages.get(chatMessage.id);
            if (message) {
                const content = message.content.replace(
                    `<div id="wound-application-${roll._id}"></div>`,
                    buttonHtml
                );
                await message.update({ content });
            }
        }, 100);
    }
}

class WoundApplier {
    constructor(actor, damage, options = {}) {
        this.actor = actor;
        this.damage = damage;

        // What hit you, not what you happen to be holding. This used to read
        // the victim's own equipped weapon, so being shot while carrying a
        // sword rolled melee anatomy.
        this.source = options.source ?? unknownSource();
    }

    async apply() {
        const table = CONFIG.GLOG.WOUNDS?.wounds || [];
        if (!table.length) {
            ui.notifications.error("No wound table is loaded.");
            return [];
        }

        const rolled = [await this._rollWound(table)];

        // The worst entries declare `multipleWounds`, which nothing read before.
        const extra = woundCount(rolled[0].entry) - 1;
        for (let i = 0; i < extra; i++) rolled.push(await this._rollWound(table));

        const wounds = rolled.map(r => r.wound);
        await this._addWoundsToActor(wounds);
        await this._sendWoundChatMessage(rolled);

        return wounds;
    }

    /**
     * Roll one wound. Damage sets the band and the die sets the position in it,
     * so the same damage no longer always produces the same wound.
     */
    async _rollWound(table) {
        const roll = new Roll(`1d${SEVERITY_DIE}`);
        await roll.evaluate();

        const severity = woundSeverity(roll.total, this.damage, table.length);
        const entry = this._entryFor(severity, table);

        return { entry, severity, roll, wound: await this._createWoundInstance(entry, severity) };
    }

    /**
     * Prefer the world's roll table so a GM editing it actually changes play.
     * Falls back to the shipped data when the table is missing or unrecognised.
     */
    /** The world table this blow draws from, by uuid or by name. */
    _worldTable() {
        const ref = woundTableFor(this.source, { fallback: WOUND_TABLE_NAME });
        return game.tables?.get(ref)
            ?? game.tables?.find(t => t.uuid === ref)
            ?? game.tables?.find(t => t.name === ref)
            ?? null;
    }

    _entryFor(severity, table) {
        const worldTable = this._worldTable();
        const result = worldTable?.results?.find(r => {
            const [low, high] = r.range ?? [];
            return Number.isFinite(low) && severity >= low && severity <= high;
        });

        if (result) {
            const tagged = result.getFlag?.("glog2d6", "woundId");
            const byFlag = tagged && table.find(entry => entry.id === tagged);
            if (byFlag) return byFlag;

            const label = String(result.text ?? result.name ?? result.description ?? "").split(":")[0].trim();
            const byName = label && table.find(entry => entry.name.toLowerCase() === label.toLowerCase());
            if (byName) return byName;
        }

        return table[severity - 1];
    }

    async _createWoundInstance(woundEntry, severity) {
        const wound = {
            id: foundry.utils.randomID(),
            typeId: woundEntry.id,
            name: woundEntry.name,
            description: woundEntry.description,
            damage: this.damage,
            severity,
            state: WOUND_STATES.UNTREATED,
            bodyPart: await this._rollBodyPart(),
            dateAcquired: new Date().toISOString(),
            effects: { ...woundEntry.effects }
        };

        if (woundEntry.effects.specialRoll === 'bodyPart') {
            wound.description = wound.description.replace("Roll 1d6", `Rolled ${wound.bodyPart}`);
        } else if (woundEntry.effects.specialRoll === 'maimed') {
            wound.maimedResult = await this._rollMaimedResult();
        }

        return wound;
    }

    /** Anatomy is now rolled for every wound, biased by what struck you. */
    async _rollBodyPart() {
        const roll = new Roll("1d6");
        await roll.evaluate();
        return bodyPartFor(roll.total, anatomyTags(this.source));
    }

    async _rollMaimedResult() {
        const roll = new Roll("1d6");
        await roll.evaluate();
        const results = CONFIG.GLOG.WOUNDS?.maimedResults || [];
        return results[roll.total - 1] ?? "Roll on the maimed table";
    }

    /** Wounds are documents, so taking one is creating one. */
    async _addWoundsToActor(wounds) {
        await this.actor.createEmbeddedDocuments("Item", wounds.map(woundItemData));
    }

    async _sendWoundChatMessage(rolled) {
        const cards = rolled.map(({ wound, severity, roll }) => `
            <div class="p-8 section mb-8">
                <div class="text-small mb-4">
                    <strong>${wound.name}</strong>
                    <span class="text-muted">&mdash; ${wound.bodyPart}</span>
                </div>
                <div class="text-small text-muted mb-4">
                    Severity ${severity} (d${SEVERITY_DIE} ${roll.total} + ${this.damage} damage)
                </div>
                <div class="text-small">${wound.description}</div>
                ${wound.effects.rerollStat
                    ? `<div class="text-small text-danger mt-4">Reroll your ${wound.effects.rerollStat.toUpperCase()}.</div>`
                    : ""}
            </div>
        `).join("");

        await ChatMessage.create({
            speaker: ChatMessage.getSpeaker({ actor: this.actor }),
            content: `
                <div class="glog2d6-roll section p-10 wound-applied">
                    <h3 class="mb-8">${this.actor.name} &mdash; ${rolled.length > 1 ? "Wounds" : "Wound"} Applied</h3>
                    ${cards}
                </div>
            `
        });
    }
}

export { ActorTraumaSystem, TraumaSaveDialog };
