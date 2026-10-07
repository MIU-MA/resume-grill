import { describe, expect, it } from 'vitest'
import JSZip from 'jszip'
import mammoth from 'mammoth'
import { createResumeDocx, normalizeResumeDocumentText, resumeDocumentParagraphs } from './resume-docx'

async function extractedLines(file: File): Promise<string[]> {
  const result = await mammoth.extractRawText({ buffer: Buffer.from(await file.arrayBuffer()) })
  expect(result.messages).toEqual([])
  // Mammoth terminates every Word paragraph with two newlines, including empty paragraphs.
  return result.value.slice(0, -2).split('\n\n')
}

describe('resume DOCX export', () => {
  it('round trips all lines, indentation, tabs, blank lines, Unicode and XML characters', async () => {
    const text = '张三\n 前端工程师 & TypeScript <React> "组件" \'测试\' 😀\n\n工作经历\n  • 保留缩进\t2024—2026\n项目经历\n\n'
    const file = await createResumeDocx(text, '原简历.pdf')
    expect(file.name).toBe('原简历-修改稿.docx')
    expect(file.type).toBe('application/vnd.openxmlformats-officedocument.wordprocessingml.document')
    expect(await extractedLines(file)).toEqual(text.split('\n'))
  })

  it('normalizes line separators and removes only XML-illegal characters', async () => {
    const input = '\n李四\r\n技能\rA\u2028B\u2029C\u0000\u000b\ufffe\uffff\ud800\udc00\ud800\n\t'
    const expected = '\n李四\n技能\nA\nB\nC𐀀\n\t'
    expect(normalizeResumeDocumentText(input)).toBe(expected)
    expect(await extractedLines(await createResumeDocx(input, '简历.txt'))).toEqual(expected.split('\n'))
  })

  it('shares conservative paragraph styles with the preview without dropping content', async () => {
    const text = '张三\n教育背景\n  示例大学 计算机科学\n# 项目作品\n中文正文没有自动变成标题\n \nSkills\nReact、Vue'
    const paragraphs = resumeDocumentParagraphs(text)
    expect(paragraphs.map(p => p.kind)).toEqual(['name', 'heading', 'body', 'heading', 'body', 'blank', 'heading', 'body'])
    expect(paragraphs.map(p => p.text).join('\n')).toBe(text)
    expect(resumeDocumentParagraphs('前端开发\n工作经历')[0].kind).toBe('body')
    expect(resumeDocumentParagraphs('技术能力\nReact')[0].kind).toBe('heading')
    const file = await createResumeDocx(text, '修改简历.docx')
    const zip = await JSZip.loadAsync(await file.arrayBuffer(), { checkCRC32: true })
    const xml = await zip.file('word/document.xml')!.async('string')
    expect(xml).toContain('<w:pStyle w:val="ResumeName"/>')
    expect(xml).toContain('<w:pStyle w:val="Heading1"/>')
    expect(xml).toContain('<w:pgSz w:w="11906" w:h="16838"/>')
    expect(await extractedLines(file)).toEqual(text.split('\n'))
  })

  it('keeps markup as literal text and creates no external or executable relationships', async () => {
    const text = '<script>alert("hello")</script>\n<w:hyperlink r:id="attack">外链</w:hyperlink>\nhttps://example.org/my-work\n<!DOCTYPE foo [<!ENTITY xxe SYSTEM "file:///secret">]>'
    const file = await createResumeDocx(text, '简历.txt')
    const zip = await JSZip.loadAsync(await file.arrayBuffer(), { checkCRC32: true })
    expect(Object.values(zip.files).filter(entry => !entry.dir).map(entry => entry.name).sort()).toEqual([
      '[Content_Types].xml', '_rels/.rels', 'word/_rels/document.xml.rels', 'word/document.xml', 'word/styles.xml',
    ])
    const relations = await zip.file('word/_rels/document.xml.rels')!.async('string')
    expect(relations).not.toContain('External')
    expect(relations).not.toContain('hyperlink')
    const xml = await zip.file('word/document.xml')!.async('string')
    expect(xml).not.toContain('<script>')
    expect(xml).not.toContain('<!DOCTYPE')
    expect(xml).not.toContain('<w:hyperlink')
    expect(await extractedLines(file)).toEqual(text.split('\n'))
  })

  it('preserves long text across hundreds of paragraphs', async () => {
    const text = Array.from({ length: 180 }, (_, index) => `${index + 1}. 持续维护组件库和文档，处理兼容性问题。`.repeat(4)).join('\n')
    expect(await extractedLines(await createResumeDocx(text, '简历.docx'))).toEqual(text.split('\n'))
  })

  it.each([
    ['C:\\docs\\王明-修改稿-修改稿.docx', '王明-修改稿.docx'],
    ['简历<>:"|?*.txt', '简历-修改稿.docx'],
    ['', '简历-修改稿.docx'],
    ['.txt', '简历-修改稿.docx'],
  ])('uses a reusable safe revision filename for %s', async (sourceFile, expected) => {
    expect((await createResumeDocx('简历正文', sourceFile)).name).toBe(expected)
  })
})
