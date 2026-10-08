export type ResumeRevisionDraft = { baseText: string; text: string }
export type RevisionTarget = { start: number; end: number; line: number; text: string }

/** Match quotations without guessing missing words; whitespace from PDF extraction may differ. */
export function findRevisionTargets(text: string, evidence: string): RevisionTarget[] {
  const positions: number[] = []
  let normalized = ''
  for (let index = 0; index < text.length; index++) {
    if (!/\s/.test(text[index])) { normalized += text[index]; positions.push(index) }
  }
  const quote = evidence.replace(/\s/g, '')
  if (!quote) return []
  const result: RevisionTarget[] = []
  let from = 0
  while (from <= normalized.length - quote.length) {
    const match = normalized.indexOf(quote, from)
    if (match < 0) break
    const start = text.lastIndexOf('\n', positions[match] - 1) + 1
    const newline = text.indexOf('\n', positions[match + quote.length - 1])
    const end = newline < 0 ? text.length : newline + 1
    if (!result.some((target) => target.start === start && target.end === end)) {
      result.push({ start, end, text: text.slice(start, end), line: text.slice(0, start).split('\n').length })
    }
    from = match + 1
  }
  return result
}

type Span = { start: number; end: number; nextStart: number; nextEnd: number; equal: boolean }

/** Line alignment deliberately refuses to locate a partial range within a rewritten block. */
export function mapRevisionTarget(base: string, text: string, target: Pick<RevisionTarget, 'start' | 'end'>): { start: number; end: number } | null {
  if (target.start < 0 || target.end > base.length || target.end <= target.start) return null
  if (base === text) return { start: target.start, end: target.end }
  const spans = alignRevisionLines(base, text)
  const boundary = (offset: number, side: 'start' | 'end') => {
    const span = spans.find((item) => side === 'start' ? item.start <= offset && offset < item.end : item.start < offset && offset <= item.end)
    if (!span) return null
    if (span.equal) return span.nextStart + offset - span.start
    if (offset === span.start) return span.nextStart
    if (offset === span.end) return span.nextEnd
    return null
  }
  const start = boundary(target.start, 'start')
  const end = boundary(target.end, 'end')
  return start === null || end === null || start > end ? null : { start, end }
}

function alignRevisionLines(base: string, text: string): Span[] {
  const oldLines = base.match(/[^\n]*\n|[^\n]+$/g) ?? []
  const newLines = text.match(/[^\n]*\n|[^\n]+$/g) ?? []
  let prefix = 0
  while (prefix < oldLines.length && prefix < newLines.length && oldLines[prefix] === newLines[prefix]) prefix++
  let suffix = 0
  while (suffix < oldLines.length - prefix && suffix < newLines.length - prefix && oldLines[oldLines.length - 1 - suffix] === newLines[newLines.length - 1 - suffix]) suffix++
  const oldMiddle = oldLines.slice(prefix, oldLines.length - suffix)
  const newMiddle = newLines.slice(prefix, newLines.length - suffix)
  const spans: Span[] = []
  let oldOffset = 0
  let newOffset = 0
  const append = (oldText: string, newText: string, equal: boolean) => {
    const last = spans.at(-1)
    if (last?.equal === equal) { last.end += oldText.length; last.nextEnd += newText.length }
    else spans.push({ start: oldOffset, end: oldOffset + oldText.length, nextStart: newOffset, nextEnd: newOffset + newText.length, equal })
    oldOffset += oldText.length
    newOffset += newText.length
  }
  append(oldLines.slice(0, prefix).join(''), newLines.slice(0, prefix).join(''), true)
  if ((oldMiddle.length + 1) * (newMiddle.length + 1) > 250_000) {
    append(oldMiddle.join(''), newMiddle.join(''), false)
  } else {
    const width = newMiddle.length + 1
    const lcs = new Uint16Array((oldMiddle.length + 1) * width)
    for (let i = oldMiddle.length - 1; i >= 0; i--) {
      for (let j = newMiddle.length - 1; j >= 0; j--) {
        lcs[i * width + j] = oldMiddle[i] === newMiddle[j] ? lcs[(i + 1) * width + j + 1] + 1 : Math.max(lcs[(i + 1) * width + j], lcs[i * width + j + 1])
      }
    }
    let i = 0
    let j = 0
    while (i < oldMiddle.length || j < newMiddle.length) {
      if (i < oldMiddle.length && j < newMiddle.length && oldMiddle[i] === newMiddle[j]) append(oldMiddle[i++], newMiddle[j++], true)
      else if (i < oldMiddle.length && (j === newMiddle.length || lcs[(i + 1) * width + j] >= lcs[i * width + j + 1])) append(oldMiddle[i++], '', false)
      else append('', newMiddle[j++], false)
    }
  }
  append(oldLines.slice(oldLines.length - suffix).join(''), newLines.slice(newLines.length - suffix).join(''), true)
  return spans
}

export function changedRevisionRanges(base: string, text: string): Array<{ start: number; end: number }> {
  if (base === text) return []
  return alignRevisionLines(base, text).filter(span => !span.equal && span.nextEnd > span.nextStart)
    .map(span => ({ start: span.nextStart, end: span.nextEnd }))
}

/** A paragraph edit must not accidentally remove the separator before its next paragraph. */
export function editableRevisionRange(text: string, range: { start: number; end: number }) {
  const ending = /\r?\n$/.exec(text.slice(range.start, range.end))
  return { start: range.start, end: range.end - (ending?.[0].length ?? 0) }
}

export function replaceRevisionTarget(text: string, range: { start: number; end: number }, replacement: string) {
  return text.slice(0, range.start) + replacement + text.slice(range.end)
}
