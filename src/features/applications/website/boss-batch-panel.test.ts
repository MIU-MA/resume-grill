// @vitest-environment jsdom
import { act, createElement } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { BossBatchPanel } from './BossBatchPanel'
import { bossRequest } from './lib/boss-client'
import { saveBossBatch } from '../history/lib/boss-batch-storage'
import type { BossDraft } from './lib/boss-workspace-storage'
import type { BossBatchPreview, BrowserRun } from '@/domain/browser-application'
vi.mock('./lib/boss-client', () => ({ bossRequest: vi.fn() }))
vi.mock('../history/lib/boss-batch-storage', () => ({ saveBossBatch: vi.fn(async () => {}) }))
const connection = { origin: 'http://127.0.0.1:4327', token: 'a'.repeat(48) }
const draft: BossDraft = { url: 'https://www.zhipin.com/job_detail/fixture.html', company: '测试公司', title: '全栈', greeting: '核对过的正文', salary: '', evidence: '', status: 'needs-image', checks: [], steps: [] }
const drafts = [draft], images: File[] = [], onRunning = vi.fn()
const run: BrowserRun = { id: '10000000-0000-4000-8000-000000000001', mode: 'boss', state: 'finished', createdAt: 1, updatedAt: 2, tasks: [] }
let host: HTMLDivElement, root: ReturnType<typeof createRoot>
beforeEach(() => {
  vi.clearAllMocks(); sessionStorage.clear(); vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  const preview: BossBatchPreview = { id: 'preview-1', greetingMode: 'platform', batchId: run.id, expiresAt: Date.now() + 120000, jobs: [draft], images: [], skipped: [] }
  vi.mocked(bossRequest).mockImplementation(async (_connection, path) => path === '/boss-batch/preview' ? preview : run)
  vi.mocked(saveBossBatch).mockResolvedValue(undefined)
  host = document.createElement('div'); document.body.append(host); root = createRoot(host)
})
afterEach(async () => { await act(async () => root.unmount()); host.remove(); vi.unstubAllGlobals() })
async function render(values: BossDraft[] = drafts) { await act(async () => root.render(createElement(BossBatchPanel, { connection, connected: true, drafts: values, images, onRunning }))) }
it('明确使用官网默认招呼且不追加草稿，确认前不创建执行任务', async () => {
  await render()
  await act(async () => host.querySelector('button')!.click())
  expect(vi.mocked(bossRequest).mock.calls.map(call => call[1])).toEqual(['/boss-batch/preview'])
  expect(host.textContent).toContain('使用 BOSS 账号默认招呼')
  expect(host.textContent).not.toContain('核对过的正文')
  const start = [...host.querySelectorAll('button')].find(button => button.textContent === '确认并开始批量投递')!
  expect(start.disabled).toBe(true)
  await act(async () => (host.querySelector('input[type=checkbox]') as HTMLInputElement).click())
  await act(async () => start.click())
  expect(bossRequest).toHaveBeenCalledWith(connection, '/boss-batch/confirm', { id: 'preview-1', confirmed: true, defaultGreetingAccepted: true })
  expect(saveBossBatch).toHaveBeenCalledWith(run)
})

it('旧执行器没有声明不追加文字时拒绝开始，不创建批次', async () => {
  vi.mocked(bossRequest).mockResolvedValue({ id: 'old', batchId: run.id, expiresAt: Date.now() + 120000, jobs: [draft], images: [], skipped: [] })
  await render(); await act(async () => host.querySelector('button')!.click())
  await act(async () => (host.querySelector('input[type=checkbox]') as HTMLInputElement).click())
  await act(async () => [...host.querySelectorAll('button')].find(button => button.textContent === '确认并开始批量投递')!.click())
  expect(host.textContent).toContain('请更新本机执行器')
  expect(vi.mocked(bossRequest).mock.calls.some(call => call[1] === '/boss-batch/confirm')).toBe(false)
  expect(sessionStorage.getItem('boss-browser:live-batch:v1')).toBeNull()
})
it('用户改动招呼语后核对结果失效，不能执行旧预览', async () => {
  await render(); await act(async () => host.querySelector('button')!.click())
  expect(host.querySelector('input[type=checkbox]')).not.toBeNull()
  await render([{ ...draft, greeting: '修改后的内容' }])
  expect(host.querySelector('input[type=checkbox]')).toBeNull()
  expect(vi.mocked(bossRequest).mock.calls.some(call => call[1].includes('/confirm'))).toBe(false)
})
it('刷新即使没有草稿也恢复批次，记录保存失败只允许重新读取，不重发', async () => {
  sessionStorage.setItem('boss-browser:live-batch:v1', run.id)
  vi.mocked(saveBossBatch).mockRejectedValue(new Error('空间不足'))
  await render([])
  expect(host.textContent).toContain('尚未写入本机投递记录')
  const retry = [...host.querySelectorAll('button')].find(button => button.textContent === '重新读取执行状态')!
  await act(async () => retry.click())
  expect(vi.mocked(bossRequest).mock.calls.every(call => call[1] === `/boss-batch/${run.id}`)).toBe(true)
})

it('从原批次继续剩余岗位会先展示新预览，不自动确认，也不需要重选简历', async () => {
  const step = { id: 'contact', kind: 'contact' as const, value: draft.url, state: 'pending' as const }
  const paused: BrowserRun = { ...run, state: 'paused', tasks: [{ ...draft, state: 'queued', steps: [step] }] }
  sessionStorage.setItem('boss-browser:live-batch:v1', paused.id)
  vi.mocked(bossRequest).mockImplementation(async (_connection, path) => path.endsWith('/remaining') ? { id: 'remaining', batchId: '20000000-0000-4000-8000-000000000001', greetingMode: 'platform', expiresAt: Date.now() + 120000, jobs: [draft], images: [], skipped: [] } : paused)
  await render([])
  const next = [...host.querySelectorAll('button')].find(button => button.textContent === '继续未执行的 1 个岗位')!
  await act(async () => next.click())
  expect(host.textContent).toContain('将联系 1 个岗位')
  expect(host.querySelector('input[type=checkbox]')).not.toBeNull()
  expect(vi.mocked(bossRequest).mock.calls.some(call => call[1] === '/boss-batch/confirm')).toBe(false)
  expect(sessionStorage.getItem('boss-browser:live-batch:v1')).toBeNull()
})
