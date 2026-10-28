import { readFileSync } from 'node:fs'
import { createCanvas } from '@napi-rs/canvas'
import { PDFDocument, rgb } from 'pdf-lib'
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs'
import { expect, it } from 'vitest'
import { createResumePdf } from './resume-pdf'
import { editOriginalPdf } from './original-pdf'

const fontBytes = new Uint8Array(readFileSync(new URL('../../../../public/fonts/NotoSansSC-Regular.ttf', import.meta.url)))
const wasmBinary = new Uint8Array(readFileSync(new URL('../../../../node_modules/@embedpdf/pdfium/dist/pdfium.wasm', import.meta.url)))
const text = '林沐\n项目经历\n参与前端页面开发与接口联调。\n专业技能\nReact、TypeScript'
const options = { fontBytes, wasmBinary }
async function original() {
  const artifact = await createResumePdf(text, '原简历.pdf', fontBytes)
  const document = await PDFDocument.load(await artifact.file.arrayBuffer())
  const image = createCanvas(40, 60), context = image.getContext('2d')
  context.fillStyle = '#cf5b37'; context.fillRect(0, 0, 40, 60)
  context.fillStyle = '#f2c76d'; context.fillRect(8, 8, 24, 44)
  const photo = await document.embedPng(image.toBuffer('image/png'))
  document.getPage(0).drawImage(photo, { x: 485, y: 720, width: 50, height: 75 })
  document.getPage(0).drawLine({ start: { x: 32, y: 700 }, end: { x: 35, y: 200 }, thickness: 3, color: rgb(.2, .4, .7) })
  return new File([Uint8Array.from(await document.save()).buffer], '原简历.pdf', { type: 'application/pdf' })
}
async function inspect(file: File) {
  const task = getDocument({ data: new Uint8Array(await file.arrayBuffer()), disableFontFace: true, useSystemFonts: false })
  try {
    const pdf = await task.promise, page = await pdf.getPage(1)
    const content = await page.getTextContent()
    const canvas = createCanvas(596, 842)
    await page.render({ canvas: canvas as unknown as HTMLCanvasElement, viewport: page.getViewport({ scale: 1 }) }).promise
    return { text: content.items.flatMap(item => 'str' in item ? [item.str] : []).join(''), image: canvas.getContext('2d').getImageData(480, 40, 70, 110).data }
  } finally { await task.destroy() }
}
it('未采用建议时直接使用原文件，原照片、文字和排版字节不变', async () => {
  const file = await original()
  const artifact = await editOriginalPdf(file, text, text, options)
  expect(artifact.file).toBe(file)
  expect(artifact.template).toBe('original')
  expect(artifact.pages[0].blocks.some(block => text.slice(block.start, block.end) === '参与前端页面开发与接口联调。')).toBe(true)
}, 15000)
it('原位替换真实文字对象，旧句子不再可提取，照片区域保持逐像素一致', async () => {
  const file = await original()
  const changed = text.replace('参与前端页面开发与接口联调。', '参与页面开发与接口联调。')
  const artifact = await editOriginalPdf(file, text, changed, options)
  const before = await inspect(file), after = await inspect(artifact.file)
  expect(after.text).toContain('参与页面开发与接口联调。')
  expect(after.text).not.toContain('参与前端页面开发与接口联调。')
  expect(after.text).toContain('React、TypeScript')
  expect(after.image).toEqual(before.image)
  expect(artifact.file.name).toBe('原简历-修改稿.pdf')
}, 15000)
it('原位置放不下时拒绝导出，不能悄悄套模板、覆盖邻近内容或修改原文件', async () => {
  const file = await original(), bytes = await file.arrayBuffer()
  await expect(editOriginalPdf(file, text, text.replace('参与前端页面开发与接口联调。', '负责页面开发与接口联调。'.repeat(12)), options)).rejects.toThrow('超出原位置')
  expect(await file.arrayBuffer()).toEqual(bytes)
}, 15000)
it('原文无法对应、纯新增段落或非 PDF 文件会明确拒绝原位写回', async () => {
  const file = await original()
  await expect(editOriginalPdf(file, text, text + '\n新增不存在的经历', options)).rejects.toThrow('无法在原 PDF 中可靠定位')
  await expect(editOriginalPdf(new File([text], '简历.docx'), text, text, options)).rejects.toThrow('目前支持 PDF')
}, 15000)
it('相邻的姓名、邮箱分别修改时按各自原位置写回，不把多条内容并成一个文本框', async () => {
  const source = '林沐\nlin@example.com\n项目经历\n参与页面开发与测试。'
  const original = await createResumePdf(source, '原简历.pdf', fontBytes)
  const changed = source.replace('林沐', '林森').replace('lin@example.com', 'me@example.com')
  const artifact = await editOriginalPdf(original.file, source, changed, options)
  const result = await inspect(artifact.file)
  expect(result.text).toContain('林森')
  expect(result.text).toContain('me@example.com')
  expect(result.text).not.toContain('林沐')
  expect(result.text).not.toContain('lin@example.com')
  expect(result.text).toContain('参与页面开发与测试。')
}, 15000)
