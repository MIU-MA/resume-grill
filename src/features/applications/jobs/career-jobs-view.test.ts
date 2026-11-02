// @vitest-environment jsdom
import { act, createElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { CareerJobsView } from './CareerJobsView'
import { emptyCareerJobs, recordCareerDiscovery, type CareerJobsStore } from './lib/career-jobs'
import type { CareerPage } from '@/domain/mail-schema'

const state = vi.hoisted(() => ({ store: { version: 1, sites: {} } as CareerJobsStore, readSite: vi.fn(), readPage: vi.fn(), readAll: vi.fn(), setError: vi.fn() }))
vi.mock('./hooks/use-career-jobs', () => ({ useCareerJobs: () => ({ store: state.store, hydrated: true, busyUrl: null, error: '', allProgress: null, setError: state.setError, readSite: state.readSite, readPage: state.readPage, readAll: state.readAll, cancelReadAll: vi.fn() }) }))
vi.mock('@/data/job-catalog', () => ({ seedJobs: [] }))

const page: CareerPage = {
  url: 'https://example.com/jobs/1', title: '前端工程师', emails: [], company: '示例公司', role: '前端工程师',
  recommendedEmail: 'hr@example.com', notes: [], jobs: [{ id: 'job-1', role: '前端工程师', emails: [], recommendedEmail: 'hr@example.com' }],
}
const onImported = vi.fn(), onOpenApplications = vi.fn(), onError = vi.fn()
let host: HTMLDivElement, root: Root
beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  sessionStorage.clear()
  state.store = recordCareerDiscovery(emptyCareerJobs(), { company: '示例公司', url: 'https://example.com/jobs', discovery: { pagesRead: 1, notes: [], pages: [page], links: [{ url: 'https://example.com/jobs/2', label: '后端工程师', kind: 'job', sourceUrl: 'https://example.com/jobs' }] } })
  state.readSite.mockReset(); state.readPage.mockReset(); state.setError.mockReset(); onImported.mockReset()
  host = document.createElement('div'); document.body.append(host); root = createRoot(host)
})
afterEach(async () => { await act(async () => root.unmount()); host.remove(); vi.unstubAllGlobals() })
const render = async (connected = true) => act(async () => root.render(createElement(CareerJobsView, {
  connected, existingJobs: [], slots: 20, discover: vi.fn(), read: vi.fn(), onConnect: vi.fn(), onBusy: vi.fn(), onError, onImported, onOpenApplications,
})))

it('把缓存里的岗位显示成列表，并能筛选已读取的岗位', async () => {
  await render()
  expect(host.textContent).toContain('前端工程师')
  expect(host.textContent).toContain('后端工程师')
  const search = host.querySelector<HTMLInputElement>('input[aria-label="筛选岗位"]')!
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(search, '后端')
    search.dispatchEvent(new Event('input', { bubbles: true }))
  })
  expect(host.textContent).toContain('后端工程师')
  expect(host.textContent).not.toContain('前端工程师')
})

it('页面里的岗位直接加入清单，链接岗位先读取再交给上层', async () => {
  await render()
  await act(async () => host.querySelector<HTMLButtonElement>('[aria-label="加入 前端工程师"]')!.click())
  expect(onImported).toHaveBeenCalledWith(expect.objectContaining({ url: 'https://example.com/jobs/1' }))
  state.readPage.mockResolvedValue({ ...page, url: 'https://example.com/jobs/2', role: '后端工程师', jobs: [] })
  await act(async () => host.querySelector<HTMLButtonElement>('[aria-label="加入 后端工程师"]')!.click())
  expect(state.readPage).toHaveBeenCalledWith('https://example.com/jobs/2')
  expect(onImported).toHaveBeenCalledWith(expect.objectContaining({ role: '后端工程师' }))
})

it('按校招／社招和岗位方向筛选职位', async () => {
  await render()
  const direction = host.querySelector<HTMLSelectElement>('select[aria-label="按岗位方向筛选"]')!
  await act(async () => { direction.value = 'frontend'; direction.dispatchEvent(new Event('change', { bubbles: true })) })
  expect(host.textContent).toContain('前端工程师')
  expect(host.textContent).not.toContain('后端工程师')
  await act(async () => [...host.querySelectorAll('button')].find(button => button.textContent === '校招')!.click())
  expect(host.textContent).toContain('没有符合筛选的岗位')
})

it('未连接执行器时给出连接入口，不静默失败', async () => {
  await render(false)
  expect(host.textContent).toContain('读取官网岗位需要连接本机执行器')
})

it('主列表只展示已读取岗位，读取官网放在独立弹窗里', async () => {
  await render()
  expect(host.querySelector('[aria-label="招聘官网来源"]')).toBeNull()
  expect(host.textContent).toContain('共 2 个职位')
  await act(async () => [...host.querySelectorAll('button')].find(button => button.textContent?.includes('读取官网'))!.click())
  expect(host.textContent).toContain('读取招聘官网')
  expect(host.textContent).toContain('不会投递或填写表单')
})
