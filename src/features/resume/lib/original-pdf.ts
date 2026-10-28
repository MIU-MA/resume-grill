import type { WrappedPdfiumModule } from '@embedpdf/pdfium'
import { alignRevisionLines, mapRevisionTarget } from '../resume-revision'
import { resumeLayoutParagraphs } from './resume-pdf-entries'
import { resumePdfSource } from './resume-pdf-offsets'
import { embedResumeFont } from './resume-pdf-font'
import type { ResumePdfArtifact } from './resume-pdf'

let engineRequest: Promise<WrappedPdfiumModule> | undefined
async function getEngine(wasmBinary?: Uint8Array) {
  if (wasmBinary) {
    const { init } = await import('@embedpdf/pdfium')
    const engine = await init({ wasmBinary }); engine.PDFiumExt_Init(); return engine
  }
  engineRequest ??= Promise.all([import('@embedpdf/pdfium'), fetch('/generated/pdfium.wasm', { signal: AbortSignal.timeout(30000) }).then(async response => {
    if (!response.ok) throw new Error('PDF 编辑组件未能加载，请重试。')
    return new Uint8Array(await response.arrayBuffer())
  })]).then(async ([{ init }, wasmBinary]) => { const engine = await init({ wasmBinary }); engine.PDFiumExt_Init(); return engine })
    .catch(error => { engineRequest = undefined; throw error })
  return engineRequest
}

type Character = { value: string; page: number; object: number; left: number; right: number; bottom: number; top: number; baseline: number; size: number; color: [number, number, number] }
type LocatedParagraph = { start: number; end: number; characters: Character[]; page: number; left: number; right: number; top: number; bottom: number; size: number; baseline: number; rows: number; leading: number }
const compact = (value: string) => value.replace(/\s/g, '').replace(/[•●▪◦]/g, '-')

/** All mutations are in a fresh in-memory copy. Images, paths and untouched text stay as PDF objects. */
export async function editOriginalPdf(original: File, baseText: string, text: string, options: { fontBytes?: Uint8Array; wasmBinary?: Uint8Array } = {}): Promise<ResumePdfArtifact> {
  if (!/\.pdf$/i.test(original.name)) throw new Error('原文件上修改目前支持 PDF；这份文件可以核对原文，或主动选择重新排版。')
  if (!text.trim() || text.length > 20000) throw new Error('新稿正文须为 1–20000 字。')
  const engine = await getEngine(options.wasmBinary)
  const bytes = new Uint8Array(await original.arrayBuffer())
  const mem = engine.pdfium as typeof engine.pdfium & { HEAPU8: Uint8Array }
  const pointer = mem.wasmExports.malloc(bytes.length)
  mem.HEAPU8.set(bytes, pointer)
  const document = engine.FPDF_LoadMemDocument(pointer, bytes.length, '')
  if (!document) { mem.wasmExports.free(pointer); throw new Error('原 PDF 无法编辑，可能已加密或损坏。请上传可读取的 PDF。') }
  const pageHandles: number[] = []
  const textHandles: number[] = []
  const scratch = mem.wasmExports.malloc(64)
  const characters: Character[] = []
  const source = resumePdfSource(baseText)
  const pageSizes: Array<{ width: number; height: number; rotation: number; editable: boolean }> = []
  const changes: Array<{ location: LocatedParagraph; after: string; start: number; end: number }> = []
  const artifactPages: ResumePdfArtifact['pages'] = []
  let cleaned: Uint8Array | undefined
  try {
    const pageCount = engine.FPDF_GetPageCount(document)
    if (pageCount > 50) throw new Error('简历页数过多，请使用 50 页以内的 PDF。')
    for (let number = 0; number < pageCount; number++) {
      const page = engine.FPDF_LoadPage(document, number)
      if (!page) throw new Error('原 PDF 的部分页面无法读取。')
      pageHandles.push(page)
      const textPage = engine.FPDFText_LoadPage(page); textHandles.push(textPage)
      const width = engine.FPDF_GetPageWidth(page), height = engine.FPDF_GetPageHeight(page)
      const rotation = engine.FPDFPage_GetRotation(page)
      const hasCrop = engine.FPDFPage_GetCropBox(page, scratch, scratch + 4, scratch + 8, scratch + 12)
      const shifted = hasCrop && (Math.abs(mem.getValue(scratch, 'float')) > .01 || Math.abs(mem.getValue(scratch + 4, 'float')) > .01)
      pageSizes.push({ width, height, rotation, editable: rotation === 0 && !shifted })
      artifactPages.push({ width, height, blocks: [] })
      const count = engine.FPDFText_CountChars(textPage)
      if (count > 100000) throw new Error('原 PDF 文字过多，无法可靠定位简历段落。')
      for (let index = 0; index < count; index++) {
        const code = engine.FPDFText_GetUnicode(textPage, index)
        if (!code || code > 0x10ffff) continue
        const value = String.fromCodePoint(code)
        if (/\s/u.test(value)) continue
        if (!engine.FPDFText_GetCharBox(textPage, index, scratch, scratch + 8, scratch + 16, scratch + 24)) continue
        const left = mem.getValue(scratch, 'double'), right = mem.getValue(scratch + 8, 'double'), bottom = mem.getValue(scratch + 16, 'double'), top = mem.getValue(scratch + 24, 'double')
        engine.FPDFText_GetCharOrigin(textPage, index, scratch + 32, scratch + 40)
        const baseline = mem.getValue(scratch + 40, 'double')
        const hasColor = engine.FPDFText_GetFillColor(textPage, index, scratch + 48, scratch + 52, scratch + 56, scratch + 60)
        const color: [number, number, number] = hasColor ? [48, 52, 56].map(offset => mem.getValue(scratch + offset, 'i32') / 255) as [number, number, number] : [.15, .15, .15]
        characters.push({ value, page: number, object: engine.FPDFText_GetTextObject(textPage, index), left, right, bottom, top, baseline, size: engine.FPDFText_GetFontSize(textPage, index), color })
      }
    }
    let normalized = ''
    const charPositions: Character[] = []
    for (const character of characters) { normalized += compact(character.value); for (let index = 0; index < character.value.length; index++) charPositions.push(character) }
    let cursor = 0
    const locations: LocatedParagraph[] = []
    for (const paragraph of resumeLayoutParagraphs(source.text)) {
      const quote = compact(paragraph.text)
      if (!quote) continue
      const match = normalized.indexOf(quote, cursor)
      if (match < 0) continue // Unlocatable content stays readable; changes to it will be refused below.
      cursor = match + quote.length
      const members = [...new Set(charPositions.slice(match, cursor))]
      if (!members.length || members.some(character => character.page !== members[0].page) || !pageSizes[members[0].page].editable) continue
      const bounds = source.range(paragraph.start, paragraph.end)
      const origins = [...new Set(members.map(character => Math.round(character.baseline * 2) / 2))].sort((a, b) => b - a)
      const first = members[0]
      const size = Number.isFinite(first.size) && first.size > 0 ? first.size : 10
      const location: LocatedParagraph = { ...bounds, characters: members, page: first.page, left: Math.min(...members.map(character => character.left)), right: Math.max(...members.map(character => character.right)), top: Math.max(...members.map(character => character.top)), bottom: Math.min(...members.map(character => character.bottom)), size, baseline: origins[0], rows: origins.length, leading: origins.length > 1 ? (origins[0] - origins.at(-1)!) / (origins.length - 1) : size * 1.3 }
      locations.push(location)
      const mapped = mapRevisionTarget(baseText, text, bounds)
      if (mapped) artifactPages[first.page].blocks.push({ ...mapped, top: pageSizes[first.page].height - location.top - 1, height: location.top - location.bottom + 2, left: location.left, width: location.right - location.left, fontSize: size, kind: paragraph.kind })
    }
    const changedSpans = alignRevisionLines(baseText, text).filter(span => !span.equal).flatMap(span => {
      const beforeLines = baseText.slice(span.start, span.end).match(/[^\n]*\n|[^\n]+$/g) ?? []
      const afterLines = text.slice(span.nextStart, span.nextEnd).match(/[^\n]*\n|[^\n]+$/g) ?? []
      if (beforeLines.length < 2 || beforeLines.length !== afterLines.length) return [span]
      // Adjacent user edits are separate targets, even when their PDF columns differ.
      let start = span.start, nextStart = span.nextStart
      return beforeLines.map((line, index) => {
        const item = { ...span, start, end: start + line.length, nextStart, nextEnd: nextStart + afterLines[index].length }
        start = item.end; nextStart = item.nextEnd
        return item
      })
    })
    for (const span of changedSpans) {
      const affected = locations.filter(location => location.start < span.end && location.end > span.start)
      const before = baseText.slice(span.start, span.end)
      const after = text.slice(span.nextStart, span.nextEnd).trimEnd()
      if (compact(before) === compact(after)) continue
      if (!compact(before) || after.startsWith(before.trimEnd() + '\n')) throw new Error('新增段落无法在原 PDF 中可靠定位。请在源文件中添加，或选择重新排版。')
      if (!affected.length || compact(affected.map(location => baseText.slice(location.start, location.end)).join('')) !== compact(before)) throw new Error('这处修改无法在原 PDF 中可靠定位。请只改已定位的段落，或选择重新排版。')
      if (affected.some(location => location.page !== affected[0].page || Math.abs(location.left - affected[0].left) > 12) || pageSizes[affected[0].page].rotation !== 0) throw new Error('这处修改跨页、跨栏或位于旋转页面，暂不能原位替换。修改建议仍可保留，或选择重新排版。')
      const first = affected[0]
      const members = affected.flatMap(location => location.characters)
      const origins = [...new Set(members.map(character => Math.round(character.baseline * 2) / 2))].sort((a, b) => b - a)
      const location: LocatedParagraph = { ...first, characters: members, left: Math.min(...members.map(character => character.left)), right: Math.max(...members.map(character => character.right)), top: Math.max(...members.map(character => character.top)), bottom: Math.min(...members.map(character => character.bottom)), baseline: origins[0], rows: origins.length, leading: origins.length > 1 ? (origins[0] - origins.at(-1)!) / (origins.length - 1) : first.leading }
      const objects = new Set(members.map(character => character.object))
      const selected = new Set(members)
      if (objects.has(0) || characters.some(character => objects.has(character.object) && !selected.has(character))) throw new Error('这段文字与其他内容共用 PDF 对象，无法单独替换。请保留建议并在源文件中修改，或选择重新排版。')
      changes.push({ location, after: /^[•●▪◦]$/.test(members[0].value) && after.startsWith('-') ? members[0].value + after.slice(1) : after, start: span.nextStart, end: span.nextEnd })
    }
    if (changes.length) {
      for (const handle of textHandles) if (handle) engine.FPDFText_ClosePage(handle)
      textHandles.length = 0
      if (!(engine.FPDF_GetDocPermissions(document) & 8)) throw new Error('原 PDF 不允许修改，请使用有编辑权限的源文件。')
      const removed = new Set<number>()
      for (const change of changes) for (const character of change.location.characters) {
        if (removed.has(character.object)) continue
        if (!engine.FPDFPage_RemoveObject(pageHandles[character.page], character.object)) throw new Error('这段文字被封装为复杂图形，无法原位替换。请在源文件中修改，或选择重新排版。')
        engine.FPDFPageObj_Destroy(character.object); removed.add(character.object)
      }
      for (const page of new Set(changes.map(change => change.location.page))) if (!engine.FPDFPage_GenerateContent(pageHandles[page])) throw new Error('原 PDF 修改未能生成，请重试。')
      const writer = engine.PDFiumExt_OpenFileWriter()
      let buffer = 0
      try {
        if (!engine.PDFiumExt_SaveAsCopy(document, writer)) throw new Error('原 PDF 修改未能保存。')
        const size = engine.PDFiumExt_GetFileWriterSize(writer)
        buffer = mem.wasmExports.malloc(size)
        if (engine.PDFiumExt_GetFileWriterData(writer, buffer, size) !== size) throw new Error('PDF 文件未完整生成。')
        cleaned = mem.HEAPU8.slice(buffer, buffer + size)
      } finally { if (buffer) mem.wasmExports.free(buffer); engine.PDFiumExt_CloseFileWriter(writer) }
    }
  } finally {
    for (const handle of textHandles) if (handle) engine.FPDFText_ClosePage(handle)
    for (const handle of pageHandles) engine.FPDF_ClosePage(handle)
    engine.FPDF_CloseDocument(document); mem.wasmExports.free(pointer); mem.wasmExports.free(scratch)
  }
  let file = original
  if (cleaned) {
    const { PDFDocument, rgb } = await import('pdf-lib')
    const document = await PDFDocument.load(cleaned)
    const font = await embedResumeFont(document, changes.map(change => change.after).join('\n'), options.fontBytes)
    for (const change of changes) {
      const location = change.location
      const width = location.right - location.left + .8
      let size = location.size
      let lines: string[] = []
      let fits = false
      while (size >= Math.min(location.size, Math.max(8, location.size * .85)) - .01) {
        lines = []; let line = ''
        for (const character of Array.from(change.after)) {
          if (character === '\n') { lines.push(line); line = ''; continue }
          if (line && font.widthOfTextAtSize(line + character, size) > width) { lines.push(line.trimEnd()); line = '' }
          line += character
        }
        if (line) lines.push(line)
        if (lines.length <= location.rows && lines.every(line => font.widthOfTextAtSize(line, size) <= width)) { fits = true; break }
        size -= .25
      }
      if (!fits) throw new Error('修改后的文字超出原位置。请缩短这段内容，或主动选择重新排版。')
      const page = document.getPage(location.page)
      const crop = page.getCropBox()
      if (Math.abs(crop.x) > .01 || Math.abs(crop.y) > .01) throw new Error('原 PDF 使用了偏移裁切区域，暂不能准确原位修改。请在源文件中修改，或选择重新排版。')
      for (const [index, line] of lines.entries()) page.drawText(line, { x: location.left, y: location.baseline - index * location.leading, font, size, color: rgb(...location.characters[0].color) })
    }
    const output = await document.save()
    file = new File([Uint8Array.from(output).buffer], `${original.name.replace(/(?:-修改稿)?\.pdf$/i, '')}-修改稿.pdf`, { type: 'application/pdf' })
  }
  return { sourceFile: original.name, inputText: text, text: resumePdfSource(text).text, file, pageCount: artifactPages.length, pages: artifactPages, template: 'original' }
}
