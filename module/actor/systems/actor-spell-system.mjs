// module/actor/systems/actor-spell-system.mjs
export class ActorSpellSystem {
    constructor(actor) {
        this.actor = actor;
    }

    async castSpellWithDice(spell, diceCount) {
        const spellCaster = new SpellCaster(this.actor, spell, diceCount);
        return spellCaster.castSpell();
    }
}

class SpellCaster {
    constructor(actor, spell, diceCount) {
        this.actor = actor;
        this.spell = spell;
        this.diceCount = diceCount;
    }

    async castSpell() {
        const rollResult = await this.rollMagicDice();
        const magicDiceResult = this.analyzeMagicDiceRoll(rollResult);

        await this.updateActorMagicDice(magicDiceResult);
        await this.sendSpellResultMessage(rollResult, magicDiceResult);

        return magicDiceResult;
    }

    async rollMagicDice() {
        const roll = new Roll(`${this.diceCount}d6`);
        await roll.evaluate();
        return roll;
    }

    analyzeMagicDiceRoll(roll) {
        const results = roll.terms[0].results.map(r => r.result);
        const exhausted = results.filter(r => r >= 4).length;
        const returned = results.length - exhausted;

        return {
            results,
            exhausted,
            returned,
            total: roll.total,
            newCurrent: Math.max(0, this.actor.system.magicDiceCurrent - exhausted)
        };
    }

    async updateActorMagicDice(magicDiceResult) {
        await this.actor.update({
            "system.magicDiceCurrent": magicDiceResult.newCurrent
        });
    }

    async sendSpellResultMessage(roll, magicDiceResult) {
        const messageBuilder = new SpellResultMessageBuilder(
            this.actor,
            this.spell,
            this.diceCount,
            roll,
            magicDiceResult
        );

        await messageBuilder.sendMessage();
    }
}

class SpellResultMessageBuilder {
    constructor(actor, spell, diceCount, roll, magicDiceResult) {
        this.actor = actor;
        this.spell = spell;
        this.diceCount = diceCount;
        this.roll = roll;
        this.magicDiceResult = magicDiceResult;
    }

    async sendMessage() {
        const content = this.buildMessageContent();

        await ChatMessage.create({
            speaker: ChatMessage.getSpeaker({ actor: this.actor }),
            content: content,
            roll: this.roll
        });
    }

    buildMessageContent() {
        const diceResultSection = this.buildDiceResultSection();
        const spellEffectSection = this.buildSpellEffectSection();

        return `
            <div class="glog2d6-spell-result">
                <h3>${this.actor.name} casts ${this.spell.name}!</h3>
                ${diceResultSection}
                ${spellEffectSection}
            </div>
        `;
    }

    buildDiceResultSection() {
        const { results, exhausted, returned, total, newCurrent } = this.magicDiceResult;
        const maxMD = this.actor.system.magicDiceMax;

        return `
            <div class="magic-dice-result">
                <strong>Magic Dice:</strong> [${results.join(', ')}] = ${total}<br>
                <strong>Dice Exhausted:</strong> ${exhausted} (rolled 4-6)<br>
                <strong>Dice Returned:</strong> ${returned} (rolled 1-3)<br>
                <strong>Remaining MD:</strong> ${newCurrent}/${maxMD}
            </div>
        `;
    }

    buildSpellEffectSection() {
        return `
            <div class="spell-effect">
                <p><strong>Spell Effect:</strong> Use [dice] = ${this.diceCount} and [sum] = ${this.magicDiceResult.total} in spell description</p>
            </div>
        `;
    }
}
