// @vitest-environment jsdom
import { act, createElement } from 'react'
import { createRoot } from 'react-dom/client'
import { beforeEach, afterEach, expect, it, vi } from 'vitest'
import { BossSimulationPanel } from './BossSimulationPanel'
import { bossRequest } from './lib/boss-client'
import { saveBrowserSimulation } from '../history/lib/browser-simulation-storage'
import type { BrowserRun } from '@/domain/browser-application'
vi.mock('./lib/boss-client', () => ({ bossRequest: vi.fn() }))
vi.mock('../history/lib/browser-simulation-storage', () => ({ saveBrowserSimulation: vi.fn(async () => {}) }))
const result: BrowserRun = { id: '00000000-0000-4000-8000-000000000000', mode: 'simulation', state: 'finished', createdAt: 1, updatedAt: 2, tasks: [{ url: 'https://www.zhipin.com/job_detail/example.html', title: '全栈', company: '示例', state: 'verified', steps: [{ id: 'text', kind: 'greeting', value: '手动核对的招呼语', state: 'verified', receipt: 'receipt1' }] }] }
let host: HTMLDivElement, root: ReturnType<typeof createRoot>
beforeEach(() => {
  vi.clearAllMocks(); sessionStorage.clear(); vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  vi.mocked(bossRequest).mockResolvedValue(result); vi.mocked(saveBrowserSimulation).mockResolvedValue(undefined)
  host = document.createElement('div'); document.body.append(host); root = createRoot(host)
})
afterEach(async () => { await act(async () => root.unmount()); host.remove(); vi.unstubAllGlobals() })
async function render() { await act(async () => root.render(createElement(BossSimulationPanel, { connection: { origin: 'http://127.0.0.1:4327', token: 'a'.repeat(48) }, drafts: [{ ...result.tasks[0], salary: '', greeting: '手动核对的招呼语', evidence: '', status: 'needs-image', checks: [], steps: [] }], images: [], onRunning: vi.fn() }))) }
it('提交核对过的招呼语，测试回执独立写回记录，完成后不能误点重发', async () => {
  await render()
  await act(async () => host.querySelector('button')!.click())
  expect(bossRequest).toHaveBeenCalledWith(expect.anything(), '/simulation', expect.objectContaining({ jobs: [expect.objectContaining({ greeting: '手动核对的招呼语' })], images: [] }))
  expect(saveBrowserSimulation).toHaveBeenCalledWith(result)
  expect(host.textContent).toContain('结果已写入投递记录的测试区')
  expect(host.querySelector('button')!.disabled).toBe(true)
})
it('刷新恢复只读取任务状态，不创建新的发送任务', async () => {
  sessionStorage.setItem('boss-browser:simulation-id:v1', result.id)
  await render()
  expect(vi.mocked(bossRequest).mock.calls.every(call => call[1] === `/simulation/${result.id}`)).toBe(true)
  expect(saveBrowserSimulation).toHaveBeenCalledWith(result)
})
it('保存失败时保留执行结果，明确提示记录未落盘', async () => {
  vi.mocked(saveBrowserSimulation).mockRejectedValue(new Error('存储空间不足'))
  sessionStorage.setItem('boss-browser:simulation-id:v1', result.id)
  await render()
  expect(host.textContent).toContain('执行状态未能写入本机记录')
  expect(host.textContent).not.toContain('结果已写入投递记录的测试区')
})
