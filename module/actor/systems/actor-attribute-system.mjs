export class ActorAttributeSystem {
    constructor(actor) {
        this.actor = actor;
    }

    calculateAttributeModifiers() {
        for (const [_key, attribute] of Object.entries(this.actor.system.attributes)) {
            attribute.mod = this.calculateSingleModifier(attribute.value);
        }
    }

    calculateSingleModifier(attributeValue) {
        if (attributeValue === 7) return 0;
        if (attributeValue < 7) return Math.floor((8 - attributeValue) / 2) * -1;
        if (attributeValue > 7) return Math.floor((attributeValue - 6) / 2);
        return 0;
    }

    applyEncumbranceToAttributes() {
        if (this.actor.type !== "character") return;

        const encumbrancePenalty = this.actor.system.inventory.encumbrance || 0;
        if (encumbrancePenalty > 0) {
            this.applyEncumbranceToDexterity(encumbrancePenalty);
        }
    }

    initializeEffectiveModifiers() {
        for (const [_key, attribute] of Object.entries(this.actor.system.attributes)) {
            this.initializeSingleAttributeEffectiveMods(attribute);
        }
    }

    initializeSingleAttributeEffectiveMods(attribute) {
        attribute.effectiveMod = attribute.mod; // Default to original mod
        attribute.effectiveValue = attribute.value; // Default to original value
    }

    applyEncumbranceToDexterity(encumbrancePenalty) {
        const dexAttribute = this.actor.system.attributes.dex;

        this.applyDexterityEncumbrancePenalty(dexAttribute, encumbrancePenalty);
        this.logDexterityAdjustment(dexAttribute, encumbrancePenalty);
    }

    applyDexterityEncumbrancePenalty(dexAttribute, encumbrancePenalty) {
        const originalValue = dexAttribute.value;
        const effectiveValue = Math.max(1, originalValue - encumbrancePenalty);

        dexAttribute.effectiveValue = effectiveValue;
        dexAttribute.effectiveMod = this.calculateSingleModifier(effectiveValue);
    }

    logDexterityAdjustment(dexAttribute, _encumbrancePenalty) {
        console.log(`Dex encumbrance applied: Value ${dexAttribute.value} -> ${dexAttribute.effectiveValue}, Mod ${dexAttribute.mod} -> ${dexAttribute.effectiveMod}`);
    }


}
