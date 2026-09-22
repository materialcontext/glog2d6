import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { migrateRetiredNpcs } from "../scripts/initialize-content.mjs";

const ROOT = resolve(import.meta.dirname, "..");
const read = p => readFileSync(resolve(ROOT, p), "utf8");

let deleted;
let created;

function world(...sources) {
    const byId = new Map(sources.map(source => [source._id, source]));

    game.actors = {
        invalidDocumentIds: new Set(byId.keys()),
        getInvalid: (id) => (byId.has(id) ? { _source: byId.get(id) } : null)
    };
}

const npc = (id, name) => ({
    _id: id,
    name,
    type: "npc",
    img: "wolf.webp",
    system: { hp: { value: 7, max: 7 }, attributes: { str: { value: 9 } }, woundTable: "Beast Maulings" },
    items: [{ name: "Fangs", type: "weapon" }]
});

beforeEach(() => {
    deleted = [];
    created = [];

    globalThis.Actor = class Actor {
        static async deleteDocuments(ids) { deleted.push(ids); }
        static async createDocuments(data, options) { created.push([data, options]); return data; }
    };

    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
    globalThis.ui = { notifications: { info() {}, warn() {}, error() {} } };
});

/**
 * The npc type held hit points, attributes and nothing else -- no attack, no
 * defence -- so a monster could not take part in a contest at all. An actor
 * whose type a system no longer declares does not load, but Foundry keeps its
 * id and will hand back its source, so the conversion still has everything.
 */
describe("carrying the retired NPCs over", () => {
    it("recreates each one as a character", async () => {
        world(npc("n1", "Dire Wolf"));

        expect(await migrateRetiredNpcs()).toBe(1);
        expect(created[0][0][0]).toMatchObject({
            _id: "n1",
            name: "Dire Wolf",
            type: "character",
            system: { hp: { value: 7, max: 7 }, woundTable: "Beast Maulings" }
        });
    });

    /** Every token on every scene points at the id, so it has to survive. */
    it("keeps the id", async () => {
        world(npc("n1", "Dire Wolf"));
        await migrateRetiredNpcs();

        expect(created[0][1]).toEqual({ keepId: true });
        expect(created[0][0][0]._id).toBe("n1");
    });

    /** Two documents cannot hold one id, so the old one goes first. */
    it("deletes before it creates", async () => {
        world(npc("n1", "Dire Wolf"));
        const order = [];
        Actor.deleteDocuments = async () => { order.push("delete"); };
        Actor.createDocuments = async () => { order.push("create"); };

        await migrateRetiredNpcs();
        expect(order).toEqual(["delete", "create"]);
    });

    it("carries everything the actor was holding", async () => {
        world(npc("n1", "Dire Wolf"));
        await migrateRetiredNpcs();

        expect(created[0][0][0].items).toEqual([{ name: "Fangs", type: "weapon" }]);
        expect(created[0][0][0].img).toBe("wolf.webp");
    });

    it("takes every one of them", async () => {
        world(npc("n1", "Dire Wolf"), npc("n2", "Brigand"));

        expect(await migrateRetiredNpcs()).toBe(2);
        expect(deleted.flat()).toEqual(["n1", "n2"]);
    });

    /**
     * An id is in `invalidDocumentIds` for any reason at all. Only the ones
     * this system retired are ours to rewrite.
     */
    it("leaves documents that are broken for other reasons alone", async () => {
        world({ _id: "x", name: "Something Else", type: "vehicle", system: {} });

        expect(await migrateRetiredNpcs()).toBe(0);
        expect(deleted).toEqual([]);
        expect(created).toEqual([]);
    });

    it("does nothing at all in a world that had none", async () => {
        world();
        expect(await migrateRetiredNpcs()).toBe(0);

        game.actors = {};
        expect(await migrateRetiredNpcs()).toBe(0);
    });

    /** A failed recreation must leave the data recoverable by hand. */
    it("prints the whole actor before it deletes anything", async () => {
        world(npc("n1", "Dire Wolf"));
        Actor.createDocuments = async () => { throw new Error("nope"); };

        expect(await migrateRetiredNpcs()).toBe(0);

        const printed = console.log.mock.calls.flat().join(" ");
        expect(printed).toContain("Dire Wolf");
        expect(printed).toContain("Beast Maulings");
        expect(console.error).toHaveBeenCalled();
    });

    it("keeps going after one of them fails", async () => {
        world(npc("n1", "Dire Wolf"), npc("n2", "Brigand"));
        Actor.createDocuments = async (data) => {
            if (data[0]._id === "n1") throw new Error("nope");
            created.push([data]);
        };

        expect(await migrateRetiredNpcs()).toBe(1);
        expect(created[0][0][0].name).toBe("Brigand");
    });
});

describe("the type is gone", () => {
    it("is not declared any more", () => {
        expect(Object.keys(JSON.parse(read("system.json")).documentTypes.Actor)).toEqual(["character", "hireling"]);

        const template = JSON.parse(read("template.json"));
        expect(template.Actor.types).toEqual(["character", "hireling"]);
        expect(template.Actor).not.toHaveProperty("npc");
    });

    it("has no sheet and no template left", () => {
        const entry = read("glog2d6.mjs");
        expect(entry).toContain('types: ["character"]');
        expect(entry).not.toContain("actor-npc-sheet");
    });

    /** Running it once is what the content version is for. */
    it("is carried over by the content migration", () => {
        const content = read("scripts/initialize-content.mjs");
        expect(content).toContain("await migrateRetiredNpcs()");
        expect(content).toMatch(/CONTENT_VERSION = "1\.4\.0"/);
    });
});
