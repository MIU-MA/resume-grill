// @vitest-environment jsdom
import { act, createElement } from 'react'
import { createRoot } from 'react-dom/client'
import { beforeEach, afterEach, expect, it, vi } from 'vitest'
import { BossWorkbench } from './BossWorkbench'
import { bossRequest } from './lib/boss-client'
import { loadBossWorkspace, saveBossWorkspace } from './lib/boss-workspace-storage'
import { prepareBossApplications, bossPreparationSchema } from './lib/boss-preparation'
import { listResumeDocuments } from '@/features/resume/lib/resume-library'
import { renderResumePdfImages } from '@/features/resume/lib/pdf-images'
vi.mock('@/features/resume/lib/pdf-images', () => ({ renderResumePdfImages: vi.fn(async () => []) }))
vi.mock('./lib/boss-images', () => ({ describeBossImages: vi.fn(async (files: File[]) => files.map(file => ({ name: file.name, type: file.type, size: file.size, width: 100, height: 200, sha256: 'a'.repeat(64) }))) }))
vi.mock('@/features/resume/lib/resume-library', () => ({ listResumeDocuments: vi.fn(async () => [{ id: 'resume', sourceFile: '已有简历.pdf', updatedAt: 1, extracted: { text: '使用 React TypeScript 完成全栈开发项目。' } }]) }))
vi.mock('./lib/boss-client', () => ({ restoreBossConnection: () => ({ origin: 'http://127.0.0.1:4327', token: 'a'.repeat(48) }), bossRequest: vi.fn(), parseBossConnection: vi.fn(), rememberBossConnection: vi.fn() }))
vi.mock('./lib/boss-workspace-storage', () => ({ loadBossWorkspace: vi.fn(async () => undefined), saveBossWorkspace: vi.fn(async () => undefined) }))
const jobs = [{ title: '全栈开发', company: '演示公司', salary: '', url: 'https://www.zhipin.com/job_detail/test.html', description: 'React TypeScript' }]
let host: HTMLDivElement, root: ReturnType<typeof createRoot>
beforeEach(() => {
  vi.clearAllMocks()
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  vi.stubGlobal('URL', Object.assign(URL, { createObjectURL: vi.fn(() => 'blob:test'), revokeObjectURL: vi.fn() }))
  vi.mocked(loadBossWorkspace).mockResolvedValue(undefined)
  vi.mocked(bossRequest).mockImplementation(async (_connection, path, body) => {
    if (path === '/status') return { ready: true, phase: 'connected', tabs: [], error: '' }
    if (path === '/jobs') return { readId: 'read', jobs }
    if (path === '/prepare') return prepareBossApplications(jobs, bossPreparationSchema.parse(body))
    return { ok: true }
  })
  host = document.createElement('div'); document.body.append(host); root = createRoot(host)
})
afterEach(async () => { await act(async () => root.unmount()); host.remove(); vi.unstubAllGlobals() })
const button = (name: string) => [...host.querySelectorAll('button')].find(item => item.textContent === name)!
async function input(element: HTMLInputElement | HTMLTextAreaElement, value: string) {
  await act(async () => { Object.getOwnPropertyDescriptor(element.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype, 'value')!.set!.call(element, value); element.dispatchEvent(new Event('input', { bubbles: true })) })
}
it('复用已有简历，读取并准备岗位，逐条修改后保存；不调用发送或上传', async () => {
  await act(async () => root.render(createElement(BossWorkbench)))
  expect(host.textContent).toContain('已有简历.pdf')
  await input(host.querySelector<HTMLInputElement>('input[placeholder^="例如"]')!, '全栈')
  await act(async () => button('读取岗位').click())
  await act(async () => button('准备投递').click())
  const text = host.querySelector('textarea')!
  expect(text.value).toContain('使用 React TypeScript 完成全栈开发项目')
  await input(text, '手动修改的招呼语')
  await act(async () => button('保存草稿').click())
  expect(saveBossWorkspace).toHaveBeenCalledWith(expect.objectContaining({ resumeId: 'resume', resumeUpdatedAt: 1, drafts: [expect.objectContaining({ greeting: '手动修改的招呼语' })] }))
  expect(vi.mocked(bossRequest).mock.calls.map(call => call[1])).toEqual(['/status', '/jobs', '/prepare'])
  expect(host.textContent).toContain('尚未发送，不计入投递记录')
})
it('简历更新后不恢复旧版本招呼语', async () => {
  vi.mocked(loadBossWorkspace).mockResolvedValue({ target: '全栈', resumeId: 'resume', resumeUpdatedAt: 0, resumeText: '旧内容', drafts: [{ ...jobs[0], greeting: '旧版本招呼语', evidence: '', status: 'needs-image', checks: [], steps: [] }], images: [], savedAt: 1 })
  await act(async () => root.render(createElement(BossWorkbench)))
  expect(host.textContent).toContain('简历版本已变化')
  expect(host.querySelector('textarea')).toBeNull()
})

it('选择原 PDF 后准备投递会自动带入图片，不要求用户手动截图上传', async () => {
  const pdf = new File(['original'], '已有简历.pdf', { type: 'application/pdf' })
  const image = new File(['png'], '已有简历-第1页.png', { type: 'image/png' })
  vi.mocked(listResumeDocuments).mockResolvedValueOnce([{ id: 'resume', sourceFile: pdf.name, updatedAt: 1, demo: false, originalFile: pdf, extracted: { text: '使用 React TypeScript 完成全栈开发项目。', charCount: 30, pageCount: 1 } }])
  vi.mocked(renderResumePdfImages).mockResolvedValueOnce([image])
  await act(async () => root.render(createElement(BossWorkbench)))
  await input(host.querySelector<HTMLInputElement>('input[placeholder^="例如"]')!, '全栈')
  await act(async () => button('读取岗位').click())
  await act(async () => button('准备投递').click())
  expect(renderResumePdfImages).toHaveBeenCalledWith(pdf)
  expect(bossRequest).toHaveBeenCalledWith(expect.anything(), '/prepare', expect.objectContaining({ images: [expect.objectContaining({ name: image.name, type: 'image/png' })] }))
  expect(host.textContent).toContain('已准备 1 个岗位、1 张简历图片')
  expect(vi.mocked(bossRequest).mock.calls.some(call => call[1].includes('/confirm'))).toBe(false)
})
