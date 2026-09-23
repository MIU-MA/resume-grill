'use client'

import { del, get, keys, set, update } from 'idb-keyval'
import type { ExtractedText } from './pdf'
import type { ResumeReviewSubmission } from '@/application/types'
import { resumeContentKey } from './storage'

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
  review?: ResumeReviewSubmission
  recordId?: string
  updatedAt: number
}

export async function listResumeDocuments(): Promise<ResumeDocument[]> {
  const ids = (await keys()).filter((key): key is string => typeof key === 'string' && key.startsWith(PREFIX))
  const documents = await Promise.all(ids.map(id => get<ResumeDocument>(id)))
  return documents.filter((item): item is ResumeDocument => Boolean(item)).sort((a, b) => b.updatedAt - a.updatedAt)
}

export function loadResumeDocument(id: string): Promise<ResumeDocument | undefined> {
  return get<ResumeDocument>(id)
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
  return documents.flatMap(document => document.originalFile instanceof File ? [{
    id: document.id, name: document.originalFile.name, file: document.originalFile,
    updatedAt: document.originalFileUpdatedAt ?? document.updatedAt, current: document.id === currentId,
  }] : [])
}
