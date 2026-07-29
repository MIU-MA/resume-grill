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
    parts.push(content.items.map((item) => ('str' in item ? item.str : '')).join(' '))
  }
  const text = parts.join('\n').trim()
  return { text, pageCount: doc.numPages, charCount: text.length }
}
