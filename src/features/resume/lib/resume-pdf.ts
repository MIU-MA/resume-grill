import { resumePdfSource } from './resume-pdf-offsets'
import { DEFAULT_RESUME_TEMPLATE, resumeTemplateId, type ResumeTemplateId } from '@/domain/resume-template'
import { embedResumeFont } from './resume-pdf-font'
import type { ResumePhoto } from '@/domain/resume-photo'
import { drawResumePhoto } from './resume-photo'
import { fitResumeToOnePage, type ResumePdfFit } from './resume-pdf-fit'
import { renderStandardResume } from './resume-pdf-standard'

export const RESUME_PAGE = { width: 595.28, height: 841.89, margin: 42 } as const
export type PdfTextBlock = { start: number; end: number; top: number; height: number; kind: 'name' | 'heading' | 'body' | 'blank'; fontSize?: number; left?: number; width?: number }
export type ResumePdfArtifact = {
  sourceFile: string
  inputText: string
  text: string
  file: File
  pageCount: number
  pages: Array<{ blocks: PdfTextBlock[]; width?: number; height?: number }>
  template?: ResumeTemplateId
  photo?: ResumePhoto | null
}

function fileName(source: string) {
  const basename = Array.from(source.split(/[\\/]/).at(-1) ?? '').filter(character => character.codePointAt(0)! >= 0x20).join('')
  const name = basename.replace(/\.[^.]*$/, '')
    .replace(/(?:-修改稿)+$/, '').replace(/[<>:"/\\|?*]/g, '').replace(/[. ]+$/, '').trim()
  return `${name || '简历'}-修改稿.pdf`
}

/** One layout engine supplies the actual PDF and the clickable paragraph positions. */
export async function createResumePdf(rawText: string, sourceFile: string, fontBytes?: Uint8Array, selectedTemplate: ResumeTemplateId = DEFAULT_RESUME_TEMPLATE, photo?: ResumePhoto | null): Promise<ResumePdfArtifact> {
  const template = resumeTemplateId(selectedTemplate)
  if (template === 'original') throw new Error('原文件上修改需要提供上传的 PDF，请重新打开这份简历。')
  const source = resumePdfSource(rawText)
  const text = source.text
  if (!text) throw new Error('新稿正文不能为空。')
  if (text.length > 20000) throw new Error('新稿请控制在 20000 字以内。')
  const { PDFDocument } = await import('pdf-lib')
  const document = await PDFDocument.create()
  const font = await embedResumeFont(document, text, fontBytes)
  document.setTitle(sourceFile.replace(/\.[^.]*$/, ''))
  document.setCreator('Resume Grill')
  document.setProducer('Resume Grill')
  document.setCreationDate(new Date(0))
  document.setModificationDate(new Date(0))
  const { isDesignedResumeTemplate, renderDesignedResume } = await import('./resume-pdf-designs')
  const first = document.addPage([RESUME_PAGE.width, RESUME_PAGE.height])
  const photoBox = await drawResumePhoto(document, first, photo)
  const render = (options: ResumePdfFit) => isDesignedResumeTemplate(template)
    ? renderDesignedResume(document, font, source, template, RESUME_PAGE, first, photoBox, options)
    : renderStandardResume(document, font, source, template, RESUME_PAGE, first, photoBox, options)
  const fit = fitResumeToOnePage(render)
  const pages = render(fit)
  if (pages.length !== 1 || document.getPageCount() !== 1) throw new Error('单页排版未完成，请重试预览。')
  const pdfBytes = await document.save()
  const file = new File([Uint8Array.from(pdfBytes).buffer], fileName(sourceFile), { type: 'application/pdf' })
  return { sourceFile, inputText: rawText, text, file, pageCount: 1, pages, template, photo }
}
