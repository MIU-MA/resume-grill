'use client'

import { get, set, del, keys } from 'idb-keyval'
import type { ResumeAnalysis } from '@/domain/resume-schema'
import type { InterviewSession } from '@/domain/interview-schema'

// 浏览器本地持久化：保存简历分析与其下的各声明面试会话。
// 用 idb-keyval（IndexedDB 封装）。不与服务端通信，退出/刷新后可恢复。

export type SavedRecord = {
  id: string
  analysis: ResumeAnalysis
  sessions: Record<string, InterviewSession> // key = claimId(= claim.quote)
  updatedAt: number
}

const PREFIX = 'resume-drill:'

export function newRecordId(analysis: ResumeAnalysis): string {
  // 用 candidate + 文件名 + 时间戳，避免依赖 Date.now 之外的随机源
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

// 便捷：保存或更新某条声明下的会话
export async function upsertSession(
  recordId: string,
  analysis: ResumeAnalysis,
  session: InterviewSession,
): Promise<void> {
  const existing = (await loadRecord(recordId)) ?? {
    id: recordId,
    analysis,
    sessions: {},
    updatedAt: Date.now(),
  }
  existing.sessions[session.claimId] = session
  existing.updatedAt = Date.now()
  await saveRecord(existing)
}
