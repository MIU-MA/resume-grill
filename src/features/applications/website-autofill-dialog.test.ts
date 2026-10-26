// @vitest-environment jsdom
import { createElement, act, StrictMode } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { WebsiteAutofillDialog } from './WebsiteAutofillDialog'
import { extensionRequest, loadWebsiteProfile, makeWebsiteBatch } from './website-automation'
import { PROFILE_LABELS, type WebsiteSnapshot } from '@/domain/website-automation'
import { loadExperiences } from './website-experience-storage'
import type { Draft } from './draft-state'

vi.mock('./website-automation', async importOriginal => ({
  ...await importOriginal<typeof import('./website-automation')>(),
  loadWebsiteProfile: vi.fn(async () => ({})),
  extensionRequest: vi.fn(async () => null),
  saveWebsiteProfile: vi.fn(async () => undefined),
  makeWebsiteBatch: vi.fn(async () => ({ id: 'batch' })),
}))
vi.mock('@/features/resume/lib/resume-library', () => ({ loadResumeDocument: vi.fn() }))
vi.mock('@/features/resume/lib/pdf', () => ({ extractTextFromFile: vi.fn(async () => ({ text: '' })) }))
vi.mock('./website-experience-storage', () => ({ loadExperiences: vi.fn(async () => ({ items: [], confirmed: false })), saveExperiences: vi.fn() }))

let root: Root
let host: HTMLDivElement
beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(loadWebsiteProfile).mockReset().mockResolvedValue({})
  vi.mocked(extensionRequest).mockReset().mockResolvedValue(null)
  vi.mocked(loadExperiences).mockResolvedValue({ items: [], confirmed: false })
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  Object.defineProperty(HTMLDialogElement.prototype, 'showModal', { configurable: true, value: function (this: HTMLDialogElement) { this.open = true } })
  host = document.createElement('div'); document.body.append(host); root = createRoot(host)
})

const job = (extra: Partial<Draft> = {}): Draft => ({ id: crypto.randomUUID(), company: '示例公司', role: '前端', sourceUrl: 'https://example.com/jobs/1', recipient: '', subject: '', body: '', sourceConfirmed: false, ...extra })
const submit = () => [...host.querySelectorAll('button')].find(button => button.textContent === '发送到扩展')!
const withJob = (draft: Draft, attachment: File | null = new File(['resume'], 'resume.txt')) => root.render(createElement(WebsiteAutofillDialog, { drafts: [draft], attachment, onClose: () => {} }))

it('只要求附件和岗位入口，基本资料留空也能交接；未核对经历不发送', async () => {
  const experiences = [{ id: 'exp', kind: 'work' as const, organization: '公司', title: '前端', start: '2023-01', end: '2024-01', description: '' }]
  vi.mocked(loadExperiences).mockResolvedValue({ items: experiences, confirmed: false })
  await act(async () => withJob(job()))
  expect(inputFor('姓名').required).toBe(false)
  expect(inputFor('姓名').parentElement!.textContent).toContain('选填')
  expect(submit().disabled).toBe(false)
  await act(async () => submit().click())
  expect(makeWebsiteBatch).toHaveBeenCalledWith(expect.any(Array), {}, expect.any(Object), expect.any(File), [])
  expect(extensionRequest).toHaveBeenCalledWith('stage', { id: 'batch' })
  expect(host.textContent).toContain('下一步：点击浏览器工具栏')
})

it('缺附件时解释原因，并能在窗口内直接选择简历', async () => {
  await act(async () => withJob(job(), null))
  expect(submit().disabled).toBe(true)
  expect(host.querySelector('#website-blocker')!.textContent).toContain('请选择 5 MB')
  const input = host.querySelector<HTMLInputElement>('input[type=file]')!
  const attachment = new File(['resume'], 'selected.txt')
  Object.defineProperty(input, 'files', { configurable: true, value: [attachment] })
  await act(async () => input.dispatchEvent(new Event('change', { bubbles: true })))
  expect(host.textContent).toContain('selected.txt')
  expect(submit().disabled).toBe(false)
  await act(async () => submit().click())
  expect(makeWebsiteBatch).toHaveBeenCalledWith(expect.any(Array), {}, expect.any(Object), attachment, [])
})

it('多个入口未选择前不能交接，选择后恢复按钮', async () => {
  const draft = job()
  draft.extraction = { url: draft.sourceUrl, company: draft.company, role: draft.role, title: '', notes: [], emails: [], recommendedEmail: '', links: ['a', 'b'].map(path => ({ kind: 'apply', label: path, sourceUrl: draft.sourceUrl, url: `https://example.com/${path}` })) }
  await act(async () => withJob(draft))
  expect(submit().disabled).toBe(true)
  expect(host.querySelector('#website-blocker')!.textContent).toContain('选择申请入口')
  const select = host.querySelector<HTMLSelectElement>('select[aria-label="示例公司 申请入口"]')!
  expect(select.required).toBe(true)
  await act(async () => { select.value = 'https://example.com/a'; select.dispatchEvent(new Event('change', { bubbles: true })) })
  expect(submit().disabled).toBe(false)
})

it('格式错误和扩展旧任务会明确说明，不能重复交接覆盖', async () => {
  await act(async () => withJob(job()))
  await type(inputFor('邮箱'), 'invalid')
  expect(submit().disabled).toBe(true)
  expect(inputFor('邮箱').getAttribute('aria-invalid')).toBe('true')
  expect(host.querySelector('#website-blocker')!.textContent).toContain('邮箱格式')
  await type(inputFor('邮箱'), '')
  expect(submit().disabled).toBe(false)
  vi.useFakeTimers()
  vi.mocked(extensionRequest).mockResolvedValue({ id: 'old', createdAt: 0, updatedAt: 0, running: false, profile: {}, answers: [], attachmentName: 'old.txt', jobs: [{ id: 'old-job', company: '旧公司', role: '前端', url: 'https://example.com/apply', status: 'pending' }] } satisfies WebsiteSnapshot)
  // Re-mount to check the initial snapshot, without relying on the real interval.
  await act(async () => root.unmount())
  root = createRoot(host)
  await act(async () => withJob(job()))
  expect(submit().disabled).toBe(true)
  expect(host.querySelector('#website-blocker')!.textContent).toContain('未结束的任务')
})
afterEach(async () => { await act(async () => root.unmount()); host.remove(); Reflect.deleteProperty(HTMLDialogElement.prototype, 'showModal'); vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.useRealTimers() })
const mount = () => root.render(createElement(StrictMode, null, createElement(WebsiteAutofillDialog, { drafts: [], attachment: null, onClose: () => {} })))
const inputFor = (text: string) => [...host.querySelectorAll('label')].find(label => label.firstChild?.textContent === text)!.querySelector('input')!
async function type(input: HTMLInputElement, value: string) {
  await act(async () => {
    input.focus()
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, value)
    input.dispatchEvent(new Event('input', { bubbles: true }))
  })
}

it('基本资料可以连续编辑、删除并切换字段，渲染后保留输入', async () => {
  await act(async () => mount())
  for (const [key, label] of Object.entries(PROFILE_LABELS)) {
    const value = key === 'email' ? 'lin@example.com' : key === 'phone' ? '13800138000' : key === 'name' ? '林同学' : '测试资料'
    const input = inputFor(label)
    for (let end = 1; end <= value.length; end++) {
      await type(input, value.slice(0, end))
      expect(input.value).toBe(value.slice(0, end))
    }
    await type(input, '')
    expect(input.value).toBe('')
    await type(input, value)
  }
  await act(async () => mount())
  expect(inputFor('姓名').value).toBe('林同学')
  expect(inputFor('邮箱').value).toBe('lin@example.com')
})

it('资料异步读完后不覆盖用户已输入的字段', async () => {
  let resolve!: (profile: { name: string }) => void
  const pending = new Promise<{ name: string }>(done => { resolve = done })
  vi.mocked(loadWebsiteProfile).mockReturnValueOnce(pending).mockReturnValueOnce(pending)
  await act(async () => mount())
  await type(inputFor('姓名'), '新姓名')
  await type(inputFor('邮箱'), 'removed@example.com')
  await type(inputFor('邮箱'), '')
  await act(async () => resolve({ name: '旧姓名' }))
  expect(inputFor('姓名').value).toBe('新姓名')
  expect(inputFor('邮箱').value).toBe('')
  expect(extensionRequest).toHaveBeenCalled()
})

it('新增经历填写名称后仍保持展开，可继续编辑其他字段', async () => {
  await act(async () => mount())
  await act(async () => [...host.querySelectorAll('button')].find(button => button.textContent === '添加一段经历')!.click())
  const organization = inputFor('学校 / 公司 / 项目名称')
  expect(organization.closest('details')!.open).toBe(true)
  await type(organization, '甲')
  expect(organization.closest('details')!.open).toBe(true)
  await type(organization, '甲公司')
  await type(inputFor('专业 / 职位 / 项目角色'), '前端开发')
  expect(organization.value).toBe('甲公司')
  expect(inputFor('专业 / 职位 / 项目角色').value).toBe('前端开发')
})

it('扩展延迟返回旧任务和定时刷新都不覆盖正在校对的资料', async () => {
  vi.useFakeTimers()
  let resolve!: (snapshot: WebsiteSnapshot | null) => void
  const pending = new Promise<WebsiteSnapshot | null>(done => { resolve = done })
  vi.mocked(extensionRequest).mockReturnValueOnce(pending).mockReturnValueOnce(pending)
  await act(async () => mount())
  await type(inputFor('姓名'), '本次姓名')
  const snapshot = { id: crypto.randomUUID(), createdAt: 0, updatedAt: 0, running: false, jobs: [], answers: [], attachmentName: 'old.txt', profile: { name: '上一批姓名' } } satisfies WebsiteSnapshot
  await act(async () => resolve(snapshot))
  expect(inputFor('姓名').value).toBe('本次姓名')
  vi.mocked(extensionRequest).mockResolvedValueOnce(snapshot)
  await act(async () => { await vi.advanceTimersByTimeAsync(4000) })
  expect(inputFor('姓名').value).toBe('本次姓名')
  expect(document.activeElement).toBe(inputFor('姓名'))
})
