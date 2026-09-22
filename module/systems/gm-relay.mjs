/**
 * Things only the GM's client can do, asked for from anywhere.
 *
 * Several parts of play are held in the GM's memory or written to documents a
 * player cannot touch: the roll requests, a monster's hit points, calling for
 * a trauma save. A player clicking the button that does one of those used to
 * run it against their own client, find nothing there, and fail silently --
 * the button simply did nothing.
 *
 * One socket, one registry. A caller asks; if they are the GM it happens here
 * and now, and if they are not it travels. Registration takes no live game
 * state, so it is safe to do during init -- which is the other half of why
 * those buttons kept dying.
 */

export const SOCKET = "system.glog2d6";

export const RELAY = Object.freeze({
    EXECUTE_REQUEST: "rollExecute",
    CALL_TRAUMA: "traumaCall",
    APPLY_DAMAGE: "applyDamage",
    BREAK_WEAPON: "breakWeapon"
});

const handlers = new Map();

/**
 * Declare what the GM's client does with one kind of request.
 *
 * @param {string} type
 * @param {(payload: object, user: object) => Promise<any>} handler
 *        `user` is whoever asked -- never assume it is the GM running it.
 */
export function onlyTheGMCan(type, handler) {
    handlers.set(type, handler);
}

/** Ask for it. Runs here when the asker is the GM, travels when they are not. */
export async function askTheGM(type, payload = {}) {
    if (game.user.isGM) return handlers.get(type)?.(payload, game.user) ?? null;

    game.socket.emit(SOCKET, { ...payload, type, userId: game.user.id });
    return null;
}

/**
 * Start listening. Belongs to a connected game, so this is called on ready
 * rather than during init.
 */
export function listenForRelays() {
    game.socket.on(SOCKET, async (data) => {
        if (!game.user.isGM) return;

        const handler = handlers.get(data?.type);
        if (!handler) return;

        try {
            await handler(data, game.users.get(data.userId));
        } catch (error) {
            console.error("glog2d6 | Relayed action failed:", data?.type, error);
        }
    });
}

/** Test seam: what is registered right now. */
export function relayHandlers() {
    return [...handlers.keys()];
}
