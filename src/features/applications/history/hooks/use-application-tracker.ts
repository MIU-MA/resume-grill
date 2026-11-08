'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { ManualApplication } from '@/domain/application-record'
import type { AgentSnapshot } from '@/domain/mail-schema'
import { changeApplicationProgress, type ApplicationProgress, type ApplicationStage } from '@/domain/application-progress'
import { emptyApplicationTracker, loadApplicationTracker, updateApplicationTracker, type ApplicationTracker, type SubmissionSnapshot } from '../lib/application-tracker-storage'

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
  const commit = useCallback(async (work: () => Promise<ApplicationTracker>) => {
    const saved = await work()
    // Transaction completion determines freshness; a queued draft save may start later.
    accept(saved, ++sequence.current)
  }, [accept])
  const save = useCallback((change: (current: ApplicationTracker) => ApplicationTracker) => commit(() => updateApplicationTracker(change)), [commit])
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
  const restoreSubmission = (id: string, expectedAt: number, previous?: SubmissionSnapshot) => save(current => {
    if (current.submissions[id]?.at !== expectedAt || current.submissions[id]?.channel !== 'website') return current
    const submissions = { ...current.submissions }
    if (previous) submissions[id] = previous; else delete submissions[id]
    return { ...current, submissions }
  })
  /** Add or update a hand-recorded application and its initial progress in one write. */
  const saveManual = (record: ManualApplication, stage: ApplicationStage) => save(current => {
    const exists = current.manualApplications.some(item => item.id === record.id)
    return {
      ...current,
      manualApplications: exists
        ? current.manualApplications.map(item => item.id === record.id ? record : item)
        : [...current.manualApplications, record],
      progress: {
        ...current.progress,
        [record.id]: changeApplicationProgress(current.progress[record.id], { stage }, Date.now()),
      },
    }
  })
  const removeManual = (id: string) => save(current => {
    if (!current.manualApplications.some(item => item.id === id)) return current
    const progress = { ...current.progress }
    delete progress[id]
    return { ...current, manualApplications: current.manualApplications.filter(item => item.id !== id), progress }
  })
  const restoreManual = (record: ManualApplication, progress?: ApplicationProgress) => save(current => ({
    ...current,
    manualApplications: current.manualApplications.some(item => item.id === record.id) ? current.manualApplications : [...current.manualApplications, record],
    progress: progress ? { ...current.progress, [record.id]: progress } : current.progress,
  }))
  const hideJob = (id: string) => save(current => current.hiddenMailJobIds.includes(id) ? current : ({ ...current, hiddenMailJobIds: [...current.hiddenMailJobIds, id] }))
  const unhideJob = (id: string) => save(current => ({ ...current, hiddenMailJobIds: current.hiddenMailJobIds.filter(item => item !== id) }))
  return { tracker, loaded, commit, saveProgress, capture, restoreSubmission, saveManual, removeManual, restoreManual, hideJob, unhideJob }
}
