// tests/mocks/foundry.js
import { vi } from 'vitest'

// Mock Foundry's core classes and utilities
export const mockFoundryGlobals = () => {
  // Core Foundry utilities
  globalThis.foundry = {
    utils: {
      mergeObject: vi.fn((target, source) => {
        return { ...target, ...source }
      }),
      setProperty: vi.fn((object, key, value) => {
        const keys = key.split('.')
        let current = object
        for (let i = 0; i < keys.length - 1; i++) {
          if (!current[keys[i]]) current[keys[i]] = {}
          current = current[keys[i]]
        }
        current[keys[keys.length - 1]] = value
        return true
      }),
      getProperty: vi.fn((object, key) => {
        return key.split('.').reduce((obj, prop) => obj?.[prop], object)
      })
    }
  }

  // Mock Roll class
  globalThis.Roll = vi.fn().mockImplementation((formula, data = {}) => {
    return {
      formula,
      data,
      total: 10, // Default total for testing
      terms: [
        {
          results: [{ result: 4 }, { result: 6 }]
        }
      ],
      evaluate: vi.fn().mockResolvedValue(true)
    }
  })

  // Mock ChatMessage
  globalThis.ChatMessage = {
    create: vi.fn().mockResolvedValue({}),
    getSpeaker: vi.fn(() => ({ alias: 'Test Actor' }))
  }

  // Mock UI notifications
  globalThis.ui = {
    notifications: {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn()
    }
  }

  // Mock game object
  globalThis.game = {
    user: {
      isGM: true
    },
    settings: {
      get: vi.fn(),
      set: vi.fn()
    }
  }

  // Mock Document classes
  globalThis.Actor = vi.fn()
  globalThis.Item = vi.fn()
  globalThis.getDocumentClass = vi.fn((type) => {
    if (type === 'Item') return globalThis.Item
    if (type === 'Actor') return globalThis.Actor
    return vi.fn()
  })

  console.log('✓ Foundry globals mocked')
}

// Mock your GLOG system data
export const mockGLOGConfig = () => {
  globalThis.CONFIG = {
    GLOG: {
      CLASSES: [
        { name: "Fighter" },
        { name: "Wizard" },
        { name: "Thief" },
        { name: "Acrobat" }
      ],
      FEATURES: [
        {
          name: "Fighter",
          features: {
            "level-0": {
              name: "Combat Training",
              description: "You get a +2 bonus on all Attack rolls."
            },
            "A": [
              {
                name: "Battle Scars",
                description: "Each time you recover from a wound..."
              }
            ]
          }
        }
      ],
      WEAPONS: {
        weapons: [
          {
            name: "Short Sword",
            type: "weapon",
            system: {
              damage: "1d6",
              weaponType: "melee",
              size: "medium"
            }
          }
        ],
        ammunition: []
      },
      ARMOR: {
        armor: [],
        shields: []
      },
      TORCHES: {
        torches: []
      },
      SPELLS: {
        spells: []
      }
    }
  }

  console.log('✓ GLOG CONFIG mocked')
}
