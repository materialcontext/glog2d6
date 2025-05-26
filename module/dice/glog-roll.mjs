export class GLOG2D6Roll extends Roll {
    constructor(formula, data = {}, options = {}) {
        super(formula, data, options);
        this._checkForSpecialFeatures = options.checkSpecialFeatures || false;
        this._rollContext = options.context || null; // 'attack', 'save', 'attribute', etc.
        this._actor = options.actor || null;
    }

    async evaluate(options = {}) {
        const result = await super.evaluate(options);

        // Only check for doubles if we have special features that care
        if (this._checkForSpecialFeatures && this._isD6Roll()) {
            this._analyzeSpecialConditions();
        }

        return result;
    }

    _isD6Roll() {
        // Check if this is a 2d6 roll
        return this.terms[0]?.faces === 6 && this.terms[0]?.number === 2;
    }

    _analyzeSpecialConditions() {
        if (this.terms[0]?.results?.length === 2) {
            const dice = this.terms[0].results.map(r => r.result);
            if (dice[0] === dice[1]) {
                this._doubles = true;
                this._snakeEyes = dice[0] === 1 && dice[1] === 1;

                // Critical hit detection
                this._criticalHit = (dice[0] === 6); // Double 6s
                this._criticalFailure = (dice[0] === 1); // Snake eyes
            }
        }
    }

    get hasDoubles() { return this._doubles || false; }
    get isSnakeEyes() { return this._snakeEyes || false; }
    get isCriticalHit() { return this._criticalHit || false; }
    get isCriticalFailure() { return this._criticalFailure || false; }
    get specialEffects() {
        if (!this._actor || !this.hasDoubles || this.isSnakeEyes) return [];
        return this._actor.getSpecialEffectsForRoll(this._rollContext, this);
    }
}
