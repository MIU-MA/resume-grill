// @vitest-environment jsdom
import { act, createElement } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { ApplicationProgressEditor } from './ApplicationProgressEditor'
import { changeApplicationProgress } from '@/domain/application-progress'
let root: ReturnType<typeof createRoot>, host: HTMLDivElement
const save = vi.fn(async () => {})
beforeEach(() => { vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true); save.mockClear(); host = document.createElement('div'); document.body.append(host); root = createRoot(host) })
afterEach(async () => { await act(async () => root.unmount()); host.remove(); vi.unstubAllGlobals() })
it('编辑窗口更新进展后，下方表单同步新进展并保留未保存备注', async () => {
  const initial = changeApplicationProgress(undefined, { stage: 'awaiting' }, 1)
  await act(async () => root.render(createElement(ApplicationProgressEditor, { value: initial, onSave: save })))
  const note = host.querySelector('textarea')!
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!.call(note, '尚未保存的备注')
    note.dispatchEvent(new Event('input', { bubbles: true }))
  })
  const updated = changeApplicationProgress(initial, { stage: 'interview', contact: 'HR' }, 2)
  await act(async () => root.render(createElement(ApplicationProgressEditor, { value: updated, onSave: save })))
  expect(host.querySelector('select')!.value).toBe('interview')
  expect(note.value).toBe('尚未保存的备注')
  await act(async () => host.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })))
  expect(save).toHaveBeenLastCalledWith(expect.objectContaining({ stage: 'interview', contact: 'HR', note: '尚未保存的备注' }))
})
