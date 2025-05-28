// tests/setup.js
import { beforeEach } from 'vitest'
import { mockFoundryGlobals, mockGLOGConfig } from './mocks/foundry.js'

// Set up global mocks before any tests run
beforeEach(() => {
  // Clear all mocks between tests
  vi.clearAllMocks()

  // Set up Foundry environment
  mockFoundryGlobals()
  mockGLOGConfig()
})

// Optional: Global test utilities
globalThis.testUtils = {
  // Add any global test helpers here
  wait: (ms) => new Promise(resolve => setTimeout(resolve, ms))
}

console.log('✓ Test setup complete');
