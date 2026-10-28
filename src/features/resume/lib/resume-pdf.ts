import { resumeDocumentParagraphs } from './resume-docx'
import { resumePdfSource } from './resume-pdf-offsets'
import { DEFAULT_RESUME_TEMPLATE, resumeTemplateId, type ResumeTemplateId } from '@/domain/resume-template'
import { embedResumeFont } from './resume-pdf-font'
import type { ResumePhoto } from '@/domain/resume-photo'
import { drawResumePhoto } from './resume-photo'

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
  const { PDFDocument, rgb, pushGraphicsState, popGraphicsState, setTextRenderingMode, setLineWidth } = await import('pdf-lib')
  const document = await PDFDocument.create()
  const font = await embedResumeFont(document, text, fontBytes)
  document.setTitle(sourceFile.replace(/\.[^.]*$/, ''))
  document.setCreator('Resume Grill')
  document.setProducer('Resume Grill')
  document.setCreationDate(new Date(0))
  document.setModificationDate(new Date(0))
  const { isDesignedResumeTemplate, renderDesignedResume } = await import('./resume-pdf-designs')
  if (isDesignedResumeTemplate(template)) {
    const first = document.addPage([RESUME_PAGE.width, RESUME_PAGE.height])
    const photoBox = await drawResumePhoto(document, first, photo)
    const pages = renderDesignedResume(document, font, source, template, RESUME_PAGE, first, photoBox)
    const pdfBytes = await document.save()
    const file = new File([Uint8Array.from(pdfBytes).buffer], fileName(sourceFile), { type: 'application/pdf' })
    return { sourceFile, inputText: rawText, text, file, pageCount: pages.length, pages, template, photo }
  }
  const { width, height, margin } = RESUME_PAGE
  const contentWidth = width - margin * 2
  const compact = template === 'compact'
  const accent = template === 'modern' ? rgb(.19, .37, .53) : template === 'sidebar' ? rgb(.48, .38, .28) : rgb(.17, .19, .22)
  const pages: ResumePdfArtifact['pages'] = []
  let page = document.addPage([width, height])
  const photoBox = await drawResumePhoto(document, page, photo)
  let top: number = margin
  let blocks: PdfTextBlock[] = []
  pages.push({ blocks })
  const nextPage = () => {
    page = document.addPage([width, height])
    top = margin
    blocks = []
    pages.push({ blocks })
    sidebarBottom = 0
    sidebarStart = null
  }
  let offset = 0
  const paragraphs = resumeDocumentParagraphs(text)
  const hasHeadings = paragraphs.some(paragraph => paragraph.kind === 'heading')
  let inHeader = hasHeadings
  let sectionTitle = ''
  let afterHeading = false
  let afterBlank = false
  let sidebarStart: number | null = null
  let sidebarBottom = 0
  for (const paragraph of paragraphs) {
    const start = offset
    const end = start + paragraph.text.length
    offset = end + 1
    if (paragraph.kind === 'blank') {
      const gap = afterBlank ? 1 : compact ? 2 : 3
      if (top + gap < height - margin) {
        blocks.push({ ...source.range(start, end), top, height: gap, kind: paragraph.kind })
        top += gap
      }
      afterBlank = true
      continue
    }
    const heading = paragraph.kind === 'heading'
    if (heading) { inHeader = false; sectionTitle = paragraph.text; top = Math.max(top, sidebarBottom, pages.length === 1 && photoBox ? photoBox.bottom + 4 : 0) }
    const entry = !inHeader && /工作|实习|项目|教育|experience|internship|projects?|education/i.test(sectionTitle) && paragraph.kind === 'body' && (afterHeading || afterBlank)
      && paragraph.text.length < 96 && !/^\s*(?:[-•·*]|\d{4}|负责|参与|主导|协助|使用|开发|熟悉|掌握|精通|通过)/.test(paragraph.text)
    const size = paragraph.kind === 'name' ? compact ? 20 : template === 'modern' ? 26 : 24 : heading ? compact ? 10.5 : 11.5 : inHeader ? 9.5 : compact ? 9.5 : 10.5
    const lineHeight = paragraph.kind === 'name' ? compact ? 27 : 34 : heading ? compact ? 16 : 20 : inHeader ? compact ? 13 : 15 : compact ? 14 : 16
    const before = heading ? compact ? 9 : 15 : entry ? 3 : 0
    const after = paragraph.kind === 'name' ? compact ? 3 : 6 : heading ? compact ? 5 : 7 : entry ? 4 : compact ? 1 : 2
    const bold = paragraph.kind === 'name' || heading || entry
    const color = heading || paragraph.kind === 'name' ? accent : inHeader ? rgb(0.37, 0.40, 0.44) : rgb(0.17, 0.19, 0.22)
    const sidebar = template === 'sidebar' && !inHeader && paragraph.kind !== 'name'
    const besidePhoto = pages.length === 1 && photoBox && top < photoBox.bottom && !heading && !sidebar
    const left = besidePhoto ? photoBox.textLeft : sidebar ? heading ? margin : margin + 90 : margin + (template === 'modern' && heading ? 9 : 0)
    const availableWidth = besidePhoto ? photoBox.textWidth : sidebar ? heading ? 74 : contentWidth - 90 : contentWidth - (left - margin)
    if (sidebar && !heading && sidebarStart !== null) { top = sidebarStart; sidebarStart = null }
    const lines: string[] = []
    let line = ''
    // Use embedded font metrics; the preview renders these same bytes, with no CSS wrapping.
    const tokens = paragraph.text.replace(/\t/g, '    ').match(/[A-Za-z0-9]+(?:[._+/@:-][A-Za-z0-9]+)*|./gu) ?? []
    for (const token of tokens) {
      if (line && font.widthOfTextAtSize(line + token, size) > availableWidth) { lines.push(line); line = '' }
      if (font.widthOfTextAtSize(token, size) <= availableWidth) { line += token; continue }
      // Unusually long URLs still need to wrap within the printable page width.
      for (const character of Array.from(token)) {
        if (line && font.widthOfTextAtSize(line + character, size) > availableWidth) { lines.push(line); line = character }
        else line += character
      }
    }
    lines.push(line)
    const paragraphHeight = lines.length * lineHeight + before + after
    const reserve = heading || entry ? lineHeight + before + after + 16 : Math.min(paragraphHeight, height - margin * 2)
    if (top + reserve > height - margin && top > margin) nextPage()
    top += sidebar && !heading && afterHeading ? 0 : before
    let blockTop = top
    const centered = template === 'classic' && (inHeader || paragraph.kind === 'name')
    const maxLineWidth = Math.max(...lines.map(value => font.widthOfTextAtSize(value, size)))
    const blockLeft = centered ? left + (availableWidth - maxLineWidth) / 2 : left
    const blockWidth = centered ? maxLineWidth : availableWidth
    for (const value of lines) {
      if (top + lineHeight > height - margin) {
        blocks.push({ ...source.range(start, end), top: blockTop, height: top - blockTop, kind: paragraph.kind, fontSize: size, left: blockLeft, width: blockWidth })
        nextPage()
        blockTop = top
      }
      // A light outline adds heading weight using the embedded CJK font. It
      // keeps one text operation per line, preserving extraction and selection.
      if (bold) page.pushOperators(pushGraphicsState(), setTextRenderingMode(2), setLineWidth(heading || paragraph.kind === 'name' ? 0.18 : 0.10))
      const x = centered ? left + (availableWidth - font.widthOfTextAtSize(value, size)) / 2 : left
      page.drawText(value, { x, y: height - top - size, size, font, color })
      if (bold) page.pushOperators(popGraphicsState())
      if (heading && lines.length === 1) {
        if (template === 'classic' || compact) page.drawLine({ start: { x: margin, y: height - top - lineHeight + 2 }, end: { x: width - margin, y: height - top - lineHeight + 2 }, thickness: compact ? .6 : .5, color: compact ? accent : rgb(.7, .73, .75) })
        else if (template === 'modern') page.drawRectangle({ x: margin, y: height - top - size - 1, width: 2.5, height: size + 1, color: accent })
        else page.drawLine({ start: { x: margin + 78, y: height - top + 1 }, end: { x: margin + 78, y: height - top - lineHeight - 3 }, thickness: .5, color: rgb(.81, .8, .77) })
      }
      top += lineHeight
    }
    blocks.push({ ...source.range(start, end), top: blockTop, height: top - blockTop, kind: paragraph.kind, fontSize: size, left: blockLeft, width: blockWidth })
    if (sidebar && heading) { sidebarStart = blockTop; sidebarBottom = top }
    if (inHeader) sidebarBottom = 0
    top += after
    afterHeading = heading
    afterBlank = false
  }
  const pdfBytes = await document.save()
  const file = new File([Uint8Array.from(pdfBytes).buffer], fileName(sourceFile), { type: 'application/pdf' })
  return { sourceFile, inputText: rawText, text, file, pageCount: pages.length, pages, template, photo }
}
