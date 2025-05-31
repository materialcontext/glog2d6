// module/actor/systems/actor-trauma-system.mjs
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

    async applyWound(damage) {
        const woundApplier = new WoundApplier(this.actor, damage);
        return woundApplier.apply();
    }

    async removeWound(woundId) {
        const wounds = this.actor.system.wounds.list || [];
        const updatedWounds = wounds.filter(w => w.id !== woundId);

        await this.actor.update({
            "system.wounds.list": updatedWounds,
            "system.wounds.count": updatedWounds.length
        });

        ui.notifications.info(`Wound removed from ${this.actor.name}`);
    }

    getWoundPenalties() {
        const wounds = this.wounds?.list || [];
        const penalties = {
            stats: { str: 0, dex: 0, con: 0, int: 0, wis: 0, cha: 0 },
            movement: 0,
            healing: false,
            attackPenalty: 0,
            defensePenalty: 0,
            reactionPenalty: 0
        };

        for (const wound of wounds) {
            this._applyWoundPenalty(wound, penalties);
        }

        return penalties;
    }

    _applyWoundPenalty(wound, penalties) {
        const woundsData = CONFIG.GLOG.WOUNDS?.wounds || [];
        const woundData = woundsData.find(w => w.id === wound.typeId);
        if (!woundData) return;

        // Apply penalties based on wound type
        if (woundData.effects.statReduction) {
            for (const [stat, value] of Object.entries(woundData.effects.statReduction)) {
                penalties.stats[stat] += value;
            }
        }

        if (woundData.effects.movementReduction) {
            penalties.movement = Math.max(penalties.movement, woundData.effects.movementReduction);
        }

        if (woundData.effects.noHealing) {
            penalties.healing = true;
        }

        if (woundData.effects.attackPenalty) {
            penalties.attackPenalty += woundData.effects.attackPenalty;
        }

        if (woundData.effects.defensePenalty) {
            penalties.defensePenalty += woundData.effects.defensePenalty;
        }

        if (woundData.effects.reactionPenalty) {
            penalties.reactionPenalty += woundData.effects.reactionPenalty;
        }
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

        const success = roll.total >= 7;
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
                    <div class="text-small mb-4"><strong>Target:</strong> 7</div>
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
    constructor(actor, damage) {
        this.actor = actor;
        this.damage = damage;
    }

    async apply() {
        const woundEntry = this._selectWoundFromTable();
        const wound = this._createWoundInstance(woundEntry);

        await this._addWoundToActor(wound);
        await this._sendWoundChatMessage(wound);

        return wound;
    }

    _selectWoundFromTable() {
        const woundsData = CONFIG.GLOG.WOUNDS?.wounds || [];
        const clampedDamage = Math.min(this.damage, woundsData.length);
        return woundsData[clampedDamage - 1];
    }

    _createWoundInstance(woundEntry) {
        const wound = {
            id: foundry.utils.randomID(),
            typeId: woundEntry.id,
            name: woundEntry.name,
            description: woundEntry.description,
            damage: this.damage,
            dateAcquired: new Date().toISOString(),
            effects: { ...woundEntry.effects }
        };

        // Handle special wounds that need additional rolls
        if (woundEntry.effects.specialRoll === 'bodyPart') {
            wound.bodyPart = this._rollBodyPart();
            wound.description = wound.description.replace("Roll 1d6", `Rolled ${wound.bodyPart}`);
        } else if (woundEntry.effects.specialRoll === 'maimed') {
            wound.maimedResult = this._rollMaimedResult();
        }

        return wound;
    }

    _rollBodyPart() {
        const roll = new Roll("1d6");
        roll.evaluate({ async: false });
        const bodyParts = CONFIG.GLOG.WOUNDS?.bodyParts || ["Leg", "Chest", "Arm", "Shoulder", "Abdomen", "Hand"];
        return bodyParts[roll.total - 1];
    }

    _rollMaimedResult() {
        const roll = new Roll("1d6");
        roll.evaluate({ async: false });
        const results = CONFIG.GLOG.WOUNDS?.maimedResults || [
            "Roll twice more and keep both results",
            "Sword Arm damaged",
            "Face damaged",
            "Shield Arm damaged",
            "Leg damaged",
            "Leg damaged"
        ];
        return results[roll.total - 1];
    }

    async _addWoundToActor(wound) {
        const currentWounds = this.actor.system.wounds?.list || [];
        const newWounds = [...currentWounds, wound];

        await this.actor.update({
            "system.wounds.list": newWounds,
            "system.wounds.count": newWounds.length
        });
    }

    async _sendWoundChatMessage(wound) {
        const content = `
            <div class="glog2d6-roll section p-10" style="border-left: 4px solid #ff9800;">
                <h3 class="text-primary mb-8">${this.actor.name} - Wound Applied</h3>
                <div class="p-8 section mb-8">
                    <div class="text-small mb-4"><strong>Wound:</strong> ${wound.name}</div>
                    <div class="text-small mb-8"><strong>Damage:</strong> ${this.damage}</div>
                    <div class="text-small p-8 section" style="background: rgba(255, 152, 0, 0.1);">
                        ${wound.description}
                    </div>
                </div>
            </div>
        `;

        await ChatMessage.create({
            speaker: ChatMessage.getSpeaker({ actor: this.actor }),
            content: content
        });
    }
}

export { ActorTraumaSystem, TraumaSaveDialog };
