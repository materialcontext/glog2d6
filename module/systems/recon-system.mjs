// module/systems/recon-system.mjs
export class ReconSystem {
    static ENCOUNTERS = ['Active Encounter', 'Passive Encounter', 'Indirect Encounter', 'Nothing', 'Nothing', 'Nothing'];

    constructor() { this.active = new Map(); }

    async initiate(actorIds, params = {}) {
        if (!game.user.isGM) throw new Error('GM only');
        const id = foundry.utils.randomID();
        const recon = { id, actorIds, params, results: new Map(), timestamp: Date.now() };
        this.active.set(id, recon);
        await this._message(recon);
        return id;
    }

    async execute(reconId, actorId) {
        const recon = this.active.get(reconId);
        if (!recon || recon.results.has(actorId)) throw new Error('Invalid recon state');

        const actor = game.actors.get(actorId);
        if (!actor?.isOwner) throw new Error('No permission');

        const result = await this._roll(actor, recon.params);
        recon.results.set(actorId, result);
        await this._message(recon);

        if (recon.results.size === recon.actorIds.length) {
            this.active.delete(recon.id);
        }
        return result;
    }

    async _roll(actor, params) {
        const encounter = new Roll('1d6'), recon = new Roll('1d6');
        await encounter.evaluate(); await recon.evaluate();

        const type = ReconSystem.ENCOUNTERS[encounter.total - 1];
        const analyzer = new ReconAnalyzer(actor, recon.total, type);
        const analysis = analyzer.analyze();

        return {
            actorId: actor.id, actorName: actor.name,
            encounter: encounter.total, encounterType: type,
            recon: recon.total, ...analysis
        };
    }

    async _message(recon) {
        const actors = recon.actorIds.map(id => game.actors.get(id)).filter(Boolean);
        const buttons = actors.map(actor => {
            const result = recon.results.get(actor.id);
            if (result) {
                // Show results inline after rolling
                let resultDisplay = `<div class="p-4 mb-4 section border-success">
                    <div class="text-bold mb-4">${actor.name}</div>
                    <div class="mb-2">Encounter: ${result.encounter} (${result.encounterType})</div>
                    <div class="mb-2">Recon: ${result.recon} (${result.hasTracker ? '5-6' : '6'} surprise)</div>`;

                if (result.features.length) {
                    resultDisplay += `<div class="mb-2 text-muted">Features: ${result.features.join(', ')}</div>`;
                }

                if (result.success && ['Active Encounter', 'Passive Encounter'].includes(result.encounterType)) {
                    resultDisplay += `<div class="text-success text-bold">• Surprise gained!</div>`;
                }
                if (result.success && result.encounterType === 'Nothing') {
                    resultDisplay += `<div class="text-primary">• Tracks found</div>`;
                }
                if (result.effects.includes('Stalker: Ambush +1')) {
                    resultDisplay += `<div class="text-muted">• Ambush resistance improved</div>`;
                }
                if (result.effects.includes('Danger Sense: Ambush +1')) {
                    resultDisplay += `<div class="text-muted">• Danger Sense: Ambush resistance improved</div>`;
                }

                return resultDisplay + `</div>`;
            } else {
                return `<button class="btn btn-primary p-4 mb-4 w-full" data-recon-id="${recon.id}" data-actor-id="${actor.id}" ${actor.isOwner ? '' : 'disabled'}>${actor.name}</button>`;
            }
        }).join('');

        const content = `<div class="section p-10 border-primary">
            <h3 class="text-primary mb-8"><i class="fas fa-search"></i> Recon Check</h3>
            ${recon.params.location ? `<div class="text-small text-muted mb-8">Location: ${recon.params.location}</div>` : ''}
            ${buttons}
            <div class="text-center text-small text-muted">${recon.results.size}/${recon.actorIds.length}</div>
        </div>`;

        if (recon.messageId) {
            await game.messages.get(recon.messageId)?.update({ content });
        } else {
            const msg = await ChatMessage.create({ content, flags: { glog2d6: { reconRequest: recon.id }}});
            recon.messageId = msg.id;
        }
    }

    async _complete(recon) {
        const results = [...recon.results.values()];
        const grouped = results.reduce((acc, r) => ((acc[r.encounterType] ??= []).push(r), acc), {});

        const summary = Object.entries(grouped).map(([type, actors]) =>
            `<div class="mb-8">
                <h4 class="text-bold text-primary">${type}</h4>
                ${actors.map(r => {
                    const breakdown = [];
                    if (r.encounter) breakdown.push(`Encounter: ${r.encounter}`);
                    if (r.recon) breakdown.push(`Recon: ${r.recon}${r.features.includes('Tracker') ? ' (5-6 success)' : ' (6 success)'}`);
                    if (r.features.length) breakdown.push(`Features: ${r.features.join(', ')}`);

                    let result = `<div class="mb-4">
                        <strong>${r.actorName}:</strong> [${breakdown.join(', ')}]`;

                    if (r.success && ['Active Encounter', 'Passive Encounter'].includes(r.encounterType)) {
                        result += `<br><span class="text-success text-bold">• Surprise gained!</span>`;
                    }
                    if (r.success && r.encounterType === 'Nothing') {
                        result += `<br><span class="text-primary">• Footprints found</span>`;
                    }
                    if (r.effects.includes('Stalker: Ambush +1')) {
                        result += `<br><span class="text-muted">• Ambush resistance improved</span>`;
                    }
                    if (r.effects.includes('Danger Sense: Ambush +1')) {
                        result += `<br><span class="text-muted">• Danger Sense: Ambush resistance improved</span>`;
                    }

                    return result + `</div>`;
                }).join('')}
            </div>`
        ).join('');

        await ChatMessage.create({
            content: `<div class="section p-10 border-success">
                <h3 class="text-success mb-8"><i class="fas fa-map"></i> Recon Results</h3>
                ${summary}
            </div>`
        });
    }
}

class ReconAnalyzer {
    constructor(actor, roll, encounterType) {
        this.actor = actor;
        this.roll = roll;
        this.encounterType = encounterType;
        this.features = actor.items.filter(i => i.type === "feature" && i.system.active);
    }

    analyze() {
        const hasTracker = this._hasFeature("Tracker");
        const hasStalker = this._hasFeature("Stalker");
        const hasDanger = this._hasFeature("Danger Sense");

        // Tracker changes success condition from 6 to 5-6
        const success = hasTracker ? this.roll >= 5 : this.roll === 6;
        const isActivePassive = ['Active Encounter', 'Passive Encounter'].includes(this.encounterType);

        const effects = [];
        if (success && isActivePassive) effects.push('Surprise');
        if (success && !isActivePassive) effects.push('Footprints');
        if (hasStalker) effects.push('Stalker: Ambush +1');
        if (hasDanger) effects.push('Danger Sense: Ambush +1');

        return {
            success,
            effects,
            features: [hasTracker && 'Tracker', hasStalker && 'Stalker', hasDanger && 'Danger Sense'].filter(Boolean),
            hasTracker
        };
    }

    _hasFeature(name) { return this.features.some(f => f.name === name); }
}

export function initReconSystem() {
    game.glog2d6 ??= {};
    game.glog2d6.reconSystem = new ReconSystem();

    if (game.user.isGM) {
        game.glog2d6.recon = (actors, params) => game.glog2d6.reconSystem.initiate(actors, params);
        game.glog2d6.quickRecon = () => {
            const actors = game.actors.filter(a => a.type === 'character').map(a => a.id);
            return actors.length ? game.glog2d6.recon(actors) : ui.notifications.warn("No characters found");
        };
    }

    // Add recon button to scene controls for GMs
    Hooks.on('getSceneControlButtons', controls => {
        if (!game.user.isGM) return;

        const tokenControls = controls.find(c => c.name === 'token');
        if (tokenControls) {
            tokenControls.tools.push({
                name: 'recon',
                title: 'Quick Recon Check',
                icon: 'fas fa-search',
                button: true,
                onClick: () => game.glog2d6.quickRecon()
            });
        }
    });

    Hooks.on("renderChatMessage", (_, html) => {
        html.find('[data-recon-id]').click(async e => {
            e.preventDefault();
            const { reconId, actorId } = e.currentTarget.dataset;
            try {
                await game.glog2d6.reconSystem.execute(reconId, actorId);
                e.currentTarget.disabled = true;
                e.currentTarget.textContent = 'Rolled';
            } catch (error) {
                ui.notifications.error(error.message);
            }
        });
    });

    // Cleanup
    setInterval(() => {
        const cutoff = Date.now() - 3600000;
        for (const [id, recon] of game.glog2d6.reconSystem.active) {
            if (recon.timestamp < cutoff) game.glog2d6.reconSystem.active.delete(id);
        }
    }, 600000);
}
