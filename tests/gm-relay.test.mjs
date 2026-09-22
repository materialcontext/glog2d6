import { readFileSync, globSync } from "node:fs";
import { resolve } from "node:path";
import { beforeEach, describe, expect, it } from "vitest";

import { RELAY, SOCKET, askTheGM, listenForRelays, onlyTheGMCan, relayHandlers } from "../module/systems/gm-relay.mjs";

const ROOT = resolve(import.meta.dirname, "..");
const read = p => readFileSync(resolve(ROOT, p), "utf8");

const TEST_MESSAGE = "test.relay";

let ran;
let emitted;
let listener;

beforeEach(() => {
    ran = [];
    emitted = [];
    listener = null;

    onlyTheGMCan(TEST_MESSAGE, (payload, user) => { ran.push([payload, user]); return "done"; });

    game.socket = {
        emit: (...args) => emitted.push(args),
        on: (_, handler) => { listener = handler; }
    };
    game.users = { get: id => ({ id, isGM: false }) };
});

/**
 * A player clicking a button that only the GM's client can honour used to run
 * it locally, find nothing, and fail silently.
 */
describe("asking the GM to do something", () => {
    it("just does it when the asker is the GM", async () => {
        game.user = { id: "gm", isGM: true };

        expect(await askTheGM(TEST_MESSAGE, { note: "hello" })).toBe("done");
        expect(ran[0][0]).toEqual({ note: "hello" });
        expect(emitted).toEqual([]);
    });

    it("sends it when the asker is not", async () => {
        game.user = { id: "p1", isGM: false };

        expect(await askTheGM(TEST_MESSAGE, { note: "hello" })).toBeNull();
        expect(ran).toEqual([]);
        expect(emitted).toEqual([[SOCKET, { note: "hello", type: TEST_MESSAGE, userId: "p1" }]]);
    });

    /** Who asked has to travel: ownership is decided about them, not the GM. */
    it("says who asked", async () => {
        game.user = { id: "p1", isGM: false };
        await askTheGM(TEST_MESSAGE, {});
        expect(emitted[0][1].userId).toBe("p1");
    });

    it("shrugs at a message nobody registered", async () => {
        game.user = { id: "gm", isGM: true };
        expect(await askTheGM("test.nobody", {})).toBeNull();
    });
});

describe("the GM's side of the socket", () => {
    beforeEach(() => {
        game.user = { id: "gm", isGM: true };
        listenForRelays();
    });

    it("runs the handler, told who asked", async () => {
        await listener({ type: TEST_MESSAGE, userId: "p1", note: "hi" });

        expect(ran[0][0]).toMatchObject({ note: "hi" });
        expect(ran[0][1]).toEqual({ id: "p1", isGM: false });
    });

    it("ignores messages it has no handler for", async () => {
        await listener({ type: "test.nobody" });
        await listener({});
        await listener(null);
        expect(ran).toEqual([]);
    });

    /** Only one client may act, or every GM present acts once. */
    it("does nothing on a client that is not the GM", async () => {
        game.user = { id: "p1", isGM: false };
        await listener({ type: TEST_MESSAGE, userId: "p1" });
        expect(ran).toEqual([]);
    });

    it("survives a handler that throws", async () => {
        onlyTheGMCan("test.throws", () => { throw new Error("nope"); });
        await expect(listener({ type: "test.throws" })).resolves.toBeUndefined();
    });
});

describe("the system wires it up", () => {
    it("registers what it needs during init, not on ready", () => {
        const gm = read("module/systems/gm-roll-system.mjs");
        const init = gm.slice(gm.indexOf("export function initGMRolls()"));
        const ready = init.indexOf('Hooks.once("ready"');

        for (const message of ["EXECUTE_REQUEST", "CALL_TRAUMA"]) {
            const at = init.indexOf(`onlyTheGMCan(RELAY.${message}`);
            expect(at, `${message} is never registered`).toBeGreaterThan(-1);
            expect(at, `${message} is registered behind ready`).toBeLessThan(ready);
        }
    });

    it("has every message somebody registers and somebody sends", () => {
        const sources = globSync("module/**/*.mjs", { cwd: ROOT }).map(read).join("\n");

        for (const [name, value] of Object.entries(RELAY)) {
            expect(sources, `${value} is never handled`).toContain(`onlyTheGMCan(RELAY.${name}`);
            expect(sources, `${value} is never asked for`).toContain(`askTheGM(RELAY.${name}`);
        }
    });

    /** One listener, so a second socket cannot go missing on its own. */
    it("keeps one socket for the whole system", () => {
        const sources = globSync("module/**/*.mjs", { cwd: ROOT })
            .filter(f => !f.endsWith("gm-relay.mjs"))
            .map(read).join("\n");

        expect(sources).not.toContain("game.socket.on");
        expect(sources).not.toContain("game.socket.emit");
    });

    it("only listens once the game is connected", () => {
        expect(read("module/systems/gm-roll-system.mjs"))
            .toMatch(/Hooks\.once\("ready"[\s\S]*listenForRelays\(\)/);
    });

    it("registers the damage relay during init too", () => {
        const entry = read("glog2d6.mjs");
        const init = /Hooks\.once\('init'[\s\S]*?\n\}\);/.exec(entry)[0];

        expect(init.indexOf("initContestFlow()"), "never called from init").toBeGreaterThan(-1);
        expect(init.indexOf("initContestFlow()"), "sits behind an await").toBeLessThan(init.indexOf("await "));
    });
});
