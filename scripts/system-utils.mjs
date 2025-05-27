const GLOG = CONFIG.GLOG;

export function setupGlobalUtils() {
    // Set up global functions
    window.getGlogClasses = function() {
        return GLOG.CLASSES || [];
    };

    window.getGlogClass = function(className) {
        if (!GLOG.CLASSES) return null;
        return GLOG.CLASSES.find(cls => cls.name === className);
    };

    window.getGlogFeatures = function() {
        return GLOG.FEATURES || [];
    };

    window.getGlogClassFeatures = function(className) {
        if (!GLOG.FEATURES) return null;
        return GLOG.FEATURES.find(cls => cls.name === className);
    };

    window.getGlogWeapons = function() {
        return GLOG.WEAPONS || { weapons: [], ammunition: [] };
    };

    window.getGlogArmor = function() {
        return GLOG.ARMOR || { armor: [], shields: [] };
    };

    window.getGlogTorches = function() {
        return GLOG.TORCHES || { torches: [] };
    };

    window.getGlogSpells = function() {
        return GLOG.SPELLS || { spells: [] };
    };

    window.getGlogItems = function() {
        const weapons = GLOG.WEAPONS || { weapons: [], ammunition: [] };
        const armor = GLOG.ARMOR || { armor: [], shields: [] };
        const torches = GLOG.TORCHES || { torches: [] };
        const spells = GLOG.SPELLS || { spells: [] };

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
