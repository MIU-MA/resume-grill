// @vitest-environment jsdom
import { act, createElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import type { AgentSnapshot, MailJob } from '@/domain/mail-schema'
import { emptyApplicationTracker, loadApplicationTracker, updateApplicationTracker, type ApplicationTracker } from '../application-tracker-storage'
import { useApplicationTracker } from './use-application-tracker'
vi.mock('../application-tracker-storage', () => ({
  emptyApplicationTracker: () => ({ progress: {}, submissions: {}, mailJobs: [] }),
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
