// tests/systems/combat-system.test.js
import { describe, it, expect, beforeEach } from 'vitest'
import { ActorCombatSystem } from '../../module/actor/systems/actor-combat-system.mjs'
import { createMockActor, createMockItem } from '../mocks/actor-data.js'

describe('ActorCombatSystem', () => {
    let actor, combatSystem

    beforeEach(() => {
        actor = createMockActor()
        combatSystem = new ActorCombatSystem(actor)
    })

    const addItem = (type, systemData) => {
        const item = createMockItem(type, { system: systemData })
        console.log('Created item:', item)
        actor.items.push(item)
    }
    const setLevel = (level) => { actor.system.details.level = level }
    const setDex = (value, mod) => {
        actor.system.attributes.dex = { value, mod, effectiveMod: mod }
    }

    describe('Attack Value Calculation', () => {
        it('sets attack value equal to character level', () => {
            const levels = [1, 3, 5, 10, 20]

            levels.forEach(level => {
                setLevel(level)
                combatSystem.calculateAttackValue()
                expect(actor.system.combat.attack.value).toBe(level)
            })
        })

        it('initializes combat structure if missing', () => {
            delete actor.system.combat
            setLevel(5)

            combatSystem.calculateAttackValue()

            expect(actor.system.combat.attack.value).toBe(5)
            expect(actor.system.combat.attack.bonus).toBe(0)
            expect(actor.system.combat.attack.breakdown).toEqual([])
        })

        it('handles missing level gracefully', () => {
            delete actor.system.details.level

            combatSystem.calculateAttackValue()

            expect(actor.system.combat.attack.value).toBe(1) // Default to 1
        })

    })

    describe('Defense Calculations', () => {
        beforeEach(() => {
            setDex(12, 3) // +3 dex bonus
        })

        it('calculates basic defense with no equipment', () => {
            combatSystem.calculateDefenseValues()

            expect(actor.system.defense.armor).toBe(0)
            expect(actor.system.defense.shield).toBe(0)
            expect(actor.system.defense.dexBonus).toBe(3)
            expect(actor.system.defense.total).toBe(3) // 0 + 0 + 3
        })

        it('includes equipped armor bonus', () => {
            addItem('armor', { equipped: true, armorBonus: 2, encumbrancePenalty: 1 })

            combatSystem.calculateDefenseValues()

            expect(actor.system.defense.armor).toBe(2)
            expect(actor.system.defense.armorEncumbrance).toBe(1)
            expect(actor.system.defense.total).toBe(5) // 2 + 0 + 3
        })

        it('includes equipped shield bonus - DEBUG', () => {
            addItem('shield', { equipped: true, armorBonus: 1 })

            console.log('Mock shield item:', actor.items[actor.items.length - 1])
            console.log('Shield system:', actor.items[actor.items.length - 1].system)
            console.log('Items filter result:', actor.items.filter(i => i.type === "shield" && i.system.equipped))

            combatSystem.calculateDefenseValues()

            console.log('Defense result:', actor.system.defense)

            expect(actor.system.defense.shield).toBe(1)
        })

        it('combines armor and shield bonuses', () => {
            addItem('armor', { equipped: true, armorBonus: 2, encumbrancePenalty: 1 })
            addItem('shield', { equipped: true, armorBonus: 1 })

            combatSystem.calculateDefenseValues()

            expect(actor.system.defense.armor).toBe(2)
            expect(actor.system.defense.shield).toBe(1)
            expect(actor.system.defense.total).toBe(6) // 2 + 1 + 3
            expect(actor.system.defense.armorEncumbrance).toBe(1)
        })

        it('ignores unequipped armor and shields', () => {
            addItem('armor', { equipped: false, armorBonus: 3 })
            addItem('shield', { equipped: false, armorBonus: 2 })

            combatSystem.calculateDefenseValues()

            expect(actor.system.defense.armor).toBe(0)
            expect(actor.system.defense.shield).toBe(0)
            expect(actor.system.defense.total).toBe(3) // Only dex bonus
        })

        it('uses only one equipped armor piece', () => {
            addItem('armor', { equipped: true, armorBonus: 2 })
            addItem('armor', { equipped: true, armorBonus: 3 }) // Second armor

            combatSystem.calculateDefenseValues()

            // Should use the first one found
            expect(actor.system.defense.armor).toBe(2)
        })

        it('uses only one equipped shield', () => {
            addItem('shield', { equipped: true, armorBonus: 1 })
            addItem('shield', { equipped: true, armorBonus: 2 }) // Second shield

            combatSystem.calculateDefenseValues()

            expect(actor.system.defense.shield).toBe(1)
        })

        it('handles zero and negative dex modifiers', () => {
            const testCases = [
                { dexMod: -2, expectedBonus: 0 }, // Negative becomes 0
                { dexMod: 0, expectedBonus: 0 },  // Zero stays 0
                { dexMod: 3, expectedBonus: 3 }   // Positive stays positive
            ]

            testCases.forEach(({ dexMod, expectedBonus }) => {
                setDex(7, dexMod)
                combatSystem.calculateDefenseValues()
                expect(actor.system.defense.dexBonus).toBe(expectedBonus)
            })
        })
    })

    describe('Special Defense Bonuses', () => {
        it('includes special melee and ranged defense bonuses', () => {
            // Setup existing defense bonuses (these would come from features)
            actor.system.defense = { meleeBonus: 1, rangedBonus: 2 }
            setDex(10, 2)
            addItem('armor', { equipped: true, armorBonus: 1 })

            combatSystem.calculateDefenseValues()

            expect(actor.system.defense.meleeTotal).toBe(4)  // 1 armor + 2 dex + 1 melee
            expect(actor.system.defense.rangedTotal).toBe(5) // 1 armor + 2 dex + 2 ranged
            expect(actor.system.defense.total).toBe(3)       // Backwards compatibility
        })

        it('handles missing special bonuses', () => {
            setDex(10, 2)

            combatSystem.calculateDefenseValues()

            expect(actor.system.defense.meleeBonus).toBe(0)
            expect(actor.system.defense.rangedBonus).toBe(0)
            expect(actor.system.defense.meleeTotal).toBe(2)  // Just dex
            expect(actor.system.defense.rangedTotal).toBe(2) // Just dex
        })
    })

    describe('Integration Tests', () => {
        it('calculates all combat stats together', () => {
            actor.type = 'character'
            setLevel(3)
            setDex(14, 4)
            addItem('armor', { equipped: true, armorBonus: 2, encumbrancePenalty: 1 })
            addItem('shield', { equipped: true, armorBonus: 1 })

            combatSystem.calculateCombatStats()

            // Attack
            expect(actor.system.combat.attack.value).toBe(3)

            // Defense
            expect(actor.system.defense.armor).toBe(2)
            expect(actor.system.defense.shield).toBe(1)
            expect(actor.system.defense.dexBonus).toBe(4)
            expect(actor.system.defense.total).toBe(7) // 2 + 1 + 4
            expect(actor.system.defense.armorEncumbrance).toBe(1)
        })
    })
    describe('Edge Cases', () => {
        it('throws when attributes are missing', () => {
            delete actor.system.attributes.dex

            expect(() => combatSystem.calculateDefenseValues()).toThrow('Cannot read properties of undefined')
        })

        it('throws when items array is missing', () => {
            actor.items = null

            expect(() => combatSystem.calculateDefenseValues()).toThrow('Cannot read properties of null')
        })

        it('handles armor without encumbrance penalty', () => {
            addItem('armor', { equipped: true, armorBonus: 2 }) // No encumbrancePenalty

            combatSystem.calculateDefenseValues()

            expect(actor.system.defense.armor).toBe(2)
            expect(actor.system.defense.armorEncumbrance).toBe(0)
        })
    })
})
