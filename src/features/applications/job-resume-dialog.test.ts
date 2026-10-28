// @vitest-environment jsdom
import { act, createElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { JobResumeDialog } from './JobResumeDialog'
import { generateJobResume, previewJobResume, saveJobResume, type TailoringSession } from './job-resume-tailoring'
import type { Draft } from './draft-state'
import type { ResumePdfArtifact } from '@/features/resume/lib/resume-pdf'
vi.mock('./job-resume-tailoring', () => ({ generateJobResume: vi.fn(), previewJobResume: vi.fn(), saveJobResume: vi.fn() }))
vi.mock('@/features/resume/PdfPages', () => ({ PdfPages: () => createElement('p', {}, '实际PDF预览') }))
const file = new File(['original'], 'original.txt')
const pdf = new File(['%PDF-test'], '示例公司-前端-投递版.pdf')
const draft: Draft = { id: crypto.randomUUID(), company: '', role: '', sourceUrl: '', recipient: 'hr@example.com', subject: '', body: '', sourceConfirmed: false, jobDescription: '示例公司 前端 负责页面开发' }
const session: TailoringSession = {
  sourceDocumentId: 'source', sourceFile: file.name, rawText: '林同学\n项目经历\n参与页面开发',
  sections: [{ id: 's0', title: '个人概况', kind: 'general', lines: ['林同学'] }, { id: 's1', title: '项目经历', kind: 'project', lines: ['参与页面开发'] }],
  plan: { company: '示例公司', role: '前端', sectionOrder: ['s0', 's1'], changes: [{ sectionId: 's1', lineIndex: 0, after: '参与开发业务页面', requirement: '负责页面开发', reason: '明确页面开发内容' }], highlights: [{ sectionId: 's1', lineIndex: 0 }], gaps: [] },
}
let host: HTMLDivElement; let root: Root
const onApply = vi.fn(); const onClose = vi.fn()
beforeEach(() => {
  vi.clearAllMocks(); vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  HTMLDialogElement.prototype.showModal = vi.fn()
  vi.mocked(generateJobResume).mockResolvedValue(session)
  vi.mocked(previewJobResume).mockImplementation(async (_session, text) => ({ file: pdf, text, inputText: text, sourceFile: file.name, pageCount: 1, pages: [] }))
  vi.mocked(saveJobResume).mockImplementation(async (_session, text, artifact) => ({ id: 'revision', sourceFile: artifact.file.name, originalFile: artifact.file, extracted: { text, charCount: text.length, pageCount: 1 }, demo: false, updatedAt: 10 }))
  onApply.mockResolvedValue(undefined)
  host = document.createElement('div'); document.body.append(host); root = createRoot(host)
})
afterEach(async () => { await act(async () => root.unmount()); host.remove(); vi.unstubAllGlobals() })
const button = (label: string) => [...host.querySelectorAll('button')].find(item => item.textContent === label)!
async function mount() { await act(async () => root.render(createElement(JobResumeDialog, { draft, file, person: '林同学', onApply, onClose }))) }
it('修改只生成一次，撤回后邮件引用原文；预览和确认复用同一 PDF 文件', async () => {
  await mount()
  expect(generateJobResume).toHaveBeenCalledOnce()
  const checkbox = host.querySelectorAll<HTMLInputElement>('input[type=checkbox]')[1]
  await act(async () => checkbox.click())
  const body = host.querySelector('section[aria-label="随附邮件"] textarea') as HTMLTextAreaElement
  expect(body.value).toContain('参与页面开发'); expect(body.value).not.toContain('参与开发业务页面')
  expect(generateJobResume).toHaveBeenCalledOnce()
  await act(async () => button('预览实际 PDF').click())
  expect(host.textContent).toContain('实际PDF预览')
  await act(async () => button('保存并用于这封邮件').click())
  expect(previewJobResume).toHaveBeenCalledOnce()
  const artifact = vi.mocked(saveJobResume).mock.calls[0][2] as ResumePdfArtifact
  expect(artifact.file).toBe(pdf)
  expect(onApply.mock.calls[0][0]).toMatchObject({ company: '示例公司', role: '前端', automatic: false })
  expect(onApply.mock.calls[0][1].attachment).toBe(pdf)
  expect(onApply.mock.calls[0][1].tailoredResume.sourceFile).toBe(file)
})
it('保存失败保留核对窗口和修改内容，不声称已经用于邮件', async () => {
  onApply.mockRejectedValue(new Error('浏览器存储写入失败'))
  await mount(); await act(async () => button('保存并用于这封邮件').click())
  expect(host.querySelector('[role=alert]')!.textContent).toContain('存储写入失败')
  expect(onClose).not.toHaveBeenCalled()
  expect((host.querySelector('textarea') as HTMLTextAreaElement).value).toBe('参与开发业务页面')
  onApply.mockResolvedValue(undefined)
  await act(async () => button('保存并用于这封邮件').click())
  expect(saveJobResume).toHaveBeenCalledOnce()
  expect(onApply).toHaveBeenCalledTimes(2)
})
it('手写邮件在修改简历后保留，用户可单独重新同步正文', async () => {
  await mount()
  const section = host.querySelector('section[aria-label="随附邮件"]')!
  const subject = section.querySelector('input')!
  const body = section.querySelector('textarea')!
  const input = async (element: HTMLInputElement | HTMLTextAreaElement, value: string) => {
    await act(async () => {
      Object.getOwnPropertyDescriptor(element instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype, 'value')!.set!.call(element, value)
      element.dispatchEvent(new Event('input', { bubbles: true }))
    })
  }
  await input(subject, '我的邮件主题')
  await input(body, '手写的求职邮件')
  await act(async () => host.querySelectorAll<HTMLInputElement>('input[type=checkbox]')[1].click())
  expect(subject.value).toBe('我的邮件主题')
  expect(body.value).toBe('手写的求职邮件')
  await act(async () => button('按当前简历更新正文').click())
  expect(subject.value).toBe('我的邮件主题')
  expect(body.value).toContain('参与页面开发')
  expect(generateJobResume).toHaveBeenCalledOnce()
})
