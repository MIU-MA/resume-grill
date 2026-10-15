'use client'

import { useEffect, useEffectEvent, useRef, useState } from 'react'
import type { AssistantTask, JobAssistantTools } from '@/domain/job-assistant'
import { listResumeDocuments, type ResumeDocument } from '@/features/resume/lib/resume-library'
import { createAssistantWriter, loadAssistantStore } from '@/features/job-assistant/lib/assistant-storage'
import { getLlmSettings } from '@/lib/settings'
import { runJobAssistant } from '../job-assistant-runner'

export function useJobAssistant(tools: JobAssistantTools, envConfigured: boolean, openSettings: () => void) {
  const [goal, setGoal] = useState('')
  const [documents, setDocuments] = useState<ResumeDocument[]>([])
  const [resumeId, setResumeId] = useState('')
  const [task, setTask] = useState<AssistantTask | null>(null)
  const [hydrated, setHydrated] = useState(false)
  const [running, setRunning] = useState(false)
  const [pausing, setPausing] = useState(false)
  const [error, setError] = useState('')
  const [writer] = useState(() => createAssistantWriter())
  const active = useRef(true)
  const pauseRequested = useRef(false)
  const busy = useRef(false)
  const pending = useRef<'new' | 'resume' | 'retry' | null>(null)
  useEffect(() => {
    active.current = true
    void Promise.all([loadAssistantStore(), listResumeDocuments()]).then(([saved, docs]) => {
      if (!active.current) return
      setGoal(saved.goal); setTask(saved.task); setDocuments(docs)
      setResumeId(docs.find(doc => doc.id === tools.preferredResumeId)?.id ?? docs.find(doc => doc.id === saved.task?.resume.id)?.id ?? docs[0]?.id ?? '')
      setHydrated(true)
    }).catch(() => { if (active.current) setError('读取简历或任务记录失败，请检查浏览器存储后刷新。') })
    return () => { active.current = false; pauseRequested.current = true }
    // Initial selection only; a later attachment change must not switch a running task's resume.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const saveGoal = async () => {
    if (!hydrated || busy.current || !navigator.locks) return
    try {
      await navigator.locks.request('resume-grill-job-assistant', { ifAvailable: true }, async lock => {
        if (!lock) return
        const saved = await loadAssistantStore()
        await writer({ ...saved, goal })
      })
    }
    catch { setError('求职条件未能保存，请检查浏览器存储。') }
  }
  const execute = async (kind: 'new' | 'resume' | 'retry') => {
    if (busy.current || tools.disabled || !hydrated) return
    const document = documents.find(doc => doc.id === resumeId)
    const text = document?.review?.rawText ?? document?.extracted.text ?? ''
    if (kind === 'new' && (!goal.trim() || !document || !text.trim())) { setError('写下求职目标，并选择一份简历。'); return }
    if (kind === 'new' && text.length > 20_000) { setError('这份简历文字超过 20000 字，请先精简后再使用。'); return }
    if (kind !== 'new' && !task) return
    if (!envConfigured && !getLlmSettings()) { openSettings(); return }
    if (!tools.connected) { pending.current = kind; tools.onConnect(); return }
    pending.current = null
    if (!navigator.locks) { setError('当前页面无法安全保存任务，请使用新版浏览器，并通过 localhost 或 HTTPS 打开。'); return }
    busy.current = true; pauseRequested.current = false; setRunning(true); setPausing(false); setError(''); tools.onBusy(true)
    let initial: AssistantTask = kind === 'new' ? {
      version: 1, id: crypto.randomUUID(), goal: goal.trim(), createdAt: Date.now(), updatedAt: Date.now(),
      resume: { id: document!.id, name: document!.sourceFile, text, updatedAt: document!.updatedAt,
        attachment: document!.originalFile, attachmentUpdatedAt: document!.originalFileUpdatedAt },
      status: 'paused', message: '', sources: [], jobs: [],
    } : task!
    const call = async (body: unknown) => {
      const response = await fetch('/api/job-assistant', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: AbortSignal.timeout(100_000),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || '分析失败，可以稍后继续。')
      return data
    }
    try {
      await navigator.locks.request('resume-grill-job-assistant', { ifAvailable: true }, async lock => {
        if (!lock) throw new Error('另一个页面仍在处理求职任务，请等它结束后继续。')
        if (kind !== 'new') {
          const saved = await loadAssistantStore()
          if (!saved.task || saved.task.id !== initial.id) throw new Error('任务已在其他页面更换，请刷新查看最新任务。')
          initial = { ...saved.task, sources: saved.task.sources.map(source => kind === 'retry' && source.status === 'failed' ? { ...source, status: 'pending', error: undefined } : source) }
        }
        const common = { goal: initial.goal, resume: initial.resume.text, llm: getLlmSettings() ?? undefined }
        await runJobAssistant(initial, {
          discover: tools.discover, read: tools.read,
          plan: () => call({ action: 'plan', ...common }),
          match: (plan, jobs) => call({ action: 'match', ...common, plan, jobs }),
          paused: () => pauseRequested.current || !active.current,
          checkpoint: async next => {
            await writer({ version: 1, goal: initial.goal, task: next })
            if (active.current) setTask(next)
          },
        })
      })
    } catch (cause) { if (active.current) setError(cause instanceof Error ? cause.message : '任务未能保存，请稍后继续。') }
    finally { busy.current = false; tools.onBusy(false); if (active.current) { setRunning(false); setPausing(false) } }
  }
  const continueAfterConnection = useEffectEvent((kind: 'new' | 'resume' | 'retry') => { void execute(kind) })
  useEffect(() => {
    if (tools.connected && !tools.disabled && pending.current) {
      const kind = pending.current; pending.current = null; continueAfterConnection(kind)
    }
  }, [tools.connected, tools.disabled])
  return { goal, setGoal, saveGoal, documents, resumeId, setResumeId, task, hydrated, running, pausing, error, setError, execute,
    pause: () => { pauseRequested.current = true; setPausing(true) } }
}
