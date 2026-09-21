/**
 * Requests: the GM calls for a roll, the players own the button.
 *
 * There used to be two of these -- this one and a parallel recon system,
 * reached through an `isRecon` flag -- each with its own chat message, socket
 * and cleanup. They have been folded into one lifecycle. What a request type
 * does is data (see systems/roll-requests) plus, where a type needs more than
 * a formula, a roller, a row and an `onComplete` declared here.
 *
 * Two things were broken in the old lifecycle and are fixed by the fold: the
 * buttons carried no class the handler bound to, and a player's click ran
 * `execute` against their own client, where the request does not exist. A
 * click now travels to the GM, who holds it.
 */

import {
    ROLL_TYPES as REQUEST_TYPES,
    SKILL_ATTRS,
    isComplete,
    mayRollFor,
    requestDamage,
    rollSpec,
    succeeded
} from "./roll-requests.mjs";
import { reconRow, reconSummary, rollRecon } from "./recon-system.mjs";
import { damageSource, withTable, woundTableFor } from "./damage-source.mjs";

export const SOCKET = "system.glog2d6";
export const EXECUTE_REQUEST = "rollExecute";

/** How long a request stays answerable. */
const REQUEST_LIFETIME = 3600000;

/**
 * What a type does beyond its formula. A type that rolls itself names a
 * roller; a type with more to say about a result renders its own row; a type
 * with something to tell the party afterwards supplies `onComplete`.
 */
const BEHAVIOUR = {
    recon: {
        roll: (actor) => rollRecon(actor),
        row: reconRow,
        onComplete: (request) => reconSummary([...request.results.values()])
    },
    trauma: {
        row: traumaRow,
        // The offered wounds are the outcome; a table of totals underneath
        // them would only be in the way.
        onComplete: null
    }
};

export const ROLL_TYPES = Object.freeze(Object.fromEntries(
    Object.entries(REQUEST_TYPES).map(([key, config]) =>
        [key, { row: defaultRow, onComplete: rankedSummary, ...config, ...(BEHAVIOUR[key] ?? {}) }])
));

/** A plain result line: who rolled, what they got, whether it was enough. */
function defaultRow(result) {
    const verdict = result.success === undefined ? "" : (result.success ? " &check;" : " &cross;");
    return `<div class="text-small">${result.actorName}: ${result.total}${verdict}</div>`;
}

/** Everyone's totals, best first -- what most requests have to say at the end. */
function rankedSummary(request) {
    const ranked = [...request.results.values()].sort((a, b) => b.total - a.total);

    return `<div class="section p-10 border-success">
        <h3 class="text-success mb-8">${request.config.name} - Results</h3>
        ${ranked.map((r, i) => `<div class="text-small">${i ? "" : "&#127942;"} ${r.actorName}: ${r.total}${r.success === undefined ? "" : (r.success ? " &check;" : " &cross;")}</div>`).join("")}
    </div>`;
}

/**
 * A failed trauma save offers the wound rather than imposing one, and carries
 * the blow with it so the wound is drawn from the attacker's table and rolled
 * against the anatomy that weapon reaches.
 */
function traumaRow(result, request) {
    if (result.success !== false) return defaultRow(result);

    const damage = requestDamage(request.params);
    return `${defaultRow(result)}
        <button type="button" class="btn btn-danger p-4 mb-4 w-full apply-wound-btn"
                data-actor-id="${result.actorId}"
                data-damage="${damage}"
                data-attacker="${request.params.attacker ?? ""}"
                data-wound-table="${request.params.woundTable ?? ""}">
            <i class="fas fa-plus"></i> Apply Wound (${damage} damage)
        </button>`;
}

export class GMRollSystem {
    static ROLL_TYPES = ROLL_TYPES;
    static SKILL_ATTRS = SKILL_ATTRS;

    constructor() { this.rolls = new Map(); }

    async create(type, actorIds, params = {}) {
        if (!game.user.isGM) throw new Error("GM only");
        const config = ROLL_TYPES[type];
        if (!config) throw new Error(`Unknown type: ${type}`);

        const roll = { id: foundry.utils.randomID(), type, config, params, actorIds, results: new Map(), timestamp: Date.now() };
        this.rolls.set(roll.id, roll);
        await this._createMessage(roll);
        return roll.id;
    }

    /**
     * Roll one actor's part of a request. Runs on the GM's client, because
     * that is where the request lives -- so the permission asked about is the
     * clicking user's, not the running client's.
     */
    async execute(rollId, actorId, user = game.user) {
        const roll = this.rolls.get(rollId);
        if (!roll || roll.results.has(actorId)) throw new Error("Invalid roll state");

        const actor = game.actors.get(actorId);
        if (!mayRollFor(actor, user)) throw new Error("No permission");

        const result = await this._roll(roll, actor);
        roll.results.set(actorId, result);
        await this._updateMessage(roll);

        if (isComplete(roll)) {
            await this._complete(roll);
            this.rolls.delete(roll.id);
        }
        return result;
    }

    async _roll(request, actor) {
        if (request.config.roll) return request.config.roll(actor, request.params);

        const { formula, data } = rollSpec(request.type, actor, request.params);
        const rollObj = actor.createRoll(formula, data, request.type);
        await rollObj.evaluate();

        return {
            actorId: actor.id,
            actorName: actor.name,
            total: rollObj.total,
            success: succeeded(request.type, rollObj.total, request.params),
            roll: rollObj
        };
    }

    async _createMessage(roll) {
        const message = await ChatMessage.create({
            content: this._buildContent(roll),
            flags: { glog2d6: { rollRequest: roll.id, type: roll.type, actorIds: roll.actorIds } }
        });
        roll.messageId = message.id;
    }

    async _updateMessage(roll) {
        await game.messages.get(roll.messageId)?.update({ content: this._buildContent(roll) });
    }

    /** What the party learns once everyone has rolled. */
    async _complete(roll) {
        const content = roll.config.onComplete?.(roll);
        if (content) await ChatMessage.create({ content });
    }

    _buildContent(roll) {
        const actors = roll.actorIds.map(id => game.actors.get(id)).filter(Boolean);
        const rows = actors.map(actor => {
            const result = roll.results.get(actor.id);
            if (result) return roll.config.row(result, roll);

            return `<button type="button" class="btn btn-primary p-4 mb-4 w-full roll-request-btn"
                            data-roll-id="${roll.id}" data-actor-id="${actor.id}"
                            ${actor.isOwner ? "" : "disabled"}>${actor.name}</button>`;
        }).join("");

        return `<div class="section p-10 border-primary">
            <h3 class="text-primary mb-8">${roll.config.name}</h3>
            ${this._describe(roll)}
            ${roll.params.description ? `<div class="text-small mb-8">${roll.params.description}</div>` : ""}
            ${rows}
            <div class="text-center text-small text-muted">${roll.results.size}/${roll.actorIds.length}</div>
        </div>`;
    }

    /** The GM's framing of the request, in the words the type uses. */
    _describe(roll) {
        const shown = { attribute: "Attribute", skill: "Skill", target: "Target", location: "Location", damage: "Damage" };
        const parts = Object.entries(roll.params)
            .filter(([key, value]) => value && shown[key])
            .map(([key, value]) => `${shown[key]}: ${value}`);

        if (roll.type === "trauma") {
            const blow = blowFrom(roll.params);
            if (blow.actorName) parts.push(`From: ${blow.actorName}`);
            parts.push(`Table: ${woundTableFor(blow)}`);
        }

        return parts.length ? `<div class="text-small text-muted mb-8">${parts.join(" | ")}</div>` : "";
    }
}

export function initGMRolls() {
    game.glog2d6 ??= {};
    game.glog2d6.gmRollSystem = new GMRollSystem();

    // Registered before anything that reads `game.user` or `game.socket`, so
    // a convenience helper or a missing socket can never take the buttons
    // down with it -- which is exactly how the recon buttons died twice.
    Hooks.on("renderChatMessageHTML", (msg, html) => {
        $(html).find("[data-roll-id]").click(async event => {
            event.preventDefault();
            const { rollId, actorId } = event.currentTarget.dataset;
            try {
                await requestRoll(rollId, actorId);
                event.currentTarget.disabled = true;
                event.currentTarget.textContent = "Rolled";
            } catch (error) {
                ui.notifications.error(error.message);
            }
        });
    });

    Hooks.on("chatMessage", (log, msg) => {
        if (msg === "/gmroll") { game.glog2d6.rollRequest(); return false; }
    });

    // The socket and `game.user` belong to a connected game rather than to
    // init, so they are claimed here rather than above.
    Hooks.once("ready", () => {
        game.socket.on(SOCKET, async (data) => {
            if (data?.type !== EXECUTE_REQUEST || !game.user.isGM) return;
            try {
                await game.glog2d6.gmRollSystem.execute(data.rollId, data.actorId, game.users.get(data.userId));
            } catch (error) {
                console.error("glog2d6 | Roll request failed:", error);
            }
        });

        if (!game.user.isGM) return;

        // Each type is callable from a macro: game.glog2d6.trauma(ids, {...}).
        for (const type of Object.keys(ROLL_TYPES)) {
            game.glog2d6[type] = (actors, params) => game.glog2d6.gmRollSystem.create(type, actors, params);
        }

        // The whole party, for the check that is usually asked of everyone.
        game.glog2d6.quickRecon = () => {
            const party = game.actors.filter(a => a.type === "character").map(a => a.id);
            return party.length ? game.glog2d6.recon(party) : ui.notifications.warn("No characters found");
        };
    });

    setInterval(() => {
        const cutoff = Date.now() - REQUEST_LIFETIME;
        for (const [id, roll] of game.glog2d6.gmRollSystem.rolls) {
            if (roll.timestamp < cutoff) game.glog2d6.gmRollSystem.rolls.delete(id);
        }
    }, 600000);
}

/**
 * The blow a trauma request was called for: who struck, and which table the
 * wound is drawn from. A table the GM named outright wins over the attacker's
 * own, because naming one is the GM saying what this particular blow was.
 */
export function blowFrom(params = {}) {
    const attacker = params.attacker ? game.actors.get(params.attacker) : null;
    return withTable(damageSource({ actor: attacker }), params.woundTable);
}

/**
 * Answer a request. A player's click has to reach the GM: the request lives
 * in the GM's memory, so a player executing it locally found nothing there
 * and the button did nothing at all.
 */
export async function requestRoll(rollId, actorId) {
    if (game.user.isGM) return game.glog2d6.gmRollSystem.execute(rollId, actorId, game.user);
    game.socket.emit(SOCKET, { type: EXECUTE_REQUEST, rollId, actorId, userId: game.user.id });
    return null;
}
