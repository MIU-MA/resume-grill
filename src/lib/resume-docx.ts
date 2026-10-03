export type ResumeDocumentParagraph = {
  text: string
  kind: 'name' | 'heading' | 'body' | 'blank'
}

const XML_DECLARATION = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
const DOCX_TYPE = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
const SECTION_HEADING = /^(?:个人信息|基本信息|联系方式|个人简介|个人优势|个人总结|求职意向|求职目标|教育经历|教育背景|工作经历|工作经验|实习经历|项目经历|项目经验|项目介绍|专业技能|技术技能|技术能力|技能清单|技能特长|专业能力|相关技能|荣誉奖项|获奖经历|证书|资格证书|自我评价|其他信息|summary|profile|contact|education|experience|work experience|employment|projects|skills|technical skills|certifications|awards|publications|languages|interests)[:：]?$/i

/** Use the same text for persistence, preview and OOXML; never trim individual lines. */
export function normalizeResumeDocumentText(rawText: string): string {
  const normalized = rawText.replace(/\r\n?|\u2028|\u2029/g, '\n')
  return Array.from(normalized).filter(character => {
    const code = character.codePointAt(0)!
    return code === 0x9 || code === 0xa || (code >= 0x20 && code <= 0xd7ff)
      || (code >= 0xe000 && code <= 0xfffd) || (code >= 0x10000 && code <= 0x10ffff)
  }).join('')
}

function isName(text: string): boolean {
  if (/^(?:姓名\s*[:：]\s*)[\p{L}·・ .'-]{2,40}$/u.test(text)) return true
  if (/(?:简历|求职|开发|工程|设计|经理|技术|工作|应聘|毕业|实习|resume|curriculum|developer|engineer|designer|manager)/i.test(text)) return false
  return /^[\p{Script=Han}]{2,4}(?:[·・][\p{Script=Han}]{1,4})?$/u.test(text)
    || /^[A-Z][a-z]+(?:[-'][A-Z]?[a-z]+)?(?: [A-Z][a-z]+(?:[-'][A-Z]?[a-z]+)?){1,2}$/.test(text)
}

export function resumeDocumentParagraphs(rawText: string): ResumeDocumentParagraph[] {
  return normalizeResumeDocumentText(rawText).split('\n').map((text, index) => {
    const label = text.trim()
    if (!label) return { text, kind: 'blank' }
    if (SECTION_HEADING.test(label) || /^#{1,3}\s+\S.{0,29}$/.test(label)) return { text, kind: 'heading' }
    if (index === 0 && isName(label)) return { text, kind: 'name' }
    return { text, kind: 'body' }
  })
}

function escapeXml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&apos;')
}

function paragraphXml({ text, kind }: ResumeDocumentParagraph): string {
  const style = kind === 'name' ? 'ResumeName' : kind === 'heading' ? 'Heading1' : 'Normal'
  const spacing = kind === 'blank' ? '<w:spacing w:after="0" w:line="140" w:lineRule="auto"/>' : ''
  const runs = text.split('\t').map(escapeXml).map(part => `<w:t xml:space="preserve">${part}</w:t>`).join('<w:tab/>')
  return `<w:p><w:pPr><w:pStyle w:val="${style}"/>${spacing}</w:pPr><w:r>${runs}</w:r></w:p>`
}

function revisionFileName(sourceFile: string): string {
  const basename = sourceFile.split(/[\\/]/).at(-1) ?? ''
  const safeBasename = Array.from(normalizeResumeDocumentText(basename))
    .filter(character => character.codePointAt(0)! >= 0x20).join('')
  const name = safeBasename.replace(/\.[^.]*$/, '').replace(/(?:-修改稿)+$/, '')
    .replace(/[<>:"/\\|?*]/g, '').replace(/[. ]+$/, '').trim()
  return `${name || '简历'}-修改稿.docx`
}

/** Builds an ordinary editable Word file entirely in the browser, without external resources. */
export async function createResumeDocx(rawText: string, sourceFile: string): Promise<File> {
  const { default: JSZip } = await import('jszip')
  const zip = new JSZip()
  zip.file('[Content_Types].xml', `${XML_DECLARATION}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/></Types>`)
  zip.file('_rels/.rels', `${XML_DECLARATION}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>`)
  zip.file('word/_rels/document.xml.rels', `${XML_DECLARATION}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`)
  zip.file('word/styles.xml', `${XML_DECLARATION}<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:eastAsia="Microsoft YaHei"/><w:color w:val="252525"/><w:sz w:val="21"/><w:lang w:val="en-US" w:eastAsia="zh-CN"/></w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:spacing w:after="80" w:line="276" w:lineRule="auto"/><w:widowControl/></w:pPr></w:pPrDefault></w:docDefaults><w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/></w:style><w:style w:type="paragraph" w:styleId="ResumeName"><w:name w:val="Resume name"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:pPr><w:keepNext/><w:spacing w:after="180"/></w:pPr><w:rPr><w:b/><w:sz w:val="36"/></w:rPr></w:style><w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="Heading 1"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:pPr><w:keepNext/><w:keepLines/><w:spacing w:before="180" w:after="100"/><w:outlineLvl w:val="0"/></w:pPr><w:rPr><w:b/><w:sz w:val="25"/></w:rPr></w:style></w:styles>`)
  const paragraphs = resumeDocumentParagraphs(rawText).map(paragraphXml).join('')
  zip.file('word/document.xml', `${XML_DECLARATION}<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${paragraphs}<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1021" w:right="1134" w:bottom="1021" w:left="1134" w:header="0" w:footer="0" w:gutter="0"/></w:sectPr></w:body></w:document>`)
  const content = await zip.generateAsync({ type: 'arraybuffer', compression: 'DEFLATE' })
  return new File([content], revisionFileName(sourceFile), { type: DOCX_TYPE })
}
