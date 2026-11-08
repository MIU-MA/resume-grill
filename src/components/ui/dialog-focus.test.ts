// @vitest-environment jsdom
import { act, createElement } from 'react'
import { createRoot } from 'react-dom/client'
import { expect, it, vi } from 'vitest'
import { Dialog } from './Dialog'
it('打开后焦点进入弹窗，后台不能获取焦点，关闭恢复触发按钮与滚动', async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  const trigger = document.createElement('button'), host = document.createElement('div')
  document.body.append(trigger, host); trigger.focus()
  const root = createRoot(host), close = vi.fn()
  const previous = document.body.style.overflow
  try {
    await act(async () => root.render(createElement(Dialog, { open: true, onClose: close, label: '测试弹窗' }, createElement('button', { id: 'inside' }, '保存'))))
    expect(document.activeElement?.id).toBe('inside'); expect(document.body.style.overflow).toBe('hidden')
    await act(async () => { trigger.focus(); await Promise.resolve() })
    expect(document.activeElement?.id).toBe('inside')
    await act(async () => root.render(null))
    expect(document.activeElement).toBe(trigger); expect(document.body.style.overflow).toBe(previous)
  } finally { await act(async () => root.unmount()); trigger.remove(); host.remove(); vi.unstubAllGlobals() }
})
