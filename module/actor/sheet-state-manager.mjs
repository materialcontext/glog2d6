// module/actor/sheet-state-manager.mjs
export class SheetStateManager {
    constructor(sheet) {
        this.sheet = sheet;
        this.actor = sheet.actor;
    }

    updateAllVisualElements(html) {
        this.applyEditModeStyles(html);
        this.updateAttributeDisplays(html);
        this.updateMovementDisplay(html);
    }

    applyEditModeStyles(html) {
        const isEditMode = this.isEditModeActive();

        if (!isEditMode) {
            this.makeElementsClickable(html);
        }
    }

    makeElementsClickable(html) {
        const clickableSelectors = [
            '.attribute-card[data-attribute]',
            '.combat-card[data-action]',
            '.action-card[data-action]',
            '.movement-display'
        ];

        clickableSelectors.forEach(selector => {
            html.find(selector).addClass('clickable');
        });
    }

    updateAttributeDisplays(html) {
        html.find('.attribute-card[data-attribute]').each((index, element) => {
            const attributeKey = this.extractAttributeKey(element);
            const attribute = this.getAttributeData(attributeKey);

            if (attribute) {
                this.updateSingleAttributeDisplay($(element), attribute);
            }
        });
    }

    updateSingleAttributeDisplay($card, attribute) {
        const displayUpdater = new AttributeDisplayUpdater($card, attribute);
        displayUpdater.updateValueDisplay();
        displayUpdater.updateModifierDisplay();
        displayUpdater.applyColorCoding();
    }

    updateMovementDisplay(html) {
        const $movementDisplay = html.find('.movement-display');

        if ($movementDisplay.length > 0 && this.actor.type === "character") {
            const movementUpdater = new MovementDisplayUpdater($movementDisplay, this.actor);
            movementUpdater.updateDisplay();
        }
    }

    isEditModeActive() {
        return this.actor.getFlag("glog2d6", "editMode") === true;
    }

    extractAttributeKey(element) {
        return $(element).attr('data-attribute');
    }

    getAttributeData(attributeKey) {
        return this.actor.system.attributes[attributeKey];
    }
}

class AttributeDisplayUpdater {
    constructor($card, attribute) {
        this.$card = $card;
        this.attribute = attribute;
        this.$attributeValue = $card.find('.attribute-value');
        this.$modifierCurrent = $card.find('.modifier-current');
        this.$modifierOriginal = $card.find('.modifier-original');
    }

    updateValueDisplay() {
        const { value: baseValue, effectiveValue } = this.getValueData();

        if (this.hasEffectiveValueChanged(effectiveValue, baseValue)) {
            this.displayEffectiveAndOriginalValues(effectiveValue, baseValue);
        } else {
            this.displaySingleValue(baseValue);
        }
    }

    updateModifierDisplay() {
        const { mod: originalMod, effectiveMod } = this.getModifierData();

        this.displayCurrentModifier(effectiveMod);
        this.displayOriginalModifierIfChanged(effectiveMod, originalMod);
    }

    applyColorCoding() {
        const colorClass = this.determineColorClass();

        this.$attributeValue
            .removeClass('normal negatively-impacted positively-impacted')
            .addClass(colorClass);
    }

    getValueData() {
        const baseValue = this.attribute.value;
        const effectiveValue = this.attribute.effectiveValue ?? baseValue;
        return { value: baseValue, effectiveValue };
    }

    getModifierData() {
        const originalMod = this.attribute.mod;
        const effectiveMod = this.attribute.effectiveMod ?? originalMod;
        return { mod: originalMod, effectiveMod };
    }

    hasEffectiveValueChanged(effectiveValue, baseValue) {
        return effectiveValue !== baseValue;
    }

    displayEffectiveAndOriginalValues(effectiveValue, baseValue) {
        this.$attributeValue.html(`
            <span class="effective-attr-value">${effectiveValue}</span>
            <span class="original-attr-value">(${baseValue})</span>
        `);
    }

    displaySingleValue(value) {
        this.$attributeValue.text(value);
    }

    displayCurrentModifier(effectiveMod) {
        const formattedMod = this.formatModifier(effectiveMod);
        this.$modifierCurrent.text(formattedMod);
    }

    displayOriginalModifierIfChanged(effectiveMod, originalMod) {
        if (effectiveMod !== originalMod) {
            const formattedOriginalMod = this.formatModifier(originalMod);
            this.$modifierOriginal.text(formattedOriginalMod).show();
        } else {
            this.$modifierOriginal.hide();
        }
    }

    formatModifier(modifier) {
        return (modifier >= 0 ? '+' : '') + modifier;
    }

    determineColorClass() {
        const { value: baseValue, effectiveValue } = this.getValueData();
        const { mod: originalMod, effectiveMod } = this.getModifierData();

        if (effectiveValue < baseValue || effectiveMod < originalMod) {
            return 'negatively-impacted';
        }

        if (effectiveValue > baseValue || effectiveMod > originalMod) {
            return 'positively-impacted';
        }

        return 'normal';
    }
}

class MovementDisplayUpdater {
    constructor($movementDisplay, actor) {
        this.$movementDisplay = $movementDisplay;
        this.actor = actor;
    }

    updateDisplay() {
        const movementData = this.getMovementData();

        if (this.hasMovementChanged(movementData)) {
            this.displayEffectiveAndBaseMovement(movementData);
            this.applyNegativeImpactStyling();
        } else {
            this.displayBaseMovementOnly(movementData.baseMovement);
            this.removeNegativeImpactStyling();
        }
    }

    getMovementData() {
        return {
            baseMovement: this.actor.system.details.movement,
            effectiveMovement: this.actor.system.details.effectiveMovement
        };
    }

    hasMovementChanged({ effectiveMovement, baseMovement }) {
        return effectiveMovement !== undefined && effectiveMovement !== baseMovement;
    }

    displayEffectiveAndBaseMovement({ effectiveMovement, baseMovement }) {
        this.$movementDisplay.html(`
            <span>Move</span>
            <span class="effective-value">${effectiveMovement}</span>
            <span class="original-value">(${baseMovement})</span>
        `);
    }

    displayBaseMovementOnly(baseMovement) {
        this.$movementDisplay.html(`
            <span>Move</span>
            ${baseMovement || 4}
        `);
    }

    applyNegativeImpactStyling() {
        this.$movementDisplay.addClass('negatively-impacted');
    }

    removeNegativeImpactStyling() {
        this.$movementDisplay.removeClass('negatively-impacted');
    }
}
