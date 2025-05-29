import { analyzeEquippedWeapons } from "../../utils/actor-analysis.mjs";

export class SheetRollHandler {
    constructor(sheet) {
        this.sheet = sheet;
        this.actor = sheet.actor;
    }

    async handleAttributeRoll(event) {
        event.preventDefault();
        const attributeKey = this.extractAttributeFromElement(event.currentTarget);
        const defaultTargetNumber = 7;

        await this.actor.rollAttribute(attributeKey, defaultTargetNumber);
    }

    async handleSaveRoll(event) {
        event.preventDefault();
        event.stopPropagation();

        const attributeKey = this.extractAttributeFromElement(event.currentTarget);
        await this.actor.rollSave(attributeKey);
    }

    async handleAttackRoll(event) {
        event.preventDefault();

        const weaponAnalysis = analyzeEquippedWeapons();
        const attackStrategy = this.determineAttackStrategy(weaponAnalysis);

        await attackStrategy.execute();
    }

    async handleDefenseRoll(event) {
        event.preventDefault();
        await this.actor.rollDefense();
    }

    async handleMeleeDefenseRoll(event) {
        event.preventDefault();
        await this.actor.rollMeleeDefense();
    }

    async handleRangedDefenseRoll(event) {
        event.preventDefault();
        await this.actor.rollRangedDefense();
    }

    async handleMovementRoll(event) {
        event.preventDefault();
        await this.actor.rollMovement();
    }

    async handleWeaponAttack(event) {
        event.preventDefault();
        const weapon = this.extractWeaponFromEvent(event);

        if (weapon) {
            await this.actor.rollWeaponAttack(weapon);
        }
    }

    // Skill roll handlers
    async handleSneakRoll(event) {
        event.preventDefault();
        await this.actor.rollSneak();
    }

    async handleHideRoll(event) {
        event.preventDefault();
        await this.actor.rollHide();
    }

    async handleDisguiseRoll(event) {
        event.preventDefault();
        await this.actor.rollDisguise();
    }

    async handleReactionRoll(event) {
        event.preventDefault();
        await this.actor.rollReaction();
    }

    async handleDiplomacyRoll(event) {
        event.preventDefault();
        await this.actor.rollDiplomacy();
    }

    async handleIntimidateRoll(event) {
        event.preventDefault();
        await this.actor.rollIntimidate();
    }

    // Helper methods
    extractAttributeFromElement(element) {
        return element.dataset.attribute;
    }

    extractWeaponFromEvent(event) {
        const itemId = event.currentTarget.dataset.itemId;
        return this.actor.items.get(itemId);
    }

    determineAttackStrategy(weaponAnalysis) {
        if (!weaponAnalysis.hasWeapons) {
            return new UnarmedAttackStrategy(this.actor);
        }

        if (weaponAnalysis.attackButtonType === 'split') {
            return new MultipleAttackOptionsStrategy(this.actor);
        }

        return new WeaponAttackStrategy(this.actor, weaponAnalysis.primaryWeapon);
    }
}

class UnarmedAttackStrategy {
    constructor(actor) {
        this.actor = actor;
    }

    async execute() {
        console.log("Executing unarmed attack!")
        await this.actor.rollAttack(null, "melee");
    }

    async promptForAttackType() {
        return new Promise((resolve) => {
            new Dialog({
                title: "Attack Type",
                content: `<p>Choose your attack type:</p>`,
                buttons: {
                    melee: { label: "Melee", callback: () => resolve("melee") },
                    ranged: { label: "Ranged", callback: () => resolve("ranged") }
                },
                default: "melee",
                close: () => resolve(null)
            }).render(true);
        });
    }
}

class WeaponAttackStrategy {
    constructor(actor, weapon) {
        this.actor = actor;
        this.weapon = weapon;
    }

    async execute() {
        if (this.weapon) {
            await this.actor.rollWeaponAttack(this.weapon);
        } else {
            await this.actor.rollAttack();
        }
    }
}

class MultipleAttackOptionsStrategy {
    constructor(actor) {
        this.actor = actor;
    }

    async execute() {
        const attackType = await this.promptForAttackType();
        if (attackType) {
            await this.actor.rollAttack(attackType);
        }
    }

    async promptForAttackType() {
        // Same as UnarmedAttackStrategy for now
        return new UnarmedAttackStrategy(this.actor).promptForAttackType();
    }
}
