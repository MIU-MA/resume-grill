import { beforeEach, expect, it, vi } from 'vitest'
import type { ResumeDocument } from './resume-library'

const values = vi.hoisted(() => new Map<string, unknown>())
vi.mock('idb-keyval', () => ({
  get: vi.fn(async (key: string) => values.get(key)), keys: vi.fn(async () => [...values.keys()]),
  set: vi.fn(async (key: string, value: unknown) => { values.set(key, value) }),
  update: vi.fn(async (key: string, callback: (value: unknown) => unknown) => { values.set(key, callback(values.get(key))) }), del: vi.fn(),
}))
import { loadResumeCheckWorkspace, selectResumeCheckDocument } from './resume-check-workspace'
import { importResumeDocument, listResumeDocuments } from './resume-library'

const general: ResumeDocument = { id: 'resume-document:general', sourceFile: '我的简历.pdf', extracted: { text: '我的简历原文', charCount: 6, pageCount: 1 }, demo: false, updatedAt: 1, review: { rawText: '我的简历原文', jobDescription: '', analysisGoal: 'overall', reviewedCandidates: [], diagnosis: { source: 'model', summary: '普通简历检查', strengths: [], issues: [], nextSteps: [] } } }
const job: ResumeDocument = { ...general, id: 'resume-document:job:a', updatedAt: 100, jobContext: { applicationId: 'a', company: '岗位公司', role: '岗位名称', sourceUrl: '', resumeVersion: 'hash', resumeUpdatedAt: 100 }, review: { ...general.review!, jobDescription: '仅投递岗位使用的 JD', diagnosis: { ...general.review!.diagnosis!, summary: '仅投递岗位使用的检查结果' } } }
beforeEach(() => { values.clear(); values.set(general.id, structuredClone(general)); values.set(job.id, structuredClone(job)); values.set('current-resume-document', job.id) })
it('独立检查不读取当前投递或面试选择，也不会选中更新时间更晚的岗位文档', async () => {
  values.set('resume-grill:diagnosis-document', job.id)
  const workspace = await loadResumeCheckWorkspace()
  expect(workspace.documents.map(document => document.id)).toEqual([general.id])
  expect(workspace.selected?.review?.jobDescription).toBe('')
  expect(workspace.selected?.review?.diagnosis?.summary).toBe('普通简历检查')
  expect(values.get('current-resume-document')).toBe(job.id)
})
it('检查选择单独恢复，拒绝把岗位文档设为普通检查目标', async () => {
  await selectResumeCheckDocument(general)
  await expect(selectResumeCheckDocument(job)).rejects.toThrow('岗位检查')
  expect((await loadResumeCheckWorkspace()).selected?.id).toBe(general.id)
  expect(values.get('current-resume-document')).toBe(job.id)
  expect(values.get(job.id)).toEqual(job)
})
it('内部投递编辑快照不出现在简历库，独立检查导入不改变全局投递选择', async () => {
  values.set('resume-document:tailoring-source:a', { ...job, id: 'resume-document:tailoring-source:a' })
  expect((await listResumeDocuments()).some(document => document.id.includes('tailoring-source:'))).toBe(false)
  await importResumeDocument({ text: '重新导入的简历', charCount: 8, pageCount: 1 }, '另一份.txt', false, undefined, { select: false })
  expect(values.get('current-resume-document')).toBe(job.id)
})
it('只有投递侧上传的简历也能检查：保留文件，隔离岗位 JD、结果和草稿，刷新不会覆盖检查修改', async () => {
  values.delete(general.id)
  const file = new File(['pdf-photo-bytes'], '我的简历.pdf', { type: 'application/pdf' })
  values.set(job.id, { ...job, originalFile: file, originalFileUpdatedAt: 10, revisionDraft: { baseText: '岗位原文', text: '岗位新稿' } })
  const workspace = await loadResumeCheckWorkspace()
  const copy = workspace.selected!
  expect(copy.originalFile).toBe(file)
  expect(copy.id).not.toBe(job.id)
  expect(copy.review?.jobDescription).toBe('')
  expect(copy.review?.diagnosis).toBeUndefined()
  expect(copy.jobContext).toBeUndefined()
  expect(copy.revisionDraft).toBeUndefined()
  values.set(copy.id, { ...copy, review: { ...copy.review!, jobDescription: '检查页手填的要求' } })
  await selectResumeCheckDocument(copy)
  expect((await loadResumeCheckWorkspace()).selected?.review?.jobDescription).toBe('检查页手填的要求')
  expect((values.get(job.id) as ResumeDocument).review?.jobDescription).toBe('仅投递岗位使用的 JD')
})
it('同内容普通简历缺少文件时，从投递侧恢复文件，不带入岗位检查结果', async () => {
  const file = new File(['picture'], '我的简历.pdf')
  values.set(job.id, { ...job, originalFile: file })
  const workspace = await loadResumeCheckWorkspace()
  expect(workspace.documents).toHaveLength(1)
  expect(workspace.selected?.originalFile).toBe(file)
  expect(workspace.selected?.review).toEqual(general.review)
})
