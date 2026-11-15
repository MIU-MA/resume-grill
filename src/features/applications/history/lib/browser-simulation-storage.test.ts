import { expect, it, vi } from 'vitest'
import type { BrowserRun } from '@/domain/browser-application'
const db = vi.hoisted(() => ({ value: [] as BrowserRun[] }))
vi.mock('idb-keyval', () => ({ get: async () => db.value, update: async (_key: string, change: (value: BrowserRun[]) => BrowserRun[]) => { db.value = change(db.value) } }))
import { saveBrowserSimulation, loadBrowserSimulations } from './browser-simulation-storage'
it('同一测试任务更新原记录，迟到状态不覆盖完成回执', async () => {
  const run: BrowserRun = { id: 'test', mode: 'simulation', state: 'running', createdAt: 1, updatedAt: 1, tasks: [] }
  await saveBrowserSimulation(run)
  await saveBrowserSimulation({ ...run, updatedAt: 3, state: 'finished' })
  await saveBrowserSimulation({ ...run, updatedAt: 2 })
  expect(await loadBrowserSimulations()).toEqual([{ ...run, updatedAt: 3, state: 'finished' }])
})
