'use client'

// pdfjs 只在用户实际触发解析时动态加载，避免 SSR 阶段求值浏览器全局（DOMMatrix 等）。
// worker 仅在浏览器本地解析 PDF，简历文件不会被上传到任何服务器。

const WORKER_SRC = (version: string) =>
  `https://cdn.jsdelivr.net/npm/pdfjs-dist@${version}/build/pdf.worker.min.mjs`

export type ExtractedText = {
  text: string
  pageCount: number
  charCount: number
}

export async function extractTextFromFile(file: File): Promise<ExtractedText> {
  const name = file.name.toLowerCase()
  if (name.endsWith('.pdf')) return extractPdf(file)
  if (name.endsWith('.txt') || name.endsWith('.md')) {
    const text = await file.text()
    return { text, pageCount: 1, charCount: text.length }
  }
  if (name.endsWith('.doc') || name.endsWith('.docx')) {
    throw new Error('暂不支持 .doc/.docx，请使用 PDF 或纯文本文件。')
  }
  const text = await file.text()
  return { text, pageCount: 1, charCount: text.length }
}

async function extractPdf(file: File): Promise<ExtractedText> {
  const pdfjsLib = await import('pdfjs-dist')
  pdfjsLib.GlobalWorkerOptions.workerSrc = WORKER_SRC(pdfjsLib.version)
  const buffer = await file.arrayBuffer()
  const doc = await pdfjsLib.getDocument({ data: buffer }).promise
  const parts: string[] = []
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i)
    const content = await page.getTextContent()
    parts.push(reconstructPdfPage(content.items))
  }
  const text = parts.join('\n').trim()
  return { text, pageCount: doc.numPages, charCount: text.length }
}

type PositionedTextItem = {
  str: string
  width?: number
  height?: number
  transform?: number[]
}

type VisualLine = {
  text: string
  x: number
  y: number
  lastY: number
  height: number
  bullet: boolean
}

export function reconstructPdfPage(items: Array<PositionedTextItem | unknown>): string {
  const positioned = items.flatMap((item) => {
    if (!item || typeof item !== 'object' || !('str' in item) || typeof item.str !== 'string') return []
    const value = item as PositionedTextItem
    const transform = value.transform
    if (!transform || transform.length < 6 || !value.str.trim()) return []
    return [{
      str: value.str.trim(),
      x: transform[4] ?? 0,
      y: transform[5] ?? 0,
      width: value.width ?? 0,
      height: Math.abs(value.height ?? transform[3] ?? 10),
    }]
  }).sort((a, b) => Math.abs(a.y - b.y) > 2 ? b.y - a.y : a.x - b.x)

  const lines: typeof positioned[] = []
  for (const item of positioned) {
    const line = lines.find((candidate) => {
      const anchor = candidate[0]
      return anchor && Math.abs(anchor.y - item.y) <= Math.max(2, Math.min(anchor.height, item.height) * 0.35)
    })
    if (line) line.push(item)
    else lines.push([item])
  }

  const visualLines = lines
    .sort((a, b) => (b[0]?.y ?? 0) - (a[0]?.y ?? 0))
    .flatMap((line) => splitVisualLine(line.sort((a, b) => a.x - b.x)))

  return mergeWrappedVisualLines(visualLines)
    .map((line) => line.text)
    .filter(Boolean)
    .join('\n')
}

function splitVisualLine(line: Array<{ str: string; x: number; y: number; width: number; height: number }>): VisualLine[] {
  const segments: VisualLine[] = []
  let current = ''
  let currentX = 0
  let currentY = 0
  let currentHeight = 10
  let previousEnd = 0
  let previousCharWidth = 6

  line.forEach((item, index) => {
    const charWidth = item.width > 0 ? item.width / Math.max(item.str.length, 1) : previousCharWidth
    const gap = index === 0 ? 0 : item.x - previousEnd
    if (index > 0 && gap > Math.max(40, previousCharWidth * 7)) {
      pushVisualSegment(segments, current, currentX, currentY, currentHeight)
      current = item.str
      currentX = item.x
      currentY = item.y
      currentHeight = item.height
    } else {
      if (!current) {
        currentX = item.x
        currentY = item.y
        currentHeight = item.height
      }
      const separator = index > 0 && gap > Math.max(1.5, previousCharWidth * 0.45) ? ' ' : ''
      current += `${separator}${item.str}`
    }
    previousEnd = item.x + item.width
    previousCharWidth = charWidth
  })
  pushVisualSegment(segments, current, currentX, currentY, currentHeight)
  return segments
}

function pushVisualSegment(segments: VisualLine[], value: string, x: number, y: number, height: number) {
  const text = normalizeVisualBullet(value.trim())
  if (!text) return
  segments.push({ text, x, y, lastY: y, height, bullet: text.startsWith('- ') })
}

function normalizeVisualBullet(value: string): string {
  return value
    .replace(/^[•◦○▪■]\s*/, '- ')
    .replace(/^[oO]\s+(?=\S)/, '- ')
}

function mergeWrappedVisualLines(lines: VisualLine[]): VisualLine[] {
  const merged: VisualLine[] = []
  for (const line of lines) {
    const previous = merged.at(-1)
    if (previous && shouldMergeWrappedLine(previous, line)) {
      previous.text = joinWrappedText(previous.text, line.text)
      previous.lastY = line.y
      previous.height = Math.max(previous.height, line.height)
      continue
    }
    merged.push({ ...line })
  }
  return merged
}

function shouldMergeWrappedLine(previous: VisualLine, current: VisualLine): boolean {
  const verticalGap = previous.lastY - current.y
  if (verticalGap <= 0.5 || verticalGap > Math.max(18, Math.max(previous.height, current.height) * 1.9)) return false
  if (current.bullet) return false

  // Short, unpunctuated lines are overwhelmingly likely to be section or entry headings.
  if (!previous.bullet && previous.text.length <= 20 && !/[，,：:；;。.!！?？]$/.test(previous.text)) return false

  if (previous.bullet) {
    return current.x >= previous.x - 2 && current.x - previous.x <= 32
  }

  const previousLooksIncomplete = !/[。.!！?？；;：:]$/.test(previous.text)
  return previousLooksIncomplete && Math.abs(current.x - previous.x) <= 8
}

function joinWrappedText(previous: string, current: string): string {
  const left = previous.trimEnd()
  const right = current.trimStart()
  if (!left || !right) return `${left}${right}`
  const last = left.at(-1) ?? ''
  const first = right[0] ?? ''
  const needsSpace = /[A-Za-z0-9)]/.test(last) && /[A-Za-z0-9(]/.test(first)
    || /[\p{Script=Han}]/u.test(last) && /[A-Za-z0-9]/.test(first)
    || /[A-Za-z0-9]/.test(last) && /[\p{Script=Han}]/u.test(first)
  return `${left}${needsSpace ? ' ' : ''}${right}`
}
