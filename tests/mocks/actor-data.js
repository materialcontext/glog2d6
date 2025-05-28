// tests/mocks/actor-data.js

// Factory for creating test actor data
export const createMockActorData = (overrides = {}) => {
    const baseData = {
        type: 'character',
        name: 'Test Character',
        system: {
            hp: { value: 10, max: 10 },
            attributes: {
                str: { value: 10, mod: 2 },
                dex: { value: 12, mod: 3 },
                con: { value: 8, mod: 1 },
                int: { value: 7, mod: 0 },
                wis: { value: 9, mod: 1 },
                cha: { value: 11, mod: 2 }
            },
            details: {
                class: 'Fighter',
                level: 1,
                movement: 4
            },
            combat: {
                attack: { value: 0, bonus: 0 }
            },
            inventory: {
                slots: { max: 6, used: 0 },
                encumbrance: 0
            },
            torch: {
                lit: false,
                activeTorchId: null
            }
        },
        items: []
    }

    return mergeDeep(baseData, overrides)
}

// Factory for creating test items
export const createMockItem = (type, overrides = {}) => {
    const baseItems = {
        weapon: {
            id: 'weapon-1',
            type: 'weapon',
            name: 'Test Weapon',
            system: {
                damage: '1d6',
                weaponType: 'melee',
                size: 'medium',
                slots: 1,
                equipped: false,
                attackPenalty: 0,
                encumbrancePenalty: 0
            }
        },
        armor: {
            id: 'armor-1',
            type: 'armor',
            name: 'Test Armor',
            system: {
                type: 'light',
                armorBonus: 1,
                encumbrancePenalty: 0,
                equipped: false
            }
        },
        shield: {  // ADD THIS
            id: 'shield-1',
            type: 'shield',
            name: 'Test Shield',
            system: {
                armorBonus: 1,
                slots: 1,
                equipped: false
            }
        },
        feature: {
            id: 'feature-1',
            type: 'feature',
            name: 'Test Feature',
            system: {
                classSource: 'Fighter',
                template: 'A',
                active: true,
                description: 'Test feature description'
            }
        }
    }

    return mergeDeep(baseItems[type], overrides)
}

// Simple deep merge utility
function mergeDeep(target, source) {
    const result = { ...target }

    for (const key in source) {
        if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
            result[key] = mergeDeep(result[key] || {}, source[key])
        } else {
            result[key] = source[key]
        }
    }

    return result
}

// Mock actor class for testing
export const createMockActor = (data = {}) => {
    const actorData = createMockActorData(data)

    return {
        ...actorData,
        // Mock methods that your systems use
        getFlag: vi.fn((scope, key) => {
            if (scope === 'glog2d6' && key === 'editMode') return false
            return undefined
        }),
        setFlag: vi.fn(),
        update: vi.fn(),
        items: actorData.items,
        getRollData: vi.fn(() => ({}))
    }
}
