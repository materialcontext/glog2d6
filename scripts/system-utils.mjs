import {
    GLOG_CLASSES,
    GLOG_WEAPONS,
    GLOG_ARMOR,
    GLOG_FEATURES,
    GLOG_TORCHES,
    GLOG_SPELLS,
    getDefaultClasses
} from '../data/data-loader.mjs';

export function setupGlobalUtils() {
    // Set up global functions
    window.getGlogClasses = function() {
        return GLOG_CLASSES || getDefaultClasses();
    };

    window.getGlogClass = function(className) {
        if (!GLOG_CLASSES) return null;
        return GLOG_CLASSES.find(cls => cls.name === className);
    };

    window.getGlogFeatures = function() {
        return GLOG_FEATURES || [];
    };

    window.getGlogClassFeatures = function(className) {
        if (!GLOG_FEATURES) return null;
        return GLOG_FEATURES.find(cls => cls.name === className);
    };

    window.getGlogWeapons = function() {
        return GLOG_WEAPONS || { weapons: [], ammunition: [] };
    };

    window.getGlogArmor = function() {
        return GLOG_ARMOR || { armor: [], shields: [] };
    };

    window.getGlogTorches = function() {
        return GLOG_TORCHES || { torches: [] };
    };

    window.getGlogSpells = function() {
        return GLOG_SPELLS || { spells: [] };
    };

    window.getGlogItems = function() {
        const weapons = GLOG_WEAPONS || { weapons: [], ammunition: [] };
        const armor = GLOG_ARMOR || { armor: [], shields: [] };
        const torches = GLOG_TORCHES || { torches: [] };
        const spells = GLOG_SPELLS || { spells: [] };

        return [
            ...weapons.weapons,
            ...weapons.ammunition,
            ...armor.armor,
            ...armor.shields,
            ...torches.torches,
            ...spells.spells
        ];
    };
}
