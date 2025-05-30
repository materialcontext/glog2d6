// module/systems/gm-roll-system.mjs
export class GMRollSystem {
    static ROLL_TYPES = {
        attribute: {
            name: 'Attribute Check',
            target: 'attribute',
            formula: '2d6 + @mod',
            getData: (actor, {attribute}) => ({ mod: actor.system.attributes[attribute]?.effectiveMod || 0 }),
            getTitle: (actor, {attribute}) => `${actor.name} - ${attribute.toUpperCase()}`
        },
        save: {
            name: 'Save',
            target: 'attribute',
            formula: '2d6 + @mod + @save',
            getData: (actor, {attribute}) => ({
                mod: actor.system.attributes[attribute]?.effectiveMod || 0,
                save: actor.system.saves?.[attribute]?.bonus || 0
            })
        },
        skill: {
            name: 'Skill Check',
            target: 'skill',
            formula: '2d6 + @mod + @skill',
            getData: (actor, {skill}) => {
                const attr = this.SKILL_ATTRS[skill] || 'cha';
                return {
                    mod: actor.system.attributes[attr]?.effectiveMod || 0,
                    skill: actor.system.skills?.[skill]?.bonus || 0
                };
            }
        },
        initiative: {
            name: 'Initiative',
            formula: '2d6 + @dex',
            getData: (actor) => ({ dex: actor.system.attributes.dex?.effectiveMod || 0 })
        }
    };

    static SKILL_ATTRS = {
        sneak: 'dex', hide: 'wis', disguise: 'int',
        reaction: 'cha', diplomacy: 'cha', intimidate: 'cha'
    };

    constructor() {
        this.rolls = new Map();
    }

    async create(type, actorIds, params = {}) {
        if (!game.user.isGM) throw new Error('GM only');

        const config = GMRollSystem.ROLL_TYPES[type];
        if (!config) throw new Error(`Unknown type: ${type}`);

        const roll = {
            id: foundry.utils.randomID(),
            type, config, params, actorIds,
            results: new Map(),
            timestamp: Date.now()
        };

        this.rolls.set(roll.id, roll);
        await this._createMessage(roll);
        return roll.id;
    }

    async execute(rollId, actorId) {
        const roll = this.rolls.get(rollId);
        if (!roll) throw new Error('Roll not found');
        if (roll.results.has(actorId)) throw new Error('Already rolled');

        const actor = game.actors.get(actorId);
        if (!actor?.isOwner) throw new Error('No permission');

        const result = await this._roll(actor, roll);
        roll.results.set(actorId, result);

        await this._updateMessage(roll);
        if (roll.results.size === roll.actorIds.length) await this._complete(roll);

        return result;
    }

    async _roll(actor, {config, params, type}) {
        const data = config.getData(actor, params);
        const rollObj = actor.createRoll(config.formula, data, type);
        await rollObj.evaluate();

        return {
            actorId: actor.id,
            actorName: actor.name,
            total: rollObj.total,
            success: params.target ? rollObj.total >= params.target : undefined,
            roll: rollObj
        };
    }

    async _createMessage(roll) {
        const message = await ChatMessage.create({
            content: this._buildContent(roll),
            flags: { glog2d6: { rollRequest: roll.id, type: roll.type, actorIds: roll.actorIds }}
        });
        roll.messageId = message.id;
    }

    async _updateMessage(roll) {
        const msg = game.messages.get(roll.messageId);
        if (msg) await msg.update({ content: this._buildContent(roll) });
    }

    async _complete(roll) {
        const results = [...roll.results.values()].sort((a,b) => b.total - a.total);
        await ChatMessage.create({
            content: `<div class="gm-roll-complete">
                <h3>${roll.config.name} - Results</h3>
                ${results.map((r,i) =>
                    `<div>${i ? '' : '🏆'} <b>${r.actorName}:</b> ${r.total}${r.success !== undefined ? (r.success ? ' ✓' : ' ✗') : ''}</div>`
                ).join('')}
            </div>`
        });
        this.rolls.delete(roll.id);
    }

    _buildContent(roll) {
        const actors = roll.actorIds.map(id => game.actors.get(id)).filter(Boolean);
        const buttons = actors.map(actor => {
            const result = roll.results.get(actor.id);
            return result ?
                `<div><b>${actor.name}:</b> ${result.total}${result.success !== undefined ? (result.success ? ' ✓' : ' ✗') : ''}</div>` :
                `<button class="gm-roll-btn" data-roll-id="${roll.id}" data-actor-id="${actor.id}" ${actor.isOwner ? '' : 'disabled'}>
                    ${actor.name}
                </button>`;
        }).join('');

        const info = Object.entries(roll.params)
            .filter(([k,v]) => v && k !== 'description')
            .map(([k,v]) => `<b>${k}:</b> ${v}`).join(' | ');

        return `<div class="gm-roll-request">
            <h3>${roll.config.name}</h3>
            ${info ? `<div class="roll-info">${info}</div>` : ''}
            ${roll.params.description ? `<div class="roll-desc">${roll.params.description}</div>` : ''}
            <div class="roll-buttons">${buttons}</div>
            <div class="roll-status">${roll.results.size}/${roll.actorIds.length}</div>
        </div>`;
    }
}

export class GMRollDialog extends FormApplication {
    static get defaultOptions() {
        return foundry.utils.mergeObject(super.defaultOptions, {
            id: "gm-roll-dialog",
            classes: ["glog2d6"],
            title: "Group Roll",
            template: "systems/glog2d6/templates/dialogs/gm-roll.hbs",
            width: 400,
            height: "auto"
        });
    }

    getData() {
        return {
            rollTypes: Object.entries(GMRollSystem.ROLL_TYPES).map(([k,v]) => ({key: k, ...v})),
            attributes: ['str','dex','con','int','wis','cha'],
            skills: Object.keys(GMRollSystem.SKILL_ATTRS),
            actors: game.actors.filter(a => a.type === 'character')
        };
    }

    activateListeners(html) {
        super.activateListeners(html);
        html.find('[name="type"]').change(e => {
            const config = GMRollSystem.ROLL_TYPES[e.target.value];
            html.find('.target-group').toggle(!!config?.target);
            html.find('.attribute-target').toggle(config?.target === 'attribute');
            html.find('.skill-target').toggle(config?.target === 'skill');
        });
    }

    async _updateObject(event, data) {
        const actorIds = Object.keys(data.actors || {}).filter(k => data.actors[k]);
        if (!actorIds.length) return ui.notifications.warn('Select actors');

        const params = foundry.utils.filterObject(data, (k,v) => k !== 'actors' && k !== 'type' && v);
        if (params.target) params.target = parseInt(params.target);

        try {
            await game.glog2d6.gmRollSystem.create(data.type, actorIds, params);
            ui.notifications.info('Roll created');
        } catch (error) {
            ui.notifications.error(error.message);
        }
    }
}

export function initGMRolls() {
    game.glog2d6 ??= {};
    game.glog2d6.gmRollSystem = new GMRollSystem();

    if (game.user.isGM) {
        game.glog2d6.groupRoll = () => new GMRollDialog().render(true);

        // Quick helpers
        ['attribute', 'save', 'skill', 'initiative'].forEach(type => {
            game.glog2d6[type] = (actors, params) =>
                game.glog2d6.gmRollSystem.create(type, actors, params);
        });
    }

    // Chat handler
    Hooks.on("renderChatMessage", (msg, html) => {
        html.find('.gm-roll-btn').click(async e => {
            e.preventDefault();
            const {rollId, actorId} = e.currentTarget.dataset;
            try {
                await game.glog2d6.gmRollSystem.execute(rollId, actorId);
                e.currentTarget.disabled = true;
                e.currentTarget.textContent = 'Rolled';
            } catch (error) {
                ui.notifications.error(error.message);
            }
        });
    });

    // Chat command
    Hooks.on("chatMessage", (log, msg) => {
        if (msg === "/gmroll") {
            game.glog2d6.groupRoll();
            return false;
        }
    });

    // Cleanup old rolls
    setInterval(() => {
        const hour = 3600000;
        const cutoff = Date.now() - hour;
        for (const [id, roll] of game.glog2d6.gmRollSystem.rolls) {
            if (roll.timestamp < cutoff) game.glog2d6.gmRollSystem.rolls.delete(id);
        }
    }, 600000);
}
