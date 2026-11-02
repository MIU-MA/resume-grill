// @vitest-environment jsdom
import { act, createElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { SettingsDialog } from './SettingsDialog'
import { setLlmSettings } from '@/lib/settings'

vi.mock('@/features/applications/hooks/use-mail-agent', () => ({ useMailAgent: () => ({ token: '', snapshot: null, connectionError: '', connect: vi.fn() }) }))
vi.mock('./hooks/use-llm-status', () => ({ useLlmStatus: () => ({ envConfigured: false, clientConfigured: true, refresh: vi.fn() }) }))
let root: Root, host: HTMLDivElement
const close = vi.fn()
const click = async (text: string) => act(async () => [...host.querySelectorAll('button')].find(button => button.textContent === text)!.click())
beforeEach(async () => {
  vi.clearAllMocks(); vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true); localStorage.clear()
  setLlmSettings({ baseUrl: 'https://api.openai.com/v1', apiKey: 'demo-key', model: 'custom-model' })
  host = document.createElement('div'); document.body.append(host); root = createRoot(host)
  await act(async () => root.render(createElement(SettingsDialog, { open: true, onClose: close })))
})
afterEach(async () => { await act(async () => root.unmount()); host.remove(); vi.unstubAllGlobals() })
it('切换设置页保留表单；保存就地反馈，未保存关闭需要明确确认', async () => {
  const model = host.querySelector<HTMLInputElement>('[aria-label="模型"] input[id]')!
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(model, 'another-model')
    model.dispatchEvent(new Event('input', { bubbles: true }))
  })
  await click('邮箱'); await click('模型')
  expect(host.querySelector<HTMLInputElement>('[aria-label="模型"] input[id]')!.value).toBe('another-model')
  await click('关闭')
  expect(close).not.toHaveBeenCalled()
  expect(host.textContent).toContain('放弃未保存的设置')
  await click('取消')
  expect(close).not.toHaveBeenCalled()
  await click('保存')
  expect(host.textContent).toContain('已保存')
  expect(close).not.toHaveBeenCalled()
  await click('关闭')
  expect(close).toHaveBeenCalledOnce()
})
it('点击遮罩不丢弃输入，邮箱和本机仍是同一设置面板', async () => {
  const overlay = host.querySelector('[role=dialog]')!
  await act(async () => { overlay.dispatchEvent(new MouseEvent('mousedown', { bubbles: true })); overlay.dispatchEvent(new MouseEvent('click', { bubbles: true })) })
  expect(close).not.toHaveBeenCalled()
  await click('本机')
  expect(host.querySelectorAll('[role=dialog]')).toHaveLength(1)
  expect(host.querySelector('[role=tabpanel][aria-label="本机"]')).not.toBeNull()
})
