// @vitest-environment jsdom
import { act, createElement, useRef, useState } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { usePdfNavigation } from './use-pdf-navigation'

let host: HTMLDivElement, root: Root, viewport: HTMLDivElement
const select = vi.fn()
function Fixture() {
  const ref = useRef<HTMLDivElement>(null)
  const [ready, setReady] = useState(false)
  const [zoom, setZoom] = useState(100)
  const navigation = usePdfNavigation(ref, ready, zoom, setZoom)
  return createElement('div', {},
    createElement('button', { onClick: () => setReady(true) }, '加载'),
    createElement('output', {}, zoom),
    createElement('div', { ref, tabIndex: 0, 'data-viewport': true, style: { overflowX: 'auto', overflowY: 'auto', cursor: navigation.cursor } },
      createElement('div', { 'data-pdf-page': true, 'data-zoom': zoom }, createElement('button', { onClick: select }, '编辑段落'))),
    createElement('textarea', { 'aria-label': '原文' }))
}
beforeEach(async () => {
  vi.clearAllMocks(); vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  host = document.createElement('div'); document.body.append(host); root = createRoot(host)
  await act(async () => root.render(createElement(Fixture)))
  viewport = host.querySelector('[data-viewport]')!
  Object.defineProperties(viewport, { clientWidth: { value: 400 }, clientHeight: { value: 400 }, scrollWidth: { value: 1800 }, scrollHeight: { value: 2400, configurable: true } })
  viewport.getBoundingClientRect = () => ({ x: 0, y: 0, left: 0, top: 0, right: 400, bottom: 400, width: 400, height: 400, toJSON: () => ({}) })
  const page = host.querySelector<HTMLElement>('[data-pdf-page]')!
  page.getBoundingClientRect = () => {
    const zoom = Number(page.dataset.zoom) / 100
    return { x: -viewport.scrollLeft, y: -viewport.scrollTop, left: -viewport.scrollLeft, top: -viewport.scrollTop, width: 600 * zoom, height: 800 * zoom, bottom: 800 * zoom - viewport.scrollTop, right: 600 * zoom - viewport.scrollLeft, toJSON: () => ({}) }
  }
})
afterEach(async () => { await act(async () => root.unmount()); host.remove(); vi.unstubAllGlobals() })
const load = async () => act(async () => host.querySelector('button')!.click())
const wheel = async (init: WheelEventInit) => {
  const event = new WheelEvent('wheel', { bubbles: true, cancelable: true, clientX: 250, clientY: 200, ...init })
  await act(async () => { viewport.dispatchEvent(event) })
  return event
}
async function pointer(type: string, target: EventTarget, options: MouseEventInit = {}) {
  const event = new MouseEvent(type, { bubbles: true, cancelable: true, ...options })
  Object.defineProperty(event, 'pointerId', { value: 1 })
  await act(async () => { target.dispatchEvent(event) })
  return event
}
it('PDF 加载后普通滚轮直接缩放，Shift 滚轮保留滚动，不接管外部区域', async () => {
  expect((await wheel({ deltaY: -100, ctrlKey: true })).defaultPrevented).toBe(false)
  await load()
  expect((await wheel({ deltaY: 100, shiftKey: true })).defaultPrevented).toBe(true)
  expect(viewport.scrollTop).toBe(100)
  expect(host.querySelector('output')!.textContent).toBe('100')
  expect((await wheel({ deltaY: -100 })).defaultPrevented).toBe(true)
  expect(host.querySelector('output')!.textContent).toBe('110')
  const outside = new WheelEvent('wheel', { cancelable: true, ctrlKey: true, deltaY: -100 })
  document.body.dispatchEvent(outside)
  expect(outside.defaultPrevented).toBe(false)
})
it('缩放前后鼠标所指的 PDF 位置保持不变，并限制缩放范围', async () => {
  await load(); viewport.scrollLeft = 50; viewport.scrollTop = 100
  await wheel({ deltaY: -100, metaKey: true })
  expect(viewport.scrollLeft).toBeCloseTo(80)
  expect(viewport.scrollTop).toBeCloseTo(130)
  for (let i = 0; i < 30; i++) await wheel({ deltaY: -100, ctrlKey: true })
  expect(host.querySelector('output')!.textContent).toBe('300')
  for (let i = 0; i < 35; i++) await wheel({ deltaY: 100, ctrlKey: true })
  expect(host.querySelector('output')!.textContent).toBe('25')
})
it('中键拖动滚动预览，窗口失焦后停止拖动', async () => {
  await load(); viewport.scrollLeft = 100; viewport.scrollTop = 200
  const down = await pointer('pointerdown', viewport, { button: 1, clientX: 100, clientY: 100 })
  expect(down.defaultPrevented).toBe(true)
  await pointer('pointermove', window, { clientX: 60, clientY: 70 })
  expect(viewport.scrollLeft).toBe(140); expect(viewport.scrollTop).toBe(230)
  await act(async () => window.dispatchEvent(new Event('blur')))
  await pointer('pointermove', window, { clientX: 0, clientY: 0 })
  expect(viewport.scrollLeft).toBe(140)
  expect(viewport.style.cursor).toBe('grab')
})
it('空格拖动不触发段落编辑，松开后普通点击仍能编辑', async () => {
  await load()
  await pointer('pointerenter', viewport)
  await act(async () => window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space', cancelable: true })))
  expect(viewport.style.cursor).toBe('grab')
  const button = viewport.querySelector('button')!
  await pointer('pointerdown', button, { button: 0, clientX: 100, clientY: 100 })
  await pointer('pointermove', window, { clientX: 100, clientY: 50 })
  await pointer('pointerup', window, { button: 0 })
  await act(async () => button.click())
  expect(select).not.toHaveBeenCalled()
  await act(async () => window.dispatchEvent(new KeyboardEvent('keyup', { code: 'Space' })))
  await pointer('pointerdown', button, { button: 0 })
  await act(async () => button.click())
  expect(select).toHaveBeenCalledOnce()
})
it('文字输入框中的空格不会被预览拦截', async () => {
  await load(); await pointer('pointerenter', viewport)
  const input = host.querySelector('textarea')!
  const event = new KeyboardEvent('keydown', { bubbles: true, cancelable: true, code: 'Space' })
  await act(async () => input.dispatchEvent(event))
  expect(event.defaultPrevented).toBe(false)
  expect(viewport.style.cursor).toBe('grab')
})

it('纵向滚动在外层面板时分别拖动正确的横向和纵向容器', async () => {
  await load()
  Object.defineProperty(viewport, 'scrollHeight', { value: 400 })
  host.style.overflowY = 'auto'
  Object.defineProperties(host, { scrollHeight: { value: 2400 }, clientHeight: { value: 400 } })
  host.scrollTop = 200; viewport.scrollLeft = 100
  await pointer('pointerdown', viewport, { button: 1, clientX: 100, clientY: 100 })
  await pointer('pointermove', window, { clientX: 60, clientY: 70 })
  expect(viewport.scrollLeft).toBe(140)
  expect(host.scrollTop).toBe(230)
  expect(viewport.scrollTop).toBe(0)
})

it('默认左键即可拖动，普通单击不误判为拖动', async () => {
  await load(); viewport.scrollTop = 200
  const button = viewport.querySelector('button')!
  await pointer('pointerdown', button, { button: 0, clientX: 100, clientY: 100 })
  await pointer('pointermove', window, { clientX: 100, clientY: 40 })
  await pointer('pointerup', window, { button: 0 })
  await act(async () => button.click())
  expect(viewport.scrollTop).toBe(260)
  expect(select).not.toHaveBeenCalled()
  await pointer('pointerdown', button, { button: 0, clientX: 100, clientY: 100 })
  await pointer('pointerup', window, { button: 0 })
  await act(async () => button.click())
  expect(select).toHaveBeenCalledOnce()
})
