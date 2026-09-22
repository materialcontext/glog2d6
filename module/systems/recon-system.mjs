/**
 * The recon check: what the party notices before it is noticed.
 *
 * This used to be a whole second request system -- its own chat message, its
 * own socket handler, its own cleanup timer -- reached through an `isRecon`
 * flag that forked `GMRollSystem.create`. All of that is now the one request
 * lifecycle in gm-roll-system; what is left here is the check itself: how it
 * rolls, how a result reads, and what the party learns once everyone has
 * looked.
 */

export const ENCOUNTERS = Object.freeze([
    "Active Encounter", "Passive Encounter", "Indirect Encounter", "Nothing", "Nothing", "Nothing"
]);

const SURPRISING = ["Active Encounter", "Passive Encounter"];

/** Roll one character's recon check. */
export async function rollRecon(actor) {
    const encounter = new Roll("1d6");
    const recon = new Roll("1d6");
    await encounter.evaluate();
    await recon.evaluate();

    const encounterType = ENCOUNTERS[encounter.total - 1];
    const analysis = new ReconAnalyzer(actor, recon.total, encounterType).analyze();

    return {
        actorId: actor.id,
        actorName: actor.name,
        encounter: encounter.total,
        encounterType,
        recon: recon.total,
        roll: recon,
        ...analysis
    };
}

/** The lines a single result earns, shared by the inline row and the summary. */
function findings(result) {
    const lines = [];
    if (result.success && SURPRISING.includes(result.encounterType)) {
        lines.push(`<div class="text-success text-bold">&bull; Surprise gained!</div>`);
    }
    if (result.success && result.encounterType === "Nothing") {
        lines.push(`<div class="text-primary">&bull; Tracks found</div>`);
    }
    for (const effect of result.effects) {
        if (effect.endsWith("Ambush +1")) {
            lines.push(`<div class="text-muted">&bull; ${effect.replace(": Ambush +1", "")}: ambush resistance improved</div>`);
        }
    }
    return lines.join("");
}

/** One character's result, as it reads in the request message. */
export function reconRow(result) {
    return `<div class="p-4 mb-4 section border-success">
        <div class="text-bold mb-4">${result.actorName}</div>
        <div class="mb-2">Encounter: ${result.encounter} (${result.encounterType})</div>
        <div class="mb-2">Recon: ${result.recon} (${result.hasTracker ? "5-6" : "6"} surprise)</div>
        ${result.features.length ? `<div class="mb-2 text-muted">Features: ${result.features.join(", ")}</div>` : ""}
        ${findings(result)}
    </div>`;
}

/**
 * What the party as a whole found, grouped by what was out there. This was
 * written long ago and never called: the old recon system deleted the request
 * on the last roll instead of completing it.
 */
export function reconSummary(results) {
    const grouped = results.reduce((acc, r) => ((acc[r.encounterType] ??= []).push(r), acc), {});

    const summary = Object.entries(grouped).map(([type, actors]) => `
        <div class="mb-8">
            <h4 class="text-bold text-primary">${type}</h4>
            ${actors.map(r => `
                <div class="mb-4">
                    <strong>${r.actorName}:</strong>
                    [Encounter: ${r.encounter}, Recon: ${r.recon}${r.hasTracker ? " (5-6 success)" : " (6 success)"}${r.features.length ? `, Features: ${r.features.join(", ")}` : ""}]
                    ${findings(r)}
                </div>
            `).join("")}
        </div>
    `).join("");

    return `<div class="section p-10 border-success">
        <h3 class="text-success mb-8"><i class="fas fa-map"></i> Recon Results</h3>
        ${summary}
    </div>`;
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

        // Tracker changes the success condition from 6 to 5-6.
        const success = hasTracker ? this.roll >= 5 : this.roll === 6;
        const isActivePassive = SURPRISING.includes(this.encounterType);

        const effects = [];
        if (success && isActivePassive) effects.push("Surprise");
        if (success && !isActivePassive) effects.push("Footprints");
        if (hasStalker) effects.push("Stalker: Ambush +1");
        if (hasDanger) effects.push("Danger Sense: Ambush +1");

        return {
            success,
            effects,
            features: [hasTracker && "Tracker", hasStalker && "Stalker", hasDanger && "Danger Sense"].filter(Boolean),
            hasTracker
        };
    }

    _hasFeature(name) { return this.features.some(f => f.name === name); }
}
