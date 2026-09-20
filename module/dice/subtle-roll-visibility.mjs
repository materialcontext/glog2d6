/**
 * Who sees which half of a subtle roll.
 *
 * A subtle check posts two messages: a public notice that something happened,
 * and a blind whisper carrying the answer. Between them they serve two
 * audiences, but everyone was being shown both halves -- the player got the
 * notice and then an empty box they are not allowed to read, and the GM got a
 * notice restating what the result beneath it already said.
 *
 * So each viewer keeps the half addressed to them and the other is hidden.
 * Hidden, not skipped: the messages still exist, they still whisper to the
 * right people, and revealing one later still works. This only decides what is
 * worth drawing.
 */

export const SUBTLE_HIDDEN_CLASS = "glog-subtle-hidden";

/**
 * @param {object} flags            a ChatMessage's flags
 * @param {object} viewer
 * @param {boolean} viewer.isGM
 * @returns {boolean} whether to hide this message from this viewer
 */
export function hidesSubtleMessage(flags = {}, { isGM = false } = {}) {
    const glog = flags?.glog2d6 ?? {};

    // The GM reads the result, which names the character and says more than
    // the notice does.
    if (glog.subtleNotice) return Boolean(isGM);

    // Everyone else may not read the result -- including its own author, which
    // is the whole point of the blind flag. Still true once it has been
    // revealed: revealing posts a fresh public message rather than unsealing
    // this one, so unhiding it here would show the same roll twice.
    if (glog.subtleRoll) return !isGM;

    return false;
}
