// @vitest-environment jsdom
import { act, createElement } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { BossJobDetails } from './BossJobDetails'
import { bossRequest } from './lib/boss-client'
import type { BossInspection } from '@/domain/boss-inspection'
vi.mock('./lib/boss-client', () => ({ bossRequest: vi.fn() }))
const jobs = [1, 2].map(index => ({ title: `岗位${index}`, company: '测试公司', url: `https://www.zhipin.com/job_detail/${index}.html`, salary: '' }))
const result: BossInspection = { kind: 'detail', url: jobs[0].url, title: jobs[0].title, company: '测试公司', description: '完整岗位要求', truncated: false, communication: { count: 1, enabled: 1, labels: ['立即沟通'] }, matched: true, blockers: [] }
let host: HTMLDivElement, root: ReturnType<typeof createRoot>
beforeEach(() => { vi.clearAllMocks(); vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true); host = document.createElement('div'); document.body.append(host); root = createRoot(host) })
afterEach(async () => { await act(async () => root.unmount()); host.remove(); vi.unstubAllGlobals() })
it('逐个读取已选岗位，遇到验证停止后续任务并显示原因', async () => {
  const busy = vi.fn(), changed = vi.fn()
  vi.mocked(bossRequest).mockResolvedValue({ ...result, kind: 'verification', matched: false, description: '', blockers: ['需要官网验证'] })
  await act(async () => root.render(createElement(BossJobDetails, { connection: { origin: 'http://127.0.0.1:4327', token: 'a'.repeat(48) }, readId: 'read', jobs, disabled: false, onBusy: busy, onChanged: changed })))
  await act(async () => host.querySelector('button')!.click())
  expect(bossRequest).toHaveBeenCalledTimes(1)
  expect(bossRequest).toHaveBeenCalledWith(expect.anything(), '/inspect-job', { readId: 'read', url: jobs[0].url })
  expect(host.textContent).toContain('需要官网验证'); expect(host.textContent).toContain('未采用此详情')
  expect(busy.mock.calls.map(call => call[0])).toEqual([true, false])
  expect(changed).toHaveBeenCalledTimes(1)
})
it('切换列表后丢弃迟到的详情响应', async () => {
  let finish!: (result: BossInspection) => void
  vi.mocked(bossRequest).mockImplementation(() => new Promise(resolve => { finish = resolve }))
  const props = { connection: { origin: 'http://127.0.0.1:4327', token: 'a'.repeat(48) }, jobs, disabled: false, onBusy: vi.fn(), onChanged: vi.fn() }
  await act(async () => root.render(createElement(BossJobDetails, { ...props, readId: 'old' })))
  await act(async () => host.querySelector('button')!.click())
  await act(async () => root.render(createElement(BossJobDetails, { ...props, readId: 'new' })))
  await act(async () => finish(result))
  expect(props.onChanged).not.toHaveBeenCalled()
  expect(host.textContent).not.toContain('完整岗位要求 · 已核对')
  expect(bossRequest).toHaveBeenCalledTimes(1)
})
