import type { ResumePdfArtifact } from './resume-pdf'

export type ResumePdfFit = { fontScale: number; spacingScale: number; measureOnly?: boolean }

/** Reduce whitespace before type size; every trial uses the actual font metrics. */
export function fitResumeToOnePage(measure: (fit: ResumePdfFit) => ResumePdfArtifact['pages']): ResumePdfFit {
  const candidates: ResumePdfFit[] = [1, .85, .7, .55].map(spacingScale => ({ fontScale: 1, spacingScale }))
  for (const fontScale of [.97, .94, .91, .88, .85, .82, .8, .78, .76]) candidates.push({ fontScale, spacingScale: .55 })
  for (const candidate of candidates) {
    const pages = measure({ ...candidate, measureOnly: true })
    if (pages.length === 1) return candidate
  }
  throw new Error('内容仍超出一页。字号已缩至可读下限（正文最小 8pt），请精简部分经历或描述后重试；当前内容不会被删减。')
}

export function resumePdfTypography(fit: ResumePdfFit) {
  const size = (base: number) => Math.max(8, base * fit.fontScale)
  const space = (base: number) => base * fit.spacingScale * fit.fontScale
  const leading = (baseSize: number, baseLeading: number) => Math.max(size(baseSize) * 1.12, size(baseSize) + space(baseLeading - baseSize))
  return { size, space, leading }
}
