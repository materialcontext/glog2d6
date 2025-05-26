// systyem data management helpers

let GLOG_CLASSES = null;
let GLOG_WEAPONS = null;
let GLOG_ARMOR = null;
let GLOG_FEATURES = null;
let GLOG_TORCHES = null;
let GLOG_SPELLS = null;

async function loadSystemData() {
    try {
        // Load features (classes)
        const featuresResponse = await fetch('systems/glog2d6/data/features.json');
        if (featuresResponse.ok) {
            const featureData = await featuresResponse.json();
            GLOG_FEATURES = featureData.classes;
            console.log('glog2d6 | Loaded', GLOG_FEATURES.length, 'classes with detailed features');
        } else {
            console.warn('glog2d6 | Could not load features.json, status:', featuresResponse.status);
            GLOG_FEATURES = getDefaultClasses();
        }
    } catch (error) {
        console.error('glog2d6 | Error loading features.json:', error);
        GLOG_FEATURES = getDefaultClasses();
    }

    // Load weapons
    try {
        const weaponsResponse = await fetch('systems/glog2d6/data/weapons.json');
        if (weaponsResponse.ok) {
            const weaponData = await weaponsResponse.json();
            GLOG_WEAPONS = weaponData;
            console.log('glog2d6 | Loaded', weaponData.weapons.length, 'weapons and', weaponData.ammunition.length, 'ammunition types');
        } else {
            console.warn('glog2d6 | Could not load weapons.json');
            GLOG_WEAPONS = { weapons: [], ammunition: [] };
        }
    } catch (error) {
        console.error('glog2d6 | Error loading weapons.json:', error);
        GLOG_WEAPONS = { weapons: [], ammunition: [] };
    }

    // Load armor
    try {
        const armorResponse = await fetch('systems/glog2d6/data/armor.json');
        if (armorResponse.ok) {
            const armorData = await armorResponse.json();
            GLOG_ARMOR = armorData;
            console.log('glog2d6 | Loaded', armorData.armor.length, 'armor pieces and', armorData.shields.length, 'shields');
        } else {
            console.warn('glog2d6 | Could not load armor.json');
            GLOG_ARMOR = { armor: [], shields: [] };
        }
    } catch (error) {
        console.error('glog2d6 | Error loading armor.json:', error);
        GLOG_ARMOR = { armor: [], shields: [] };
    }

    // Load torches
    try {
        const torchesResponse = await fetch('systems/glog2d6/data/torches.json');
        if (torchesResponse.ok) {
            const torchData = await torchesResponse.json();
            GLOG_TORCHES = torchData;
            console.log('glog2d6 | Loaded', torchData.torches.length, 'torch types');
        } else {
            console.warn('glog2d6 | Could not load torches.json');
            GLOG_TORCHES = { torches: [] };
        }
    } catch (error) {
        console.error('glog2d6 | Error loading torches.json:', error);
        GLOG_TORCHES = { torches: [] };
    }

    // Load spells from multiple files
    await loadSpellData();
}

async function loadSpellData() {
    GLOG_SPELLS = { spells: [] };

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
                    GLOG_SPELLS.spells.push(...spellData.spells);
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

    console.log(`glog2d6 | Total spells loaded: ${GLOG_SPELLS.spells.length}`);
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
    GLOG_CLASSES,
    GLOG_WEAPONS,
    GLOG_ARMOR,
    GLOG_FEATURES,
    GLOG_TORCHES,
    GLOG_SPELLS,
    loadSystemData,
    loadSpellData,
    getDefaultClasses
}
