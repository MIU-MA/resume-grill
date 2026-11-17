import { getPdfJs } from './pdfjs'

/** Render the original file, preserving its layout and embedded photo. */
export async function renderResumePdfImages(file: File, maxPages = 3): Promise<File[]> {
  if (file.type !== 'application/pdf' && !/\.pdf$/i.test(file.name)) throw new Error('自动生成简历图片需要 PDF 原文件。')
  const pdfjs = await getPdfJs()
  const task = pdfjs.getDocument({ data: await file.arrayBuffer(), cMapUrl: '/generated/cmaps/', cMapPacked: true, standardFontDataUrl: '/generated/standard_fonts/', wasmUrl: '/generated/wasm/' })
  try {
    const pdf = await task.promise
    if (pdf.numPages > maxPages) throw new Error(`简历有 ${pdf.numPages} 页，最多发送 ${maxPages} 张图片；请先整理简历或自行选择图片，不会截掉后面的页面。`)
    const files: File[] = []
    for (let number = 1; number <= pdf.numPages; number++) {
      const page = await pdf.getPage(number), initial = page.getViewport({ scale: 1 })
      const viewport = page.getViewport({ scale: Math.min(2, 1800 / initial.width, 2400 / initial.height) })
      const canvas = document.createElement('canvas')
      canvas.width = Math.ceil(viewport.width); canvas.height = Math.ceil(viewport.height)
      try {
        await page.render({ canvas, viewport }).promise
        const encode = (type: string, quality?: number) => new Promise<Blob>((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('简历图片生成失败，请重试。')), type, quality))
        let image = await encode('image/png')
        if (image.size > 5 * 1024 * 1024) image = await encode('image/jpeg', .9)
        if (image.size > 5 * 1024 * 1024) throw new Error('简历图片超过 5 MB，请先压缩 PDF 或自行选择图片。')
        files.push(new File([image], `${file.name.replace(/\.pdf$/i, '')}-第${number}页.${image.type === 'image/png' ? 'png' : 'jpg'}`, { type: image.type }))
      } finally { canvas.width = 0; canvas.height = 0; page.cleanup() }
    }
    if (files.reduce((size, image) => size + image.size, 0) > 10 * 1024 * 1024) throw new Error('简历图片合计超过 10 MB，请先压缩 PDF。')
    return files
  } finally { await task.destroy() }
}
