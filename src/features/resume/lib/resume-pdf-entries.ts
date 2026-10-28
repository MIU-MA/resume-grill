import { resumeDocumentParagraphs } from './resume-docx'

export type ResumeLayoutParagraph = ReturnType<typeof resumeDocumentParagraphs>[number] & { start: number; end: number }
export type ResumeEntry = { title: ResumeLayoutParagraph; date?: ResumeLayoutParagraph; role?: ResumeLayoutParagraph }

const ENTRY_SECTION = /工作|实习|项目|教育|experience|employment|internship|projects?|education/i
const DATE = /^(?:19|20)\d{2}(?:[./年-]\d{1,2}(?:月|[./-]\d{1,2}日?)?)?\s*(?:—|–|-|~|～|至|到)\s*(?:(?:19|20)\d{2}(?:[./年-]\d{1,2}(?:月|[./-]\d{1,2}日?)?)?|至今|现在|present|current|now)$/i
const ROLE = /工程师|开发|实习生|设计师|经理|负责人|研究员|本科|硕士|博士|学士|engineer|developer|designer|intern|manager|bachelor|master|phd/i

export function resumeLayoutParagraphs(text: string): ResumeLayoutParagraph[] {
  let start = 0
  return resumeDocumentParagraphs(text).map(paragraph => {
    const value = { ...paragraph, start, end: start + paragraph.text.length }
    start = value.end + 1
    return value
  })
}

function entryTitle(paragraph: ResumeLayoutParagraph | undefined): paragraph is ResumeLayoutParagraph {
  return !!paragraph && paragraph.kind === 'body' && paragraph.text.trim().length < 100
    && !/^\s*(?:[-•·*]|负责|参与|主导|协助|使用|开发了|熟悉|掌握|精通|通过)/.test(paragraph.text)
    && !DATE.test(paragraph.text.trim())
}

function inlineEntry(paragraph: ResumeLayoutParagraph): ResumeEntry | undefined {
  for (const match of paragraph.text.matchAll(/\s+[|｜·]\s+|\t+| {2,}/g)) {
    const start = match.index + match[0].length
    if (DATE.test(paragraph.text.slice(start).trim())) return {
      title: { ...paragraph, text: paragraph.text.slice(0, start), end: paragraph.start + start },
      date: { ...paragraph, text: paragraph.text.slice(start), start: paragraph.start + start },
    }
  }
}

/** Group only short entry headers and explicit date ranges. Keep every source span. */
export function resumeEntries(paragraphs: ResumeLayoutParagraph[]): Map<number, ResumeEntry> {
  const entries = new Map<number, ResumeEntry>()
  let section = ''
  let atEntry = false
  for (let index = 0; index < paragraphs.length; index++) {
    const paragraph = paragraphs[index]
    if (paragraph.kind === 'heading') { section = paragraph.text; atEntry = true; continue }
    if (paragraph.kind === 'blank') { atEntry = true; continue }
    if (!ENTRY_SECTION.test(section)) continue
    const following = paragraphs[index + 1]
    const third = paragraphs[index + 2]
    const inline = entryTitle(paragraph) ? inlineEntry(paragraph) : undefined
    if (inline) entries.set(index, inline)
    else if (DATE.test(paragraph.text.trim()) && entryTitle(following)) {
      entries.set(index, { title: following, date: paragraph })
      index++
    } else if (entryTitle(paragraph)) {
      if (following?.kind === 'body' && DATE.test(following.text.trim())) {
        entries.set(index, { title: paragraph, date: following })
        index++
      } else if (entryTitle(following) && ROLE.test(following.text) && third?.kind === 'body' && DATE.test(third.text.trim())) {
        entries.set(index, { title: paragraph, role: following, date: third })
        index += 2
      } else if (atEntry) entries.set(index, { title: paragraph })
    }
    atEntry = false
  }
  return entries
}

/** Explicit column delimiters only; punctuation in ordinary prose stays untouched. */
export function resumeEntryColumns(title: ResumeLayoutParagraph): ResumeLayoutParagraph[] {
  const delimiter = /\s+[|｜·]\s+|\t+| {3,}/g
  const parts: ResumeLayoutParagraph[] = []
  let start = 0
  for (const match of title.text.matchAll(delimiter)) {
    // Keep separators visible and selectable in the same order as the original.
    const end = match.index + match[0].length
    parts.push({ ...title, text: title.text.slice(start, end), start: title.start + start, end: title.start + end })
    start = end
  }
  if (!parts.length || parts.length > 2) return [title]
  if (start < title.text.length) parts.push({ ...title, text: title.text.slice(start), start: title.start + start, end: title.end })
  return parts
}
