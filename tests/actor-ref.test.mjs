import { readFileSync, globSync } from "node:fs";
import { resolve } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { actorFrom, actorRef } from "../module/systems/actor-ref.mjs";

const ROOT = resolve(import.meta.dirname, "..");
const read = p => readFileSync(resolve(ROOT, p), "utf8");

const sidebar = { id: "n1", name: "Dire Wolf", uuid: "Actor.n1", system: { hp: { value: 20 } } };
const onCanvas = { id: "n1", name: "Dire Wolf", uuid: "Scene.s1.Token.t1.Actor.n1", system: { hp: { value: 6 } } };

beforeEach(() => {
    game.actors = { get: id => (id === "n1" ? sidebar : null) };
    globalThis.fromUuidSync = () => null;
    vi.spyOn(console, "warn").mockImplementation(() => {});
});

/**
 * The bug: a token that is not linked to its prototype carries a *synthetic*
 * actor, and Foundry gives that actor its base actor's id -- the API calls it
 * "a reference to the synthetic token actor by its base actor's ID". So
 * `game.actors.get(actor.id)` hands back the sheet in the sidebar, and damage
 * written that way lands on the prototype while the creature on the canvas is
 * untouched.
 */
describe("finding the actor a card points at", () => {
    it("takes the creature on the canvas over the sheet in the sidebar", () => {
        globalThis.fromUuidSync = () => ({ documentName: "Token", actor: onCanvas });

        const found = actorFrom("Scene.s1.Token.t1");
        expect(found).toBe(onCanvas);
        expect(found).not.toBe(sidebar);
        expect(found.system.hp.value, "the token's own hit points").toBe(6);
    });

    it("resolves a plain actor uuid to that actor", () => {
        globalThis.fromUuidSync = uuid => (uuid === "Actor.n1" ? sidebar : null);
        expect(actorFrom("Actor.n1")).toBe(sidebar);
    });

    /** Cards posted before any of this existed carry a bare id. */
    it("still answers a bare id", () => {
        expect(actorFrom("n1")).toBe(sidebar);
        expect(actorFrom("nobody")).toBeNull();
    });

    it("finds nothing where there is nothing", () => {
        expect(actorFrom("")).toBeNull();
        expect(actorFrom(null)).toBeNull();
        expect(actorFrom("   ")).toBeNull();
        expect(actorFrom("Actor.gone")).toBeNull();
    });

    /**
     * `fromUuidSync` throws by default for anything it cannot answer on the
     * spot, which for our purposes is simply "not found".
     */
    it("survives a uuid it cannot answer", () => {
        globalThis.fromUuidSync = () => { throw new Error("cannot resolve synchronously"); };
        expect(actorFrom("Compendium.pack.Actor.x")).toBeNull();
    });

    it("asks for the non-strict lookup, which is what stops the throwing", () => {
        const asked = [];
        globalThis.fromUuidSync = (uuid, options) => { asked.push(options); return null; };

        actorFrom("Actor.n1");
        expect(asked[0]).toEqual({ strict: false });
    });
});

describe("how a card refers to an actor", () => {
    it("is the uuid, which a token keeps its own", () => {
        expect(actorRef(onCanvas)).toBe("Scene.s1.Token.t1.Actor.n1");
        expect(actorRef(sidebar)).toBe("Actor.n1");
    });

    it("falls back to an id, and to nothing at all", () => {
        expect(actorRef({ id: "n1" })).toBe("n1");
        expect(actorRef(null)).toBe("");
    });
});

describe("the system uses it", () => {
    const sources = globSync("module/**/*.mjs", { cwd: ROOT })
        .filter(f => !f.endsWith("actor-ref.mjs"))
        .map(read).join("\n");

    /** The combat cards are where unlinked tokens actually turn up. */
    it("refers to a target and an attacker by uuid, not by id", () => {
        const flow = read("module/systems/contest-flow.mjs");
        expect(flow).toContain("actorRef(contest.defender)");
        expect(flow).toContain("actorFrom(targetUuid)");
        expect(flow).not.toContain("game.actors.get");
    });

    it("resolves every chat-card actor the same way", () => {
        expect(read("glog2d6.mjs")).not.toContain("game.actors.get");
        expect(read("module/systems/gm-roll-system.mjs")).toContain("actorFrom(params.attacker)");
    });

    /**
     * The request system is aimed at the party, whose actors are linked, and
     * it is keyed by id throughout -- so it is the one place left that looks
     * an actor up in the world collection.
     */
    it("leaves the request system as the only id-keyed thing", () => {
        const offenders = globSync("module/**/*.mjs", { cwd: ROOT })
            .filter(f => read(f).includes("game.actors.get"));

        expect(offenders).toEqual(["module/systems/gm-roll-system.mjs"]);
        void sources;
    });
});
