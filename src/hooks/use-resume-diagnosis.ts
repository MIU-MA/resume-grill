'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { resumeDiagnosisSchema, type ResumeDiagnosis } from '@/domain/resume-diagnosis'
import { getLlmSettings } from '@/lib/settings'

export function useResumeDiagnosis(rawText: string, jobDescription: string, enabled: boolean, demo: boolean) {
  const input = { rawText: rawText.trim(), jobDescription: jobDescription.trim() }
  const latestInput = useRef(input)
  latestInput.current = input
  const [result, setResult] = useState<{ rawText: string; jobDescription: string; report: ResumeDiagnosis } | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const controller = useRef<AbortController | null>(null)
  const requestId = useRef(0)
  const autoStarted = useRef(false)

  const invalidate = useCallback(() => {
    requestId.current++
    controller.current?.abort()
    controller.current = null
  }, [])

  const cancel = useCallback(() => {
    autoStarted.current = true
    invalidate()
    setLoading(false)
  }, [invalidate])

  const generate = useCallback(async () => {
    cancel()
    const snapshot = latestInput.current
    if (!snapshot.rawText || snapshot.rawText.length > 20_000 || snapshot.jobDescription.length > 12_000) {
      setError('请确认简历正文不为空且不超过 20000 字，岗位描述不超过 12000 字。')
      return
    }
    if (!enabled && !demo) {
      setError('请先配置模型，再检查简历。')
      return
    }
    autoStarted.current = true
    const id = ++requestId.current
    const abort = new AbortController()
    controller.current = abort
    setLoading(true)
    setError(null)
    try {
      const llm = demo ? null : getLlmSettings()
      const response = await fetch('/api/diagnose', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...snapshot, demo, ...(llm ? { llm } : {}) }),
        signal: AbortSignal.any([abort.signal, AbortSignal.timeout(100_000)]),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(typeof data.error === 'string' ? data.error : '检查失败，请稍后重试。')
      const report = resumeDiagnosisSchema.parse(data)
      if (id === requestId.current && snapshot.rawText === latestInput.current.rawText && snapshot.jobDescription === latestInput.current.jobDescription) {
        setResult({ ...snapshot, report })
      }
    } catch (error) {
      if (id === requestId.current && !abort.signal.aborted) {
        setError(error instanceof Error && error.name === 'TimeoutError' ? '检查超时，请稍后重试。' : error instanceof Error ? error.message : '检查失败，请稍后重试。')
      }
    } finally {
      if (id === requestId.current) {
        controller.current = null
        setLoading(false)
      }
    }
  }, [cancel, enabled, demo])

  useEffect(() => {
    setError(null)
    setLoading(false)
    return invalidate
  }, [input.rawText, input.jobDescription, invalidate])

  useEffect(() => {
    if (autoStarted.current || (!enabled && !demo)) return
    // Defer until after mount so Strict Mode's effect replay cannot duplicate a paid call.
    const timer = window.setTimeout(() => { void generate() }, 0)
    return () => window.clearTimeout(timer)
  }, [enabled, demo, generate])

  const current = result?.rawText === input.rawText && result?.jobDescription === input.jobDescription
  return { report: current ? result.report : null, stale: Boolean(result && !current), loading, error, generate, cancel }
}
