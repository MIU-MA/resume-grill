import { resumeDocumentParagraphs } from './resume-docx'
import { resumePdfSource } from './resume-pdf-offsets'

export const RESUME_PAGE = { width: 595.28, height: 841.89, margin: 42 } as const
export type PdfTextBlock = { start: number; end: number; top: number; height: number; kind: 'name' | 'heading' | 'body' | 'blank' }
export type ResumePdfArtifact = {
  sourceFile: string
  inputText: string
  text: string
  file: File
  pageCount: number
  pages: Array<{ blocks: PdfTextBlock[] }>
}

let fontRequest: Promise<Uint8Array> | undefined
async function loadResumeFont() {
  fontRequest ??= fetch('/fonts/NotoSansSC-Regular.ttf', { signal: AbortSignal.timeout(20000) }).then(async response => {
    if (!response.ok) throw new Error('中文字体未能加载，请重试 PDF 预览。')
    return new Uint8Array(await response.arrayBuffer())
  }).catch(error => { fontRequest = undefined; throw error })
  return fontRequest
}

function fileName(source: string) {
  const basename = Array.from(source.split(/[\\/]/).at(-1) ?? '').filter(character => character.codePointAt(0)! >= 0x20).join('')
  const name = basename.replace(/\.[^.]*$/, '')
    .replace(/(?:-修改稿)+$/, '').replace(/[<>:"/\\|?*]/g, '').replace(/[. ]+$/, '').trim()
  return `${name || '简历'}-修改稿.pdf`
}

/** One layout engine supplies the actual PDF and the clickable paragraph positions. */
export async function createResumePdf(rawText: string, sourceFile: string, fontBytes?: Uint8Array): Promise<ResumePdfArtifact> {
  const source = resumePdfSource(rawText)
  const text = source.text
  if (!text) throw new Error('新稿正文不能为空。')
  if (text.length > 20000) throw new Error('新稿请控制在 20000 字以内。')
  const [{ PDFDocument, rgb }, { default: fontkit }, { createFont }, bytes] = await Promise.all([
    import('pdf-lib'), import('@pdf-lib/fontkit'), import('fonteditor-core'), fontBytes ? Promise.resolve(fontBytes) : loadResumeFont(),
  ])
  const document = await PDFDocument.create()
  document.registerFontkit(fontkit)
  const available = new Set(fontkit.create(bytes).characterSet)
  const missing = [...new Set(Array.from(text).filter(character => !/\s/u.test(character) && !available.has(character.codePointAt(0)!)))]
  if (missing.length) throw new Error(`PDF 字体不支持这些字符：${missing.slice(0, 8).join(' ')}。请替换后再保存。`)
  // The PDF library's own CJK subsetter can silently drop visible glyphs. Build a
  // standalone TrueType subset first, then embed it whole with its complete cmap.
  const subset = createFont(Uint8Array.from(bytes).buffer, {
    type: 'ttf', subset: [...new Set(Array.from(text + ' ').filter(character => !/[\n\t]/.test(character)).map(character => character.codePointAt(0)!))],
    compound2simple: true, hinting: false,
  })
  const font = await document.embedFont(subset.write({ type: 'ttf', toBuffer: false }), { subset: false })
  document.setTitle(sourceFile.replace(/\.[^.]*$/, ''))
  document.setCreator('Resume Grill')
  document.setProducer('Resume Grill')
  document.setCreationDate(new Date(0))
  document.setModificationDate(new Date(0))
  const { width, height, margin } = RESUME_PAGE
  const contentWidth = width - margin * 2
  const pages: ResumePdfArtifact['pages'] = []
  let page = document.addPage([width, height])
  let top = margin
  let blocks: PdfTextBlock[] = []
  pages.push({ blocks })
  const nextPage = () => {
    page = document.addPage([width, height])
    top = margin
    blocks = []
    pages.push({ blocks })
  }
  let offset = 0
  for (const paragraph of resumeDocumentParagraphs(text)) {
    const start = offset
    const end = start + paragraph.text.length
    offset = end + 1
    if (paragraph.kind === 'blank') {
      if (top + 8 < height - margin) {
        blocks.push({ ...source.range(start, end), top, height: 8, kind: paragraph.kind })
        top += 8
      }
      continue
    }
    const size = paragraph.kind === 'name' ? 20 : paragraph.kind === 'heading' ? 12 : 10.5
    const lineHeight = paragraph.kind === 'name' ? 29 : paragraph.kind === 'heading' ? 23 : 16
    const before = paragraph.kind === 'heading' ? 10 : 0
    const lines: string[] = []
    let line = ''
    // Use embedded font metrics; the preview renders these same bytes, with no CSS wrapping.
    const tokens = paragraph.text.replace(/\t/g, '    ').match(/[A-Za-z0-9]+(?:[._+/@:-][A-Za-z0-9]+)*|./gu) ?? []
    for (const token of tokens) {
      if (line && font.widthOfTextAtSize(line + token, size) > contentWidth) { lines.push(line); line = '' }
      if (font.widthOfTextAtSize(token, size) <= contentWidth) { line += token; continue }
      // Unusually long URLs still need to wrap within the printable page width.
      for (const character of Array.from(token)) {
        if (line && font.widthOfTextAtSize(line + character, size) > contentWidth) { lines.push(line); line = character }
        else line += character
      }
    }
    lines.push(line)
    const paragraphHeight = lines.length * lineHeight + before + 4
    const reserve = paragraph.kind === 'heading' ? lineHeight + before + 16 : Math.min(paragraphHeight, height - margin * 2)
    if (top + reserve > height - margin && top > margin) nextPage()
    top += before
    let blockTop = top
    for (const value of lines) {
      if (top + lineHeight > height - margin) {
        blocks.push({ ...source.range(start, end), top: blockTop, height: top - blockTop, kind: paragraph.kind })
        nextPage()
        blockTop = top
      }
      page.drawText(value, { x: margin, y: height - top - size, size, font, color: rgb(0.13, 0.13, 0.13) })
      top += lineHeight
    }
    if (paragraph.kind === 'heading') page.drawLine({ start: { x: margin, y: height - top + 3 }, end: { x: width - margin, y: height - top + 3 }, thickness: 0.5, color: rgb(0.75, 0.71, 0.65) })
    blocks.push({ ...source.range(start, end), top: blockTop, height: top - blockTop, kind: paragraph.kind })
    top += 4
  }
  const pdfBytes = await document.save()
  const file = new File([Uint8Array.from(pdfBytes).buffer], fileName(sourceFile), { type: 'application/pdf' })
  return { sourceFile, inputText: rawText, text, file, pageCount: pages.length, pages }
}
