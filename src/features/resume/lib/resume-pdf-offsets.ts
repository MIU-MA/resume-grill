import { normalizeResumeDocumentText } from './resume-docx'

/** Retain original UTF-16 offsets through newline/control normalization and trimming. */
export function resumePdfSource(rawText: string) {
  let normalized = ''
  const starts: number[] = []
  const ends: number[] = []
  for (const match of rawText.matchAll(/\r\n|\r|\u2028|\u2029|[\s\S]/gu)) {
    const value = normalizeResumeDocumentText(match[0])
    normalized += value
    for (let index = 0; index < value.length; index++) {
      starts.push(match.index + Math.min(index, match[0].length - 1))
      ends.push(match.index + (value.length === 1 ? match[0].length : index + 1))
    }
  }
  const left = normalized.length - normalized.trimStart().length
  const text = normalized.trim()
  return {
    text,
    range: (start: number, end: number) => ({
      start: starts[left + start] ?? rawText.length,
      end: end > start ? ends[left + end - 1] ?? rawText.length : starts[left + start] ?? rawText.length,
    }),
  }
}
