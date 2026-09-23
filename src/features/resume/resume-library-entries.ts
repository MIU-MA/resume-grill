import type { SavedRecord } from '@/lib/storage'
import type { ResumeDocument } from '@/lib/resume-library'

export function resumeLibraryEntries(records: SavedRecord[], documents: ResumeDocument[]) {
  const linked = new Set(documents.map(document => document.recordId).filter(Boolean))
  return [
    ...documents.map(document => ({ id: document.id, document, record: records.find(record => record.id === document.recordId), updatedAt: Math.max(document.updatedAt, records.find(record => record.id === document.recordId)?.updatedAt ?? 0) })),
    ...records.filter(record => !linked.has(record.id)).map(record => ({ id: record.id, document: undefined, record, updatedAt: record.updatedAt })),
  ].sort((a, b) => b.updatedAt - a.updatedAt)
}

