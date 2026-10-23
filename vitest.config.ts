import { defineConfig } from 'vitest/config'
import path from 'node:path'

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
    },
  },
  test: {
    pool: 'forks',
    // Font rendering and DOM workers compete for CPU/memory on high-core hosts.
    maxWorkers: 4,
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
