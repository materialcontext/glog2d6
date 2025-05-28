// tests/systems/inventory-calculator.test.js
import { describe, it, expect, beforeEach } from 'vitest'
import { ActorInventorySystem } from '../../module/actor/systems/actor-inventory-system.mjs'
import { createMockActor, createMockItem } from '../mocks/actor-data.js'

describe('InventoryCalculator', () => {
  let mockActor
  let inventorySystem

  beforeEach(() => {
    mockActor = createMockActor({
      system: {
        attributes: {
          str: { value: 10, mod: 2 },  // +2 str mod
          con: { value: 8, mod: 1 }    // +1 con mod
        }
      }
    })
    inventorySystem = new ActorInventorySystem(mockActor)
  })

  describe('Max Slots Calculation', () => {
    it('calculates max slots as 6 + max(str, con) modifier', () => {
      inventorySystem.calculateInventoryData()

      // 6 base + max(2, 1) = 8
      expect(mockActor.system.inventory.slots.max).toBe(8)
    })

    it('uses strength modifier when higher than constitution', () => {
      mockActor.system.attributes.str.mod = 3
      mockActor.system.attributes.con.mod = 1

      inventorySystem.calculateInventoryData()

      expect(mockActor.system.inventory.slots.max).toBe(9) // 6 + 3
    })

    it('uses constitution modifier when higher than strength', () => {
      mockActor.system.attributes.str.mod = 1
      mockActor.system.attributes.con.mod = 4

      inventorySystem.calculateInventoryData()

      expect(mockActor.system.inventory.slots.max).toBe(10) // 6 + 4
    })

    it('handles negative modifiers correctly', () => {
      mockActor.system.attributes.str.mod = -2
      mockActor.system.attributes.con.mod = -1

      inventorySystem.calculateInventoryData()

      expect(mockActor.system.inventory.slots.max).toBe(5) // 6 + max(-2, -1) = 6 + (-1)
    })
  })

  describe('Used Slots Calculation', () => {
    it('calculates used slots correctly with no items', () => {
      mockActor.items = []

      inventorySystem.calculateInventoryData()

      expect(mockActor.system.inventory.slots.used).toBe(0)
    })

    it('sums up slots from all items', () => {
      mockActor.items = [
        createMockItem('weapon', { system: { slots: 2 } }),
        createMockItem('armor', { system: { slots: 1 } }),
        createMockItem('weapon', { system: { slots: 1 } })
      ]

      inventorySystem.calculateInventoryData()

      expect(mockActor.system.inventory.slots.used).toBe(4) // 2 + 1 + 1
    })

    it('ignores items without slots property', () => {
      mockActor.items = [
        createMockItem('weapon', { system: { slots: 2 } }),
        { system: {} }, // No slots property
        createMockItem('armor', { system: { slots: 1 } })
      ]

      inventorySystem.calculateInventoryData()

      expect(mockActor.system.inventory.slots.used).toBe(3) // 2 + 0 + 1
    })

    it('handles zero-slot items', () => {
      mockActor.items = [
        createMockItem('weapon', { system: { slots: 0 } }),
        createMockItem('armor', { system: { slots: 2 } })
      ]

      inventorySystem.calculateInventoryData()

      expect(mockActor.system.inventory.slots.used).toBe(2) // 0 + 2
    })
  })

  describe('Slot Encumbrance Calculation', () => {
    it('calculates no slot encumbrance when under capacity', () => {
      // Max slots: 8 (6 + 2), Used: 6
      mockActor.items = [
        createMockItem('weapon', { system: { slots: 3 } }),
        createMockItem('armor', { system: { slots: 3 } })
      ]

      inventorySystem.calculateInventoryData()

      expect(mockActor.system.inventory.slotEncumbrance).toBe(0)
    })

    it('calculates slot encumbrance when over capacity', () => {
      // Max slots: 8 (6 + 2), Used: 10
      mockActor.items = [
        createMockItem('weapon', { system: { slots: 5 } }),
        createMockItem('armor', { system: { slots: 5 } })
      ]

      inventorySystem.calculateInventoryData()

      expect(mockActor.system.inventory.slotEncumbrance).toBe(2) // 10 - 8
    })

    it('never returns negative slot encumbrance', () => {
      // Max slots: 8, Used: 3
      mockActor.items = [
        createMockItem('weapon', { system: { slots: 3 } })
      ]

      inventorySystem.calculateInventoryData()

      expect(mockActor.system.inventory.slotEncumbrance).toBe(0) // Math.max(0, 3-8)
    })
  })

  describe('Equipment Encumbrance Calculation', () => {
    it('calculates no equipment encumbrance with no equipped items', () => {
      mockActor.items = [
        createMockItem('weapon', {
          system: {
            equipped: false,
            encumbrancePenalty: 2
          }
        })
      ]

      inventorySystem.calculateInventoryData()

      expect(mockActor.system.inventory.equipmentEncumbrance).toBe(0)
    })

    it('sums encumbrance from equipped armor', () => {
      mockActor.items = [
        createMockItem('armor', {
          system: {
            equipped: true,
            encumbrancePenalty: 2
          }
        })
      ]

      inventorySystem.calculateInventoryData()

      expect(mockActor.system.inventory.equipmentEncumbrance).toBe(2)
    })

    it('sums encumbrance from equipped weapons', () => {
      mockActor.items = [
        createMockItem('weapon', {
          system: {
            equipped: true,
            encumbrancePenalty: 1
          }
        }),
        createMockItem('weapon', {
          system: {
            equipped: true,
            encumbrancePenalty: 1
          }
        })
      ]

      inventorySystem.calculateInventoryData()

      expect(mockActor.system.inventory.equipmentEncumbrance).toBe(2)
    })

    it('combines armor and weapon encumbrance', () => {
      mockActor.items = [
        createMockItem('armor', {
          system: {
            equipped: true,
            encumbrancePenalty: 2
          }
        }),
        createMockItem('weapon', {
          system: {
            equipped: true,
            encumbrancePenalty: 1
          }
        })
      ]

      inventorySystem.calculateInventoryData()

      expect(mockActor.system.inventory.equipmentEncumbrance).toBe(3)
    })
  })

  describe('Armor Training Reduction', () => {
    it('reduces equipment encumbrance by 1 with Armor Training feature', () => {
      // Add Armor Training feature
      mockActor.items = [
        createMockItem('feature', {
          name: 'Armor Training',
          system: { active: true }
        }),
        createMockItem('armor', {
          system: {
            equipped: true,
            encumbrancePenalty: 2
          }
        })
      ]

      inventorySystem.calculateInventoryData()

      expect(mockActor.system.inventory.equipmentEncumbrance).toBe(1) // 2 - 1
    })

    it('does not reduce below zero', () => {
      mockActor.items = [
        createMockItem('feature', {
          name: 'Armor Training',
          system: { active: true }
        }),
        createMockItem('armor', {
          system: {
            equipped: true,
            encumbrancePenalty: 1
          }
        })
      ]

      inventorySystem.calculateInventoryData()

      expect(mockActor.system.inventory.equipmentEncumbrance).toBe(0) // Math.max(0, 1-1)
    })

    it('does not apply reduction without Armor Training', () => {
      mockActor.items = [
        createMockItem('armor', {
          system: {
            equipped: true,
            encumbrancePenalty: 2
          }
        })
      ]

      inventorySystem.calculateInventoryData()

      expect(mockActor.system.inventory.equipmentEncumbrance).toBe(2) // No reduction
    })
  })

  describe('Total Encumbrance Calculation', () => {
    it('combines slot and equipment encumbrance', () => {
      // Setup: Max slots 8, but using 10 slots (2 over) + 1 equipment penalty
      mockActor.items = [
        createMockItem('weapon', { system: { slots: 10 } }), // Way over slot limit
        createMockItem('armor', {
          system: {
            equipped: true,
            encumbrancePenalty: 1
          }
        })
      ]

      inventorySystem.calculateInventoryData()

      expect(mockActor.system.inventory.encumbrance).toBe(3) // 2 slot + 1 equipment
    })

    it('calculates zero when no encumbrance sources', () => {
      mockActor.items = [
        createMockItem('weapon', { system: { slots: 2 } }) // Well under limit
      ]

      inventorySystem.calculateInventoryData()

      expect(mockActor.system.inventory.encumbrance).toBe(0)
    })
  })

  describe('Non-Character Actors', () => {
    it('skips calculation for non-character actors', () => {
      const npcActor = createMockActor({ type: 'npc' })
      const npcSystem = new ActorInventorySystem(npcActor)

      npcSystem.calculateInventoryData()

      // Should not have modified the inventory data
      expect(npcActor.system.inventory).toEqual({ slots: { max: 6, used: 0 }, encumbrance: 0 })
    })
  })
})
