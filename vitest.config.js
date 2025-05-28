// vitest.config.js
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./tests/setup.js'],

    include: ['tests/**/*.{test,spec}.{js,mjs,ts}'],
    exclude: ['node_modules/**', 'dist/**'],

    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'clover'],
      include: ['module/**/*.mjs'],
      exclude: [
        'module/**/handlers/**',
        '**/*.{test,spec}.{js,mjs,ts}'
      ],
      thresholds: {
        branches: 50,
        functions: 50,
        lines: 50,
        statements: 50
      }
    },

    reporter: ['verbose', 'html'],

    pool: 'threads',
    poolOptions: {
      threads: {
        singleThread: false
      }
    },

    testTimeout: 10000,
    hookTimeout: 10000
  }
})
