import type { ResumeAnalysis } from '@/domain/resume-schema'
import type { InterviewSession } from '@/domain/interview-schema'
import { deriveBlindSpots } from '@/lib/blind-spots'

export type KnowledgeItemSource = 'blind-spot' | 'knowledge-gap' | 'manual'
export type KnowledgeItemStatus = 'open' | 'mastered'

export type KnowledgeItem = {
  id: string
  source: KnowledgeItemSource
  title: string
  detail: string
  claimId: string
  claimTitle: string
  status: KnowledgeItemStatus
  note: string
  createdAt: number
  updatedAt: number
}

export type KnowledgeItemPatch = Partial<
  Pick<KnowledgeItem, 'title' | 'detail' | 'note' | 'status'>
>

export type KnowledgeItemInput = {
  title: string
  detail?: string
  note?: string
}

export function createKnowledgeItemId(text: string): string {
  const normalized = text.replace(/\s+/g, '').toLowerCase()
  let hash = 0x811c9dc5
  for (let index = 0; index < normalized.length; index++) {
    hash ^= normalized.charCodeAt(index)
    hash = Math.imul(hash, 0x01000193)
  }
  return `knowledge-${(hash >>> 0).toString(36)}`
}

export function deriveKnowledgeItems(
  analysis: ResumeAnalysis,
  sessions: Record<string, InterviewSession[]>,
  masteredBlindSpotIds: string[],
): KnowledgeItem[] {
  const masteredSet = new Set(masteredBlindSpotIds)
  const items: KnowledgeItem[] = []

  for (const spot of deriveBlindSpots(analysis, sessions)) {
    items.push({
      id: spot.id,
      source: 'blind-spot',
      title: spot.annotation,
      detail: spot.explanation,
      claimId: spot.claim.id,
      claimTitle: spot.claim.title,
      status: masteredSet.has(spot.id) ? 'mastered' : 'open',
      note: '',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    })
  }

  for (const claim of analysis.claims) {
    for (const session of sessions[claim.id] ?? []) {
      const gaps = session.finalResult?.knowledgeGaps ?? []
      for (const gap of gaps) {
        const text = gap.trim()
        if (!text) continue
        items.push({
          id: createKnowledgeItemId(text),
          source: 'knowledge-gap',
          title: text,
          detail: '',
          claimId: claim.id,
          claimTitle: claim.title,
          status: 'open',
          note: '',
          createdAt: Date.now(),
          updatedAt: Date.now(),
        })
      }
    }
  }

  return items
}

export function mergeKnowledgeItems(
  current: KnowledgeItem[],
  derived: KnowledgeItem[],
): KnowledgeItem[] {
  const existingIds = new Set(current.map((item) => item.id))
  const fresh = derived.filter((item) => !existingIds.has(item.id))
  if (fresh.length === 0) return current
  return [...current, ...fresh]
}

export function createManualKnowledgeItemId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return `manual-${crypto.randomUUID()}`
  }
  return `manual-${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`
}

export function filterDismissedKnowledgeItems(
  items: KnowledgeItem[],
  dismissedIds: string[],
): KnowledgeItem[] {
  if (dismissedIds.length === 0) return items
  const dismissedSet = new Set(dismissedIds)
  return items.filter((item) => !dismissedSet.has(item.id))
}
