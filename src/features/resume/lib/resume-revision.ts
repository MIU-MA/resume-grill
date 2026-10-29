'use client'

import { set, update } from 'idb-keyval'
import { normalizeResumeDocumentText } from './resume-docx'
import type { ResumePdfArtifact } from './resume-pdf'
import { createResumePdfRevision } from './resume-pdf-revision'
import { loadResumeDocument, type ResumeDocument } from './resume-library'
import { extractResumeClaimCandidates } from '../../../domain/resume-structure'
import { resumeTemplateId, type ResumeTemplateId } from '@/domain/resume-template'
import { sameResumePhoto, type ResumePhoto } from '@/domain/resume-photo'

/** A confirmed revision gets its own file, review and practice identity. */
export async function createResumeRevision(sourceId: string, text: string, baseText: string, preview?: ResumePdfArtifact, options: { allowUnchanged?: boolean; template?: ResumeTemplateId; photo?: ResumePhoto | null } = {}): Promise<ResumeDocument> {
  const rawText = normalizeResumeDocumentText(text).trim()
  if (!rawText) throw new Error('新稿正文不能为空。')
  if (rawText.length > 20000) throw new Error('新稿请控制在 20000 字以内。')
  const source = await loadResumeDocument(sourceId)
  if (!source) throw new Error('原简历已被删除，请重新导入。')
  if ((source.review?.rawText ?? source.extracted.text).trim() !== baseText.trim()) throw new Error('原文已在其他页面更新，请重新打开后再保存新稿。')
  const template = resumeTemplateId(options.template ?? preview?.template ?? source.pdfTemplate)
  const photo = options.photo !== undefined ? options.photo : preview?.photo !== undefined ? preview.photo : source.photo
  if (!options.allowUnchanged && rawText === normalizeResumeDocumentText(baseText).trim() && template === resumeTemplateId(source.pdfTemplate) && sameResumePhoto(photo, source.photo)) throw new Error('还没有修改正文。')

  const pdf = preview?.inputText === text && preview.text === rawText && preview.sourceFile === source.sourceFile && resumeTemplateId(preview.template) === template && sameResumePhoto(preview.photo, photo)
    ? preview : await createResumePdfRevision(text, source.sourceFile, template, source.originalFile, baseText, photo)
  const file = pdf.file
  const revisionId = `resume-document:revision:${crypto.randomUUID()}`
  const resumeVersion = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', await file.arrayBuffer())), byte => byte.toString(16).padStart(2, '0')).join('')
  const now = Date.now()
  const document: ResumeDocument = {
    id: revisionId, revisionId, revisionOf: sourceId, sourceFile: file.name, pdfTemplate: template, photo: pdf.photo ?? undefined,
    extracted: { text: rawText, charCount: rawText.length, pageCount: pdf.pageCount },
    originalFile: file, originalFileUpdatedAt: now, demo: source.demo,
    jobContext: source.jobContext ? { ...source.jobContext, resumeVersion, resumeDocumentId: revisionId, resumeUpdatedAt: now } : undefined,
    review: {
      rawText, analysisGoal: source.review?.analysisGoal ?? 'overall',
      jobDescription: source.review?.jobDescription ?? '',
      reviewedCandidates: extractResumeClaimCandidates(rawText),
    },
    updatedAt: now,
  }
  // Recheck after generating the attachment: a concurrent autosave must not be lost.
  const latest = await loadResumeDocument(sourceId)
  if (!latest || (latest.review?.rawText ?? latest.extracted.text).trim() !== baseText.trim()) throw new Error('原简历已更新，请重新打开后再保存新稿。')
  await set(document.id, document)
  // Cleanup is best-effort after durable creation; never hide a saved new file.
  await update<ResumeDocument | undefined>(sourceId, current => {
    if (!current || current.revisionDraft?.text !== text || current.revisionDraft.baseText !== baseText || resumeTemplateId(current.revisionDraft.template ?? current.pdfTemplate) !== template || !sameResumePhoto(current.revisionDraft.photo === undefined ? current.photo : current.revisionDraft.photo, photo)) return current
    return { ...current, revisionDraft: undefined }
  }).catch(() => undefined)
  return document
}

export function downloadResumeFile(file: File): void {
  const url = URL.createObjectURL(file)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = file.name
  anchor.style.display = 'none'
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}
