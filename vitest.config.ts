import { defineConfig } from 'vitest/config'
import path from 'node:path'

export default defineConfig(({ mode }) => {
  const goBridge = mode === 'go-bridge'
  return {
    resolve: {
      alias: {
        '@': path.resolve(import.meta.dirname, './src'),
      },
    },
    test: {
      pool: 'forks',
      // Font rendering and DOM workers compete for CPU/memory on high-core hosts.
      maxWorkers: goBridge ? 1 : 4,
      environment: 'node',
      include: goBridge ? ['src/lib/workbench-proxy.integration.test.ts'] : ['src/**/*.test.ts'],
      exclude: goBridge ? [] : ['src/**/*.integration.test.ts'],
      ...(goBridge ? { hookTimeout: 180000, testTimeout: 30000 } : {}),
    },
  }
})
