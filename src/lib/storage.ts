'use client'

import { get, set, del, keys } from 'idb-keyval'
import { createClaimId, type ResumeAnalysis, type ResumeClaim } from '@/domain/resume-schema'
import type { InterviewSession } from '@/domain/interview-schema'
import { isExcludedClaimContent } from '@/lib/claim-filter'

// 浏览器本地持久化：保存简历分析与其下的各声明面试会话。
// 用 idb-keyval（IndexedDB 封装）。不与服务端通信，退出/刷新后可恢复。
// sessions 为 Record<声明 ID, InterviewSession[]>：同一声明可有多个版本。

export type SavedRecord = {
  id: string
  analysis: ResumeAnalysis
  sessions: Record<string, InterviewSession[]>
  preparedClaimIds: string[]
  masteredBlindSpotIds: string[]
  updatedAt: number
}

const PREFIX = 'resume-drill:'

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

// 保存或更新某条声明下的会话（追加版本或更新现有版本）
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
  // 同版本覆盖，否则追加
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

// v0 记录以声明全文作为 key，也没有 claim.id。读取时在内存中迁移，下一次保存即写回新结构。
function migrateLegacyRecord(record: SavedRecord): SavedRecord {
  const legacyClaims = record.analysis.claims as Array<ResumeClaim & { id?: string }>
  const claims = legacyClaims.filter((claim) => !isExcludedClaimContent(claim.content)).map((claim, index) => ({
    ...claim,
    id: claim.id || createClaimId(claim, index),
    evidence: claim.evidence.filter((item) => !/^(?:简历中已给出量化数据|简历中提及该表述)$/.test(item)),
  }))
  const sessions: Record<string, InterviewSession[]> = {}

  claims.forEach((claim) => {
    const list = record.sessions[claim.id] ?? record.sessions[claim.content] ?? []
    sessions[claim.id] = list.map((session) => ({
      ...session,
      id: session.id === claim.content ? `${claim.id}:v${session.version}` : session.id,
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
