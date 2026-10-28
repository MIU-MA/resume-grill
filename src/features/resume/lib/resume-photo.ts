import type { PDFDocument, PDFPage } from 'pdf-lib'
import type { ResumePhoto } from '@/domain/resume-photo'

export async function readResumePhoto(file: File): Promise<ResumePhoto> {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 5 * 1024 * 1024) throw new Error('请选择 5 MB 以内的 JPG、PNG 或 WebP 照片。')
  const bitmap = await createImageBitmap(file)
  try {
    if (!bitmap.width || !bitmap.height || bitmap.width * bitmap.height > 40000000) throw new Error('照片尺寸过大或无法读取，请换一张图片。')
    const scale = Math.min(1, 600 / bitmap.width, 800 / bitmap.height)
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(bitmap.width * scale)); canvas.height = Math.max(1, Math.round(bitmap.height * scale))
    const context = canvas.getContext('2d')
    if (!context) throw new Error('照片未能处理，请重试。')
    context.fillStyle = 'white'; context.fillRect(0, 0, canvas.width, canvas.height)
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
    return { dataUrl: canvas.toDataURL('image/jpeg', .88), position: 'right' }
  } finally { bitmap.close() }
}

export type PdfPhotoBox = { left: number; width: number; height: number; textLeft: number; textWidth: number; bottom: number }
export async function drawResumePhoto(document: PDFDocument, page: PDFPage, photo?: ResumePhoto | null): Promise<PdfPhotoBox | undefined> {
  if (!photo) return
  if (!/^data:image\/(?:jpeg|png);base64,[A-Za-z\d+/=]+$/.test(photo.dataUrl) || photo.dataUrl.length > 2500000) throw new Error('照片数据无效，请重新上传。')
  const image = photo.dataUrl.startsWith('data:image/png') ? await document.embedPng(photo.dataUrl) : await document.embedJpg(photo.dataUrl)
  const margin = 42, width = 62, height = 83, gap = 18
  const left = photo.position === 'left' ? margin : page.getWidth() - margin - width
  const fitted = image.scaleToFit(width, height)
  page.drawImage(image, { x: left + (width - fitted.width) / 2, y: page.getHeight() - margin - height + (height - fitted.height) / 2, ...fitted })
  return { left, width, height, textLeft: photo.position === 'left' ? margin + width + gap : margin, textWidth: page.getWidth() - margin * 2 - width - gap, bottom: margin + height }
}
