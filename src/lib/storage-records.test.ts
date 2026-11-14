// @vitest-environment jsdom
import { beforeEach, expect, it, vi } from 'vitest'
const database = vi.hoisted(() => {
  const values = new Map<string, unknown>()
  let tail = Promise.resolve()
  const transaction = <T>(work: () => T) => {
    const result = tail.then(work)
    tail = result.then(() => undefined, () => undefined)
    return result
  }
  return {
    values,
    get: (key: string) => transaction(() => structuredClone(values.get(key))),
    keys: async () => [...values.keys()],
    set: (key: string, value: unknown) => transaction(() => { values.set(key, structuredClone(value)) }),
    update: vi.fn((key: string, change: (value: unknown) => unknown) => transaction(() => { values.set(key, structuredClone(change(structuredClone(values.get(key))))) })),
    del: (key: string) => transaction(() => { values.delete(key) }),
  }
})
vi.mock('idb-keyval', () => database)
import { listRecords, loadRecord, upsertSession, updatePreparedClaims, updateMasteredBlindSpots, updateClaimPriorityOverrides } from './storage'
import { resumeClaimSchema, type ResumeAnalysis } from '@/domain/resume-schema'
import type { InterviewSession } from '@/domain/interview-schema'
const { values } = database
const analysis = {
  sourceFile: '简历.txt', rawText: '简历正文', claims: ['a', 'b'].map(id => resumeClaimSchema.parse({ id, title: '能力', content: `负责 ${id}`, category: 'skill', sourceSection: '项目', role: '后端', capability: id, masteryPoints: [{ point: '说明方案', dimension: 'practice', importance: 'high' }], initialQuestion: '如何实现？' })),
} as ResumeAnalysis
const session = (id: string, version = 1): InterviewSession => ({ id: `${id}:v${version}`, rounds: [], claimAnalysis: null, finalResult: null, status: 'in_progress', version })
beforeEach(() => { values.clear(); vi.clearAllMocks() })
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

it('并发保存面试、准备、掌握与优先级，保留每项更新及不同声明的会话', async () => {
  const id = 'resume-grill:concurrent'
  await Promise.all([
    upsertSession(id, analysis, 'a', session('a')),
    upsertSession(id, analysis, 'b', session('b')),
    updatePreparedClaims(id, analysis, ['a']),
    updateMasteredBlindSpots(id, analysis, ['blind-spot']),
    updateClaimPriorityOverrides(id, analysis, { b: 'high' }),
  ])
  expect(await loadRecord(id)).toMatchObject({
    id, analysis: { rawText: analysis.rawText }, sessions: { a: [session('a')], b: [session('b')] },
    preparedClaimIds: ['a'], masteredBlindSpotIds: ['blind-spot'], claimPriorityOverrides: { b: 'high' },
  })
  await upsertSession(id, analysis, 'a', session('a', 2))
  await upsertSession(id, analysis, 'a', { ...session('a'), pendingQuestion: '修改后的问题' })
  const saved = await loadRecord(id)
  expect(saved?.sessions.a).toHaveLength(2)
  expect(saved?.sessions.a[0].pendingQuestion).toBe('修改后的问题')
  expect(saved?.sessions.b).toHaveLength(1)
})

it('公共更新兼容旧记录，写入失败时原记录保持不变', async () => {
  const id = 'resume-grill:legacy-update'
  values.set(id, { id, analysis, sessions: {}, updatedAt: 1 })
  await updatePreparedClaims(id, analysis, ['a'])
  const before = structuredClone(values.get(id))
  expect(await loadRecord(id)).toMatchObject({ preparedClaimIds: ['a'], masteredBlindSpotIds: [], claimPriorityOverrides: {} })
  database.update.mockRejectedValueOnce(new Error('quota exceeded'))
  await expect(updateMasteredBlindSpots(id, analysis, ['new'])).rejects.toThrow('quota exceeded')
  expect(values.get(id)).toEqual(before)
})
