import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { WebsiteQueue } from '../domain/website-automation'

let listener: (message: unknown, sender: object, reply: (value: unknown) => void) => unknown
let stored: WebsiteQueue | null
let redirected: boolean
let nextTab: number
const tabs = new Map<number, { id: number; url: string; status: string }>()
const fake = {
  storage: { local: { setAccessLevel: vi.fn(async () => undefined), get: vi.fn(async () => ({ 'website-queue:v1': structuredClone(stored) })), set: vi.fn(async value => { stored = structuredClone(value['website-queue:v1']) }), remove: vi.fn(async () => { stored = null }) } },
  permissions: { contains: vi.fn(async () => true) },
  scripting: { executeScript: vi.fn(async () => []) },
  tabs: { create: vi.fn(async ({ url }) => { const id = ++nextTab; tabs.set(id, { id, url: redirected ? 'https://redirect.example/form' : url, status: 'complete' }); return { id } }), get: vi.fn(async id => { const tab = tabs.get(id); if (!tab) throw new Error('closed'); return tab }), update: vi.fn(async id => tabs.get(id)), sendMessage: vi.fn(async () => ({ result: { filled: ['姓名'], uploaded: true, missing: [], message: '请核对' } })) },
  windows: { update: vi.fn() },
  runtime: { id: 'test-extension', getURL: (file: string) => `chrome-extension://test-extension/${file}`, getManifest: () => ({ version: '0.2.2' }), onMessage: { addListener: vi.fn(fn => { listener = fn }) }, onInstalled: { addListener: vi.fn() }, onStartup: { addListener: vi.fn() } },
}
const popup = { id: 'test-extension', url: 'chrome-extension://test-extension/popup.html' }
const workbench = { id: 'test-extension', url: 'http://localhost:3000/applications', tab: { id: 1 } }
const batch = () => ({ id: crypto.randomUUID(), createdAt: 1, profile: { name: '林同学' }, jobs: [{ id: crypto.randomUUID(), company: '示例公司', role: '前端', url: 'https://example.com/apply' }], attachment: { name: 'resume.pdf', base64: 'YQ==' } })
const send = (message: object, sender = popup) => new Promise<{ ok: boolean; data: WebsiteQueue; error?: string }>(resolve => { listener(message, sender, value => resolve(value as { ok: boolean; data: WebsiteQueue; error?: string })) })

beforeEach(async () => { stored = null; redirected = false; nextTab = 100; tabs.clear(); vi.resetModules(); vi.clearAllMocks(); vi.stubGlobal('chrome', fake); await import('./background') })
afterEach(async () => { if (stored) await vi.waitFor(() => expect(stored?.running).toBe(false)); vi.unstubAllGlobals() })
describe('扩展权限与任务交接', () => {
  it('安装更新和浏览器启动时注册恢复，连接回应包含实际扩展版本', async () => {
    expect(fake.runtime.onInstalled.addListener).toHaveBeenCalledOnce()
    expect(fake.runtime.onStartup.addListener).toHaveBeenCalledOnce()
    expect((await send({ type: 'ping' }, workbench)).data).toEqual({ version: 1, extensionVersion: '0.2.2' })
  })
  it('独立填写资料只允许扩展面板读取，工作台不能直接执行', async () => {
    expect((await send({ type: 'direct-state' })).ok).toBe(true)
    expect((await send({ type: 'direct-state' }, workbench)).ok).toBe(false)
    expect((await send({ type: 'direct-fill', request: {} }, workbench)).ok).toBe(false)
    expect(fake.scripting.executeScript).not.toHaveBeenCalled()
  })
  it('接受从诊断页和运行状态页加载的工作台连接，但仍禁止网页执行填写', async () => {
    for (const path of ['/diagnosis', '/audit']) {
      const sender = { ...workbench, url: `http://localhost:3000${path}` }
      expect((await send({ type: 'ping' }, sender)).ok).toBe(true)
      expect((await send({ type: 'command', action: 'start' }, sender)).ok).toBe(false)
    }
    expect(fake.tabs.create).not.toHaveBeenCalled()
  })
  it('存储初始化尚未结束时仍能检测连接，任务读取继续等待初始化', async () => {
    vi.resetModules(); fake.runtime.onMessage.addListener.mockClear()
    let release!: () => void
    fake.storage.local.setAccessLevel.mockImplementationOnce(() => new Promise<void>(resolve => { release = resolve }))
    const loading = import('./background')
    await vi.waitFor(() => expect(fake.runtime.onMessage.addListener).toHaveBeenCalledTimes(1))
    let answered = false
    expect((await send({ type: 'ping' }, workbench)).ok).toBe(true)
    const pending = send({ type: 'snapshot' }).then(reply => { answered = true; return reply })
    await Promise.resolve(); expect(answered).toBe(false)
    release(); await loading
    expect((await pending).ok).toBe(true)
  })
  it('拒绝其他页面发消息，工作台只能交接和查看，不能直接开始或提交', async () => {
    const reply = vi.fn()
    listener({ type: 'stage', batch: batch() }, { id: 'test-extension', url: 'https://evil.example', tab: { id: 2 } }, reply)
    expect(reply).not.toHaveBeenCalled()
    expect((await send({ type: 'stage', batch: batch() }, workbench)).ok).toBe(true)
    expect((await send({ type: 'command', action: 'start' }, workbench)).ok).toBe(false)
    expect(fake.tabs.create).not.toHaveBeenCalled()
    const snapshot = await send({ type: 'snapshot' }, workbench)
    expect(snapshot.data).not.toHaveProperty('attachment')
  })
  it('即使别的站点以前授权过，跳转后也先暂停，明确允许后才注入资料', async () => {
    redirected = true; const input = batch()
    await send({ type: 'stage', batch: input }, workbench); await send({ type: 'command', action: 'start' })
    await vi.waitFor(() => expect(stored?.jobs[0].status).toBe('waiting'))
    expect(fake.scripting.executeScript).not.toHaveBeenCalled()
    await send({ type: 'command', action: 'resume-job', id: input.jobs[0].id, authorizeCurrent: true })
    await vi.waitFor(() => expect(stored?.jobs[0].status).toBe('ready'))
    expect(fake.scripting.executeScript).toHaveBeenCalledTimes(1)
    expect(stored?.jobs[0].authorizedOrigins).toContain('https://redirect.example')
  })
  it('标签页关闭后，用户继续才重开，不自动循环开页', async () => {
    const input = batch(); await send({ type: 'stage', batch: input }, workbench); await send({ type: 'command', action: 'start' })
    await vi.waitFor(() => expect(stored?.jobs[0].status).toBe('ready'))
    tabs.clear()
    await send({ type: 'command', action: 'resume-job', id: input.jobs[0].id, authorizeCurrent: true })
    await vi.waitFor(() => expect(fake.tabs.create).toHaveBeenCalledTimes(2))
    await vi.waitFor(() => expect(stored?.jobs[0].status).toBe('ready'))
  })
  it('不把验证码答案或其他公司作用域的答案存入复用资料', async () => {
    const input = batch(); await send({ type: 'stage', batch: input }, workbench); await send({ type: 'command', action: 'start' })
    await vi.waitFor(() => expect(stored?.jobs[0].status).toBe('ready'))
    const answer = { origin: 'https://example.com', scope: '示例公司\n前端', label: '验证码', value: '123456' }
    expect((await send({ type: 'command', action: 'resume-job', id: input.jobs[0].id, answers: [answer], authorizeCurrent: true })).ok).toBe(false)
    expect((await send({ type: 'command', action: 'resume-job', id: input.jobs[0].id, answers: [{ ...answer, label: '到岗时间', scope: '其他公司\n前端' }], authorizeCurrent: true })).ok).toBe(false)
    expect(stored?.answers).toEqual([])
  })
})
