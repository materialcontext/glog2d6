// module/actor/data-context-builder.mjs
import { decorateWounds, woundsFromItems } from "../systems/wounds.mjs";
import { hasAvailableClassFeatures } from './handlers/feature-handlers.mjs';
import { analyzeEquippedWeapons, hasFeature } from '../utils/actor-analysis.mjs';
import {
    classOptions,
    classDisplayName,
    effectiveClassKey,
    isCustomClass,
    selectedClassOption
} from './class-identity.mjs';
import {
    attackTiles,
    attributeTiles,
    castingOptions,
    defenseTiles,
    encumbranceNote,
    hpBar,
    inEffectRows,
    inflictedWoundTable,
    magicDicePips,
    partitionItems,
    skillChips,
    woundEffectRows
} from './sheet-readouts.mjs';
import { DEFAULT_SHEET_MODE, SHEET_MODES, modeToggleLabel, normalizeMode } from './sheet-mode.mjs';

export class DataContextBuilder {
    constructor(actor) {
        this.actor = actor;
    }

    buildCompleteContext(baseContext, { mode = DEFAULT_SHEET_MODE } = {}) {
        const enhancer = new ContextEnhancer(this.actor, baseContext)
            .addBasicData()
            .addModeData(mode)
            .addEditModeData();

        if (CONFIG.GLOG?.CLASSES && CONFIG.GLOG?.FEATURES) {
            enhancer.addClassData().addFeatureData();
        } else {
            enhancer.addUnconfiguredClassData();
        }

        return enhancer
            .addWeaponAnalysis()
            .addAcrobatTraining()
            .addWoundData()
            .addViewModels()
            .getContext();
    }

    /**
     * The context a sheet can still render when CONFIG.GLOG never loaded, and
     * the one the hireling sheet uses because it has no class or features.
     */
    _buildSafeContext(baseContext) {
        return new ContextEnhancer(this.actor, baseContext)
            .addBasicData()
            .addModeData(SHEET_MODES.FULL)
            .addEditModeData()
            .addUnconfiguredClassData()
            .addWeaponAnalysis()
            .addAcrobatTraining()
            .addWoundData()
            .addViewModels()
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

    addModeData(mode) {
        const resolved = normalizeMode(mode);
        this.context.mode = resolved;
        this.context.isCompact = resolved === SHEET_MODES.COMPACT;
        this.context.modeToggleLabel = modeToggleLabel(resolved);
        return this;
    }

    addEditModeData() {
        // Compact is a palette, not an editor -- it has nothing to type into,
        // so it never renders the edit-mode variant of anything.
        const flagged = this.actor.getFlag("glog2d6", "editMode") === true;
        this.context.editMode = flagged && !this.context.isCompact;
        return this;
    }

    addClassData() {
        const classNames = this.classNames();
        const details = this.actor.system?.details ?? {};

        this.context.availableClasses = classNames;
        this.context.classOptions = classOptions(classNames);
        this.context.selectedClass = selectedClassOption(details, classNames);
        this.context.isCustomClass = isCustomClass(this.context.selectedClass);
        this.context.classKey = effectiveClassKey(details, classNames);
        this.context.classDisplay = classDisplayName(details);
        return this;
    }

    /**
     * No class list to choose from, so the dropdown would be a lie: the sheet
     * falls back to a plain custom name.
     */
    addUnconfiguredClassData() {
        const details = this.actor.system?.details ?? {};

        this.context.availableClasses = [];
        this.context.classOptions = classOptions([]);
        this.context.selectedClass = selectedClassOption(details, []);
        this.context.isCustomClass = true;
        this.context.classKey = "";
        this.context.classDisplay = classDisplayName(details);
        this.context.hasAvailableFeatures = false;
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

    addWoundData() {
        this.context.wounds = decorateWounds(woundsFromItems(this.actor.items ?? []));
        return this;
    }

    addViewModels() {
        const system = this.actor.system ?? {};
        const items = Array.from(this.actor.items ?? []);

        this.context.attackTiles = attackTiles({
            combat: system.combat,
            weaponAnalysis: this.context.weaponAnalysis
        });
        this.context.defenseTiles = defenseTiles({
            defense: system.defense,
            hasAcrobatTraining: this.context.hasAcrobatTraining
        });
        this.context.combatTiles = [
            ...this.context.attackTiles.map(tile => ({ ...tile, kind: "attack" })),
            ...this.context.defenseTiles.map(tile => ({ ...tile, kind: "defend" }))
        ];

        this.context.hpBar = hpBar(system.hp?.value, system.hp?.max);
        this.context.attributeTiles = attributeTiles(system.attributes);
        this.context.skillChips = skillChips(system.skills);
        this.context.magicDice = magicDicePips(system.magicDiceCurrent, system.magicDiceMax);
        this.context.castingOptions = castingOptions(system.magicDiceCurrent);
        this.context.encumbranceNote = encumbranceNote(system.inventory);
        this.context.inEffect = inEffectRows({ system, items });
        this.context.woundEffects = woundEffectRows(system.wounds?.effects);
        this.context.inflictsFrom = inflictedWoundTable({ items, system });
        this.context.itemsByKind = partitionItems(items);
        return this;
    }

    getContext() {
        return this.context;
    }

    classNames() {
        return (CONFIG.GLOG?.CLASSES ?? []).map(cls => cls.name).filter(Boolean);
    }

    checkForAvailableFeatures() {
        try {
            return hasAvailableClassFeatures(this.actor);
        } catch (error) {
            console.warn('Error checking available features:', error);
            return false;
        }
    }
}
