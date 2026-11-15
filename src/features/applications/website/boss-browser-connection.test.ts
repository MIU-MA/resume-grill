// @vitest-environment jsdom
import { act, createElement } from 'react'
import { createRoot } from 'react-dom/client'
import { beforeEach, afterEach, expect, it, vi } from 'vitest'
import { BossBrowserConnection } from './BossBrowserConnection'
import { bossRequest, type BossStatus } from './lib/boss-client'
vi.mock('./lib/boss-client', () => ({ bossRequest: vi.fn(), parseBossConnection: vi.fn(), rememberBossConnection: vi.fn() }))
let host: HTMLDivElement, root: ReturnType<typeof createRoot>
const connection = { origin: 'http://127.0.0.1:4327', token: 'a'.repeat(48) }
beforeEach(() => { vi.clearAllMocks(); vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true); host = document.createElement('div'); document.body.append(host); root = createRoot(host) })
afterEach(async () => { await act(async () => root.unmount()); host.remove(); vi.unstubAllGlobals() })
const status = (phase: string, browserConnected = true): BossStatus => ({ phase, browserConnected, ready: phase === 'connected', tabs: [], error: '' })
async function render(value: BossStatus) { await act(async () => root.render(createElement(BossBrowserConnection, { connection, status: value, busy: false, onStatus: vi.fn(), onConnection: vi.fn(), onCommand: action => action() }))) }
it('Chrome 已连接但没有 BOSS 页时，只刷新列表，不再重复建立连接', async () => {
  vi.mocked(bossRequest).mockResolvedValue(status('selecting'))
  await render(status('selecting'))
  expect(host.textContent).toContain('Chrome 已连接')
  expect(host.textContent).toContain('无需手动输入网址或重新连接')
  expect([...host.querySelectorAll('button')].some(button => button.textContent === '连接 Chrome')).toBe(false)
  await act(async () => [...host.querySelectorAll('button')].find(button => button.textContent === '刷新页面列表')!.click())
  expect(vi.mocked(bossRequest).mock.calls.map(call => call[1])).toEqual(['/refresh-tabs', '/status'])
})
it('等待授权时禁用重复连接，页面关闭后保留刷新和断开入口', async () => {
  await render(status('awaiting-permission', false))
  expect([...host.querySelectorAll('button')].find(button => button.textContent === '等待连接完成')!.disabled).toBe(true)
  expect(host.textContent).toContain('手动点允许')
  await render(status('closed'))
  expect(host.textContent).toContain('所选页面已关闭')
  expect(host.textContent).toContain('刷新页面列表')
  expect(host.textContent).toContain('断开 Chrome')
})
