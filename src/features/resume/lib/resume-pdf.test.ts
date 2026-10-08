import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs'
import { createCanvas } from '@napi-rs/canvas'
import fontkit from '@pdf-lib/fontkit'
import { createResumePdf, RESUME_PAGE } from './resume-pdf'
import { resumePdfSource } from './resume-pdf-offsets'

const font = new Uint8Array(readFileSync(new URL('../../../../public/fonts/NotoSansSC-Regular.ttf', import.meta.url)))
const compact = (text: string) => text.replace(/\s/g, '')

async function inspect(file: File) {
  const task = getDocument({ data: new Uint8Array(await file.arrayBuffer()) })
  const document = await task.promise
  const pages = []
  for (let number = 1; number <= document.numPages; number++) {
    const page = await document.getPage(number)
    const content = await page.getTextContent()
    pages.push(content.items.flatMap(item => 'str' in item ? [item.str] : []).join(''))
  }
  const count = document.numPages
  await task.destroy()
  return { text: pages.join(''), count }
}

describe('可投递 PDF', () => {
  it('实际渲染时每个中文、英文字母和数字都有可见字形', async () => {
    expect(
      typeof ArrayBuffer.prototype.transferToFixedLength,
      'PDF 渲染测试需要 Node.js 22.13 以上，请使用 .nvmrc 指定的 Node.js 24',
    ).toBe('function')
    const text = '林沐\nABCdef0123\n订单优化'
    const pdf = await createResumePdf(text, '简历.pdf', font)
    // Draw embedded glyph paths without system-font fallback, and request
    // strict parsing so malformed files cannot pass as a blank preview.
    const task = getDocument({
      data: new Uint8Array(await pdf.file.arrayBuffer()),
      disableFontFace: true,
      useSystemFonts: false,
      stopAtErrors: true,
    })
    try {
      const document = await task.promise
      const page = await document.getPage(1)
      const scale = 2
      const viewport = page.getViewport({ scale })
      const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height))
      await page.render({ canvas: canvas as unknown as HTMLCanvasElement, viewport }).promise
      const context = canvas.getContext('2d')
      const sourceFont = fontkit.create(font)
      for (const block of pdf.pages[0].blocks) {
        const size = block.kind === 'name' ? 20 : block.kind === 'heading' ? 12 : 10.5
        let x: number = RESUME_PAGE.margin
        for (const character of text.slice(block.start, block.end)) {
          const width = sourceFont.layout(character).glyphs[0].advanceWidth / sourceFont.unitsPerEm * size
          const pixels = context.getImageData(Math.floor(x * scale), Math.floor(block.top * scale), Math.ceil(width * scale), Math.ceil(block.height * scale)).data
          let darkPixels = 0
          for (let index = 0; index < pixels.length; index += 4) {
            if (pixels[index + 3] > 0 && pixels[index] < 180 && pixels[index + 1] < 180 && pixels[index + 2] < 180) darkPixels++
          }
          expect(darkPixels, `字形 ${character} 不应为空白`).toBeGreaterThan(3)
          x += width
        }
      }
    } finally {
      await task.destroy()
    }
  })

  it('输出包含中文和英文的可提取文字，文件、分页和预览段落一致', async () => {
    const text = '张三\n项目经历\n使用 React & TypeScript 开发订单页面，首屏耗时从 800ms 降至 120ms。'
    const pdf = await createResumePdf(text, '张三.docx', font)
    const result = await inspect(pdf.file)
    expect(pdf.file.name).toBe('张三-修改稿.pdf')
    expect(pdf.file.type).toBe('application/pdf')
    expect(compact(result.text)).toBe(compact(text))
    expect(result.count).toBe(pdf.pageCount)
    expect(pdf.file.size).toBeLessThan(5 * 1024 * 1024)
    expect(pdf.pages[0].blocks.map(block => text.slice(block.start, block.end))).toEqual(text.split('\n'))
  })

  it('长段落自动换行并跨页，页面不溢出、没有遗漏或重复文本', async () => {
    const text = '李四\n项目经历\n' + '负责 React 组件开发与性能优化，记录接口耗时与问题定位过程。'.repeat(100)
    const pdf = await createResumePdf(text, '简历.pdf', font)
    const result = await inspect(pdf.file)
    expect(pdf.pageCount).toBeGreaterThan(1)
    expect(compact(result.text)).toBe(compact(text))
    expect(result.count).toBe(pdf.pages.length)
    for (const page of pdf.pages) for (const block of page.blocks) {
      expect(block.top).toBeGreaterThanOrEqual(RESUME_PAGE.margin)
      expect(block.top + block.height).toBeLessThanOrEqual(RESUME_PAGE.height - RESUME_PAGE.margin)
      expect(block.height).toBeGreaterThan(0)
    }
  })

  it('在换行规范化和控制符清理之后仍能定位到原始编辑范围', async () => {
    const input = '\n\u0000 张三\r\n项目经历\r\n  使用 React & TypeScript\n'
    const pdf = await createResumePdf(input, '张三-修改稿.pdf', font)
    expect(pdf.text).toBe('张三\n项目经历\n  使用 React & TypeScript')
    expect(pdf.file.name).toBe('张三-修改稿.pdf')
    expect(pdf.pages[0].blocks.map(block => input.slice(block.start, block.end))).toEqual(['张三', '项目经历', '  使用 React & TypeScript'])
  })

  it('不支持的字形会明确报错，避免生成缺字的简历', async () => {
    await expect(createResumePdf('张三\n项目经历\n使用 React 🫠', '简历.pdf', font)).rejects.toThrow('PDF 字体不支持')
  })

  it('映射保留代理对位置并拒绝空文档', async () => {
    const source = resumePdfSource('\n😀\r\n内容\n')
    expect(source.text).toBe('😀\n内容')
    expect(source.range(0, 2)).toEqual({ start: 1, end: 3 })
    expect(source.range(3, 5)).toEqual({ start: 5, end: 7 })
    await expect(createResumePdf(' \n\u0000', '简历.pdf', font)).rejects.toThrow('不能为空')
  })
})
