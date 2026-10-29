import type { ResumePhoto } from '@/domain/resume-photo'
import { getEngine } from './original-pdf'

type Encoder = (rgba: Uint8ClampedArray, width: number, height: number) => string
function encode(rgba: Uint8ClampedArray, width: number, height: number) {
  const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height
  const context = canvas.getContext('2d')
  if (!context) throw new Error('图片读取失败，请手动上传照片。')
  context.putImageData(new ImageData(Uint8ClampedArray.from(rgba), width, height), 0, 0)
  return canvas.toDataURL('image/png')
}
const cache = new WeakMap<File, Promise<ResumePhoto[]>>()
export function sourceResumePhotos(file: File): Promise<ResumePhoto[]> {
  if (!cache.has(file)) cache.set(file, extractSourceResumePhotos(file).catch(error => { cache.delete(file); throw error }))
  return cache.get(file)!
}

/** Extract header-sized image objects, not a screenshot of the resume or guessed personal identity. */
export async function extractSourceResumePhotos(file: File, options: { wasmBinary?: Uint8Array; encode?: Encoder } = {}): Promise<ResumePhoto[]> {
  if (/\.docx$/i.test(file.name)) {
    const { default: JSZip } = await import('jszip')
    const zip = await JSZip.loadAsync(await file.arrayBuffer())
    const media = Object.values(zip.files).filter(entry => !entry.dir && /^word\/media\//.test(entry.name))
    if (media.length > 8 || media.some(entry => !/\.(png|jpe?g)$/i.test(entry.name))) throw new Error('Word 中的图片较多或格式不支持，请手动上传需要的照片。')
    return Promise.all(media.map(async entry => {
      const data = await entry.async('uint8array')
      if (data.length > 1500000) throw new Error('Word 中的图片过大，请重新上传压缩后的照片。')
      let binary = ''; for (let offset=0;offset<data.length;offset+=16384) binary+=String.fromCharCode(...data.subarray(offset,offset+16384))
      return { dataUrl: `data:image/${/\.png$/i.test(entry.name)?'png':'jpeg'};base64,${btoa(binary)}`, position: 'right' as const }
    }))
  }
  if (!/\.pdf$/i.test(file.name)) return []
  const bytes = new Uint8Array(await file.arrayBuffer())
  const engine = await getEngine(options.wasmBinary)
  const mem = engine.pdfium as typeof engine.pdfium & { HEAPU8: Uint8Array }
  const pointer = mem.wasmExports.malloc(bytes.length), scratch = mem.wasmExports.malloc(32)
  mem.HEAPU8.set(bytes, pointer)
  const document = engine.FPDF_LoadMemDocument(pointer, bytes.length, '')
  let page = 0
  const photos: ResumePhoto[] = []
  try {
    if (!document) throw new Error('原文件图片未能读取，请手动上传照片。')
    page = engine.FPDF_LoadPage(document, 0)
    if (!page) return []
    const width = engine.FPDF_GetPageWidth(page), height = engine.FPDF_GetPageHeight(page)
    type Matrix = [number, number, number, number, number, number]
    const point = (m: Matrix, x: number, y: number) => [m[0]*x+m[2]*y+m[4], m[1]*x+m[3]*y+m[5]]
    let visited = 0
    const walk = (object: number, parent: Matrix, depth: number) => {
      if (++visited > 2000 || depth > 8) throw new Error('原文件图片结构复杂，请手动选择照片。')
      const type = engine.FPDFPageObj_GetType(object)
      if (type === 5 && engine.FPDFPageObj_GetMatrix(object, scratch)) {
        const m = Array.from({ length: 6 }, (_, i) => mem.getValue(scratch+i*4, 'float')) as Matrix
        const origin = point(parent, m[4], m[5]), a = point(parent, m[0]+m[4], m[1]+m[5]), b = point(parent, m[2]+m[4], m[3]+m[5])
        const next: Matrix = [a[0]-origin[0], a[1]-origin[1], b[0]-origin[0], b[1]-origin[1], ...origin] as Matrix
        const count = engine.FPDFFormObj_CountObjects(object)
        for (let i=0; i<count; i++) walk(engine.FPDFFormObj_GetObject(object, i), next, depth+1)
      }
      if (type !== 3 || !engine.FPDFPageObj_GetBounds(object, scratch, scratch+4, scratch+8, scratch+12)) return
      const [l, bottom, r, top] = Array.from({ length: 4 }, (_, i) => mem.getValue(scratch+i*4, 'float'))
      const corners = [[l,bottom],[l,top],[r,bottom],[r,top]].map(([x,y])=>point(parent,x,y))
      const left = Math.min(...corners.map(p=>p[0])), right = Math.max(...corners.map(p=>p[0]))
      const upper = Math.max(...corners.map(p=>p[1])), lower = Math.min(...corners.map(p=>p[1]))
      const w=right-left, h=upper-lower
      if (w<24 || h<32 || w>160 || h>190 || w/h<.45 || w/h>1.25 || upper<height*.58 || left<0 || right>width+1) return
      if (photos.length>=8) throw new Error('原文件有较多图片，请手动选择照片。')
      const bitmap = engine.FPDFImageObj_GetRenderedBitmap(document, page, object)
      if (!bitmap) throw new Error('原文件图片无法解码，请手动上传照片。')
      try {
        const bw=engine.FPDFBitmap_GetWidth(bitmap), bh=engine.FPDFBitmap_GetHeight(bitmap), stride=engine.FPDFBitmap_GetStride(bitmap), format=engine.FPDFBitmap_GetFormat(bitmap)
        if (!bw || !bh || bw*bh>4000000 || ![1,2,3,4].includes(format)) throw new Error('图片尺寸或格式不支持，请手动上传照片。')
        const data=mem.HEAPU8, address=engine.FPDFBitmap_GetBuffer(bitmap), rgba=new Uint8ClampedArray(bw*bh*4), channels=format===1?1:format===2?3:4
        for(let y=0;y<bh;y++)for(let x=0;x<bw;x++) {
          const from=address+y*stride+x*channels, to=(y*bw+x)*4
          rgba[to]=data[from+(channels===1?0:2)]; rgba[to+1]=data[from+(channels===1?0:1)]; rgba[to+2]=data[from]; rgba[to+3]=format===4?data[from+3]:255
        }
        photos.push({ dataUrl:(options.encode??encode)(rgba,bw,bh), position:(left+right)/2<width/2?'left':'right' })
      } finally { engine.FPDFBitmap_Destroy(bitmap) }
    }
    const count = engine.FPDFPage_CountObjects(page)
    for(let i=0;i<count;i++)walk(engine.FPDFPage_GetObject(page,i),[1,0,0,1,0,0],0)
    return photos
  } finally { if(page)engine.FPDF_ClosePage(page); if(document)engine.FPDF_CloseDocument(document);mem.wasmExports.free(scratch);mem.wasmExports.free(pointer) }
}
