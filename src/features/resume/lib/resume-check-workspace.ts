'use client'

import { get, set, update } from 'idb-keyval'
import { listResumeDocuments, type ResumeDocument } from './resume-library'
import { listRecords, resumeContentKey } from '@/lib/storage'
import { extractResumeClaimCandidates } from '@/domain/resume-structure'

const CURRENT_CHECK_DOCUMENT = 'resume-grill:diagnosis-document'

export async function loadResumeCheckWorkspace() {
  const [all, id, records] = await Promise.all([listResumeDocuments({ includeInternal: true }), get<string>(CURRENT_CHECK_DOCUMENT), listRecords()])
  const documents = all.filter(document => !document.jobContext && !document.id.startsWith('resume-document:tailoring-source:'))
  // Reuse files, never job-specific JD, diagnosis, interview links or drafts.
  // A separate stable copy retains edits made later in the check workspace.
  const sources: ResumeDocument[] = [...all.filter(document => document.jobContext || document.id.startsWith('resume-document:tailoring-source:')),
    ...records.filter(record => !all.some(document => document.recordId === record.id)).map(record => ({
      id: `legacy-record:${record.id}`, sourceFile: record.analysis.sourceFile,
      extracted: { text: record.analysis.rawText, charCount: record.analysis.rawText.length, pageCount: 1 }, demo: false, updatedAt: record.updatedAt,
    } satisfies ResumeDocument))]
  const seen = new Set(documents.map(document => `${document.sourceFile}:${document.extracted.text}`))
  for (const source of sources) {
    const identity = `${source.sourceFile}:${source.extracted.text}`
    if (seen.has(identity)) {
      const index = documents.findIndex(document => `${document.sourceFile}:${document.extracted.text}` === identity)
      const target = documents[index]
      if (target && !target.originalFile && source.originalFile) {
        let recovered!: ResumeDocument
        await update<ResumeDocument>(target.id, current => {
          if (!current) throw new Error('简历已被删除，请刷新列表。')
          recovered = current.originalFile ? current : { ...current, originalFile: source.originalFile, originalFileUpdatedAt: source.originalFileUpdatedAt, photo: current.photo ?? source.photo }
          return recovered
        })
        documents[index] = recovered
      }
      continue
    }
    seen.add(identity)
    const copyId = `resume-document:check:${resumeContentKey(JSON.stringify([source.id, source.originalFileUpdatedAt, source.extracted.text]))}`
    let copy!: ResumeDocument
    await update<ResumeDocument | undefined>(copyId, existing => {
      copy = existing ?? {
        id: copyId, sourceFile: source.sourceFile, extracted: source.extracted, originalFile: source.originalFile,
        originalFileUpdatedAt: source.originalFileUpdatedAt, pdfTemplate: source.pdfTemplate, photo: source.photo, demo: source.demo, updatedAt: source.updatedAt,
        review: { rawText: source.extracted.text, analysisGoal: 'overall', jobDescription: '', reviewedCandidates: extractResumeClaimCandidates(source.extracted.text) },
      }
      return copy
    })
    documents.push(copy)
  }
  return { documents, selected: documents.find(document => document.id === id) ?? documents[0] ?? null }
}

export async function selectResumeCheckDocument(document: ResumeDocument) {
  if (document.jobContext || document.id.startsWith('resume-document:tailoring-source:')) throw new Error('请选择简历库中的普通简历；岗位检查请从对应投递记录打开。')
  await set(CURRENT_CHECK_DOCUMENT, document.id)
  return document
}

