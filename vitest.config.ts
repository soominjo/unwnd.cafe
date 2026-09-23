import { defineConfig } from 'vitest/config'

// Node environment is enough: the pure modules need no DOM, and the two
// presentational components are checked with react-dom/server static markup.
export default defineConfig({
  esbuild: { jsx: 'automatic' },
  test: {
    include: ['app/**/*.test.{ts,tsx}', 'lib/**/*.test.{ts,tsx}'],
    environment: 'node',
  },
})
