import { readFileSync } from 'node:fs'
import { createCanvas, ImageData } from '@napi-rs/canvas'
import { PDFDocument } from 'pdf-lib'
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs'
import { expect, it } from 'vitest'
import { extractSourceResumePhotos } from './source-resume-photos'
import { createResumePdf } from './resume-pdf'
import JSZip from 'jszip'

const font = new Uint8Array(readFileSync('public/fonts/NotoSansSC-Regular.ttf'))
const wasmBinary = new Uint8Array(readFileSync('node_modules/@embedpdf/pdfium/dist/pdfium.wasm'))
const encode = (pixels: Uint8ClampedArray, width: number, height: number) => {
  const canvas = createCanvas(width, height)
  canvas.getContext('2d').putImageData(new ImageData(pixels, width, height), 0, 0)
  return canvas.toDataURL('image/png')
}
async function original(count=1, nested=false, scan=false) {
  const document=await PDFDocument.create(), page=document.addPage([595,842])
  const canvas=createCanvas(120,160), context=canvas.getContext('2d')
  context.fillStyle='#e32120';context.fillRect(0,0,120,160)
  const image=await document.embedPng(canvas.toBuffer('image/png'))
  if(scan) page.drawImage(image,{x:0,y:0,width:595,height:842})
  else for(let i=0;i<count;i++)page.drawImage(image,{x:42+i*420,y:715,width:62,height:83})
  let bytes=await document.save()
  if(nested) {
    const wrapper=await PDFDocument.create(), embedded=await wrapper.embedPdf(bytes)
    wrapper.addPage([595,842]).drawPage(embedded[0],{x:0,y:0,width:595,height:842})
    bytes=await wrapper.save()
  }
  return new File([Uint8Array.from(bytes).buffer],'用户上传.pdf',{type:'application/pdf'})
}
it.each([false,true])('上传 PDF 自动提取真实图片（嵌套对象=%s），改文字并换模板后图片仍实际可见',async nested=>{
  const photos=await extractSourceResumePhotos(await original(1,nested),{wasmBinary,encode})
  expect(photos).toHaveLength(1);expect(photos[0].position).toBe('left')
  const pdf=await createResumePdf('林沐\n专业技能\nTypeScript、React','修改.pdf',font,'modern',photos[0])
  const task=getDocument({data:new Uint8Array(await pdf.file.arrayBuffer()),disableFontFace:true,useSystemFonts:false})
  try {
    const page=await(await task.promise).getPage(1),canvas=createCanvas(596,842)
    await page.render({canvas:canvas as unknown as HTMLCanvasElement,viewport:page.getViewport({scale:1})}).promise
    const pixel=canvas.getContext('2d').getImageData(60,65,1,1).data
    expect(pixel[0]).toBeGreaterThan(200);expect(pixel[1]).toBeLessThan(70)
    const text=(await page.getTextContent()).items.flatMap(item=>'str'in item?[item.str]:[]).join('')
    expect(text).toContain('TypeScript')
  } finally {await task.destroy()}
},15000)
it('保留多张候选供用户选择，不把扫描整页当照片',async()=>{
  expect(await extractSourceResumePhotos(await original(2),{wasmBinary,encode})).toHaveLength(2)
  expect(await extractSourceResumePhotos(await original(1,false,true),{wasmBinary,encode})).toEqual([])
},15000)
it('Word 的照片直接复用，遇到无法嵌入的格式时明确要求手动上传', async () => {
  const zip = new JSZip(), canvas = createCanvas(30,40)
  zip.file('word/media/photo.png', canvas.toBuffer('image/png'))
  const file = new File([await zip.generateAsync({type:'arraybuffer'})], '简历.docx')
  expect((await extractSourceResumePhotos(file))[0].dataUrl).toMatch(/^data:image\/png;base64,/)
  zip.file('word/media/vector.emf', 'unsupported')
  await expect(extractSourceResumePhotos(new File([await zip.generateAsync({type:'arraybuffer'})], '简历.docx'))).rejects.toThrow('手动上传')
})
