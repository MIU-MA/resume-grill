'use client'

import { get, set, del, keys } from 'idb-keyval'
import { createClaimId, type ResumeAnalysis, type ResumeClaim } from '@/domain/resume-schema'
import type { InterviewSession } from '@/domain/interview-schema'
import { isExcludedClaimContent } from '@/lib/claim-filter'

export type SavedRecord = {
  id: string
  analysis: ResumeAnalysis
  sessions: Record<string, InterviewSession[]>
  preparedClaimIds: string[]
  masteredBlindSpotIds: string[]
  updatedAt: number
}

const PREFIX = 'resume-grill:'

export function newRecordId(analysis: ResumeAnalysis): string {
  return `${PREFIX}resume:${resumeContentKey(analysis.rawText)}`
}

export function resumeContentKey(rawText: string | undefined | null): string {
  const normalized = (typeof rawText === 'string' ? rawText : '').replace(/\s+/g, ' ').trim()
  let hash = 0x811c9dc5
  for (let i = 0; i < normalized.length; i++) {
    hash ^= normalized.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193)
  }
  return `${(hash >>> 0).toString(36)}-${normalized.length.toString(36)}`
}

export async function saveRecord(record: SavedRecord): Promise<void> {
  if (typeof window === 'undefined') return
  await set(record.id, record)
}

export async function loadRecord(id: string): Promise<SavedRecord | undefined> {
  if (typeof window === 'undefined') return undefined
  const record = (await get(id)) as SavedRecord | undefined
  return record ? migrateLegacyRecord(record) : undefined
}

export async function listRecords(): Promise<SavedRecord[]> {
  if (typeof window === 'undefined') return []
  const allKeys = (await keys()) as string[]
  const ids = allKeys.filter((k) => typeof k === 'string' && k.startsWith(PREFIX))
  const records = await Promise.all(ids.map((id) => loadRecord(id)))
  const sorted = records
    .filter((record): record is SavedRecord => Boolean(record))
    .sort((a, b) => b.updatedAt - a.updatedAt)
  const unique = new Map<string, SavedRecord>()
  sorted.forEach((record) => {
    const key = resumeContentKey(record.analysis.rawText)
    if (!unique.has(key)) unique.set(key, record)
  })
  return [...unique.values()]
}

export async function deleteRecord(id: string): Promise<void> {
  if (typeof window === 'undefined') return
  await del(id)
}

export async function upsertSession(
  recordId: string,
  analysis: ResumeAnalysis,
  claimId: string,
  session: InterviewSession,
): Promise<void> {
  const existing = (await loadRecord(recordId)) ?? {
    id: recordId,
    analysis,
    sessions: {},
    preparedClaimIds: [],
    masteredBlindSpotIds: [],
    updatedAt: Date.now(),
  }
  const list = existing.sessions[claimId] ?? []
  const idx = list.findIndex((s) => s.version === session.version)
  if (idx >= 0) list[idx] = session
  else list.push(session)
  existing.sessions[claimId] = list
  existing.updatedAt = Date.now()
  await saveRecord(existing)
}

export async function updatePreparedClaims(
  recordId: string,
  analysis: ResumeAnalysis,
  preparedClaimIds: string[],
): Promise<void> {
  const existing = (await loadRecord(recordId)) ?? {
    id: recordId,
    analysis,
    sessions: {},
    preparedClaimIds: [],
    masteredBlindSpotIds: [],
    updatedAt: Date.now(),
  }
  existing.preparedClaimIds = preparedClaimIds
  existing.updatedAt = Date.now()
  await saveRecord(existing)
}

export async function updateMasteredBlindSpots(
  recordId: string,
  analysis: ResumeAnalysis,
  masteredBlindSpotIds: string[],
): Promise<void> {
  const existing = (await loadRecord(recordId)) ?? {
    id: recordId,
    analysis,
    sessions: {},
    preparedClaimIds: [],
    masteredBlindSpotIds: [],
    updatedAt: Date.now(),
  }
  existing.masteredBlindSpotIds = masteredBlindSpotIds
  existing.updatedAt = Date.now()
  await saveRecord(existing)
}

function migrateLegacyRecord(record: SavedRecord): SavedRecord {
  const legacyClaims = record.analysis.claims as Array<ResumeClaim & { id?: string; evidence?: string[]; evaluationPoints?: string[]; verifyPoints?: Array<{ point: string; importance: string }>; exaggerationRisk?: string; interviewRisk?: string; evidenceGap?: string[] }>
  const claims = legacyClaims.filter((claim) => !isExcludedClaimContent(claim.content)).map((claim, index) => {
    // 迁移旧字段到新结构
    type SafeMasteryPoint = { point: string; dimension: 'context' | 'practice' | 'principle' | 'decision' | 'troubleshooting' | 'boundary'; importance: 'high' | 'medium' | 'low' }
    const safeImportance = (v: string): 'high' | 'medium' | 'low' =>
      v === 'high' ? 'high' : v === 'low' ? 'low' : 'medium'

    const legacyPoints: SafeMasteryPoint[] = claim.verifyPoints
      ? claim.verifyPoints.map((vp) => ({ point: vp.point, dimension: 'practice' as const, importance: safeImportance(vp.importance) }))
      : Array.isArray(claim.evaluationPoints)
        ? claim.evaluationPoints.map((p: string, i: number) => ({ point: p, dimension: 'practice' as const, importance: (i === 0 ? 'high' : 'medium') as 'high' | 'medium' | 'low' }))
        : []

    const masteryPoints: SafeMasteryPoint[] = (claim.masteryPoints && claim.masteryPoints.length > 0)
      ? claim.masteryPoints as SafeMasteryPoint[]
      : legacyPoints.length > 0
        ? legacyPoints
        : [{ point: '需要验证该声明的真实性', dimension: 'practice' as const, importance: 'high' as const }]

    const safePriority: 'high' | 'medium' | 'low' =
      (claim as Record<string, unknown>).testPriority === 'high' ? 'high'
        : (claim as Record<string, unknown>).testPriority === 'low' ? 'low'
        : 'medium'
    const { evidence, evaluationPoints, verifyPoints, exaggerationRisk, interviewRisk, evidenceGap, ...rest } = claim
    return {
      ...rest,
      id: claim.id || createClaimId(claim as unknown as Parameters<typeof createClaimId>[0], index),
      masteryPoints,
      capability: (claim as Record<string, unknown>).capability as string ?? '未知能力',
      testPriority: safePriority,
      initialIntent: (claim as Record<string, unknown>).initialIntent as string ?? '',
    }
  })
  const sessions: Record<string, InterviewSession[]> = {}

  claims.forEach((claim) => {
    const list = record.sessions[claim.id] ?? record.sessions[claim.content] ?? []
    sessions[claim.id] = list.map((session) => ({
      ...session,
      id: session.id === claim.content ? `${claim.id}:v${session.version}` : session.id,
      rounds: session.rounds.map((round) => ({
        ...round,
        action: round.action ?? (round.answer.trim() ? 'answer' : 'clarify'),
      })),
      summaryStatus:
        session.summaryStatus ??
        (session.status === 'done' && session.finalResult?.answerSummary?.includes('没有成功生成')
          ? 'failed'
          : session.status === 'done'
            ? 'success'
            : undefined),
    }))
  })

  return {
    ...record,
    analysis: { ...record.analysis, claims },
    sessions,
    preparedClaimIds: record.preparedClaimIds ?? [],
    masteredBlindSpotIds: record.masteredBlindSpotIds ?? [],
  }
}
