import { createResumePdf, type ResumePdfArtifact } from './resume-pdf'
import { editOriginalPdf } from './original-pdf'
import type { ResumeTemplateId } from '@/domain/resume-template'
import type { ResumePhoto } from '@/domain/resume-photo'
import { sourceResumePhotos } from './source-resume-photos'

export async function createResumePdfRevision(text: string, sourceFile: string, template: ResumeTemplateId, original?: File, baseText = text, photo?: ResumePhoto | null): Promise<ResumePdfArtifact> {
  if (template !== 'original') {
    if (photo === undefined && original) {
      const images = await sourceResumePhotos(original)
      if (images.length > 1) throw new Error('原文件有多张图片，请在简历检查的“排版与照片”中选择照片后保存，再用于投递。')
      photo = images[0]
    }
    return createResumePdf(text, sourceFile, undefined, template, photo)
  }
  if (!original) return Promise.reject(new Error('原文件尚未读取，请稍后重试。'))
  return editOriginalPdf(original, baseText, text).then(artifact => ({ ...artifact, photo }))
}
