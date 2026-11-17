import { createCanvas, loadImage } from '@napi-rs/canvas'
import { PDFDocument } from 'pdf-lib'
import { afterEach, expect, it, vi } from 'vitest'
import { renderResumePdfImages } from './pdf-images'

vi.mock('./pdfjs', () => ({ getPdfJs: () => import('pdfjs-dist/legacy/build/pdf.mjs') }))
afterEach(() => vi.unstubAllGlobals())

it('从原 PDF 渲染图片，保留照片所在位置和颜色，不根据简历文字重新排版', async () => {
  const pdf = await PDFDocument.create(), page = pdf.addPage([200, 300])
  const photo = createCanvas(20, 20), context = photo.getContext('2d')
  context.fillStyle = '#ed1c24'; context.fillRect(0, 0, 20, 20)
  page.drawImage(await pdf.embedPng(photo.toBuffer('image/png')), { x: 150, y: 250, width: 20, height: 20 })
  vi.stubGlobal('document', { createElement: () => {
    const canvas = createCanvas(1, 1)
    Object.assign(canvas, { toBlob: (done: (blob: Blob) => void) => done(new Blob([new Uint8Array(canvas.toBuffer('image/png'))], { type: 'image/png' })) })
    return canvas
  } })
  const images = await renderResumePdfImages(new File([new Uint8Array(await pdf.save())], '原简历.pdf', { type: 'application/pdf' }))
  expect(images).toHaveLength(1)
  expect(images[0].name).toBe('原简历-第1页.png')
  const image = await loadImage(Buffer.from(await images[0].arrayBuffer()))
  expect([image.width, image.height]).toEqual([400, 600])
  const canvas = createCanvas(image.width, image.height), pixels = canvas.getContext('2d')
  pixels.drawImage(image, 0, 0)
  const color = [...pixels.getImageData(320, 80, 1, 1).data]
  expect(color[0]).toBeGreaterThan(220); expect(color[1]).toBeLessThan(50); expect(color[2]).toBeLessThan(60)
})

it('超过三页时拒绝自动转换，不静默截断简历', async () => {
  const pdf = await PDFDocument.create()
  for (let index = 0; index < 4; index++) pdf.addPage()
  await expect(renderResumePdfImages(new File([new Uint8Array(await pdf.save())], '四页.pdf', { type: 'application/pdf' }))).rejects.toThrow('不会截掉后面的页面')
})
