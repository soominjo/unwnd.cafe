import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

// Node environment is enough: the pure modules need no DOM, and the
// presentational components are checked with react-dom/server static markup.
export default defineConfig({
  esbuild: { jsx: 'automatic' },
  // tsconfig's "@/*" path, so a test can reach modules that import through it.
  resolve: { alias: { '@': dirname(fileURLToPath(import.meta.url)) } },
  test: {
    include: ['app/**/*.test.{ts,tsx}', 'components/**/*.test.{ts,tsx}', 'lib/**/*.test.{ts,tsx}', 'scripts/**/*.test.ts'],
    environment: 'node',
  },
})
