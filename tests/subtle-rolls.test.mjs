import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";

import { RollChatMessageBuilder } from "../module/actor/actor.mjs";

/**
 * WIS, INT and CHA checks are meant to be resolved by the GM without the
 * player learning what the dice said -- the GM narrates the outcome instead.
 *
 * `whisper` alone does not do that. ChatMessage#visible returns true for the
 * message's own author, and the author is the player who clicked, so a
 * whispered roll hid from the rest of the table and from nobody else. `blind`
 * is the flag that means "sent blindly where the creating User cannot see it".
 */
describe("subtle rolls", () => {
    let created;

    const actor = {
        name: "Mareth",
        items: [],
        system: { hp: { value: 5, max: 10 } }
    };

    const roll = () => ({
        total: 9,
        formula: "2d6 + 1",
        terms: [{ results: [{ result: 4 }, { result: 4 }] }],
        dice: [{ results: [{ result: 4 }, { result: 4 }] }],
        toJSON: () => ({ formula: "2d6 + 1", total: 9 })
    });

    const build = (context = "wisdom") =>
        new RollChatMessageBuilder(actor, "Wisdom Check", roll(), "", context);

    beforeEach(() => {
        created = [];
        vi.spyOn(ChatMessage, "create").mockImplementation(async data => {
            created.push(data);
            return { id: `msg${created.length}`, ...data, update: async () => {} };
        });
        vi.spyOn(ChatMessage, "getWhisperRecipients").mockReturnValue([{ id: "gm1" }, { id: "gm2" }]);
    });

    afterEach(() => vi.restoreAllMocks());

    describe("a subtle roll", () => {
        beforeEach(async () => {
            await build().createAndSend({ subtle: true, revealOnCritical: false });
        });

        it("posts the public notice and the private result, in that order", () => {
            expect(created).toHaveLength(2);
            expect(created[0].content).toContain("takes in their surroundings");
            expect(created[1].content).toContain("Wisdom Check");
        });

        it("tells the table a roll happened without telling them anything else", () => {
            const [notice] = created;
            expect(notice.whisper).toBeUndefined();
            expect(notice.blind).toBeUndefined();
            expect(notice.content).not.toContain("9");
        });

        it("whispers the result to the GMs", () => {
            expect(created[1].whisper).toEqual(["gm1", "gm2"]);
        });

        /** The actual fix: without this the roller reads their own whisper. */
        it("marks the result blind, so its own author cannot read it", () => {
            expect(created[1].blind).toBe(true);
        });

        it("keeps what the reveal path needs on the message", () => {
            const subtle = created[1].flags.glog2d6.subtleRoll;
            expect(subtle.revealed).toBe(false);
            expect(subtle.rollContent).toContain("Wisdom Check");
            expect(subtle.rollJson).toEqual({ formula: "2d6 + 1", total: 9 });
        });
    });

    describe("an ordinary roll", () => {
        beforeEach(async () => {
            await build("attack").createAndSend({ subtle: false });
        });

        it("posts one message", () => {
            expect(created).toHaveLength(1);
        });

        /** Blind must never leak onto a public roll -- it would hide the result
         *  from the very player who needs it. */
        it("is neither whispered nor blind", () => {
            expect(created[0].whisper).toBeUndefined();
            expect(created[0].blind).toBeUndefined();
            expect(created[0].content).toContain("9");
        });
    });
});
