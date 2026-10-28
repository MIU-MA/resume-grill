// @vitest-environment jsdom
import { act, createElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { ResumeReviewView } from './ResumeReviewView'
import type { ResumeTemplateId } from '@/domain/resume-template'

const calls = vi.hoisted(() => ({ onSave: vi.fn(), onDraft: vi.fn(), onReview: vi.fn(), pdf: vi.fn(), cancel: vi.fn() }))
vi.mock('./hooks/use-resume-pdf', () => ({ useResumePdf: (text: string, sourceFile: string, _enabled: boolean, template: ResumeTemplateId, original?: File, baseText?: string) => {
  calls.pdf(template, original, baseText)
  return { artifact: { inputText: text, text, sourceFile, file: new File(['pdf'], `${template}.pdf`), pageCount: 1, pages: [], template }, previous: null, loading: false, error: null, retry: vi.fn() }
} }))
vi.mock('./hooks/use-resume-diagnosis', () => ({ useResumeDiagnosis: () => ({ report: null, loading: false, error: null, cancel: calls.cancel }) }))
vi.mock('./ResumeDiagnosisStep', () => ({ ResumeDiagnosisStep: () => null }))
vi.mock('./PdfPages', () => ({ PdfPages: ({ file }: { file: File }) => createElement('p', {}, file.name) }))
const text = '林同学\n项目经历\n使用 React 开发订单页面'
let host: HTMLDivElement; let root: Root
beforeEach(() => {
  vi.clearAllMocks(); vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  calls.onSave.mockResolvedValue(undefined); calls.onDraft.mockResolvedValue(undefined); calls.onReview.mockResolvedValue(undefined)
  host = document.createElement('div'); document.body.append(host); root = createRoot(host)
})
afterEach(async () => { await act(async () => root.unmount()); host.remove(); vi.unstubAllGlobals() })
it('普通简历只换模板也能预览、暂存并保存，原文不变', async () => {
  await act(async () => root.render(createElement(ResumeReviewView, {
    sourceFile: '简历.pdf', demo: true, extracted: { text, pageCount: 1, charCount: text.length },
    analyzing: false, error: null, envConfigured: false, clientConfigured: false,
    onClientChanged: vi.fn(), onConfirm: vi.fn(), onBack: vi.fn(), onApplications: vi.fn(),
    onSaveReview: calls.onReview, onSaveRevisionDraft: calls.onDraft, onSaveRevision: calls.onSave,
    initialPdfTemplate: 'sidebar',
  })))
  const button = (label: string) => [...host.querySelectorAll('button')].find(item => item.textContent === label)!
  await act(async () => button('修改全文').click())
  expect(host.querySelector('button[aria-label="使用侧栏标题模板"]')!.getAttribute('aria-pressed')).toBe('true')
  await act(async () => host.querySelector<HTMLButtonElement>('button[aria-label="使用蓝色线条模板"]')!.click())
  expect(host.querySelector('[aria-label="新稿预览"]')!.textContent).toContain('modern.pdf')
  expect(calls.onDraft).toHaveBeenLastCalledWith({ baseText: text, text, template: 'modern' })
  await act(async () => host.querySelector<HTMLButtonElement>('button[aria-label="关闭预览"]')!.click())
  await act(async () => button('保存 PDF 并下载').click())
  expect(calls.onSave).toHaveBeenCalledWith(text, expect.objectContaining({ template: 'modern' }))
  await act(async () => button('放弃修改').click())
  expect(calls.onDraft).toHaveBeenLastCalledWith(null)
  expect(host.querySelector('button[aria-label="使用侧栏标题模板"]')!.getAttribute('aria-pressed')).toBe('true')
})
it('已有原 PDF 时默认原位编辑并加载上传文件，只有主动选择模板才重新排版', async () => {
  const file = new File(['%PDF-original'], '原简历.pdf', { type: 'application/pdf' })
  const load = vi.fn(async () => file)
  await act(async () => root.render(createElement(ResumeReviewView, {
    sourceFile: file.name, demo: false, extracted: { text, pageCount: 1, charCount: text.length },
    analyzing: false, error: null, envConfigured: false, clientConfigured: false,
    onClientChanged: vi.fn(), onConfirm: vi.fn(), onBack: vi.fn(), onApplications: vi.fn(),
    onSaveReview: calls.onReview, onSaveRevisionDraft: calls.onDraft, onSaveRevision: calls.onSave,
    initialPdfTemplate: 'sidebar', onLoadOriginal: load,
  })))
  expect(calls.pdf).toHaveBeenLastCalledWith('original', file, text)
  const button = (label: string) => [...host.querySelectorAll('button')].find(item => item.textContent === label)!
  await act(async () => button('修改全文').click())
  expect(host.querySelector<HTMLDetailsElement>('.resume-template-details')!.open).toBe(false)
  expect(button('原文件上修改').getAttribute('aria-pressed')).toBe('true')
  await act(async () => host.querySelector<HTMLButtonElement>('button[aria-label="使用Meowth模板"]')!.click())
  expect(calls.pdf).toHaveBeenLastCalledWith('meowth', file, text)
  await act(async () => button('原文件上修改').click())
  expect(calls.onDraft).toHaveBeenLastCalledWith({ baseText: text, text, template: 'original' })
  expect(load).toHaveBeenCalledOnce()
})
