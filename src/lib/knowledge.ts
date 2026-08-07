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

/** 知识点稳定 id：FNV-1a 哈希（同文本恒同 id，去空白/大小写） */
export function createKnowledgeItemId(text: string): string {
  const normalized = text.replace(/\s+/g, '').toLowerCase()
  let hash = 0x811c9dc5
  for (let index = 0; index < normalized.length; index++) {
    hash ^= normalized.charCodeAt(index)
    hash = Math.imul(hash, 0x01000193)
  }
  return `knowledge-${(hash >>> 0).toString(36)}`
}

/**
 * 从 sessions 推导漏洞（盲点批注）+ 知识点（finalResult.knowledgeGaps）。
 * 盲点 status 取 masteredBlindSpotIds；知识点恒为 open。
 */
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

/**
 * 只把缺失的 id 并入当前列表；无新增时返回原引用（避免触发下游 effect）。
 * 已存在的条目保留用户对 status/title/note 的修改，不回写覆盖。
 */
export function mergeKnowledgeItems(
  current: KnowledgeItem[],
  derived: KnowledgeItem[],
): KnowledgeItem[] {
  const existingIds = new Set(current.map((item) => item.id))
  const fresh = derived.filter((item) => !existingIds.has(item.id))
  if (fresh.length === 0) return current
  return [...current, ...fresh]
}

/** 手动新增条目的 id（随机） */
export function createManualKnowledgeItemId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return `manual-${crypto.randomUUID()}`
  }
  return `manual-${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`
}
