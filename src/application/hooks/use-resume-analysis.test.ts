import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { AppNavigation, UseResumeWorkspace } from '@/application/types'
import type { ResumeReviewSubmission } from '@/domain/resume-review'
import type { ResumeAnalysis } from '@/domain/resume-schema'
import type { ResumeDocument } from '@/features/resume/lib/resume-library'
import type { SavedRecord } from '@/lib/storage'

const persistence = vi.hoisted(() => ({
  loadRecord: vi.fn(), listRecords: vi.fn(), saveRecord: vi.fn(), deleteRecord: vi.fn(), updateRecordDiagnosis: vi.fn(),
}))
const library = vi.hoisted(() => ({
  updateResumeDocument: vi.fn(), setCurrentResumeDocument: vi.fn(), importResumeDocument: vi.fn(),
  deleteResumeDocument: vi.fn(), listResumeDocuments: vi.fn(),
  loadResumeDocument: vi.fn(), saveResumeRevisionDraft: vi.fn(), resumeDocumentForRecord: vi.fn(),
}))
const preparation = vi.hoisted(() => ({ prepareJobResume: vi.fn() }))
const revision = vi.hoisted(() => ({ createResumeRevision: vi.fn(), downloadResumeFile: vi.fn() }))

// Exercise the hook's asynchronous orchestration with explicit input snapshots.
// Rendering is not needed to verify which saved record receives the results.
vi.mock('react', () => ({ useCallback: <T>(callback: T) => callback, useState: <T>(initial: T) => [initial, vi.fn()] }))
vi.mock('@/lib/storage', async (importOriginal) => ({ ...await importOriginal<typeof import('@/lib/storage')>(), ...persistence }))
vi.mock('@/features/resume/lib/resume-library', () => library)
vi.mock('@/lib/settings', () => ({ getLlmSettings: () => null }))
vi.mock('@/features/resume/lib/job-preparation', () => preparation)
vi.mock('@/features/resume/lib/resume-revision', () => revision)

import { newRecordId } from '@/lib/storage'
import { useResumeAnalysis } from './use-resume-analysis'

const submission: ResumeReviewSubmission = {
  rawText: '张三\n项目经历\n使用 React 开发订单管理系统', analysisGoal: 'overall', jobDescription: '使用 React 开发管理后台',
  reviewedCandidates: [{ content: '使用 React 开发订单管理系统', sourceSection: '项目经历', lineNumber: 3 }],
}
const analysis: ResumeAnalysis = {
  ...submission, candidate: '张三', role: '前端工程师', sourceFile: '简历.pdf', summary: '准备前端项目实践',
  jobContext: { applicationId: 'job-a', company: '甲公司', role: '前端工程师', sourceUrl: 'https://example.com/job-a', resumeVersion: 'same-file-bytes', resumeUpdatedAt: 1000 },
  claims: [{ id: 'shared-claim-id', content: '使用 React 开发订单管理系统', title: '订单管理系统', category: 'responsibility', role: '前端工程师', sourceSection: '项目经历', capability: '前端开发', masteryPoints: [{ point: '说明个人职责', dimension: 'practice', importance: 'high' }], initialQuestion: '具体负责哪些功能？', initialIntent: '', trapPoints: [], testPriority: 'high' }],
}
const oldRecord: SavedRecord = {
  id: newRecordId(analysis), analysis,
  sessions: { 'shared-claim-id': [{ id: 'shared-claim-id:v1', claimContent: analysis.claims[0].content, claimAnalysis: null, finalResult: null, status: 'in_progress', version: 1, rounds: [] }] },
  preparedClaimIds: ['shared-claim-id'], masteredBlindSpotIds: ['prior-job-blind-spot'], claimPriorityOverrides: { 'shared-claim-id': 'low' }, updatedAt: 1000,
}
const document = (changes: Partial<ResumeDocument> = {}): ResumeDocument => ({
  id: 'resume-document:job:a', sourceFile: '简历.pdf', extracted: { text: submission.rawText, charCount: submission.rawText.length, pageCount: 1 },
  demo: false, updatedAt: 1000, jobContext: analysis.jobContext, review: submission, ...changes,
})
const workspace = (changes: Partial<UseResumeWorkspace> = {}): UseResumeWorkspace => ({
  envConfigured: true, clientConfigured: false, refreshClientLlm: vi.fn(),
  analysis: oldRecord.analysis, setAnalysis: vi.fn(), pendingExtracted: { ...document(), documentId: document().id, initialReview: submission }, setPendingExtracted: vi.fn(),
  selectedIndex: 0, setSelectedIndex: vi.fn(), sessions: oldRecord.sessions, setSessions: vi.fn(),
  preparedClaimIds: oldRecord.preparedClaimIds, setPreparedClaimIds: vi.fn(), masteredBlindSpotIds: oldRecord.masteredBlindSpotIds, setMasteredBlindSpotIds: vi.fn(),
  knowledgeItems: [], setKnowledgeItems: vi.fn(), dismissedKnowledgeItemIds: [], setDismissedKnowledgeItemIds: vi.fn(),
  recordId: oldRecord.id, setRecordId: vi.fn(), recovering: false, recoveredFromStorage: true, setRecoveredFromStorage: vi.fn(),
  savedDocuments: [], setSavedDocuments: vi.fn(), savedRecords: [oldRecord], setSavedRecords: vi.fn(), loadingRecords: false,
  toast: '', setToast: vi.fn(), showToast: vi.fn(), error: null, setError: vi.fn(), selected: analysis.claims[0], completedClaimCount: 0,
  claimPriorityOverrides: oldRecord.claimPriorityOverrides!, setClaimPriorityOverrides: vi.fn(), refreshSavedRecords: vi.fn(), handleSessionSaved: vi.fn(),
  ...changes,
})
const navigation = (): AppNavigation => ({ push: vi.fn(), replace: vi.fn() })
const fetchMock = vi.fn()

beforeEach(() => {
  vi.clearAllMocks()
  persistence.loadRecord.mockResolvedValue(oldRecord)
  persistence.listRecords.mockResolvedValue([oldRecord])
  persistence.saveRecord.mockResolvedValue(undefined)
  library.updateResumeDocument.mockResolvedValue(undefined)
  library.setCurrentResumeDocument.mockResolvedValue(undefined)
  fetchMock.mockResolvedValue({ ok: true, json: async () => analysis })
  vi.stubGlobal('fetch', fetchMock)
  vi.stubGlobal('window', { sessionStorage: { setItem: vi.fn(), getItem: vi.fn(), removeItem: vi.fn() } })
})
afterEach(() => { vi.unstubAllGlobals() })

describe('useResumeAnalysis resume revisions', () => {
  it('opens the saved new document and downloads its file without requesting analysis', async () => {
    const file = new File(['new docx'], '简历-修改稿.docx')
    const next = document({ id: 'resume-document:revision:new', revisionId: 'resume-document:revision:new', originalFile: file })
    revision.createResumeRevision.mockResolvedValueOnce(next)
    const ws = workspace()
    const nav = navigation()

    await useResumeAnalysis(ws, nav).saveRevision('修改后的正文')

    expect(revision.createResumeRevision).toHaveBeenCalledWith(document().id, '修改后的正文', submission.rawText)
    expect(ws.setPendingExtracted).toHaveBeenCalledWith(expect.objectContaining({ documentId: next.id, revisionId: next.id, autoDiagnose: false, hasAttachment: true }))
    expect(ws.setRecordId).toHaveBeenCalledWith(null)
    expect(revision.downloadResumeFile).toHaveBeenCalledWith(file)
    expect(nav.push).toHaveBeenCalledWith('review')
    expect(fetchMock).not.toHaveBeenCalled()
    expect(persistence.saveRecord).not.toHaveBeenCalled()
  })

  it('leaves the current review open if a revision cannot be saved', async () => {
    revision.createResumeRevision.mockRejectedValueOnce(new Error('原简历已更新'))
    const ws = workspace()
    const nav = navigation()

    await expect(useResumeAnalysis(ws, nav).saveRevision('修改后的正文')).rejects.toThrow('原简历已更新')

    expect(ws.setPendingExtracted).not.toHaveBeenCalled()
    expect(revision.downloadResumeFile).not.toHaveBeenCalled()
    expect(nav.push).not.toHaveBeenCalled()
  })

  it('never copies original interview sessions into a revision with the same text', async () => {
    const next = document({ revisionId: 'resume-document:revision:new' })
    const ws = workspace({ pendingExtracted: { ...next, documentId: next.id, initialReview: submission } })

    await useResumeAnalysis(ws, navigation()).handleConfirmText(submission, next.sourceFile)

    const saved = persistence.saveRecord.mock.calls[0][0] as SavedRecord
    expect(saved.analysis.revisionId).toBe(next.revisionId)
    expect(saved.id).not.toBe(oldRecord.id)
    expect(saved.sessions).toEqual({})
    expect(ws.setPreparedClaimIds).toHaveBeenCalledWith([])
    expect(ws.setMasteredBlindSpotIds).toHaveBeenCalledWith([])
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).not.toHaveProperty('revisionId')
  })
})

describe('useResumeAnalysis job handoff', () => {
  it('starts a different job without overwriting the prior record or copying its interview progress', async () => {
    const next = document({ id: 'resume-document:job:b', jobContext: { ...analysis.jobContext!, applicationId: 'job-b', company: '乙公司' } })
    const ws = workspace({ pendingExtracted: { ...next, documentId: next.id, initialReview: submission } })
    const nav = navigation()

    await useResumeAnalysis(ws, nav).handleConfirmText(submission, next.sourceFile)

    const saved = vi.mocked(persistence.saveRecord).mock.calls[0][0] as SavedRecord
    expect(saved.id).not.toBe(oldRecord.id)
    expect(saved.analysis.jobContext).toEqual(next.jobContext)
    expect(saved).toMatchObject({ sessions: {}, preparedClaimIds: [], masteredBlindSpotIds: [], claimPriorityOverrides: {} })
    expect(library.updateResumeDocument).toHaveBeenCalledWith(next.id, { recordId: saved.id, review: submission })
    expect(ws.setSessions).toHaveBeenCalledWith({})
    expect(ws.setRecordId).toHaveBeenCalledWith(saved.id)
    expect(nav.push).toHaveBeenCalledWith('workspace', 'audit')
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toMatchObject({ rawText: submission.rawText, jobDescription: submission.jobDescription, reviewedCandidates: submission.reviewedCandidates })
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).not.toHaveProperty('jobContext')
  })

  it('reopens identical job inputs and existing interviews without requesting model analysis', async () => {
    const ws = workspace()
    const nav = navigation()

    await useResumeAnalysis(ws, nav).handleConfirmText(submission, analysis.sourceFile)

    expect(fetchMock).not.toHaveBeenCalled()
    expect(persistence.saveRecord).not.toHaveBeenCalled()
    expect(ws.setRecordId).toHaveBeenCalledWith(oldRecord.id)
    expect(ws.setSessions).toHaveBeenCalledWith(oldRecord.sessions)
    expect(ws.setPreparedClaimIds).toHaveBeenCalledWith(oldRecord.preparedClaimIds)
    expect(ws.setMasteredBlindSpotIds).toHaveBeenCalledWith(oldRecord.masteredBlindSpotIds)
    expect(ws.setClaimPriorityOverrides).toHaveBeenCalledWith(oldRecord.claimPriorityOverrides)
    expect(library.updateResumeDocument).toHaveBeenCalledWith(document().id, { recordId: oldRecord.id, review: submission })
    expect(nav.push).toHaveBeenCalledWith('workspace', 'audit')
  })

  it('uses an explicit job document during immediate handoff even before workspace state rerenders', async () => {
    const next = document({ id: 'resume-document:job:b', jobContext: { ...analysis.jobContext!, applicationId: 'job-b', company: '乙公司' } })
    const ws = workspace() // still points to job A when the B action is clicked

    await useResumeAnalysis(ws, navigation()).handleConfirmText(submission, next.sourceFile, next)

    expect(persistence.loadRecord).not.toHaveBeenCalled()
    const saved = persistence.saveRecord.mock.calls[0][0] as SavedRecord
    expect(saved.analysis.jobContext?.applicationId).toBe('job-b')
    expect(saved.id).not.toBe(oldRecord.id)
    expect(saved.sessions).toEqual({})
    expect(library.updateResumeDocument).toHaveBeenCalledWith(next.id, { recordId: saved.id, review: submission })
  })

  it('creates a separate record when requirements change within the same application', async () => {
    const changed = { ...submission, jobDescription: '负责 Vue 组件库开发' }
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({ ...analysis, jobDescription: changed.jobDescription }) })
    const ws = workspace()

    await useResumeAnalysis(ws, navigation()).handleConfirmText(changed, analysis.sourceFile)

    const saved = persistence.saveRecord.mock.calls[0][0] as SavedRecord
    expect(saved.id).not.toBe(oldRecord.id)
    expect(saved.analysis.jobDescription).toBe(changed.jobDescription)
    expect(saved.sessions).toEqual({})
    expect(ws.setMasteredBlindSpotIds).toHaveBeenCalledWith([])
  })

  it('opens a saved job interview directly without another model request', async () => {
    const savedDocument = document({ recordId: oldRecord.id })
    preparation.prepareJobResume.mockResolvedValueOnce(savedDocument)
    const ws = workspace({ envConfigured: false })
    const onOpen = vi.fn()

    await useResumeAnalysis(ws, navigation()).openJobPreparation({
      job: { id: 'job-a', company: '甲公司', role: '前端工程师', sourceUrl: analysis.jobContext!.sourceUrl, jobDescription: submission.jobDescription },
      attachment: new File(['saved resume'], analysis.sourceFile),
    }, 'interview', onOpen)

    expect(onOpen).toHaveBeenCalledTimes(1)
    expect(fetchMock).not.toHaveBeenCalled()
    expect(ws.setAnalysis).toHaveBeenCalledWith(analysis)
    expect(ws.setSessions).toHaveBeenCalledWith(oldRecord.sessions)
    expect(library.setCurrentResumeDocument).toHaveBeenCalledWith(savedDocument.id)
  })
})
