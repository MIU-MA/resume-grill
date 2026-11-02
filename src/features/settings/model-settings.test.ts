// @vitest-environment jsdom
import { act, createElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { ModelSettings } from './ModelSettings'
import { getLlmSettings, setLlmSettings } from '@/lib/settings'

let host: HTMLDivElement, root: Root
const change = async (element: HTMLSelectElement | HTMLInputElement, value: string) => {
  await act(async () => {
    Object.getOwnPropertyDescriptor(element instanceof HTMLInputElement ? HTMLInputElement.prototype : HTMLSelectElement.prototype, 'value')!.set!.call(element, value)
    element.dispatchEvent(new Event(element instanceof HTMLSelectElement ? 'change' : 'input', { bubbles: true }))
  })
}
const button = (text: string) => [...host.querySelectorAll('button')].find(node => node.textContent === text)!
const render = async () => act(async () => root.render(createElement(ModelSettings, { envConfigured: false, clientConfigured: true, onClientChanged: vi.fn() })))
const saved = { baseUrl: 'https://api.openai.com/v1', apiKey: 'saved-private-key', model: 'my-pinned-model' }
beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  window.localStorage.clear(); setLlmSettings(saved)
  host = document.createElement('div'); document.body.append(host); root = createRoot(host)
})
afterEach(async () => { await act(async () => root.unmount()); host.remove(); vi.unstubAllGlobals() })

it('打开设置保留用户固定型号和 Key，识别供应商但不替换已保存内容', async () => {
  const fetchMock = vi.fn(); vi.stubGlobal('fetch', fetchMock)
  await render()
  expect(host.querySelector<HTMLSelectElement>('select')!.selectedOptions[0].textContent).toBe('OpenAI')
  expect(host.querySelector<HTMLInputElement>('input[type="password"]')!.value).toBe(saved.apiKey)
  expect(host.querySelector<HTMLInputElement>('input[id]')!.value).toBe(saved.model)
  expect(getLlmSettings()).toEqual(saved)
  expect(fetchMock).not.toHaveBeenCalled()
})
it('读取列表只发送接口和 Key，可选择精确新型号，保存前不改原设置', async () => {
  const fetchMock = vi.fn(async () => Response.json({ models: ['newly-released-model', 'author/custom-model'] }))
  vi.stubGlobal('fetch', fetchMock)
  await render(); await act(async () => button('读取可用模型').click())
  expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ baseUrl: saved.baseUrl, apiKey: saved.apiKey })
  await change(host.querySelector<HTMLSelectElement>('[aria-label="选择模型型号"]')!, 'author/custom-model')
  expect(host.querySelector<HTMLSelectElement>('[aria-label="选择模型型号"]')!.value).toBe('author/custom-model')
  expect(getLlmSettings()).toEqual(saved)
  await act(async () => button('保存').click())
  expect(getLlmSettings()?.model).toBe('author/custom-model')
})
it('切换供应商取消旧列表请求，清空旧 Key，迟到响应不污染新供应商', async () => {
  let resolve!: (response: Response) => void
  let signal!: AbortSignal
  vi.stubGlobal('fetch', vi.fn((_url, init) => { signal = init.signal; return new Promise<Response>(done => { resolve = done }) }))
  await render(); await act(async () => button('读取可用模型').click())
  const provider = host.querySelector<HTMLSelectElement>('select')!
  const kimi = [...provider.options].find(option => option.textContent === 'Kimi')!
  await change(provider, kimi.value)
  expect(signal.aborted).toBe(true)
  expect(host.querySelector<HTMLInputElement>('input[type="password"]')!.value).toBe('')
  await act(async () => resolve(Response.json({ models: ['old-provider-model'] })))
  expect(host.textContent).not.toContain('old-provider-model')
  expect(host.querySelector<HTMLSelectElement>('[aria-label="选择模型型号"]')!.value).toBe('kimi-k3.1-pro')
  expect(getLlmSettings()).toEqual(saved)
})
it('不支持列表时仍保留已填型号与保存操作', async () => {
  vi.stubGlobal('fetch', vi.fn(async () => Response.json({ error: '可以手动填写型号。' }, { status: 502 })))
  await render(); await act(async () => button('读取可用模型').click())
  expect(host.textContent).toContain('可以手动填写型号')
  expect(host.querySelector<HTMLInputElement>('input[id]')!.value).toBe(saved.model)
  expect(button('保存').disabled).toBe(false)
})
