// @vitest-environment jsdom
import { act, createElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { ApplicationRecordDialog } from './ApplicationRecordDialog'

let host: HTMLDivElement, root: Root
beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  host = document.createElement('div'); document.body.append(host); root = createRoot(host)
})
afterEach(async () => { await act(async () => root.unmount()); host.remove(); vi.unstubAllGlobals() })

it('登记一条官网直投记录，校验公司并保存渠道、日期和进展', async () => {
  const onSave = vi.fn(async () => {})
  await act(async () => root.render(createElement(ApplicationRecordDialog, { mode: 'add', onClose: vi.fn(), onSave })))
  const company = host.querySelector<HTMLInputElement>('input[placeholder="公司名称"]')!
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(company, '示例公司')
    company.dispatchEvent(new Event('input', { bubbles: true }))
  })
  await act(async () => host.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })))
  expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ company: '示例公司', channel: 'website', stage: 'awaiting' }))
  expect(onSave.mock.calls[0][0].appliedAt).toBeTypeOf('number')
})

it('公司为空时给出提示，不调用保存', async () => {
  const onSave = vi.fn(async () => {})
  await act(async () => root.render(createElement(ApplicationRecordDialog, { mode: 'add', onClose: vi.fn(), onSave })))
  await act(async () => host.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })))
  expect(onSave).not.toHaveBeenCalled()
  expect(host.querySelector('[role="alert"]')).not.toBeNull()
})
