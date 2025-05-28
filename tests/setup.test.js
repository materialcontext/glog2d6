// tests/setup.test.js
import { describe, it, expect, vi } from 'vitest'
import { createMockActor } from './mocks/actor-data.js'

describe('Test Setup', () => {
  it('should have mocked Foundry globals', () => {
    expect(globalThis.CONFIG).toBeDefined()
    expect(globalThis.foundry).toBeDefined()
    expect(globalThis.Roll).toBeDefined()
  })

  it('should create mock actors', () => {
    const actor = createMockActor({
      name: 'Test Hero',
      system: { details: { level: 5 } }
    })

    expect(actor.name).toBe('Test Hero')
    expect(actor.system.details.level).toBe(5)
    expect(actor.system.attributes.str.value).toBe(10) // Default value
  })

  it('should have GLOG config available', () => {
    expect(CONFIG.GLOG.CLASSES).toBeDefined()
    expect(CONFIG.GLOG.CLASSES.length).toBeGreaterThan(0)
  })

  it('should handle async operations', async () => {
    const mockAsyncFn = vi.fn().mockResolvedValue('success')
    const result = await mockAsyncFn()
    expect(result).toBe('success')
  })
})
