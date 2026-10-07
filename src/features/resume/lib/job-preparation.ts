'use client'

import { update } from 'idb-keyval'
import { extractTextFromFile } from './pdf'
import { loadResumeDocument, type ResumeDocument } from './resume-library'
import { extractResumeClaimCandidates } from '../../../domain/resume-structure'

import type { JobPreparationRequest } from '@/domain/job-preparation'

async function digest(value: ArrayBuffer): Promise<string> {
  return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', value)), byte => byte.toString(16).padStart(2, '0')).join('')
}

/** Freeze the exact attachment and job inputs without changing the general resume review. */
export async function prepareJobResume({ job, attachment, attachmentSource }: JobPreparationRequest): Promise<ResumeDocument> {
  const jobDescription = job.jobDescription.trim()
  if (!jobDescription) throw new Error('请先补充该岗位的职责或任职要求。')
  if (jobDescription.length > 12000) throw new Error('岗位要求请控制在 12000 字以内。')
  if (!(attachment instanceof File) || !attachment.size || attachment.size > 5 * 1024 * 1024 || !/\.(pdf|docx|txt)$/i.test(attachment.name)) {
    throw new Error('请选择 5 MB 以内的 PDF、DOCX 或 TXT 简历原文件。')
  }
  const resumeVersion = await digest(await attachment.arrayBuffer())
  const identity = JSON.stringify([job.id, job.company.trim(), job.role.trim(), job.sourceUrl, jobDescription, attachment.name, resumeVersion])
  const id = `resume-document:job:${await digest(new TextEncoder().encode(identity).buffer)}`
  const existing = await loadResumeDocument(id)
  if (existing) return existing

  const source = attachmentSource ? await loadResumeDocument(attachmentSource.id) : undefined
  // The library can have a newer file under the same document id. Compare bytes,
  // not names or timestamps, before reusing its extracted text.
  const matchesSource = source?.originalFile instanceof File && await digest(await source.originalFile.arrayBuffer()) === resumeVersion
  const extracted = matchesSource ? source.extracted : await extractTextFromFile(attachment)
  const rawText = extracted.text.trim()
  if (!rawText) throw new Error('这份附件未读到简历正文，请更换可读取的原文件。')
  const created: ResumeDocument = {
    id, sourceFile: attachment.name, extracted, originalFile: attachment, demo: false,
    originalFileUpdatedAt: attachmentSource?.updatedAt ?? Date.now(), updatedAt: Date.now(),
    jobContext: {
      applicationId: job.id, company: job.company.trim(), role: job.role.trim(), sourceUrl: job.sourceUrl,
      resumeVersion, resumeDocumentId: matchesSource ? source.id : undefined,
      resumeUpdatedAt: attachmentSource?.updatedAt ?? Date.now(),
    },
    review: { rawText, analysisGoal: 'overall', reviewedCandidates: extractResumeClaimCandidates(rawText), jobDescription },
  }
  let saved = created
  await update<ResumeDocument>(id, current => { saved = current ?? created; return saved })
  return saved
}
