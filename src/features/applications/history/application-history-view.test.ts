// @vitest-environment jsdom
import { act, createElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { ApplicationHistoryView } from './ApplicationHistoryView'
import { buildApplicationEntries } from './lib/application-entry'
import type { WebsiteApplication } from '../mail/lib/draft-state'

const website = { id: 'w1', company: '官网公司', role: '后端', recipient: 'hr@site.com', sourceUrl: 'https://site.example/job', applicationUrl: 'https://site.example/job', appliedAt: 2, channel: 'website' } as WebsiteApplication
const manual = { id: 'a1', company: '手动公司', role: '运营', channel: 'referral' as const, appliedAt: 3, sourceUrl: '', contact: '朋友', note: '内推', createdAt: 3, updatedAt: 3 }
const entries = buildApplicationEntries({ websites: [website], manuals: [manual] })
let host: HTMLDivElement, root: Root
const onAdd = vi.fn(), onSelect = vi.fn(), onDelete = vi.fn(), onEdit = vi.fn(), onSaveProgress = vi.fn(async () => {}), onMailAction = vi.fn(), onReturnToDrafts = vi.fn()
beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  sessionStorage.clear()
  host = document.createElement('div'); document.body.append(host); root = createRoot(host)
})
afterEach(async () => { await act(async () => root.unmount()); host.remove(); vi.unstubAllGlobals() })
const render = async () => act(async () => root.render(createElement(ApplicationHistoryView, {
  entries, progress: {}, selectedId: 'a1', onSelect, onAdd, onEdit, onDelete, onSaveProgress, onMailAction, onReturnToDrafts,
})))

it('展示全部记录，搜索会同时过滤公司、岗位和联系方式', async () => {
  await render()
  expect(host.textContent).toContain('官网公司')
  expect(host.textContent).toContain('手动公司')
  const search = host.querySelector<HTMLInputElement>('input[aria-label="搜索投递记录"]')!
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(search, 'hr@site.com')
    search.dispatchEvent(new Event('input', { bubbles: true }))
  })
  expect(host.textContent).toContain('官网公司')
  expect(host.textContent).not.toContain('手动公司')
})

it('登记、编辑、删除都直接交给上层，不在视图里重复存储逻辑', async () => {
  await render()
  await act(async () => [...host.querySelectorAll('button')].find(button => button.textContent?.includes('登记投递'))!.click())
  expect(onAdd).toHaveBeenCalled()
  await act(async () => host.querySelector<HTMLButtonElement>('[aria-label="删除 手动公司 / 运营"]')!.click())
  expect(onDelete).toHaveBeenCalledWith(expect.objectContaining({ id: 'a1' }))
  await act(async () => [...host.querySelectorAll('button')].find(button => button.textContent === '编辑')!.click())
  expect(onEdit).toHaveBeenCalledWith(expect.objectContaining({ id: 'a1' }))
})
