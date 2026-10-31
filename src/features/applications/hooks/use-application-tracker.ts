'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { AgentSnapshot } from '@/domain/mail-schema'
import { changeApplicationProgress, type ApplicationProgress } from '@/domain/application-progress'
import { emptyApplicationTracker, loadApplicationTracker, updateApplicationTracker, type ApplicationTracker, type SubmissionSnapshot } from '../application-tracker-storage'

export function useApplicationTracker(snapshot: AgentSnapshot | null, onError: (message: string) => void) {
  const [tracker, setTracker] = useState(emptyApplicationTracker)
  const [loaded, setLoaded] = useState(false)
  const lastJobs = useRef('')
  const sequence = useRef(0)
  const applied = useRef(0)
  const accept = useCallback((value: ApplicationTracker, order: number) => {
    if (order >= applied.current) { applied.current = order; setTracker(value) }
  }, [])
  useEffect(() => {
    let active = true
    const order = ++sequence.current
    void loadApplicationTracker().then(value => { if (active) { accept(value, order); setLoaded(true) } }).catch(() => onError('无法读取岗位进展，请检查浏览器存储权限后刷新。'))
    return () => { active = false }
  }, [accept, onError])
  const save = useCallback(async (change: (current: ApplicationTracker) => ApplicationTracker) => {
    const order = ++sequence.current
    const saved = await updateApplicationTracker(change)
    accept(saved, order)
  }, [accept])
  useEffect(() => {
    if (!loaded || !snapshot) return
    const key = JSON.stringify(snapshot.jobs)
    if (key === lastJobs.current) return
    lastJobs.current = key
    void save(current => {
      const merged = new Map(current.mailJobs.map(job => [job.id, job]))
      for (const job of snapshot.jobs) merged.set(job.id, job)
      return { ...current, mailJobs: [...merged.values()] }
    }).catch(() => { lastJobs.current = ''; onError('邮件记录未能保存在浏览器，连接执行器后可重新读取。') })
  }, [snapshot, loaded, save, onError])
  const saveProgress = (id: string, changes: Partial<Omit<ApplicationProgress, 'events' | 'updatedAt'>>) => save(current => ({ ...current, progress: { ...current.progress, [id]: changeApplicationProgress(current.progress[id], changes, Date.now()) } }))
  const capture = (values: Record<string, SubmissionSnapshot>) => save(current => ({ ...current, submissions: { ...current.submissions, ...values } }))
  return { tracker, loaded, saveProgress, capture }
}
