// @vitest-environment jsdom
import { act, createElement, useRef } from 'react'
import { createRoot } from 'react-dom/client'
import { expect, it, vi } from 'vitest'
import { ResumePasteInput } from './ResumePasteInput'
it('长文本输入不触发简历库父视图重绘，切换方式后仍保留输入', async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  const host = document.createElement('div'), root = createRoot(host), imported = vi.fn()
  let renders = 0
  function Harness({ show }: { show: boolean }) { renders++; const draft = useRef(''); return show ? createElement(ResumePasteInput, { draft, disabled: false, onImport: imported }) : null }
  try {
    await act(async () => root.render(createElement(Harness, { show: true })))
    const textarea = host.querySelector('textarea')!, text = '完整简历正文\n'.repeat(2000)
    await act(async () => { Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!.call(textarea, text); textarea.dispatchEvent(new Event('input', { bubbles: true })) })
    expect(renders).toBe(1)
    await act(async () => root.render(createElement(Harness, { show: false })))
    await act(async () => root.render(createElement(Harness, { show: true })))
    expect(host.querySelector('textarea')!.value.length).toBe(text.length)
    expect(host.querySelector('textarea')!.value).toBe(text)
    await act(async () => host.querySelector('button')!.click())
    expect(imported).toHaveBeenCalledWith(text)
  } finally { await act(async () => root.unmount()); vi.unstubAllGlobals() }
})
