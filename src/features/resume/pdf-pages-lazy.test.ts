// @vitest-environment jsdom
import { act, createElement } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, expect, it, vi } from 'vitest'
import { PdfPages } from './PdfPages'
const fake = vi.hoisted(() => ({ getPage: vi.fn(), destroy: vi.fn(async () => {}), cancel: vi.fn() }))
vi.mock('./lib/pdfjs', () => ({ getPdfJs: async () => ({ getDocument: () => ({ promise: Promise.resolve({ numPages: 3, getPage: fake.getPage }), destroy: fake.destroy }) }) }))
vi.mock('./hooks/use-pdf-navigation', () => ({ MIN_PDF_ZOOM: 50, MAX_PDF_ZOOM: 200, usePdfNavigation: () => ({ changeZoom: vi.fn(), hand: false, setHand: vi.fn() }) }))
const host = document.createElement('div'); let root = createRoot(host)
afterEach(async () => { await act(async () => root.unmount()); root = createRoot(host); vi.unstubAllGlobals() })
it('仅渲染相邻可见页，离屏释放画布，切换文件销毁 PDF 文档', async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true); sessionStorage.clear()
  const observers = new Map<Element, (entries: Array<{ isIntersecting: boolean }>) => void>()
  vi.stubGlobal('IntersectionObserver', class {
    callback: (entries: Array<{ isIntersecting: boolean }>) => void
    constructor(callback: (entries: Array<{ isIntersecting: boolean }>) => void) { this.callback = callback }
    observe(element: Element) { observers.set(element, this.callback) }
    disconnect() {}
  })
  fake.getPage.mockImplementation(async () => ({ getViewport: () => ({ width: 600, height: 800 }), render: () => ({ promise: Promise.resolve(), cancel: fake.cancel }) }))
  const file = new File(['pdf'], 'test.pdf'); Object.defineProperty(file, 'arrayBuffer', { value: async () => new ArrayBuffer(1) })
  await act(async () => root.render(createElement(PdfPages, { file })))
  expect(fake.getPage).toHaveBeenCalledTimes(1)
  const first = host.querySelector('[data-pdf-page="1"]')!, third = host.querySelector('[data-pdf-page="3"]')!
  const firstCanvas = first.querySelector('canvas')!
  await act(async () => { observers.get(first)!([{ isIntersecting: false }]); observers.get(third)!([{ isIntersecting: true }]) })
  expect(fake.getPage).toHaveBeenCalledTimes(2)
  expect(first.querySelector('canvas')).toBeNull(); expect(firstCanvas.width).toBe(0)
  expect(third.querySelector('canvas')).not.toBeNull()
  await act(async () => root.render(null))
  expect(fake.destroy).toHaveBeenCalled()
})
