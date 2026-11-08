import type { ResumeDocument } from './resume-library'
export function resumeVersionParent(document: ResumeDocument) {
  const parent = document.revisionOf ?? document.jobContext?.resumeDocumentId
  return parent && parent !== document.id ? parent : undefined
}
export function resumeVersionRows(documents: ResumeDocument[]) {
  const sorted = [...documents].sort((a, b) => a.updatedAt - b.updatedAt || a.id.localeCompare(b.id))
  const known = new Set(sorted.map(document => document.id)), seen = new Set<string>()
  const rows: Array<{ document: ResumeDocument; depth: number }> = []
  const visit = (document: ResumeDocument, depth: number) => {
    if (seen.has(document.id)) return
    seen.add(document.id); rows.push({ document, depth })
    for (const child of sorted) if (resumeVersionParent(child) === document.id) visit(child, depth + 1)
  }
  for (const document of sorted) { const parent = resumeVersionParent(document); if (!parent || !known.has(parent)) visit(document, 0) }
  // Corrupt/legacy cycles still remain visible, without recursive loops.
  for (const document of sorted) if (!seen.has(document.id)) visit(document, 0)
  return rows
}
