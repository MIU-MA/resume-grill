import { createResumePdf, type ResumePdfArtifact } from './resume-pdf'
import { editOriginalPdf } from './original-pdf'
import type { ResumeTemplateId } from '@/domain/resume-template'
import type { ResumePhoto } from '@/domain/resume-photo'

export function createResumePdfRevision(text: string, sourceFile: string, template: ResumeTemplateId, original?: File, baseText = text, photo?: ResumePhoto | null): Promise<ResumePdfArtifact> {
  if (template !== 'original') return createResumePdf(text, sourceFile, undefined, template, photo)
  if (!original) return Promise.reject(new Error('原文件尚未读取，请稍后重试。'))
  return editOriginalPdf(original, baseText, text).then(artifact => ({ ...artifact, photo }))
}
