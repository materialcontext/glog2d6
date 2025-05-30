// module/systems/gm-roll-system.mjs - Updated with Recon Integration
export class GMRollSystem {
    static ROLL_TYPES = {
        attribute: { name: 'Attribute Check', target: 'attribute', formula: '2d6 + @mod',
                    getData: (actor, {attribute}) => ({ mod: actor.system.attributes[attribute]?.effectiveMod || 0 }) },
        save: { name: 'Save', target: 'attribute', formula: '2d6 + @mod + @save',
               getData: (actor, {attribute}) => ({ mod: actor.system.attributes[attribute]?.effectiveMod || 0, save: actor.system.saves?.[attribute]?.bonus || 0 }) },
        skill: { name: 'Skill Check', target: 'skill', formula: '2d6 + @mod + @skill',
                getData: (actor, {skill}) => { const attr = this.SKILL_ATTRS[skill] || 'cha'; return { mod: actor.system.attributes[attr]?.effectiveMod || 0, skill: actor.system.skills?.[skill]?.bonus || 0 }; } },
        initiative: { name: 'Initiative', formula: '2d6 + @dex', getData: (actor) => ({ dex: actor.system.attributes.dex?.effectiveMod || 0 }) },
        recon: { name: 'Recon Check', isRecon: true }
    };

    static SKILL_ATTRS = { sneak: 'dex', hide: 'wis', disguise: 'int', reaction: 'cha', diplomacy: 'cha', intimidate: 'cha' };

    constructor() { this.rolls = new Map(); }

    async create(type, actorIds, params = {}) {
        if (!game.user.isGM) throw new Error('GM only');
        const config = GMRollSystem.ROLL_TYPES[type];
        if (!config) throw new Error(`Unknown type: ${type}`);

        if (config.isRecon) return game.glog2d6.reconSystem.initiate(actorIds, params);

        const roll = { id: foundry.utils.randomID(), type, config, params, actorIds, results: new Map(), timestamp: Date.now() };
        this.rolls.set(roll.id, roll);
        await this._createMessage(roll);
        return roll.id;
    }

    async execute(rollId, actorId) {
        const roll = this.rolls.get(rollId);
        if (!roll || roll.results.has(actorId)) throw new Error('Invalid roll state');

        const actor = game.actors.get(actorId);
        if (!actor?.isOwner) throw new Error('No permission');

        const data = roll.config.getData(actor, roll.params);
        const rollObj = actor.createRoll(roll.config.formula, data, roll.type);
        await rollObj.evaluate();

        const result = { actorId: actor.id, actorName: actor.name, total: rollObj.total,
                        success: roll.params.target ? rollObj.total >= roll.params.target : undefined, roll: rollObj };

        roll.results.set(actorId, result);
        await this._updateMessage(roll);

        if (roll.results.size === roll.actorIds.length) {
            await this._complete(roll);
            this.rolls.delete(roll.id);
        }
        return result;
    }

    async _createMessage(roll) {
        const message = await ChatMessage.create({
            content: this._buildContent(roll),
            flags: { glog2d6: { rollRequest: roll.id, type: roll.type, actorIds: roll.actorIds }}
        });
        roll.messageId = message.id;
    }

    async _updateMessage(roll) {
        await game.messages.get(roll.messageId)?.update({ content: this._buildContent(roll) });
    }

    async _complete(roll) {
        const results = [...roll.results.values()].sort((a,b) => b.total - a.total);
        await ChatMessage.create({
            content: `<div class="section p-10 border-success">
                <h3 class="text-success mb-8">${roll.config.name} - Results</h3>
                ${results.map((r,i) => `<div class="text-small">${i ? '' : '🏆'} ${r.actorName}: ${r.total}${r.success !== undefined ? (r.success ? ' ✓' : ' ✗') : ''}</div>`).join('')}
            </div>`
        });
    }

    _buildContent(roll) {
        const actors = roll.actorIds.map(id => game.actors.get(id)).filter(Boolean);
        const buttons = actors.map(actor => {
            const result = roll.results.get(actor.id);
            return result ?
                `<div class="text-small">${actor.name}: ${result.total}${result.success !== undefined ? (result.success ? ' ✓' : ' ✗') : ''}</div>` :
                `<button class="btn btn-primary p-4 mb-4" data-roll-id="${roll.id}" data-actor-id="${actor.id}" ${actor.isOwner ? '' : 'disabled'}>${actor.name}</button>`;
        }).join('');

        const info = Object.entries(roll.params).filter(([k,v]) => v && k !== 'description').map(([k,v]) => `${k}: ${v}`).join(' | ');

        return `<div class="section p-10 border-primary">
            <h3 class="text-primary mb-8">${roll.config.name}</h3>
            ${info ? `<div class="text-small text-muted mb-8">${info}</div>` : ''}
            ${roll.params.description ? `<div class="text-small mb-8">${roll.params.description}</div>` : ''}
            ${buttons}
            <div class="text-center text-small text-muted">${roll.results.size}/${roll.actorIds.length}</div>
        </div>`;
    }
}

export class GMRollDialog extends FormApplication {
    static get defaultOptions() {
        return foundry.utils.mergeObject(super.defaultOptions, {
            id: "gm-roll-dialog", classes: ["glog2d6"], title: "Group Roll",
            template: "systems/glog2d6/templates/dialogs/gm-roll.hbs", width: 400, height: "auto"
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
            html.find('.location-group').toggle(!!config?.isRecon);
        });
    }

    async _updateObject(event, data) {
        const actorIds = Object.keys(data.actors || {}).filter(k => data.actors[k]);
        if (!actorIds.length) return ui.notifications.warn('Select actors');

        const params = foundry.utils.filterObject(data, (k,v) => k !== 'actors' && k !== 'type' && v);
        if (params.target) params.target = parseInt(params.target);

        try {
            await game.glog2d6.gmRollSystem.create(data.type, actorIds, params);
            ui.notifications.info(`${GMRollSystem.ROLL_TYPES[data.type].name} created`);
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
        ['attribute', 'save', 'skill', 'initiative', 'recon'].forEach(type => {
            game.glog2d6[type] = (actors, params) => game.glog2d6.gmRollSystem.create(type, actors, params);
        });
    }

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

    Hooks.on("chatMessage", (log, msg) => {
        if (msg === "/gmroll") { game.glog2d6.groupRoll(); return false; }
    });

    setInterval(() => {
        const cutoff = Date.now() - 3600000;
        for (const [id, roll] of game.glog2d6.gmRollSystem.rolls) {
            if (roll.timestamp < cutoff) game.glog2d6.gmRollSystem.rolls.delete(id);
        }
    }, 600000);
}
