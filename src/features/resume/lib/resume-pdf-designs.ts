import { rgb, pushGraphicsState, popGraphicsState, setTextRenderingMode, setLineWidth, type PDFDocument, type PDFPage, type PDFFont, type RGB } from 'pdf-lib'
import type { PdfPhotoBox } from './resume-photo'
import type { ResumeTemplateId } from '@/domain/resume-template'
import type { RESUME_PAGE, ResumePdfArtifact } from './resume-pdf'
import type { resumePdfSource } from './resume-pdf-offsets'
import { resumeEntries, resumeEntryColumns, resumeLayoutParagraphs, type ResumeLayoutParagraph } from './resume-pdf-entries'
import { resumePdfTypography, type ResumePdfFit } from './resume-pdf-fit'

type DesignId = Extract<ResumeTemplateId, 'meowth' | 'brilliant' | 'persian' | 'typst'>
export function isDesignedResumeTemplate(template: ResumeTemplateId): template is DesignId {
  return ['meowth', 'brilliant', 'persian', 'typst'].includes(template)
}

const INK = rgb(.16, .17, .19)
const MUTED = rgb(.38, .4, .43)
const DESIGNS = {
  meowth: { accent: rgb(.59, .25, .18), name: 29, body: 10, leading: 15, centered: false, sectionGap: 17 },
  brilliant: { accent: rgb(.12, .39, .64), name: 32, body: 10, leading: 15, centered: false, sectionGap: 16 },
  persian: { accent: INK, name: 27, body: 10.2, leading: 15.5, centered: true, sectionGap: 17 },
  typst: { accent: rgb(.12, .32, .57), name: 25, body: 10.5, leading: 16, centered: true, sectionGap: 16 },
} as const

/** Independent PDF adaptations of the referenced layouts; no Typst runtime or remote rendering. */
export function renderDesignedResume(document: PDFDocument, font: PDFFont, source: ReturnType<typeof resumePdfSource>, template: DesignId, pageSize: typeof RESUME_PAGE, firstPage: PDFPage, photoBox: PdfPhotoBox | undefined, fit: ResumePdfFit): ResumePdfArtifact['pages'] {
  const base = DESIGNS[template]
  const typography = resumePdfTypography(fit)
  const design = { ...base, name: typography.size(base.name), body: typography.size(base.body), leading: typography.leading(base.body, base.leading), sectionGap: typography.space(base.sectionGap) }
  const { width, height, margin } = pageSize
  const contentWidth = width - 2 * margin
  const bottom = height - margin
  const paragraphs = resumeLayoutParagraphs(source.text)
  const entries = resumeEntries(paragraphs)
  const pages: ResumePdfArtifact['pages'] = []
  let page = firstPage
  let top: number = margin
  let blocks: ResumePdfArtifact['pages'][number]['blocks'] = []
  let inHeader = paragraphs.some(paragraph => paragraph.kind === 'heading')
  let hadSection = false
  pages.push({ blocks })

  function nextPage() {
    if (!fit.measureOnly) page = document.addPage([width, height])
    top = margin
    blocks = []
    pages.push({ blocks })
  }
  function ensureSpace(space: number) {
    if (top > margin && top + space > bottom) nextPage()
  }
  function wrap(text: string, size: number, available: number): string[] {
    const lines: string[] = []
    let line = ''
    for (const token of text.replace(/\t/g, '    ').match(/[A-Za-z0-9]+(?:[._+/@:-][A-Za-z0-9]+)*|./gu) ?? []) {
      if (line && font.widthOfTextAtSize(line + token, size) > available) { lines.push(line); line = '' }
      if (font.widthOfTextAtSize(token, size) <= available) { line += token; continue }
      for (const character of Array.from(token)) {
        if (line && font.widthOfTextAtSize(line + character, size) > available) { lines.push(line); line = '' }
        line += character
      }
    }
    lines.push(line)
    return lines
  }
  function drawLine(text: string, x: number, y: number, size: number, color: RGB, bold: boolean) {
    if (fit.measureOnly) return
    if (bold) page.pushOperators(pushGraphicsState(), setTextRenderingMode(2), setLineWidth(size > 20 ? .2 : .12))
    page.drawText(text, { x, y: height - y - size, font, size, color })
    if (bold) page.pushOperators(popGraphicsState())
  }
  function drawBlock(paragraph: ResumeLayoutParagraph, x: number, available: number, size: number, leading: number, color: RGB, bold = false, align: 'left' | 'center' | 'right' = 'left') {
    const lines = wrap(paragraph.text, size, available)
    let blockTop = top
    const lineWidth = Math.max(...lines.map(line => font.widthOfTextAtSize(line, size)))
    const blockX = align === 'center' ? x + (available - lineWidth) / 2 : align === 'right' ? x + available - lineWidth : x
    const blockWidth = align === 'left' ? available : lineWidth
    for (const line of lines) {
      if (top + leading > bottom) {
        if (top > blockTop) blocks.push({ ...source.range(paragraph.start, paragraph.end), top: blockTop, height: top - blockTop, kind: paragraph.kind, fontSize: size, left: blockX, width: blockWidth })
        nextPage()
        blockTop = top
      }
      const measured = font.widthOfTextAtSize(line, size)
      const lineX = align === 'center' ? x + (available - measured) / 2 : align === 'right' ? x + available - measured : x
      drawLine(line, lineX, top, size, color, bold)
      top += leading
    }
    blocks.push({ ...source.range(paragraph.start, paragraph.end), top: blockTop, height: top - blockTop, kind: paragraph.kind, fontSize: size, left: blockX, width: blockWidth })
  }
  function section(paragraph: ResumeLayoutParagraph, index: number) {
    if (pages.length === 1 && photoBox) top = Math.max(top, photoBox.bottom + typography.space(4))
    const size = typography.size(template === 'brilliant' ? 13 : 12)
    const leading = typography.leading(template === 'brilliant' ? 13 : 12, 19)
    const titleLines = wrap(paragraph.text, size, contentWidth).length
    const next = entries.get(index + 1)
    const entryRows = next?.role ? 2 : 1
    const gap = hadSection ? design.sectionGap : typography.space(template === 'persian' ? 17 : 21)
    ensureSpace(gap + titleLines * leading + entryRows * design.leading + typography.space(25))
    if (!fit.measureOnly && inHeader && template === 'persian' && top > margin) {
      page.drawLine({ start: { x: margin, y: height - top - 4 }, end: { x: width - margin, y: height - top - 4 }, thickness: 1.1, color: INK })
    }
    top += top === margin ? 0 : gap
    const sectionTop = top
    drawBlock(paragraph, margin, contentWidth, size, leading, design.accent, true)
    const labelWidth = font.widthOfTextAtSize(paragraph.text, size)
    if (!fit.measureOnly && (template === 'persian' || titleLines > 1)) {
      page.drawLine({ start: { x: margin, y: height - top + 2 }, end: { x: width - margin, y: height - top + 2 }, thickness: .6, color: design.accent })
    } else if (!fit.measureOnly) {
      const lineStart = margin + labelWidth + 12
      if (lineStart < width - margin) page.drawLine({ start: { x: lineStart, y: height - sectionTop - 11 }, end: { x: width - margin, y: height - sectionTop - 11 }, thickness: template === 'typst' ? .8 : .5, color: design.accent })
    }
    top += typography.space(template === 'persian' ? 8 : 6)
    inHeader = false
    hadSection = true
  }

  for (let index = 0; index < paragraphs.length; index++) {
    const paragraph = paragraphs[index]
    if (paragraph.kind === 'heading') { section(paragraph, index); continue }
    if (paragraph.kind === 'blank') {
      const gap = typography.space(4)
      if (top + gap <= bottom) { blocks.push({ ...source.range(paragraph.start, paragraph.end), top, height: gap, kind: 'blank' }); top += gap }
      continue
    }
    const entry = entries.get(index)
    if (entry) {
      const dateWidth = (template === 'typst' ? 116 : 132) * fit.fontScale
      const gap = typography.space(14)
      const entryTopPadding = typography.space(2)
      const textLeft = template === 'typst' && entry.date ? margin + dateWidth + gap : margin
      const textWidth = entry.date ? contentWidth - dateWidth - gap : contentWidth
      const columns = template === 'meowth' ? resumeEntryColumns(entry.title) : [entry.title]
      const cells: Array<{ paragraph: ResumeLayoutParagraph; x: number; width: number; size: number; leading: number; color: RGB; bold: boolean; row: number; align: 'left' | 'right' }> = columns.map((part, partIndex) => {
        const cellWidth = columns.length > 1 ? (textWidth - gap * (columns.length - 1)) / columns.length : textWidth
        return { paragraph: part, x: textLeft + partIndex * (cellWidth + gap), width: cellWidth, size: typography.size(base.body + .5), leading: typography.leading(base.body + .5, base.leading + 1), color: INK, bold: partIndex === 0, row: 0, align: 'left' as const }
      })
      if (entry.role) cells.push({ paragraph: entry.role, x: textLeft, width: textWidth, size: design.body, leading: design.leading, color: template === 'brilliant' ? design.accent : MUTED, bold: false, row: 1, align: 'left' })
      const firstRowHeight = Math.max(...cells.filter(cell => cell.row === 0).map(cell => wrap(cell.paragraph.text, cell.size, cell.width).length * cell.leading))
      const roleHeight = entry.role ? wrap(entry.role.text, design.body, textWidth).length * design.leading : 0
      const dateSize = typography.size(9.2)
      const dateHeight = entry.date ? wrap(entry.date.text, dateSize, dateWidth).length * design.leading : 0
      const rowHeight = Math.max(firstRowHeight + roleHeight, dateHeight)
      ensureSpace(entryTopPadding + rowHeight + design.leading + typography.space(4))
      top += entryTopPadding
      const rowTop = top
      const positioned = cells.map(cell => ({ ...cell, top: rowTop + (cell.row === 1 ? firstRowHeight : 0) }))
      if (entry.date) positioned.push({ paragraph: entry.date, x: template === 'typst' ? margin : width - margin - dateWidth, width: dateWidth, size: dateSize, leading: design.leading, color: MUTED, bold: false, row: 0, top: rowTop, align: template === 'typst' ? 'left' : 'right' })
      // Draw in source order, even when the date is visually placed in the left column.
      // Text extraction, editor hit targets and accessible reading keep the original order.
      for (const cell of positioned.sort((a, b) => a.paragraph.start - b.paragraph.start)) {
        top = cell.top
        drawBlock(cell.paragraph, cell.x, cell.width, cell.size, cell.leading, cell.color, cell.bold, cell.align)
      }
      top = rowTop + rowHeight + typography.space(5)
      index += [entry.title, entry.date, entry.role].filter((part): part is ResumeLayoutParagraph => !!part)
        .filter(part => part.end > paragraph.end).length
      continue
    }
    const name = paragraph.kind === 'name'
    const size = name ? design.name : inHeader ? typography.size(9.5) : design.body
    const leading = name ? typography.leading(base.name, base.name + 9) : inHeader ? typography.leading(9.5, 15) : design.leading
    const color = name ? INK : inHeader && template === 'brilliant' ? design.accent : inHeader ? MUTED : INK
    const besidePhoto = pages.length === 1 && photoBox && top < photoBox.bottom
    const paragraphLeft = besidePhoto ? photoBox.textLeft : margin
    const paragraphWidth = besidePhoto ? photoBox.textWidth : contentWidth
    const paragraphHeight = wrap(paragraph.text, size, paragraphWidth).length * leading
    ensureSpace(Math.min(paragraphHeight, bottom - margin))
    drawBlock(paragraph, paragraphLeft, paragraphWidth, size, leading, color, name, (inHeader || name) && design.centered ? 'center' : 'left')
    top += typography.space(name ? 5 : inHeader ? 1 : 2)
  }
  return pages
}
