// @vitest-environment jsdom
import { act, createElement } from 'react'
import { createRoot } from 'react-dom/client'
import { beforeEach, afterEach, expect, it, vi } from 'vitest'
import { BossDraftFill } from './BossDraftFill'
import { bossRequest } from './lib/boss-client'
vi.mock('./lib/boss-client', () => ({ bossRequest: vi.fn() }))
const props = { connection: { origin: 'http://127.0.0.1:4327', token: 'a'.repeat(48) }, connected: true, disabled: false, company: '示例公司', title: '全栈开发', url: 'https://www.zhipin.com/job_detail/example.html', text: '核对过的招呼语', onBusy: vi.fn() }
const preview = () => ({ id: 'preview', expiresAt: Date.now() + 30000, company: props.company, title: props.title, state: { conversation: '', fields: [] } })
let host: HTMLDivElement, root: ReturnType<typeof createRoot>
beforeEach(() => { vi.clearAllMocks(); vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true); host = document.createElement('div'); document.body.append(host); root = createRoot(host); vi.mocked(bossRequest).mockImplementation(async (_connection, path) => path === '/draft-preview' ? preview() : { written: true, cleared: false, sendActionPerformed: false }) })
afterEach(async () => { await act(async () => root.unmount()); host.remove(); vi.unstubAllGlobals() })
const button = (text: string) => [...host.querySelectorAll('button')].find(item => item.textContent === text)!
async function open() { await act(async () => root.render(createElement(BossDraftFill, props))); await act(async () => button('填入已有会话').click()) }
it('检查后必须由用户确认当前会话，正式填写使用已核对文本且不触发发送接口', async () => {
  await open(); expect(bossRequest).not.toHaveBeenCalled()
  await act(async () => button('检查当前输入框').click())
  expect(button('填写到 Chrome，不发送').disabled).toBe(true)
  expect(host.textContent).toContain('未自动识别会话名称')
  await act(async () => host.querySelector<HTMLInputElement>('input[type=checkbox]')!.click())
  await act(async () => button('填写到 Chrome，不发送').click())
  expect(bossRequest).toHaveBeenCalledWith(props.connection, '/draft-preview', { company: props.company, title: props.title, url: props.url, text: props.text })
  expect(bossRequest).toHaveBeenLastCalledWith(props.connection, '/fill-draft', { id: 'preview', confirmed: true })
  expect(host.textContent).toContain('尚未发送')
  expect(vi.mocked(bossRequest).mock.calls.map(call => call[1])).toEqual(['/draft-preview', '/fill-draft'])
})
it('招呼语修改后丢弃旧核对状态及迟到响应', async () => {
  let finish!: (value: unknown) => void
  vi.mocked(bossRequest).mockImplementation(() => new Promise(resolve => { finish = resolve }))
  await open()
  await act(async () => button('检查当前输入框').click())
  await act(async () => root.render(createElement(BossDraftFill, { ...props, text: '更改后的招呼语' })))
  await act(async () => finish(preview()))
  expect(host.querySelector('input[type=checkbox]')).toBeNull()
})
