// @vitest-environment jsdom
import { act, createElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import type { AgentSnapshot, MailJob } from '@/domain/mail-schema'
import { emptyApplicationTracker, loadApplicationTracker, updateApplicationTracker, type ApplicationTracker } from '../lib/application-tracker-storage'
import { useApplicationTracker } from './use-application-tracker'
vi.mock('../lib/application-tracker-storage', () => ({
  emptyApplicationTracker: () => ({ progress: {}, submissions: {}, mailJobs: [], manualApplications: [], hiddenMailJobIds: [] }),
  loadApplicationTracker: vi.fn(), updateApplicationTracker: vi.fn(),
}))
let data: ApplicationTracker, root: Root, host: HTMLDivElement, current: ReturnType<typeof useApplicationTracker>
const onError = vi.fn()
function Harness({ snapshot }: { snapshot: AgentSnapshot | null }) { current = useApplicationTracker(snapshot, onError); return null }
const job = { id: 'a', status: 'sent', company: '甲公司' } as MailJob
const snapshot = { jobs: [job] } as AgentSnapshot
beforeEach(() => {
  vi.clearAllMocks(); vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  data = emptyApplicationTracker()
  vi.mocked(loadApplicationTracker).mockImplementation(async () => data)
  vi.mocked(updateApplicationTracker).mockImplementation(async change => { data = change(data); return data })
  host = document.createElement('div'); document.body.append(host); root = createRoot(host)
})
afterEach(async () => { await act(async () => root.unmount()); host.remove(); vi.unstubAllGlobals() })
it('执行器断开和重新打开页面后，已读取的邮件、进展、笔记仍保留', async () => {
  await act(async () => root.render(createElement(Harness, { snapshot })))
  await act(async () => { await current.saveProgress('a', { stage: 'interview', contact: 'HR', note: '周五一面' }) })
  await act(async () => root.render(createElement(Harness, { snapshot: null })))
  expect(current.tracker.mailJobs).toEqual([job])
  expect(current.tracker.progress.a.stage).toBe('interview')
  await act(async () => root.unmount())
  root = createRoot(host)
  await act(async () => root.render(createElement(Harness, { snapshot: null })))
  expect(current.tracker.progress.a.note).toBe('周五一面')
  expect(current.tracker.mailJobs).toEqual([job])
})
it('手动记录可新增、删除和恢复；邮件记录只在本地隐藏', async () => {
  await act(async () => root.render(createElement(Harness, { snapshot })))
  const record = { id: 'manual-1', company: '官网公司', role: '前端', channel: 'website' as const, appliedAt: 1, sourceUrl: '', contact: '', note: '', createdAt: 1, updatedAt: 1 }
  await act(async () => { await current.saveManual(record, 'interview') })
  expect(current.tracker.manualApplications).toEqual([record])
  expect(current.tracker.progress['manual-1'].stage).toBe('interview')
  await act(async () => { await current.hideJob('a') })
  expect(current.tracker.hiddenMailJobIds).toEqual(['a'])
  await act(async () => { await current.unhideJob('a') })
  expect(current.tracker.hiddenMailJobIds).toEqual([])
  const progress = current.tracker.progress['manual-1']
  await act(async () => { await current.removeManual('manual-1') })
  expect(current.tracker.manualApplications).toEqual([])
  await act(async () => { await current.restoreManual(record, progress) })
  expect(current.tracker.manualApplications).toEqual([record])
  expect(current.tracker.progress['manual-1'].stage).toBe('interview')
})
it('后台更新发送状态时保留手动进展；不覆盖其他岗位，保存失败可以重试', async () => {
  await act(async () => root.render(createElement(Harness, { snapshot })))
  await act(async () => { await current.saveProgress('b', { stage: 'offer' }) })
  await act(async () => root.render(createElement(Harness, { snapshot: { ...snapshot, jobs: [{ ...job, status: 'failed' }] } })))
  expect(current.tracker.progress.b.stage).toBe('offer')
  expect(current.tracker.mailJobs[0].status).toBe('failed')
  vi.mocked(updateApplicationTracker).mockRejectedValueOnce(new Error('quota'))
  await act(async () => { await expect(current.saveProgress('a', { stage: 'replied' })).rejects.toThrow('quota') })
  expect(current.tracker.progress.a).toBeUndefined()
  await act(async () => { await current.saveProgress('a', { stage: 'replied' }) })
  expect(current.tracker.progress.a.stage).toBe('replied')
  expect(current.tracker.progress.b.stage).toBe('offer')
})
