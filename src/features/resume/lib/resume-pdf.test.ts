import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs'
import { createCanvas } from '@napi-rs/canvas'
import fontkit from '@pdf-lib/fontkit'
import { createResumePdf, RESUME_PAGE } from './resume-pdf'
import { resumePdfSource } from './resume-pdf-offsets'
import { RESUME_TEMPLATES } from '@/domain/resume-template'

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
  it.each(RESUME_TEMPLATES)('$name：实际渲染时每个中文、英文字母和数字都有可见字形', async template => {
    expect(
      typeof ArrayBuffer.prototype.transferToFixedLength,
      'PDF 渲染测试需要 Node.js 22.13 以上，请使用 .nvmrc 指定的 Node.js 24',
    ).toBe('function')
    const text = '林沐\nABCdef0123\n订单优化'
    const pdf = await createResumePdf(text, '简历.pdf', font, template.id)
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
        const size = block.fontSize!
        let x: number = block.left ?? RESUME_PAGE.margin
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
  }, 15000) // Real glyph rendering competes with other font/PDF tests in CI.

  it.each(RESUME_TEMPLATES)('$name：较长简历自适应一页，仍保留全部文字和可点击位置', async template => {
    const text = '林沐\nlin@example.com\n\n项目经历\n订单管理系统\n' + '使用 React 开发页面，参与接口联调与测试。'.repeat(120) + '\n\n专业技能\nReact、TypeScript、CSS'
    const pdf = await createResumePdf(text, '简历.pdf', font, template.id)
    expect(pdf.template).toBe(template.id)
    expect(pdf.pageCount).toBe(1)
    expect((await inspect(pdf.file)).count).toBe(1)
    expect(compact((await inspect(pdf.file)).text)).toBe(compact(text))
    for (const page of pdf.pages) for (const block of page.blocks) {
      expect(block.top).toBeGreaterThanOrEqual(RESUME_PAGE.margin)
      expect(block.height).toBeGreaterThan(0)
      if (block.fontSize !== undefined) expect(block.fontSize).toBeGreaterThanOrEqual(8)
      expect(block.top + block.height).toBeLessThanOrEqual(RESUME_PAGE.height - RESUME_PAGE.margin)
      if (block.left !== undefined && block.width !== undefined) {
        expect(block.left).toBeGreaterThanOrEqual(RESUME_PAGE.margin)
        expect(block.left + block.width).toBeLessThanOrEqual(RESUME_PAGE.width - RESUME_PAGE.margin + .01)
      }
      if (block.kind === 'blank') expect(text.slice(block.start, block.end)).toBe('')
      else expect(text.slice(block.start, block.end).trim()).not.toBe('')
    }
    if (template.id === 'sidebar') {
      const heading = pdf.pages[0].blocks.find(block => block.kind === 'heading')!
      const entry = pdf.pages[0].blocks.find(block => text.slice(block.start, block.end) === '订单管理系统')!
      expect(entry.top).toBe(heading.top)
      expect(entry.left).toBeGreaterThan(heading.left!)
    }
  }, 15000)

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

  it.each(RESUME_TEMPLATES.filter(template => ['meowth', 'brilliant', 'persian', 'typst'].includes(template.id)))('$name：经历日期对齐，分栏、独立职位和未知正文均不丢失', async template => {
    const text = '林沐\n工作经历\n星河科技 | 前端开发工程师 | 2024.07 — 至今\n- 负责订单页面与接口联调。\n\n2023.07 — 2023.12\n远山软件\n- 参与运营后台开发。\n\n示例公司\n前端开发实习生\n2022.07 — 2022.12\n- 完成页面测试。\n\n其他信息\n个人主页：https://example.com/a-long-path\n尚未分类的内容保持原样。'
    const pdf = await createResumePdf(text, '简历.pdf', font, template.id)
    expect(compact((await inspect(pdf.file)).text)).toBe(compact(text))
    const blocks = pdf.pages.flatMap(page => page.blocks)
    const title = blocks.find(block => text.slice(block.start, block.end).startsWith('星河科技'))!
    const date = blocks.find(block => text.slice(block.start, block.end) === '2024.07 — 至今')!
    expect(date.top).toBe(title.top)
    if (template.id === 'typst') expect(date.left).toBeLessThan(title.left!)
    else expect(date.left).toBeGreaterThan(title.left!)
    const company = blocks.find(block => text.slice(block.start, block.end) === '示例公司')!
    const role = blocks.find(block => text.slice(block.start, block.end) === '前端开发实习生')!
    expect(role.top).toBeGreaterThan(company.top)
    for (const block of blocks.filter(block => block.kind !== 'blank')) {
      expect(text.slice(block.start, block.end).trim()).not.toBe('')
      expect(block.top + block.height).toBeLessThanOrEqual(RESUME_PAGE.height - RESUME_PAGE.margin)
      expect(block.left! + block.width!).toBeLessThanOrEqual(RESUME_PAGE.width - RESUME_PAGE.margin + .01)
    }
  }, 15000)

  it.each(RESUME_TEMPLATES.filter(template => ['meowth', 'brilliant', 'persian', 'typst'].includes(template.id)))('$name：长经历标题自适应时不重叠、不截断，日期仍能定位原文', async template => {
    const text = '林沐\n项目经历\n' + Array.from({ length: 5 }, (_, index) => `第 ${index + 1} 个跨部门协作运营管理系统 | 前端开发与测试负责人\n2023.01 — 2024.06\n- ${'使用 React 开发业务组件并完成测试。'.repeat(3)}\n`).join('\n')
    const pdf = await createResumePdf(text, '简历.pdf', font, template.id)
    expect(pdf.pageCount).toBe(1)
    expect(compact((await inspect(pdf.file)).text)).toBe(compact(text))
    for (const page of pdf.pages) {
      const dates = page.blocks.filter(block => text.slice(block.start, block.end) === '2023.01 — 2024.06')
      for (const date of dates) expect(page.blocks.some(block => block.kind === 'body' && block.top === date.top && text.slice(block.start, block.end).startsWith('第 '))).toBe(true)
      for (const block of page.blocks) {
        expect(block.top).toBeGreaterThanOrEqual(RESUME_PAGE.margin)
        expect(block.top + block.height).toBeLessThanOrEqual(RESUME_PAGE.height - RESUME_PAGE.margin)
      }
    }
  }, 15000)

  it('长段落自动换行并缩进一页，页面不溢出、没有遗漏或重复文本', async () => {
    const text = '李四\n项目经历\n' + '负责 React 组件开发与性能优化，记录接口耗时与问题定位过程。'.repeat(70)
    const pdf = await createResumePdf(text, '简历.pdf', font)
    const result = await inspect(pdf.file)
    expect(pdf.pageCount).toBe(1)
    expect(compact(result.text)).toBe(compact(text))
    expect(result.count).toBe(pdf.pages.length)
    for (const page of pdf.pages) for (const block of page.blocks) {
      expect(block.top).toBeGreaterThanOrEqual(RESUME_PAGE.margin)
      expect(block.top + block.height).toBeLessThanOrEqual(RESUME_PAGE.height - RESUME_PAGE.margin)
      expect(block.height).toBeGreaterThan(0)
    }
  })

  it.each(RESUME_TEMPLATES)('$name：带照片的完整经历自动适配一页，页数与实际文件一致', async template => {
    const photo = createCanvas(90, 120)
    photo.getContext('2d').fillStyle = '#e32120'
    photo.getContext('2d').fillRect(0, 0, 90, 120)
    const text = readFileSync('examples/resume-templates.txt', 'utf8').trim() + '\n\n其他信息\n' + '参与项目维护，整理接口文档，补充页面测试与组件使用说明。'.repeat(27)
    const pdf = await createResumePdf(text, '简历.pdf', font, template.id, { dataUrl: photo.toDataURL('image/png'), position: 'right' })
    expect(pdf.pageCount).toBe(1)
    const result = await inspect(pdf.file)
    expect(result.count).toBe(1)
    expect(compact(result.text)).toBe(compact(text))
    for (const block of pdf.pages[0].blocks) {
      expect(block.top + block.height).toBeLessThanOrEqual(RESUME_PAGE.height - RESUME_PAGE.margin)
      if (block.fontSize !== undefined) expect(block.fontSize).toBeGreaterThanOrEqual(8)
    }
  }, 15000)

  it.each(RESUME_TEMPLATES)('$name：内容过多时明确提示精简，不截断内容或生成第二页', async template => {
    const text = '林沐\n项目经历\n' + '负责 React 组件开发与性能优化，记录接口耗时与问题定位过程。'.repeat(160)
    await expect(createResumePdf(text, '简历.pdf', font, template.id)).rejects.toThrow('内容仍超出一页')
  }, 15000)

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
