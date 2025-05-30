CONFIG.GLOG = {};
const glog = CONFIG.GLOG;

glog.CONSTANTS = {
    WEAPON_SIZES: {
        LIGHT: 'light',
        MEDIUM: 'medium',
        HEAVY: 'heavy'
    },
    WEAPON_TYPES: {
        MELEE: 'melee',
        RANGED: 'ranged',
        THROWN: 'thrown'
    },

    // UI Labels
    WEAPON_SIZE_LABELS: {
        'light': 'Light',
        'medium': 'Medium',
        'heavy': 'Heavy'
    }
};

async function loadSystemData() {
    try {
        const classesResponse = await fetch('systems/glog2d6/data/classes.json')
        if (classesResponse.ok) {
            const classesData = await classesResponse.json();
            glog.CLASSES = classesData.classes;
            console.log('glog2d6 | Loaded', glog.Classes.length, 'classes with template details')
        }
    } catch (error) {
        console.log('glog2d6 | Errpr loading classes.json')
        glog.CLASSES = getDefaultClasses();
    }

    try {
        // Load features (featrues data)
        const featuresResponse = await fetch('systems/glog2d6/data/features.json');
        if (featuresResponse.ok) {
            const featureData = await featuresResponse.json();
            glog.FEATURES = featureData.classes;
            console.log('glog2d6 | Loaded', glog.FEATURES.length, 'features from classes');
        } else {
            console.warn('glog2d6 | Could not load features.json, status:', featuresResponse.status);
            glog.FEATURES = getDefaultClasses();
        }
    } catch (error) {
        console.error('glog2d6 | Error loading features.json:', error);
        glog.FEATURES = getDefaultClasses();
    }

    // Load weapons
    try {
        const weaponsResponse = await fetch('systems/glog2d6/data/weapons.json');
        if (weaponsResponse.ok) {
            const weaponData = await weaponsResponse.json();
            glog.WEAPONS = weaponData;
            console.log('glog2d6 | Loaded', weaponData.weapons.length, 'weapons and', weaponData.ammunition.length, 'ammunition types');
        } else {
            console.warn('glog2d6 | Could not load weapons.json');
            glog.WEAPONS = { weapons: [], ammunition: [] };
        }
    } catch (error) {
        console.error('glog2d6 | Error loading weapons.json:', error);
        glog.WEAPONS = { weapons: [], ammunition: [] };
    }

    // Load armor
    try {
        const armorResponse = await fetch('systems/glog2d6/data/armor.json');
        if (armorResponse.ok) {
            const armorData = await armorResponse.json();
            glog.ARMOR = armorData;
            console.log('glog2d6 | Loaded', armorData.armor.length, 'armor pieces and', armorData.shields.length, 'shields');
        } else {
            console.warn('glog2d6 | Could not load armor.json');
            glog.ARMOR = { armor: [], shields: [] };
        }
    } catch (error) {
        console.error('glog2d6 | Error loading armor.json:', error);
        glog.ARMOR = { armor: [], shields: [] };
    }

    // Load torches
    try {
        const torchesResponse = await fetch('systems/glog2d6/data/torches.json');
        if (torchesResponse.ok) {
            const torchData = await torchesResponse.json();
            glog.TORCHES = torchData;
            console.log('glog2d6 | Loaded', torchData.torches.length, 'torch types');
        } else {
            console.warn('glog2d6 | Could not load torches.json');
            glog.TORCHES = { torches: [] };
        }
    } catch (error) {
        console.error('glog2d6 | Error loading torches.json:', error);
        glog.TORCHES = { torches: [] };
    }

    // Load wounds data
    try {
        const woundsResponse = await fetch('systems/glog2d6/data/wounds.json');
        if (woundsResponse.ok) {
            const woundsData = await woundsResponse.json();
            glog.WOUNDS = woundsData;
            console.log('glog2d6 | Loaded', woundsData.wounds.length, 'wound types');
        } else {
            console.warn('glog2d6 | Could not load wounds.json');
            glog.WOUNDS = { wounds: [], bodyParts: [], maimedResults: [] };
        }
    } catch (error) {
        console.error('glog2d6 | Error loading wounds.json:', error);
        glog.WOUNDS = { wounds: [], bodyParts: [], maimedResults: [] };
    }

    // Load spells from multiple files
    await loadSpellData();
}

async function loadSpellData() {
    glog.SPELLS = { spells: [] };

    // List of spell files to load (add more as needed)
    const spellFiles = [
        'spells-1-25.json',
        'spells-26-50.json',
        'spells-51-75.json',
        'spells-76-100.json',  // Add this line
    ];

    for (const filename of spellFiles) {
        try {
            const response = await fetch(`systems/glog2d6/data/${filename}`);
            if (response.ok) {
                const spellData = await response.json();
                if (spellData.spells && Array.isArray(spellData.spells)) {
                    glog.SPELLS.spells.push(...spellData.spells);
                    console.log(`glog2d6 | Loaded ${spellData.spells.length} spells from ${filename}`);
                }
            } else if (response.status !== 404) {
                // Only warn if it's not a 404 (file not found is expected for optional files)
                console.warn(`glog2d6 | Could not load ${filename}, status:`, response.status);
            }
        } catch (error) {
            console.error(`glog2d6 | Error loading ${filename}:`, error);
        }
    }

    console.log(`glog2d6 | Total spells loaded: ${glog.SPELLS.spells.length}`);
}

// Fallback class data
function getDefaultClasses() {
    return [
        { name: "Acrobat" },
        { name: "Assassin" },
        { name: "Barbarian" },
        { name: "Courtier" },
        { name: "Fighter" },
        { name: "Hunter" },
        { name: "Thief" },
        { name: "Wizard" }
    ];
}



export {
    loadSystemData,
    loadSpellData,
    getDefaultClasses
}
