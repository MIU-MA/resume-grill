// @vitest-environment jsdom
import { act, createElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { JobResumeDialog } from './JobResumeDialog'
import { generateJobResume, previewJobResume, saveJobResume, type TailoringSession } from './job-resume-tailoring'
import type { Draft } from './draft-state'
import type { ResumePdfArtifact } from '@/features/resume/lib/resume-pdf'
import { useResumePdf } from '@/features/resume/hooks/use-resume-pdf'
vi.mock('./job-resume-tailoring', () => ({ generateJobResume: vi.fn(), previewJobResume: vi.fn(), saveJobResume: vi.fn() }))
vi.mock('@/features/resume/PdfPages', () => ({ PdfPages: ({ artifact, onSelect }: { artifact?: ResumePdfArtifact; onSelect?: (block: ResumePdfArtifact['pages'][number]['blocks'][number]) => void }) => createElement('button', { onClick: () => { const block = artifact?.pages[0]?.blocks.at(-1); if (block) onSelect?.(block) } }, '实际PDF预览') }))
vi.mock('@/features/resume/hooks/use-resume-pdf', () => ({ useResumePdf: vi.fn() }))
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
  vi.mocked(useResumePdf).mockReturnValue({ artifact: null, previous: null, loading: false, error: null, retry: vi.fn() })
  vi.mocked(generateJobResume).mockResolvedValue(session)
  vi.mocked(previewJobResume).mockImplementation(async (_session, text, _company, _role, template) => ({ file: pdf, text, inputText: text, sourceFile: file.name, pageCount: 1, pages: [], template }))
  vi.mocked(saveJobResume).mockImplementation(async (_session, text, artifact) => ({ id: 'revision', sourceFile: artifact.file.name, originalFile: artifact.file, extracted: { text, charCount: text.length, pageCount: 1 }, demo: false, updatedAt: 10 }))
  onApply.mockResolvedValue(undefined)
  host = document.createElement('div'); document.body.append(host); root = createRoot(host)
})
afterEach(async () => { await act(async () => root.unmount()); host.remove(); vi.unstubAllGlobals() })
const button = (label: string) => [...host.querySelectorAll('button')].find(item => item.textContent === label)!
async function mount(adopt = true, attachment = file) {
  await act(async () => root.render(createElement(JobResumeDialog, { draft, file: attachment, person: '林同学', onApply, onClose })))
  if (adopt) await act(async () => host.querySelector<HTMLInputElement>('input[aria-label="采用第 1 处修改"]')!.click())
}
it('上传 PDF 后默认展示原文件和未勾选的修改建议，模板是折叠的可选功能', async () => {
  const original = new File(['%PDF-demo'], '带照片的原简历.pdf', { type: 'application/pdf' })
  await mount(false, original)
  expect(host.querySelector('button[aria-pressed="true"]')!.textContent).toBe('原简历')
  expect(host.querySelector<HTMLInputElement>('input[aria-label="采用第 1 处修改"]')!.checked).toBe(false)
  expect(host.querySelector<HTMLDetailsElement>('.resume-template-details')!.open).toBe(false)
  expect(host.querySelector('.tailoring-source-note')!.textContent).toContain('点击原文直接修改')
  expect(previewJobResume).not.toHaveBeenCalled()
  await act(async () => button('保存并用于这封邮件').click())
  expect(vi.mocked(previewJobResume).mock.calls[0][1]).toBe(session.rawText)
  expect(vi.mocked(previewJobResume).mock.calls[0][4]).toBe('original')
  expect(generateJobResume).toHaveBeenCalledOnce()
})
it('修改只生成一次，撤回后邮件引用原文；预览和确认复用同一 PDF 文件', async () => {
  await mount()
  expect(generateJobResume).toHaveBeenCalledOnce()
  const checkbox = host.querySelector<HTMLInputElement>('input[aria-label="采用第 1 处修改"]')!
  await act(async () => checkbox.click())
  const body = host.querySelector('section[aria-label="随附邮件"] textarea') as HTMLTextAreaElement
  expect(body.value).toContain('参与页面开发'); expect(body.value).not.toContain('参与开发业务页面')
  expect(generateJobResume).toHaveBeenCalledOnce()
  await act(async () => button('PDF 预览').click())
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
  await act(async () => host.querySelector<HTMLInputElement>('input[aria-label="采用第 1 处修改"]')!.click())
  expect(subject.value).toBe('我的邮件主题')
  expect(body.value).toBe('手写的求职邮件')
  await act(async () => button('按当前简历更新正文').click())
  expect(subject.value).toBe('我的邮件主题')
  expect(body.value).toContain('参与页面开发')
  expect(generateJobResume).toHaveBeenCalledOnce()
})
it('切换整份简历和对照时保留修改选择，不重新请求模型', async () => {
  await mount()
  const checkbox = host.querySelector<HTMLInputElement>('input[aria-label="采用第 1 处修改"]')!
  await act(async () => checkbox.click())
  await act(async () => button('逐条修改').click())
  expect(host.querySelector('[aria-label="简历逐条编辑"]')!.textContent).toContain('参与页面开发')
  expect(host.querySelector('[aria-label="简历逐条编辑"]')!.textContent).not.toContain('参与开发业务页面')
  await act(async () => button('AI 建议').click())
  expect(host.querySelector<HTMLInputElement>('input[aria-label="采用第 1 处修改"]')!.checked).toBe(false)
  expect(generateJobResume).toHaveBeenCalledOnce()
  expect(previewJobResume).not.toHaveBeenCalled()
})
it('邮件正文尚未补全时仍可预览 PDF，更新简历后不沿用旧预览', async () => {
  await mount()
  const body = host.querySelector<HTMLTextAreaElement>('section[aria-label="随附邮件"] textarea')!
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!.call(body, '')
    body.dispatchEvent(new Event('input', { bubbles: true }))
  })
  await act(async () => button('PDF 预览').click())
  expect(host.textContent).toContain('实际PDF预览')
  expect(previewJobResume).toHaveBeenCalledOnce()
  await act(async () => button('AI 建议').click())
  await act(async () => host.querySelector<HTMLInputElement>('input[aria-label="采用第 1 处修改"]')!.click())
  await act(async () => button('PDF 预览').click())
  expect(previewJobResume).toHaveBeenCalledTimes(2)
  expect(vi.mocked(previewJobResume).mock.calls[1][1]).toContain('参与页面开发')
  expect(vi.mocked(previewJobResume).mock.calls[1][1]).not.toContain('参与开发业务页面')
  expect(generateJobResume).toHaveBeenCalledOnce()
})
it('切换模板直接更新 PDF，保存和邮件附件复用所选模板，不再次请求模型', async () => {
  await mount()
  const template = host.querySelector<HTMLButtonElement>('button[aria-label="使用侧栏标题模板"]')!
  await act(async () => template.click())
  expect(template.getAttribute('aria-pressed')).toBe('true')
  expect(vi.mocked(previewJobResume).mock.calls[0][4]).toBe('sidebar')
  expect(host.textContent).toContain('实际PDF预览')
  await act(async () => button('保存并用于这封邮件').click())
  expect(previewJobResume).toHaveBeenCalledOnce()
  expect(vi.mocked(saveJobResume).mock.calls[0][2].template).toBe('sidebar')
  expect(onApply.mock.calls[0][1].tailoredResume.template).toBe('sidebar')
  expect(generateJobResume).toHaveBeenCalledOnce()
})

it('新增中文模板可直接用于邮件，切回原模板时正文与修改选择保持不变', async () => {
  await mount()
  const checkbox = host.querySelector<HTMLInputElement>('input[aria-label="采用第 1 处修改"]')!
  await act(async () => checkbox.click())
  await act(async () => host.querySelector<HTMLButtonElement>('button[aria-label="使用中文 Typst模板"]')!.click())
  expect(vi.mocked(previewJobResume).mock.calls.at(-1)?.[4]).toBe('typst')
  expect(vi.mocked(previewJobResume).mock.calls.at(-1)?.[1]).toContain('参与页面开发')
  await act(async () => host.querySelector<HTMLButtonElement>('button[aria-label="使用经典居中模板"]')!.click())
  expect(vi.mocked(previewJobResume).mock.calls.at(-1)?.[4]).toBe('classic')
  await act(async () => host.querySelector<HTMLButtonElement>('button[aria-label="使用Meowth模板"]')!.click())
  await act(async () => button('保存并用于这封邮件').click())
  expect(vi.mocked(saveJobResume).mock.calls[0][2].template).toBe('meowth')
  expect(onApply.mock.calls[0][1].tailoredResume.template).toBe('meowth')
  expect(onApply.mock.calls[0][1].attachment).toBe(pdf)
  expect(generateJobResume).toHaveBeenCalledOnce()
})

async function edit(label: string, value: string) {
  const field = host.querySelector<HTMLTextAreaElement>(`textarea[aria-label="${label}"]`)!
  expect(field.disabled).toBe(false)
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!.call(field, value)
    field.dispatchEvent(new Event('input', { bubbles: true }))
  })
}
it('所有原文都可逐条改，包含没有 AI 建议的内容；单条还原不影响其余修改和邮件', async () => {
  const expanded = { ...session, rawText: session.rawText + '\n使用 CSS 调整样式', sections: [session.sections[0], { ...session.sections[1], lines: ['参与页面开发', '使用 CSS 调整样式'] }] }
  vi.mocked(generateJobResume).mockResolvedValue(expanded)
  await mount(false)
  await act(async () => button('逐条修改').click())
  await act(async () => host.querySelector<HTMLButtonElement>('[aria-label="编辑项目经历第 2 条"]')!.click())
  await edit('修改项目经历第 2 条', '手工补充移动端适配细节')
  await act(async () => host.querySelector<HTMLButtonElement>('[aria-label="编辑项目经历第 1 条"]')!.click())
  await edit('修改项目经历第 1 条', '我自己核对后的项目描述')
  await act(async () => host.querySelector<HTMLButtonElement>('[aria-label="编辑个人概况第 1 条"]')!.click())
  await edit('修改个人概况第 1 条', '用户更正的姓名')
  await act(async () => button('还原这条').click())
  expect(host.querySelector<HTMLTextAreaElement>('[aria-label="修改个人概况第 1 条"]')!.value).toBe('林同学')
  await act(async () => button('保存并用于这封邮件').click())
  const savedText = vi.mocked(previewJobResume).mock.calls.at(-1)![1]
  expect(savedText).toContain('手工补充移动端适配细节')
  expect(savedText).toContain('我自己核对后的项目描述')
  expect(savedText).toContain('林同学')
  expect(savedText).not.toContain('参与开发业务页面')
  expect(onApply.mock.calls[0][0].body).toContain('我自己核对后的项目描述')
  expect(generateJobResume).toHaveBeenCalledOnce()
})
it('模型还在分析或请求失败时能编辑，失败后手工修改仍可保存', async () => {
  let reject!: (error: Error) => void
  vi.mocked(generateJobResume).mockImplementation((_draft, _file, _source, _signal, onPrepared) => {
    onPrepared?.({ ...session, plan: { ...session.plan, changes: [], highlights: [] } })
    return new Promise((_resolve, fail) => { reject = fail })
  })
  await mount(false)
  await act(async () => button('逐条修改').click())
  await act(async () => host.querySelector<HTMLButtonElement>('[aria-label="编辑项目经历第 1 条"]')!.click())
  await edit('修改项目经历第 1 条', '分析期间的手工修改')
  await act(async () => reject(new Error('建议生成暂时失败')))
  expect(host.textContent).toContain('可以继续逐条修改原文')
  expect(host.querySelector<HTMLTextAreaElement>('[aria-label="修改项目经历第 1 条"]')!.value).toBe('分析期间的手工修改')
  await act(async () => button('保存并用于这封邮件').click())
  expect(vi.mocked(previewJobResume).mock.calls.at(-1)![1]).toContain('分析期间的手工修改')
  expect(generateJobResume).toHaveBeenCalledOnce()
})
it('点击原 PDF 的段落后在旁边编辑，原文件预览保持可见', async () => {
  const original = new File(['%PDF-demo'], '原简历.pdf', { type: 'application/pdf' })
  vi.mocked(useResumePdf).mockImplementation((text, sourceFile) => ({ artifact: { sourceFile, inputText: text, text, file: original, template: 'original', pageCount: 1, pages: [{ blocks: [{ start: session.rawText.indexOf('参与页面开发'), end: session.rawText.length, top: 80, left: 42, width: 300, height: 16, kind: 'body' }] }] }, previous: null, loading: false, error: null, retry: vi.fn() }))
  await mount(false, original)
  await act(async () => button('实际PDF预览').click())
  expect(host.querySelector('[aria-label="修改项目经历第 1 条"]')).not.toBeNull()
  expect(host.querySelector('button[aria-pressed="true"]')!.textContent).toBe('原简历')
  await edit('修改项目经历第 1 条', '直接在原文旁边修改')
  expect(host.textContent).toContain('实际PDF预览')
  expect(generateJobResume).toHaveBeenCalledOnce()
})
it('AI 结果晚到时保留已输入的原文修改，不自动采用同一位置的新建议', async () => {
  let finish!: (value: TailoringSession) => void
  vi.mocked(generateJobResume).mockImplementation((_draft, _file, _source, _signal, onPrepared) => {
    onPrepared?.({ ...session, plan: { ...session.plan, changes: [], highlights: [] } })
    return new Promise(resolve => { finish = resolve })
  })
  await mount(false)
  await act(async () => button('逐条修改').click())
  await act(async () => host.querySelector<HTMLButtonElement>('[aria-label="编辑项目经历第 1 条"]')!.click())
  await edit('修改项目经历第 1 条', '应当优先保留的手工描述')
  await act(async () => finish(session))
  expect(host.querySelector<HTMLTextAreaElement>('[aria-label="修改项目经历第 1 条"]')!.value).toBe('应当优先保留的手工描述')
  await act(async () => button('保存并用于这封邮件').click())
  expect(vi.mocked(previewJobResume).mock.calls.at(-1)![1]).toContain('应当优先保留的手工描述')
  expect(onApply.mock.calls[0][0].body).toContain('应当优先保留的手工描述')
  expect(generateJobResume).toHaveBeenCalledOnce()
})
