'use client'

import { get, set, del, keys } from 'idb-keyval'
import type { ResumeAnalysis } from '@/domain/resume-schema'
import type { InterviewSession } from '@/domain/interview-schema'

// 浏览器本地持久化：保存简历分析与其下的各声明面试会话。
// 用 idb-keyval（IndexedDB 封装）。不与服务端通信，退出/刷新后可恢复。
// sessions 为 Record<原始声明内容, InterviewSession[]>：同一声明可有多个版本（改写后重拷）。

export type SavedRecord = {
  id: string
  analysis: ResumeAnalysis
  sessions: Record<string, InterviewSession[]>
  updatedAt: number
}

const PREFIX = 'resume-drill:'

export function newRecordId(analysis: ResumeAnalysis): string {
  const stamp = Date.now().toString(36)
  return `${PREFIX}${analysis.candidate}:${analysis.sourceFile}:${stamp}`
}

export async function saveRecord(record: SavedRecord): Promise<void> {
  if (typeof window === 'undefined') return
  await set(record.id, record)
}

export async function loadRecord(id: string): Promise<SavedRecord | undefined> {
  if (typeof window === 'undefined') return undefined
  return (await get(id)) as SavedRecord | undefined
}

export async function listRecords(): Promise<SavedRecord[]> {
  if (typeof window === 'undefined') return []
  const allKeys = (await keys()) as string[]
  const ids = allKeys.filter((k) => typeof k === 'string' && k.startsWith(PREFIX))
  const records = await Promise.all(ids.map((id) => get(id) as Promise<SavedRecord>))
  return records.filter(Boolean).sort((a, b) => b.updatedAt - a.updatedAt)
}

export async function deleteRecord(id: string): Promise<void> {
  if (typeof window === 'undefined') return
  await del(id)
}

// 保存或更新某条声明下的会话（追加版本或更新现有版本）
export async function upsertSession(
  recordId: string,
  analysis: ResumeAnalysis,
  claimContent: string,
  session: InterviewSession,
): Promise<void> {
  const existing = (await loadRecord(recordId)) ?? {
    id: recordId,
    analysis,
    sessions: {},
    updatedAt: Date.now(),
  }
  const list = existing.sessions[claimContent] ?? []
  // 同版本覆盖，否则追加
  const idx = list.findIndex((s) => s.version === session.version)
  if (idx >= 0) list[idx] = session
  else list.push(session)
  existing.sessions[claimContent] = list
  existing.updatedAt = Date.now()
  await saveRecord(existing)
}
