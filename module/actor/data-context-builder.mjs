// module/actor/data-context-builder.mjs
import { hasAvailableClassFeatures } from './handlers/feature-handlers.mjs';

export class DataContextBuilder {
    constructor(actor) {
        this.actor = actor;
    }

    buildCompleteContext(baseContext) {
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
        this.context.weaponAnalysis = this.analyzeEquippedWeapons();
        return this;
    }

    addAcrobatTraining() {
        this.context.hasAcrobatTraining = this.checkForAcrobatTraining();
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

    analyzeEquippedWeapons() {
        try {
            return this.actor.analyzeEquippedWeapons();
        } catch (error) {
            console.warn('Error analyzing weapons:', error);
            return { hasWeapons: false, attackButtonType: 'generic' };
        }
    }

    checkForAcrobatTraining() {
        try {
            return this.actor.hasFeature("Acrobat Training");
        } catch (error) {
            console.warn('Error checking for Acrobat Training:', error);
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
