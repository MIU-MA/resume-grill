// @vitest-environment jsdom
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import type { WebsiteSnapshot } from '../domain/website-automation'

let snapshot: WebsiteSnapshot | null
const fake = {
  runtime: { sendMessage: vi.fn(async (_input: unknown) => ({ ok: true, data: snapshot })) },
  tabs: { query: vi.fn(async () => [] as Array<{ id: number; url: string; windowId: number }>), create: vi.fn(async (_input: unknown) => ({ id: 10 })), update: vi.fn(async (_id: number, _input: unknown) => ({})), get: vi.fn(async (_id: number) => ({ url: 'https://example.com/apply' })) },
  windows: { update: vi.fn(async (_id: number, _input: unknown) => ({})) },
  permissions: { request: vi.fn(async (_input: unknown) => true) },
}
const getButton = (label: string) => [...document.querySelectorAll('button')].find(button => button.textContent === label)!
const click = async (label: string) => { getButton(label).click(); await vi.advanceTimersByTimeAsync(0); await vi.waitFor(() => expect(getButton('刷新任务').disabled).toBe(false)) }
const load = async () => { await import('./popup'); await vi.waitFor(() => expect(document.getElementById('message')!.textContent).not.toBe('正在读取任务…')) }
const queue = (status: 'pending' | 'waiting' | 'ready' = 'pending'): WebsiteSnapshot => ({ id: 'batch', createdAt: 1, updatedAt: 1, running: false, profile: {}, answers: [], attachmentName: 'resume.pdf', jobs: [{ id: 'job', company: '示例公司', role: '前端', url: 'https://example.com/apply', status }] })

beforeEach(() => {
  vi.resetModules(); vi.useFakeTimers(); vi.clearAllMocks(); snapshot = null
  fake.runtime.sendMessage.mockReset().mockImplementation(async () => ({ ok: true, data: snapshot }))
  fake.tabs.query.mockReset().mockResolvedValue([]); fake.permissions.request.mockReset().mockResolvedValue(true)
  document.documentElement.innerHTML = readFileSync(resolve('src/browser-extension/popup.html'), 'utf8')
  vi.stubGlobal('chrome', fake)
})
afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); vi.unstubAllGlobals(); document.body.replaceChildren() })

it('没有任务也能打开工作台、刷新任务，并看见下一步', async () => {
  await load()
  expect(document.body.textContent).toContain('发送到扩展')
  expect(getButton('打开工作台')).toBeDefined()
  await click('打开工作台')
  await vi.waitFor(() => expect(fake.tabs.create).toHaveBeenCalledWith({ url: 'http://127.0.0.1:3000/applications', active: true }))
  snapshot = queue()
  await click('刷新任务')
  await vi.waitFor(() => expect(getButton('开始填写（1）')).toBeDefined())
})
it('复用已打开的 3107 工作台，不另开错误端口', async () => {
  fake.tabs.query.mockResolvedValue([{ id: 8, windowId: 9, url: 'http://localhost:3107/careers' }, { id: 3, windowId: 4, url: 'https://evil.example/applications' }])
  await load(); await click('打开工作台')
  await vi.waitFor(() => expect(fake.tabs.update).toHaveBeenCalledWith(8, { active: true, url: 'http://localhost:3107/applications' }))
  expect(fake.windows.update).toHaveBeenCalledWith(9, { focused: true })
  expect(fake.tabs.create).not.toHaveBeenCalled()
})
it('读取失败后仍有刷新按钮，拒绝官网权限时不开始任务', async () => {
  fake.runtime.sendMessage.mockRejectedValueOnce(new Error('存储读取失败'))
  await load()
  expect(document.getElementById('message')!.textContent).toContain('存储读取失败')
  snapshot = queue(); await click('刷新任务')
  await vi.waitFor(() => expect(getButton('开始填写（1）')).toBeDefined())
  fake.permissions.request.mockResolvedValue(false)
  await click('开始填写（1）')
  await vi.waitFor(() => expect(document.getElementById('message')!.textContent).toContain('未允许访问官网'))
  expect(fake.runtime.sendMessage).not.toHaveBeenCalledWith({ type: 'command', action: 'start' })
})
it('开始按钮申请本批权限并发送开始命令', async () => {
  snapshot = queue(); await load(); await click('开始填写（1）')
  await vi.waitFor(() => expect(fake.runtime.sendMessage).toHaveBeenCalledWith({ type: 'command', action: 'start' }))
  expect(fake.permissions.request).toHaveBeenCalledWith({ origins: ['https://example.com/*'] })
})
it('需要处理时显示可补充字段和官网处理项，不再显示无效的整批开始按钮', async () => {
  snapshot = queue('waiting'); snapshot.jobs[0].tabId = 2
  snapshot.jobs[0].result = { filled: ['姓名'], uploaded: false, message: '需要补充', missing: [{ kind: 'profile', key: 'phone', label: '手机号' }, { kind: 'manual', label: '验证码' }] }
  await load()
  expect(getButton('开始填写（0）')).toBeUndefined()
  expect(document.body.textContent).toContain('验证码（在官网处理）')
  expect(document.querySelectorAll('input')).toHaveLength(1)
  const input = document.querySelector('input')!; input.focus(); input.value = '13800138000'; input.dispatchEvent(new Event('input'))
  await vi.advanceTimersByTimeAsync(2000)
  expect(document.activeElement).toBe(input)
  expect(input.value).toBe('13800138000')
  await click('继续填写')
  await vi.waitFor(() => expect(fake.runtime.sendMessage).toHaveBeenCalledWith(expect.objectContaining({ type: 'command', action: 'resume-job', id: 'job', profile: { phone: '13800138000' }, authorizeCurrent: true })))
})
