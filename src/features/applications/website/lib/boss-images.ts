import { bossPreparationSchema } from './boss-preparation'
export async function describeBossImages(files: File[]) {
  if (files.length > 3 || files.some(file => !file.size || file.size > 5 * 1024 * 1024) || files.reduce((sum, file) => sum + file.size, 0) > 10 * 1024 * 1024) throw new Error('最多 3 张图片，单张不超过 5 MB，合计不超过 10 MB。')
  const images = await Promise.all(files.map(async file => {
    const bytes = await file.arrayBuffer()
    const signature = new Uint8Array(bytes)
    const png = signature[0] === 137 && signature[1] === 80 && signature[2] === 78 && signature[3] === 71
    const jpeg = signature[0] === 255 && signature[1] === 216 && signature[2] === 255
    if (!(file.type === 'image/png' && png || file.type === 'image/jpeg' && jpeg)) throw new Error('请选择 PNG 或 JPG 图片。')
    const bitmap = await createImageBitmap(file)
    const width = bitmap.width, height = bitmap.height
    bitmap.close()
    const sha256 = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)), byte => byte.toString(16).padStart(2, '0')).join('')
    return { name: file.name, size: file.size, type: file.type as 'image/png' | 'image/jpeg', width, height, sha256 }
  }))
  return bossPreparationSchema.shape.images.parse(images)
}
