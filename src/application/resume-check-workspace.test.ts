// @vitest-environment jsdom
import { act, createElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { ResumeCheckWorkspace } from './ResumeCheckWorkspace'
import type { ResumeDocument } from '@/features/resume/lib/resume-library'
import type { ResumeReviewView } from '@/features/resume/ResumeReviewView'
type ViewProps = Parameters<typeof ResumeReviewView>[0]
const state = vi.hoisted(() => ({ props: null as ViewProps | null, load: vi.fn(), select: vi.fn(), update: vi.fn(), draft: vi.fn(), revision: vi.fn(), download: vi.fn() }))
vi.mock('@/features/resume/ResumeReviewView', () => ({ ResumeReviewView: (props: ViewProps) => { state.props = props; return createElement('div', {}, props.documentPicker, props.sourceFile) } }))
vi.mock('@/features/resume/CreateResumeDialog', () => ({ CreateResumeDialog: (props: { source: ResumeDocument; onCreated: (value: ResumeDocument) => Promise<void> }) => createElement('button', { 'data-builder': props.source.id, onClick: () => props.onCreated({ ...props.source, id: 'resume-document:composed:new', sourceFile: '新简历.pdf', extracted: { text: '已有经历生成的简历', charCount: 9, pageCount: 1 } }) }, '生成简历') }))
vi.mock('@/features/workspace/WorkspaceSidebar', () => ({ WorkspaceSidebar: () => null }))
vi.mock('@/features/workspace/hooks/use-sidebar-collapsed', () => ({ useSidebarCollapsed: () => [false, vi.fn()] }))
vi.mock('@/features/settings/SettingsDialog', () => ({ SettingsDialog: () => null }))
vi.mock('@/features/resume/lib/resume-check-workspace', () => ({ loadResumeCheckWorkspace: state.load, selectResumeCheckDocument: state.select }))
vi.mock('@/features/resume/lib/resume-library', () => ({ updateResumeDocument: state.update, saveResumeRevisionDraft: state.draft, importResumeDocument: vi.fn() }))
vi.mock('@/features/resume/lib/resume-revision', () => ({ createResumeRevision: state.revision, downloadResumeFile: state.download }))
const review = { rawText: '普通简历正文', jobDescription: '', analysisGoal: 'overall' as const, reviewedCandidates: [] }
const documentA: ResumeDocument = { id: 'resume-document:a', sourceFile: 'A.txt', extracted: { text: review.rawText, charCount: 6, pageCount: 1 }, demo: false, updatedAt: 1, review }
const documentB = { ...documentA, id: 'resume-document:b', sourceFile: 'B.txt', review: { ...review, rawText: '另一份独立简历' } }
const props = { badges: { claimTotal: 0, highUntested: 0, testingActive: 0, testedDone: 0, knowledgeOpen: 0 }, envConfigured: false, clientConfigured: false, onClientChanged: vi.fn(), onNavigate: vi.fn(), onHome: vi.fn(), onPractice: vi.fn() }
let host: HTMLDivElement, root: Root
beforeEach(() => {
  vi.clearAllMocks(); state.props = null; vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  state.load.mockResolvedValue({ documents: [documentA, documentB], selected: documentA })
  state.select.mockResolvedValue(undefined); state.update.mockResolvedValue(undefined); state.draft.mockResolvedValue(undefined)
  host = document.createElement('div'); document.body.append(host); root = createRoot(host)
})
afterEach(async () => { await act(async () => root.unmount()); host.remove(); vi.unstubAllGlobals() })
async function mount() { await act(async () => root.render(createElement(ResumeCheckWorkspace, props))) }
it('普通检查显式传入自己的原文和结果，不带岗位上下文，也不自动调用模型', async () => {
  await mount()
  expect(state.props?.initialReview).toEqual(review)
  expect(state.props?.jobContext).toBeUndefined()
  expect(state.props?.autoDiagnose).toBe(false)
  await act(async () => state.props!.onSaveReview({ ...review, jobDescription: '用户在检查页自行填写的 JD' }))
  expect(state.update).toHaveBeenCalledWith(documentA.id, { review: expect.objectContaining({ jobDescription: '用户在检查页自行填写的 JD' }) })
})
it('切换简历后，旧文档的异步检查、草稿和新稿只保存回旧文档，不抢回当前选择', async () => {
  await mount()
  const oldView = state.props!
  const select = host.querySelector<HTMLSelectElement>('[aria-label="选择要检查的简历"]')!
  await act(async () => { select.value = documentB.id; select.dispatchEvent(new Event('change', { bubbles: true })) })
  const draft = { baseText: review.rawText, text: '只属于 A 的新稿' }
  const saved = { ...documentA, id: 'resume-document:revision:a', originalFile: new File(['pdf'], 'A-修改稿.pdf') }
  state.revision.mockResolvedValue(saved)
  await act(async () => { await oldView.onSaveReview(review); await oldView.onSaveRevisionDraft(draft); await oldView.onSaveRevision(draft.text) })
  expect(state.draft).toHaveBeenCalledWith(documentA.id, draft)
  expect(state.update).toHaveBeenLastCalledWith(documentA.id, { review })
  expect(state.props?.sourceFile).toBe(documentB.sourceFile)
  expect(state.props?.initialReview?.rawText).toBe('另一份独立简历')
  expect(state.select).toHaveBeenLastCalledWith(documentB)
  expect(state.download).toHaveBeenCalledWith(saved.originalFile)
})
it('新建打开资料与经历表单，确认生成后才切换文档，不再直接创建空白文本', async () => {
  await mount()
  await act(async () => host.querySelector<HTMLButtonElement>('[aria-label="新建简历"]')!.click())
  expect(state.props?.sourceFile).toBe('A.txt')
  expect(host.querySelector('[data-builder]')?.getAttribute('data-builder')).toBe(documentA.id)
  await act(async () => host.querySelector<HTMLButtonElement>('[data-builder]')!.click())
  expect(state.props?.sourceFile).toBe('新简历.pdf')
  expect(state.props?.extracted.text).toBe('已有经历生成的简历')
  expect(state.props?.initialReview?.jobDescription).toBe('')
})
