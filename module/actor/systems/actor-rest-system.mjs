// module/actor/systems/actor-rest-system.mjs
export class ActorRestSystem {
    constructor(actor) {
        this.actor = actor;
    }

    async performRest() {
        const restCalculator = new RestCalculator(this.actor);
        const restResult = restCalculator.calculateRecovery();

        await this.applyRestUpdates(restResult.updates);
        await this.sendRestChatMessage(restResult.messages);

        return restResult.summary;
    }

    async applyRestUpdates(updates) {
        if (Object.keys(updates).length > 0) {
            await this.actor.update(updates);
        }
    }

    async sendRestChatMessage(messages) {
        const messageBuilder = new RestChatMessageBuilder(this.actor, messages);
        await messageBuilder.sendMessage();
    }
}

class RestCalculator {
    constructor(actor) {
        this.actor = actor;
        this.system = actor.system;
        this.updates = {};
        this.messages = [];
    }

    calculateRecovery() {
        const hpRestored = this.calculateHpRecovery();
        const mdRestored = this.calculateMagicDiceRecovery();

        return {
            updates: this.updates,
            messages: this.messages,
            summary: {
                hpRestored,
                mdRestored,
                message: this.buildSummaryMessage()
            }
        };
    }

    calculateHpRecovery() {
        return this.recoverStat(
            this.system.hp.value,
            this.system.hp.max,
            "HP",
            "system.hp.value"
        );
    }

    calculateMagicDiceRecovery() {
        return this.recoverStat(
            this.system.magicDiceCurrent || 0,
            this.system.magicDiceMax || 0,
            "Magic Dice",
            "system.magicDiceCurrent"
        );
    }

    recoverStat(current, max, label, updateKey) {
        if (max <= 0) return 0;

        if (current < max) {
            this.updates[updateKey] = max;
            this.messages.push(`Restored ${max - current} ${label} (${current} → ${max})`);
            return max - current;
        } else {
            this.messages.push(`${label} already at maximum`);
            return 0;
        }
    }

    buildSummaryMessage() {
        return this.messages.length > 0
            ? this.messages.join(" • ")
            : "No recovery needed";
    }
}

class RestChatMessageBuilder {
    constructor(actor, messages) {
        this.actor = actor;
        this.messages = messages;
    }

    async sendMessage() {
        const content = this.buildMessageContent();

        await ChatMessage.create({
            speaker: ChatMessage.getSpeaker({ actor: this.actor }),
            content: content,
            type: CONST.CHAT_MESSAGE_TYPES.OTHER
        });
    }

    buildMessageContent() {
        const restSummary = this.buildRestSummary();

        return `
            <div class="glog2d6-roll rest-message">
                <h3><i class="fas fa-bed"></i> ${this.actor.name} takes a rest</h3>
                <div class="roll-result">
                    <strong>Recovery:</strong><br>
                    ${restSummary}
                </div>
            </div>
        `;
    }

    buildRestSummary() {
        return this.messages.length > 0
            ? this.messages.join(" • ")
            : "No recovery needed";
    }
}
