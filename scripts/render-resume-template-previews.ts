import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { createCanvas } from '@napi-rs/canvas'
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs'
import { createResumePdf } from '../src/features/resume/lib/resume-pdf'
import { RESUME_TEMPLATES } from '../src/domain/resume-template'

// Deliberately uses synthetic data; never read a user's saved resumes.
const root = new URL('../', import.meta.url)
const text = readFileSync(new URL('examples/resume-templates.txt', root), 'utf8').trim()
const font = new Uint8Array(readFileSync(new URL('public/fonts/NotoSansSC-Regular.ttf', root)))
const previews = new URL('public/resume-templates/', root)
const qa = new URL('dist/resume-templates/', root)
mkdirSync(previews, { recursive: true })
mkdirSync(qa, { recursive: true })
for (const template of RESUME_TEMPLATES) {
  const pdf = await createResumePdf(text, '示例简历.pdf', font, template.id)
  const bytes = new Uint8Array(await pdf.file.arrayBuffer())
  writeFileSync(new URL(`${template.id}.pdf`, qa), bytes)
  const task = getDocument({ data: bytes, disableFontFace: true, useSystemFonts: false, stopAtErrors: true })
  try {
    const document = await task.promise
    const page = await document.getPage(1)
    const viewport = page.getViewport({ scale: 1.5 })
    const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height))
    await page.render({ canvas: canvas as unknown as HTMLCanvasElement, viewport }).promise
    writeFileSync(new URL(`${template.id}.png`, qa), canvas.toBuffer('image/png'))
    const thumbnail = createCanvas(180, 255)
    thumbnail.getContext('2d').drawImage(canvas, 0, 0, 180, 255)
    writeFileSync(new URL(`${template.id}.webp`, previews), thumbnail.toBuffer('image/webp', 85))
    console.log(`${template.name}: ${pdf.pageCount} 页 — ${fileURLToPath(new URL(`${template.id}.pdf`, qa))}`)
  } finally { await task.destroy() }
}
