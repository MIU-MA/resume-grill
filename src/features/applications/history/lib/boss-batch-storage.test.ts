import { beforeEach, expect, it, vi } from 'vitest'
import type { BrowserRun } from '@/domain/browser-application'
import { manualApplicationSchema } from '@/domain/application-record'
const db = vi.hoisted(() => ({ values: new Map<string, unknown>(), failBatchWrite: false }))
vi.mock('idb-keyval', () => ({
  get: async (key: string) => db.values.get(key),
  update: async (key: string, change: (value: unknown) => unknown) => {
    if (db.failBatchWrite && key.includes('boss-batches')) throw new Error('写入失败')
    db.values.set(key, structuredClone(change(db.values.get(key))))
  },
}))
import { loadBossBatches, saveBossBatch } from './boss-batch-storage'
import { loadApplicationTracker, updateApplicationTracker } from './application-tracker-storage'
const makeRun = (): BrowserRun => ({ id: '10000000-0000-4000-8000-000000000001', mode: 'boss', state: 'finished', createdAt: 1, updatedAt: 3, tasks: [{ company: '测试公司', title: '全栈', url: 'https://www.zhipin.com/job_detail/fixture.html', state: 'verified', verifiedAt: 2, steps: [{ id: 'contact', kind: 'contact', value: 'url', state: 'verified', receipt: 'contact-1' }, { id: 'text', kind: 'greeting', value: '核对后的正文', state: 'verified', receipt: 'text-1' }] }] })
beforeEach(() => { db.values.clear(); db.failBatchWrite = false })
it('只把全部步骤核验通过的岗位写入普通记录，重复轮询保留人工修改', async () => {
  const run = makeRun()
  run.tasks.push({ ...structuredClone(run.tasks[0]), state: 'uncertain', url: 'https://www.zhipin.com/job_detail/other.html' })
  await saveBossBatch(run)
  const initial = await loadApplicationTracker()
  expect(initial.manualApplications).toHaveLength(1)
  expect(manualApplicationSchema.safeParse(initial.manualApplications[0]).success).toBe(true)
  expect(initial.manualApplications[0]).toMatchObject({ channel: 'boss', appliedAt: 2 })
  await updateApplicationTracker(current => ({ ...current, manualApplications: current.manualApplications.map(record => ({ ...record, note: '人工备注' })) }))
  await saveBossBatch(run)
  expect((await loadApplicationTracker()).manualApplications).toHaveLength(1)
  expect((await loadApplicationTracker()).manualApplications[0].note).toBe('人工备注')
})
it('部分写入失败后仅重试存储，不重复创建记录；迟到快照不回退批次状态', async () => {
  const run = makeRun(); db.failBatchWrite = true
  await expect(saveBossBatch(run)).rejects.toThrow('写入失败')
  expect((await loadApplicationTracker()).manualApplications).toHaveLength(1)
  db.failBatchWrite = false; await saveBossBatch(run)
  await saveBossBatch({ ...run, updatedAt: 1, state: 'running' })
  expect((await loadApplicationTracker()).manualApplications).toHaveLength(1)
  expect(await loadBossBatches()).toEqual([run])
})
it('模拟和缺失回执的结果不会冒充已投递', async () => {
  const run = makeRun()
  await expect(saveBossBatch({ ...run, mode: 'simulation' })).rejects.toThrow('模拟结果')
  delete run.tasks[0].steps[0].receipt
  await saveBossBatch(run)
  expect((await loadApplicationTracker()).manualApplications).toEqual([])
})
