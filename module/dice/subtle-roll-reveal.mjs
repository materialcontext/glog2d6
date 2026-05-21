/**
 * Handles revealing a subtle roll to all players.
 *
 * This is the single code path for both:
 *   - GM clicking "Reveal to Players" on a whispered message
 *   - Automatic reveal triggered by a critical hit
 *
 * The whispered message is updated (flag set, re-rendered without button).
 * A new public ChatMessage is posted with the full roll content.
 */
export class SubtleRollReveal {
    /**
     * @param {string} messageId   — ID of the whispered ChatMessage
     * @param {object} options
     * @param {boolean} options.auto  — true when triggered by critical, affects label
     */
    static async reveal(messageId, { auto = false } = {}) {
        const message = game.messages.get(messageId);
        if (!message) {
            console.warn(`glog2d6 | SubtleRollReveal: message ${messageId} not found`);
            return;
        }

        const subtleData = message.flags?.glog2d6?.subtleRoll;
        if (!subtleData) {
            console.warn(`glog2d6 | SubtleRollReveal: message ${messageId} has no subtleRoll flag`);
            return;
        }
        if (subtleData.revealed) return; // already revealed, nothing to do

        // Reconstruct the roll object for proper dice tooltip display
        let roll;
        try {
            if (subtleData.rollJson) {
                roll = Roll.fromData(subtleData.rollJson);
            }
        } catch (err) {
            console.warn('glog2d6 | SubtleRollReveal: could not reconstruct roll', err);
        }

        // Post the public message — identical content to what the GM saw
        const publicData = {
            speaker: subtleData.speaker,
            content: subtleData.rollContent,
        };
        if (roll) publicData.roll = roll;

        await ChatMessage.create(publicData);

        // Mark as revealed — Foundry re-renders the whispered message,
        // and the renderChatMessageHTML hook will see revealed=true and skip
        // injecting the reveal button.
        await message.update({ 'flags.glog2d6.subtleRoll.revealed': true });
    }
}
