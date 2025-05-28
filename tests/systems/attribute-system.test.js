// tests/systems/attribute-system.test.js
import { describe, it, expect, beforeEach } from 'vitest'
import { ActorAttributeSystem } from '../../module/actor/systems/actor-attribute-system.mjs'
import { createMockActor } from '../mocks/actor-data.js'

describe('ActorAttributeSystem', () => {
  let mockActor, attributeSystem

  beforeEach(() => {
    mockActor = createMockActor()
    attributeSystem = new ActorAttributeSystem(mockActor)
  })

  // Helper functions
  const setAttr = (attr, value) => { mockActor.system.attributes[attr].value = value }
  const getAttr = (attr) => mockActor.system.attributes[attr]
  const setEncumbrance = (value) => { mockActor.system.inventory.encumbrance = value }
  const calculateMods = () => attributeSystem.calculateAttributeModifiers()

  describe('Modifier Calculation', () => {
    it('calculates correct modifiers for all value ranges', () => {
      const testCases = [
        [1, -3], [2, -3], [3, -2], [4, -2], [5, -1], [6, -1],
        [7, 0], [8, 1], [9, 1], [10, 2], [11, 2], [12, 3], [14, 4], [18, 6]
      ]

      testCases.forEach(([value, expectedMod]) => {
        setAttr('str', value)
        calculateMods()
        expect(getAttr('str').mod).toBe(expectedMod)
      })
    })

    it('calculates modifiers for all attributes simultaneously', () => {
      const attrs = { str: 10, dex: 8, con: 7, int: 6, wis: 4, cha: 12 }
      const expected = { str: 2, dex: 1, con: 0, int: -1, wis: -2, cha: 3 }

      Object.entries(attrs).forEach(([attr, value]) => setAttr(attr, value))
      calculateMods()
      Object.entries(expected).forEach(([attr, mod]) => {
        expect(getAttr(attr).mod).toBe(mod)
      })
    })
  })

  describe('Effective Modifier Initialization', () => {
    it('copies original values to effective values', () => {
      const attrs = ['str', 'dex', 'con', 'int', 'wis', 'cha']

      attributeSystem.initializeEffectiveModifiers()

      attrs.forEach(attr => {
        const attribute = getAttr(attr)
        expect(attribute.effectiveMod).toBe(attribute.mod)
        expect(attribute.effectiveValue).toBe(attribute.value)
      })
    })
  })

  describe('Encumbrance Effects', () => {
    const setupDex = (value, encumbrance = 0) => {
      mockActor.type = 'character'
      setAttr('dex', value)
      getAttr('dex').mod = attributeSystem.calculateSingleModifier(value)
      getAttr('dex').effectiveMod = getAttr('dex').mod
      getAttr('dex').effectiveValue = value
      setEncumbrance(encumbrance)
    }

    it('applies encumbrance penalties correctly', () => {
      const testCases = [
        { dex: 12, encumbrance: 0, expectedValue: 12, expectedMod: 3 },
        { dex: 12, encumbrance: 2, expectedValue: 10, expectedMod: 2 },
        { dex: 14, encumbrance: 3, expectedValue: 11, expectedMod: 2 },
        { dex: 3, encumbrance: 5, expectedValue: 1, expectedMod: -3 },  // Clamped to 1
        { dex: 8, encumbrance: 10, expectedValue: 1, expectedMod: -3 }   // Large penalty
      ]

      testCases.forEach(({ dex, encumbrance, expectedValue, expectedMod }) => {
        setupDex(dex, encumbrance)
        attributeSystem.applyEncumbranceToAttributes()

        expect(getAttr('dex').effectiveValue).toBe(expectedValue)
        expect(getAttr('dex').effectiveMod).toBe(expectedMod)
      })
    })

    it('only affects character actors and dexterity', () => {
      setupDex(12, 3)
      mockActor.type = 'npc'  // Change to NPC

      attributeSystem.applyEncumbranceToAttributes()

      expect(getAttr('dex').effectiveValue).toBe(12) // Unchanged
    })

    it('preserves other attributes during encumbrance', () => {
      setupDex(12, 3)
      const originalStr = getAttr('str')

      attributeSystem.applyEncumbranceToAttributes()

      expect(getAttr('str')).toEqual(originalStr) // Str unchanged
      expect(getAttr('dex').effectiveValue).toBe(9) // Dex changed
    })
  })

  describe('Integration Workflow', () => {
    it('performs complete attribute calculation', () => {
      mockActor.type = 'character'
      setAttr('dex', 14)
      setEncumbrance(2)

      // Full workflow
      attributeSystem.calculateAttributeModifiers()
      attributeSystem.initializeEffectiveModifiers()
      attributeSystem.applyEncumbranceToAttributes()

      expect(getAttr('dex').mod).toBe(4)           // Original
      expect(getAttr('dex').effectiveValue).toBe(12) // After encumbrance
      expect(getAttr('dex').effectiveMod).toBe(3)     // Recalculated
    })
  })

  describe('Edge Cases', () => {
    it('handles missing data gracefully', () => {
      mockActor.system.inventory = {} // No encumbrance
      mockActor.system.attributes.str.value = undefined

      expect(() => {
        attributeSystem.applyEncumbranceToAttributes()
        attributeSystem.calculateAttributeModifiers()
      }).not.toThrow()
    })
  })
})
