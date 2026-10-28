import type { PDFDocument } from 'pdf-lib'

let fontRequest: Promise<Uint8Array> | undefined
async function loadResumeFont() {
  fontRequest ??= fetch('/fonts/NotoSansSC-Regular.ttf', { signal: AbortSignal.timeout(20000) }).then(async response => {
    if (!response.ok) throw new Error('中文字体未能加载，请重试 PDF 预览。')
    return new Uint8Array(await response.arrayBuffer())
  }).catch(error => { fontRequest = undefined; throw error })
  return fontRequest
}

export async function embedResumeFont(document: PDFDocument, text: string, fontBytes?: Uint8Array) {
  const [{ default: fontkit }, { createFont }, bytes] = await Promise.all([
    import('@pdf-lib/fontkit'), import('fonteditor-core'), fontBytes ? Promise.resolve(fontBytes) : loadResumeFont(),
  ])
  document.registerFontkit(fontkit)
  const available = new Set(fontkit.create(bytes).characterSet)
  const missing = [...new Set(Array.from(text).filter(character => !/\s/u.test(character) && !available.has(character.codePointAt(0)!)))]
  if (missing.length) throw new Error(`PDF 字体不支持这些字符：${missing.slice(0, 8).join(' ')}。请替换后再保存。`)
  // Build a standalone TrueType subset: pdf-lib's CJK subsetter can drop glyphs.
  const subset = createFont(Uint8Array.from(bytes).buffer, {
    type: 'ttf', subset: [...new Set(Array.from(text + ' ').filter(character => !/[\n\t]/.test(character)).map(character => character.codePointAt(0)!))],
    compound2simple: true, hinting: false,
  })
  return document.embedFont(subset.write({ type: 'ttf', toBuffer: false }), { subset: false })
}
