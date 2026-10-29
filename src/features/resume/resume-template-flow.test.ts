// @vitest-environment jsdom
import { act, createElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { ResumeReviewView } from './ResumeReviewView'
import type { ResumeTemplateId } from '@/domain/resume-template'

const calls = vi.hoisted(() => ({ onSave: vi.fn(), onDraft: vi.fn(), onReview: vi.fn(), pdf: vi.fn(), cancel: vi.fn() }))
vi.mock('./hooks/use-resume-pdf', () => ({ useResumePdf: (text: string, sourceFile: string, enabled: boolean, template: ResumeTemplateId, original?: File, baseText?: string) => {
  if (enabled) calls.pdf(template, original, baseText)
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
  await act(async () => host.querySelector<HTMLButtonElement>('[aria-label="更换简历模板"]')!.click())
  expect(host.querySelector('button[aria-label="预览侧栏标题模板"]')!.getAttribute('aria-pressed')).toBe('true')
  await act(async () => host.querySelector<HTMLButtonElement>('button[aria-label="预览蓝色线条模板"]')!.click())
  expect(calls.onDraft).not.toHaveBeenCalled()
  expect(host.querySelector('[aria-label="模板排版预览"]')!.textContent).toContain('modern.pdf')
  await act(async () => button('使用蓝色线条模板').click())
  expect(host.querySelector('[aria-label="新稿预览"]')).toBeNull()
  expect(calls.onDraft).toHaveBeenLastCalledWith({ baseText: text, text, template: 'modern' })
  await act(async () => button('保存 PDF 并下载').click())
  expect(calls.onSave).toHaveBeenCalledWith(text, expect.objectContaining({ template: 'modern' }))
  await act(async () => button('放弃修改').click())
  expect(calls.onDraft).toHaveBeenLastCalledWith(null)
  expect(host.querySelector('[aria-label="更换简历模板"]')!.textContent).toContain('侧栏标题')
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
  expect(host.querySelector('[aria-label="选择简历模板"]')).toBeNull()
  expect(button('原文件上修改').getAttribute('aria-pressed')).toBe('true')
  await act(async () => host.querySelector<HTMLButtonElement>('[aria-label="更换简历模板"]')!.click())
  await act(async () => host.querySelector<HTMLButtonElement>('button[aria-label="预览Meowth模板"]')!.click())
  await act(async () => button('使用Meowth模板').click())
  expect(calls.pdf).toHaveBeenLastCalledWith('meowth', file, text)
  await act(async () => button('原文件上修改').click())
  expect(calls.onDraft).toHaveBeenLastCalledWith({ baseText: text, text, template: 'original' })
  expect(load).toHaveBeenCalledOnce()
})
it('检查页复用逐条编辑和全文重写，只暂存新稿，不改写原检查结果的正文', async () => {
  await act(async () => root.render(createElement(ResumeReviewView, {
    sourceFile: '简历.txt', demo: false, extracted: { text, pageCount: 1, charCount: text.length },
    analyzing: false, error: null, envConfigured: false, clientConfigured: false,
    onClientChanged: vi.fn(), onConfirm: vi.fn(), onBack: vi.fn(), onApplications: vi.fn(),
    onSaveReview: calls.onReview, onSaveRevisionDraft: calls.onDraft, onSaveRevision: calls.onSave,
  })))
  const button = (label: string) => [...host.querySelectorAll('button')].find(item => item.textContent === label)!
  const type = async (label: string, value: string) => {
    await act(async () => {
      const field = host.querySelector<HTMLTextAreaElement>(`textarea[aria-label="${label}"]`)!
      Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!.call(field, value)
      field.dispatchEvent(new Event('input', { bubbles: true }))
    })
  }
  await act(async () => button('修改全文').click())
  await act(async () => host.querySelector<HTMLButtonElement>('[aria-label="编辑项目经历第 1 条"]')!.click())
  await type('修改项目经历第 1 条', '用户逐条补充的项目说明')
  expect(calls.onDraft).toHaveBeenLastCalledWith(expect.objectContaining({ baseText: text, text: '林同学\n项目经历\n用户逐条补充的项目说明' }))
  expect(calls.onReview.mock.calls.at(-1)?.[0].rawText).toBe(text)
  await act(async () => button('还原这条').click())
  expect(host.querySelector<HTMLTextAreaElement>('[aria-label="修改项目经历第 1 条"]')!.value).toBe('使用 React 开发订单页面')
  await act(async () => button('全文重写').click())
  await type('简历全文', '用户重新编写的整份简历')
  expect(calls.onDraft).toHaveBeenLastCalledWith(expect.objectContaining({ baseText: text, text: '用户重新编写的整份简历' }))
  await act(async () => button('保存 PDF 并下载').click())
  expect(calls.onSave).toHaveBeenCalledWith('用户重新编写的整份简历', expect.anything())
})
it('空白简历可以连续输入全文，不会输入第一个字后切走编辑框', async () => {
  await act(async () => root.render(createElement(ResumeReviewView, {
    sourceFile: '新简历.txt', demo: false, extracted: { text: '', pageCount: 1, charCount: 0 }, initialTab: 'raw',
    analyzing: false, error: null, envConfigured: false, clientConfigured: false,
    onClientChanged: vi.fn(), onConfirm: vi.fn(), onBack: vi.fn(), onApplications: vi.fn(),
    onSaveReview: calls.onReview, onSaveRevisionDraft: calls.onDraft, onSaveRevision: calls.onSave,
  })))
  const field = host.querySelector<HTMLTextAreaElement>('[aria-label="简历全文"]')!
  for (const value of ['林', '林同学\n项目经历\n用户自行编写的经历']) await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!.call(field, value)
    field.dispatchEvent(new Event('input', { bubbles: true }))
  })
  expect(host.querySelector('[aria-label="简历全文"]')).toBe(field)
  expect(field.value).toContain('用户自行编写的经历')
})
