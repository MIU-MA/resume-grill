import { defineConfig } from 'vitest/config'
import base from './vitest.config'

export default defineConfig({
  ...base,
  test: {
    ...base.test,
    include: ['src/lib/workbench-proxy.integration.test.ts'],
    exclude: [], maxWorkers: 1, hookTimeout: 180000, testTimeout: 30000,
  },
})
