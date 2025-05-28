// module/actor/systems/actor-torch-system.mjs
import { updateTokenLighting } from "../handlers/torch-handlers.mjs";

export class ActorTorchSystem {
    constructor(actor) {
        this.actor = actor;
    }

    async toggleTorch() {
        if (this.actor.type !== "character") return;

        const torchStateManager = new TorchStateManager(this.actor);
        return torchStateManager.toggle();
    }

    getAvailableTorches() {
        return this.actor.items.filter(item =>
            item.type === "torch" &&
            (!item.system.duration.enabled || item.system.duration.remaining > 0)
        );
    }

    getActiveTorch() {
        const torchId = this.actor.system.torch?.activeTorchId;
        if (!torchId) return null;
        return this.actor.items.get(torchId);
    }

    async burnTorch(hours = 0.1) {
        const torchBurner = new TorchBurner(this.actor);
        return torchBurner.burnActiveTorch(hours);
    }
}

class TorchStateManager {
    constructor(actor) {
        this.actor = actor;
    }

    async toggle() {
        const currentState = this.getCurrentTorchState();
        const newState = !currentState;

        if (newState && !this.hasAvailableTorches()) {
            ui.notifications.warn("No torches available or all torches are burned out!");
            return;
        }

        const activeTorch = newState ? this.selectActiveTorch() : null;

        await this.updateActorTorchState(newState, activeTorch);
        await this.updateTokenLighting(newState, activeTorch);
        await this.sendChatMessage(newState, activeTorch);

        return newState;
    }

    getCurrentTorchState() {
        return this.actor.system.torch?.lit || false;
    }

    hasAvailableTorches() {
        const availableTorches = this.actor.items.filter(item =>
            item.type === "torch" &&
            (!item.system.duration.enabled || item.system.duration.remaining > 0)
        );
        return availableTorches.length > 0;
    }

    selectActiveTorch() {
        const availableTorches = this.getAvailableTorches();
        const currentTorchId = this.actor.system.torch?.activeTorchId;

        return availableTorches.find(t => t.id === currentTorchId) || availableTorches[0];
    }

    getAvailableTorches() {
        return this.actor.items.filter(item =>
            item.type === "torch" &&
            (!item.system.duration.enabled || item.system.duration.remaining > 0)
        );
    }

    async updateActorTorchState(newState, activeTorch) {
        await this.actor.update({
            "system.torch.lit": newState,
            "system.torch.activeTorchId": activeTorch?.id || null
        });
    }

    async updateTokenLighting(newState, activeTorch) {
        updateTokenLighting(this.actor, newState, newState ? activeTorch : null);
    }

    async sendChatMessage(newState, activeTorch) {
        const messageBuilder = new TorchChatMessageBuilder(this.actor, newState, activeTorch);
        await messageBuilder.sendMessage();
    }
}

class TorchBurner {
    constructor(actor) {
        this.actor = actor;
    }

    async burnActiveTorch(hours) {
        const activeTorch = this.getActiveTorch();
        if (!this.shouldBurnTorch(activeTorch)) return;

        const newRemaining = this.calculateNewDuration(activeTorch, hours);
        await activeTorch.update({ "system.duration.remaining": newRemaining });

        if (newRemaining === 0) {
            await this.handleBurnedOutTorch(activeTorch);
        }
    }

    getActiveTorch() {
        const torchId = this.actor.system.torch?.activeTorchId;
        return torchId ? this.actor.items.get(torchId) : null;
    }

    shouldBurnTorch(activeTorch) {
        return activeTorch &&
               this.actor.system.torch?.lit &&
               activeTorch.system.duration.enabled;
    }

    calculateNewDuration(activeTorch, hours) {
        const burnRate = activeTorch.system.duration.burnRate || 1.0;
        const actualBurn = hours * burnRate;
        return Math.max(0, activeTorch.system.duration.remaining - actualBurn);
    }

    async handleBurnedOutTorch(burnedTorch) {
        ui.notifications.info(`${burnedTorch.name} has burned out!`);

        if (burnedTorch.system.duration.autoExtinguish) {
            await this.tryAutoSwitchTorch(burnedTorch);
        } else {
            ui.notifications.warn(`${burnedTorch.name} is burned out but still lit (auto-extinguish disabled)`);
        }
    }

    async tryAutoSwitchTorch(burnedTorch) {
        const otherTorches = this.getOtherAvailableTorches(burnedTorch.id);

        if (otherTorches.length > 0) {
            await this.switchToNewTorch(otherTorches[0]);
        } else {
            await this.extinguishAllTorches();
        }
    }

    getOtherAvailableTorches(excludeId) {
        return this.actor.items.filter(item =>
            item.type === "torch" &&
            item.id !== excludeId &&
            (!item.system.duration.enabled || item.system.duration.remaining > 0)
        );
    }

    async switchToNewTorch(newTorch) {
        await this.actor.update({ "system.torch.activeTorchId": newTorch.id });
        ui.notifications.info(`Automatically switched to ${newTorch.name}`);
    }

    async extinguishAllTorches() {
        const torchSystem = new ActorTorchSystem(this.actor);
        await torchSystem.toggleTorch();
    }
}

class TorchChatMessageBuilder {
    constructor(actor, isLit, torch) {
        this.actor = actor;
        this.isLit = isLit;
        this.torch = torch;
    }

    async sendMessage() {
        const content = this.buildMessageContent();

        await ChatMessage.create({
            speaker: ChatMessage.getSpeaker({ actor: this.actor }),
            content: content
        });
    }

    buildMessageContent() {
        if (this.isLit) {
            return this.buildLitMessage();
        } else {
            return this.buildExtinguishedMessage();
        }
    }

    buildLitMessage() {
        const durationInfo = this.getDurationInfo();

        return `<div class="glog2d6-roll">
            <h3>${this.actor.name} lights a torch</h3>
            <div class="roll-result">
                <strong>Torch:</strong> ${this.torch.name}<br>
                <strong>Duration:</strong> ${durationInfo}
            </div>
        </div>`;
    }

    buildExtinguishedMessage() {
        return `<div class="glog2d6-roll">
            <h3>${this.actor.name} extinguishes their torch</h3>
        </div>`;
    }

    getDurationInfo() {
        return this.torch.system.duration.enabled
            ? `${this.torch.system.duration.remaining} hours remaining`
            : "∞ duration";
    }
}
