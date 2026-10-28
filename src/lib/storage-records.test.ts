// @vitest-environment jsdom
import { beforeEach, expect, it, vi } from 'vitest'
const values = vi.hoisted(() => new Map<string, unknown>())
vi.mock('idb-keyval', () => ({ get: async (key: string) => values.get(key), keys: async () => [...values.keys()], set: vi.fn(), update: vi.fn(), del: vi.fn() }))
import { listRecords, loadRecord } from './storage'
beforeEach(() => values.clear())
it('选择简历后刷新：忽略同命名空间的选择键、设置和不完整记录，仍能读取旧练习记录', async () => {
  values.set('resume-grill:diagnosis-document', 'resume-document:composed:a')
  values.set('resume-grill:preferences', { collapsed: true })
  values.set('resume-grill:broken', { analysis: { rawText: '不完整' } })
  values.set('resume-grill:legacy', { id: 'resume-grill:legacy', analysis: { sourceFile: '旧简历.txt', rawText: '真实简历正文', claims: [] }, sessions: {}, updatedAt: 1 })
  expect(await loadRecord('resume-grill:diagnosis-document')).toBeUndefined()
  const records = await listRecords()
  expect(records).toHaveLength(1)
  expect(records[0].analysis.rawText).toBe('真实简历正文')
})
