'use client'

import { del, get, keys, set, update } from 'idb-keyval'
import type { ExtractedText } from './pdf'
import type { ResumeReviewSubmission } from '@/application/types'
import { resumeContentKey, type SavedRecord } from './storage'
import { extractResumeClaimCandidates } from './resume-structure'
import type { JobContext } from '@/domain/job-context'

// Keep source documents separate from generated interview records, including legacy ones.
const PREFIX = 'resume-document:'
const CURRENT_KEY = 'current-resume-document'

export type ResumeDocument = {
  id: string
  sourceFile: string
  extracted: ExtractedText
  originalFile?: File
  originalFileUpdatedAt?: number
  demo: boolean
  jobContext?: JobContext
  revisionOf?: string
  revisionId?: string
  revisionDraft?: ResumeRevisionDraft
  review?: ResumeReviewSubmission
  recordId?: string
  updatedAt: number
}

export type ResumeRevisionDraft = { baseText: string; text: string }

export function saveResumeRevisionDraft(id: string, draft: ResumeRevisionDraft | null): Promise<void> {
  return update<ResumeDocument>(id, existing => {
    if (!existing) throw new Error('这份简历已被删除，请重新导入。')
    if (draft && draft.baseText.trim() !== (existing.review?.rawText ?? existing.extracted.text).trim()) {
      throw new Error('原文已在其他页面更新，请重新打开简历后再修改。')
    }
    return { ...existing, revisionDraft: draft ?? undefined, updatedAt: Date.now() }
  })
}

export async function listResumeDocuments(): Promise<ResumeDocument[]> {
  const ids = (await keys()).filter((key): key is string => typeof key === 'string' && key.startsWith(PREFIX))
  const documents = await Promise.all(ids.map(id => get<ResumeDocument>(id)))
  return documents.filter((item): item is ResumeDocument => Boolean(item)).sort((a, b) => b.updatedAt - a.updatedAt)
}

export function loadResumeDocument(id: string): Promise<ResumeDocument | undefined> {
  return get<ResumeDocument>(id)
}

export async function resumeDocumentForRecord(record: SavedRecord): Promise<ResumeDocument> {
  const linked = (await listResumeDocuments()).find(document => document.recordId === record.id && document.review?.rawText === record.analysis.rawText && document.review.jobDescription === (record.analysis.jobDescription ?? ''))
  if (linked) return linked
  // Older practice records may predate the document library. Recover their text,
  // without inventing an original attachment or changing another resume document.
  const analysis = record.analysis
  const id = `resume-document:record:${resumeContentKey(record.id)}`
  const document: ResumeDocument = {
    id, sourceFile: analysis.sourceFile, demo: analysis.diagnosis?.source === 'demo',
    extracted: { text: analysis.rawText, charCount: analysis.rawText.length, pageCount: 1 },
    jobContext: analysis.jobContext, recordId: record.id, revisionId: analysis.revisionId,
    review: { rawText: analysis.rawText, analysisGoal: analysis.analysisGoal ?? 'overall', jobDescription: analysis.jobDescription ?? '', reviewedCandidates: analysis.reviewedCandidates ?? extractResumeClaimCandidates(analysis.rawText), diagnosis: analysis.diagnosis },
    updatedAt: Date.now(),
  }
  let saved = document
  await update<ResumeDocument>(id, existing => { saved = existing ?? document; return saved })
  return saved
}

export async function importResumeDocument(extracted: ExtractedText, sourceFile: string, demo: boolean, originalFile?: File): Promise<ResumeDocument> {
  const id = `${PREFIX}${resumeContentKey(extracted.text)}:${demo ? 'demo' : 'personal'}`
  let document!: ResumeDocument
  await update<ResumeDocument>(id, existing => {
    const sameInput = existing?.extracted.text === extracted.text
    document = {
      ...existing, id, sourceFile, extracted, demo,
      originalFile: originalFile ?? existing?.originalFile,
      originalFileUpdatedAt: originalFile ? Date.now() : existing?.originalFileUpdatedAt,
      // A changed extraction must not display a diagnosis from different text.
      review: sameInput ? existing?.review : undefined,
      updatedAt: Date.now(),
    }
    return document
  })
  await setCurrentResumeDocument(id)
  return document
}

export function updateResumeDocument(id: string, changes: Pick<Partial<ResumeDocument>, 'review' | 'recordId'>): Promise<void> {
  // Atomic updates keep review autosaves from overwriting a newly linked interview record.
  return update<ResumeDocument>(id, existing => {
    if (!existing) throw new Error('这份简历已被删除，请重新导入。')
    return { ...existing, ...changes, updatedAt: Date.now() }
  })
}

export function setCurrentResumeDocument(id: string | null): Promise<void> {
  return set(CURRENT_KEY, id)
}

export async function deleteResumeDocument(id: string): Promise<void> {
  await del(id)
  await update<string | null>(CURRENT_KEY, current => current === id ? null : current ?? null)
}

export async function listResumeAttachments(): Promise<Array<{ id: string; name: string; file: File; updatedAt: number; current: boolean }>> {
  const [documents, currentId] = await Promise.all([listResumeDocuments(), get<string>(CURRENT_KEY)])
  const currentDocument = documents.find(document => document.id === currentId)
  const seenVersions = new Set<string>()
  return documents.filter(document => {
    const context = document.jobContext
    if (!context) return true
    const original = documents.find(item => item.id === context.resumeDocumentId && !item.jobContext)
    if (original?.originalFile && original.originalFileUpdatedAt === context.resumeUpdatedAt) return false
    const version = `${context.resumeVersion}:${document.originalFile?.name}`
    if (seenVersions.has(version)) return false
    seenVersions.add(version)
    return true
  }).flatMap(document => document.originalFile instanceof File ? [{
    id: document.id, name: document.originalFile.name, file: document.originalFile,
    updatedAt: document.originalFileUpdatedAt ?? document.updatedAt,
    current: document.id === currentId || (document.id === currentDocument?.jobContext?.resumeDocumentId && document.originalFileUpdatedAt === currentDocument.jobContext.resumeUpdatedAt),
  }] : [])
}
