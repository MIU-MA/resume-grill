import { readFileSync } from 'node:fs'
import { createCanvas } from '@napi-rs/canvas'
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs'
import { expect, it } from 'vitest'
import { createResumePdf, RESUME_PAGE } from './resume-pdf'
import { RESUME_TEMPLATES } from '@/domain/resume-template'

const font = new Uint8Array(readFileSync('public/fonts/NotoSansSC-Regular.ttf'))
const portrait = createCanvas(90, 120)
const context = portrait.getContext('2d'); context.fillStyle = '#e32120'; context.fillRect(0, 0, 90, 120)
const dataUrl = portrait.toDataURL('image/png')

it.each(RESUME_TEMPLATES)('$name：左右照片实际出现在 PDF 中，抬头与正文不覆盖照片，文字仍完整可提取', async template => {
  for (const position of ['left', 'right'] as const) {
    const text = '林沐\n邮箱：lin@example.com | 手机号：13800138000\n教育经历\n测试大学 | 软件工程 | 2023-09 — 2027-06\n专业技能\nTypeScript、React'
    const pdf = await createResumePdf(text, '简历.pdf', font, template.id, { dataUrl, position })
    const task = getDocument({ data: new Uint8Array(await pdf.file.arrayBuffer()), disableFontFace: true, useSystemFonts: false, stopAtErrors: true })
    try {
      const document = await task.promise
      expect(document.numPages).toBe(1)
      const page = await document.getPage(1), viewport = page.getViewport({ scale: 1 })
      const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height))
      await page.render({ canvas: canvas as unknown as HTMLCanvasElement, viewport }).promise
      const left = position === 'left' ? 42 : RESUME_PAGE.width - 42 - 62
      const pixels = canvas.getContext('2d').getImageData(Math.ceil(left + 4), 48, 50, 68).data
      let red = 0
      for (let i = 0; i < pixels.length; i += 4) if (pixels[i] > 180 && pixels[i + 1] < 90 && pixels[i + 2] < 90 && pixels[i + 3] > 0) red++
      expect(red).toBeGreaterThan(3000)
      for (const block of pdf.pages[0].blocks.filter(block => block.kind !== 'blank' && block.top < 125)) {
        if (position === 'left') expect(block.left).toBeGreaterThanOrEqual(122)
        else expect(block.left! + block.width!).toBeLessThanOrEqual(left - 18 + .01)
      }
      const extracted = (await page.getTextContent()).items.flatMap(item => 'str' in item ? [item.str] : []).join('')
      expect(extracted.replace(/\s/g, '')).toBe(text.replace(/\s/g, ''))
    } finally { await task.destroy() }
  }
}, 15000)
