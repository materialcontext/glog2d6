// module/actor/data-context-builder.mjs
import { hasAvailableClassFeatures } from './handlers/feature-handlers.mjs';
import { analyzeEquippedWeapons, hasFeature } from '../utils/actor-analysis.mjs';

export class DataContextBuilder {
    constructor(actor) {
        this.actor = actor;
    }

    buildCompleteContext(baseContext) {
        // Single line fix - check if CONFIG.GLOG exists
        if (!CONFIG.GLOG || !CONFIG.GLOG.CLASSES || !CONFIG.GLOG.FEATURES) {
            return this._buildSafeContext(baseContext);
        }

        const contextEnhancer = new ContextEnhancer(this.actor, baseContext);

        return contextEnhancer
            .addBasicData()
            .addEditModeData()
            .addClassData()
            .addFeatureData()
            .addWeaponAnalysis()
            .addAcrobatTraining()
            .addDebugLogging()
            .getContext();
    }

    // Add this fallback method
    _buildSafeContext(baseContext) {
        return {
            ...baseContext,
            rollData: this.actor.getRollData(),
            system: this.actor.system,
            flags: this.actor.flags,
            editMode: this.actor.getFlag("glog2d6", "editMode") === true,
            weaponAnalysis: { hasWeapons: false, attackButtonType: 'generic' },
            hasAvailableFeatures: false,
            availableClasses: [],
            hasAcrobatTraining: false
        };
    }
}

class ContextEnhancer {
    constructor(actor, context) {
        this.actor = actor;
        this.context = context;
    }

    addBasicData() {
        this.context.rollData = this.actor.getRollData();
        this.context.system = this.actor.system;
        this.context.flags = this.actor.flags;
        return this;
    }

    addEditModeData() {
        this.context.editMode = this.actor.getFlag("glog2d6", "editMode") === true;
        return this;
    }

    addClassData() {
        const availableClasses = this.getAvailableClasses();
        this.context.availableClasses = availableClasses.map(cls => cls.name);
        return this;
    }

    addFeatureData() {
        this.context.hasAvailableFeatures = this.checkForAvailableFeatures();
        return this;
    }

    addWeaponAnalysis() {
        this.context.weaponAnalysis = analyzeEquippedWeapons(this.actor.items);
        return this;
    }

    addAcrobatTraining() {
        this.context.hasAcrobatTraining = hasFeature(this.actor.items, "Acrobat Training");
        return this;
    }

    addDebugLogging() {
        if (this.actor.type === "character") {
            this.logContextDebugInfo();
        }
        return this;
    }

    getContext() {
        return this.context;
    }

    getAvailableClasses() {
        return CONFIG.GLOG.CLASSES || [];
    }

    checkForAvailableFeatures() {
        try {
            return hasAvailableClassFeatures(this.actor);
        } catch (error) {
            console.warn('Error checking available features:', error);
            return false;
        }
    }

    logContextDebugInfo() {
        const debugInfo = {
            actorName: this.actor.name,
            editMode: this.context.editMode,
            weaponAnalysis: this.context.weaponAnalysis,
            hasAcrobatTraining: this.context.hasAcrobatTraining,
            encumbrance: this.context.system.inventory.encumbrance
        };

        console.log(`Sheet getData - ${debugInfo.actorName}:`, debugInfo);
    }
}
