export async function revealNote(actor, event) {
    event.preventDefault();
    event.stopPropagation();

    const itemId = event.currentTarget.dataset.itemId;
    const note = actor.items.get(itemId);
    if (!note) return;

    await ChatMessage.create({
        speaker: ChatMessage.getSpeaker({ actor }),
        content: `
            <div class="glog2d6-roll">
                <h3>${actor.name} — ${note.name}</h3>
                <div class="roll-result">
                    ${note.system.description || '<em>No content.</em>'}
                </div>
            </div>
        `
    });
}

export async function openNote(actor, event) {
    if (event.target.closest('a, button')) return;
    const itemId = event.currentTarget.dataset.itemId;
    const note = actor.items.get(itemId);
    if (note) note.sheet.render(true);
}
