// module/actor/systems/actor-movement-system.mjs
export class ActorMovementSystem {
    constructor(actor) {
        this.actor = actor;
    }

    calculateEffectiveMovement() {
        if (this.actor.type !== "character") return;

        const movementCalculator = new MovementCalculator(this.actor);
        const effectiveMovement = movementCalculator.calculate();

        this.actor.system.details.effectiveMovement = effectiveMovement;

        this.logMovementCalculation(movementCalculator);
    }

    logMovementCalculation(calculator) {
        const { baseMovement, movementBonus, movePenalty } = calculator.getCalculationBreakdown();

        if (movePenalty > 0 || movementBonus > 0) {
            console.log(`Movement calculation: ${baseMovement} base + ${movementBonus} bonus - ${movePenalty} penalty = ${this.actor.system.details.effectiveMovement}`);
        }
    }
}

class MovementCalculator {
    constructor(actor) {
        this.actor = actor;
        this.system = actor.system;
    }

    calculate() {
        const baseMovement = this.getBaseMovement();
        const movementBonus = this.getMovementBonus();
        const movePenalty = this.calculateMovementPenalty();

        this.calculationBreakdown = { baseMovement, movementBonus, movePenalty };

        return Math.max(0, baseMovement + movementBonus - movePenalty);
    }

    getCalculationBreakdown() {
        return this.calculationBreakdown || { baseMovement: 0, movementBonus: 0, movePenalty: 0 };
    }

    getBaseMovement() {
        return this.system.details.movement;
    }

    getMovementBonus() {
        return this.system.details.movementBonus || 0;
    }

    calculateMovementPenalty() {
        const encumbrance = this.system.inventory.encumbrance || 0;
        return Math.floor(encumbrance / 2);
    }
}
