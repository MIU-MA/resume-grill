'use client'

import { useState, useRef, useCallback, useEffect, type SetStateAction } from 'react'
import { interviewInputKey, readInterviewInput, writeInterviewInput } from '../lib/interview-input-draft'
import type { ResumeClaim } from '@/domain/resume-schema'
import type { ClaimAnalysis, InterviewAction, InterviewRound, InterviewSession, InterviewContinueResult, FinalResult } from '@/domain/interview-schema'
import type { InterviewContext } from '@/domain/interview-context'
import { getLlmSettings } from '@/lib/settings'
import { mergeCoveredPoints } from '@/domain/interview-state'

type Callbacks = {
  onError: (msg: string) => void
  onToast: (msg: string) => void
  onSessionSaved: (claimId: string, session: InterviewSession) => void
}

type StartOptions = {
  version?: number
  claimContent?: string
}

export function useInterview(envConfigured: boolean, { onError, onToast, onSessionSaved }: Callbacks, getContext?: (claimId: string) => InterviewContext, scope = 'local') {
  const [rounds, setRounds] = useState<InterviewRound[]>([])
  const [currentQuestion, setCurrentQuestion] = useState('')
  const [currentIntent, setCurrentIntent] = useState('')
  const [answer, setAnswer] = useState('')
  const [annotation, setAnnotation] = useState('')
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)
  const [activeClaimSnapshot, setActiveClaimSnapshot] = useState<ResumeClaim | null>(null)
  const [version, setVersion] = useState(1)
  const [draftSaved, setDraftSaved] = useState(true)
  const [interviewerStyle, setStyleState] = useState<NonNullable<InterviewContext['interviewerStyle']>>('standard')
  const [regeneratingId, setRegeneratingId] = useState<string | null>(null)
  const generation = useRef(0)
  const requests = useRef(new Set<AbortController>())
  const invalidateRequests = useCallback(() => {
    generation.current++
    for (const request of requests.current) request.abort()
    requests.current.clear()
  }, [])
  useEffect(() => {
    setLoading(false); setRegeneratingId(null)
    return invalidateRequests
  }, [scope, invalidateRequests])
  const inputs = useRef({ answer, annotation })
  inputs.current = { answer, annotation }

  const contextRef = useRef<InterviewContext | undefined>(undefined)
  const cache = useRef<Map<string, ClaimAnalysis>>(new Map())
  const cacheKey = (claim: ResumeClaim) => `${claim.id}:${hashClaimContent(claim.content)}`

  const reset = useCallback(() => {
    invalidateRequests(); setLoading(false); setRegeneratingId(null)
    setStyleState('standard')
    cache.current.clear(); contextRef.current = undefined
    setRounds([]); setCurrentQuestion(''); setCurrentIntent(''); setAnswer(''); setAnnotation('')
    setDone(false); setActiveClaimSnapshot(null); setVersion(1); setDraftSaved(true)
  }, [invalidateRequests])

  const restore = useCallback((claim: ResumeClaim, session: InterviewSession): boolean => {
    if (session.status !== 'in_progress') return false
    invalidateRequests(); setLoading(false); setRegeneratingId(null)
    contextRef.current = session.context ?? getContext?.(claim.id)
    setStyleState(contextRef.current?.interviewerStyle ?? 'standard')
    const snapshot: ResumeClaim = session.claimContent && session.claimContent !== claim.content
      ? { ...claim, content: session.claimContent }
      : claim
    setActiveClaimSnapshot(snapshot)
    setRounds(session.rounds)
    setCurrentQuestion(session.pendingQuestion ?? snapshot.initialQuestion)
    setCurrentIntent(session.pendingIntent ?? snapshot.initialIntent ?? '')
    const draft = readInterviewInput(interviewInputKey(scope, snapshot, session.version, session.rounds.length, session.pendingQuestion ?? snapshot.initialQuestion))
    setAnswer(draft.answer); setAnnotation(draft.annotation); setDone(false)
    setVersion(session.version)
    if (session.claimAnalysis) {
      cache.current.set(cacheKey(snapshot), session.claimAnalysis)
    }
    return true
  }, [getContext, scope, invalidateRequests])

  const start = useCallback(async (claim: ResumeClaim, opts?: StartOptions) => {
    if (!getLlmSettings() && !envConfigured) {
      onError('请先配置 API Key（点击顶部齿轮图标 → Base URL + Key + Model）')
      return
    }
    invalidateRequests(); setRegeneratingId(null)
    setLoading(true); onError('')
    contextRef.current = getContext?.(claim.id)
    setStyleState(contextRef.current?.interviewerStyle ?? 'standard')

    const resolvedVersion = opts?.version ?? 1
    const resolvedContent = opts?.claimContent ?? claim.content
    const isRewrite = Boolean(opts?.claimContent && opts.claimContent !== claim.content)
    const effectiveClaim: ResumeClaim = isRewrite
      ? { ...claim, content: resolvedContent }
      : claim

    if (opts?.version && opts.version > 1) {
      setVersion(opts.version)
      if (isRewrite) setActiveClaimSnapshot(effectiveClaim)
      setRounds([]); setAnswer(''); setAnnotation(''); setDone(false)
    }

    try {
      if (!isRewrite) setActiveClaimSnapshot(effectiveClaim)

      const key = cacheKey(effectiveClaim)
      let claimAnalysis = cache.current.get(key) ?? null
      if (!claimAnalysis) {
        claimAnalysis = buildClaimAnalysisFromClaim(effectiveClaim)
        cache.current.set(key, claimAnalysis)
      }

      setCurrentQuestion(effectiveClaim.initialQuestion)
      const draft = readInterviewInput(interviewInputKey(scope, effectiveClaim, resolvedVersion, 0, effectiveClaim.initialQuestion))
      setAnswer(draft.answer); setAnnotation(draft.annotation)
      setCurrentIntent(effectiveClaim.initialIntent || '先讲清这件事里你做了什么')

      if (typeof window !== 'undefined') {
        window.sessionStorage.setItem('resume-grill:active-claim', effectiveClaim.id)
      }

      onSessionSaved(effectiveClaim.id, {
        id: `${effectiveClaim.id}:v${resolvedVersion}`,
        context: contextRef.current,
        claimContent: resolvedContent,
        rounds: [],
        claimAnalysis,
        finalResult: null,
        status: 'in_progress',
        version: resolvedVersion,
        pendingQuestion: effectiveClaim.initialQuestion,
        pendingIntent: effectiveClaim.initialIntent || '先讲清这件事里你做了什么',
      })
    } catch (e) { onError(e instanceof Error ? e.message : '启动面试失败') }
    finally { setLoading(false) }
  }, [envConfigured, onError, onSessionSaved, getContext, scope, invalidateRequests])

  const finalizeSession = useCallback(async (claim: ResumeClaim, finalRounds: InterviewRound[], signal: AbortSignal, isCurrent: () => boolean) => {
    const snapshot = activeClaimSnapshot ?? claim
    const sessionId = `${snapshot.id}:v${version}`
    const context = contextRef.current
    const claimAnalysis = cache.current.get(cacheKey(snapshot))!
    let finalResult: FinalResult | null = null
    let summarySucceeded = false

    onSessionSaved(snapshot.id, {
      id: sessionId,
      context,
      claimContent: snapshot.content,
      rounds: finalRounds,
      claimAnalysis,
      finalResult: null,
      status: 'done',
      version,
    })

    try {
      const llm = getLlmSettings()
      const body: any = { claim: snapshot, rounds: finalRounds, context }; if (llm) body.llm = llm
      const res = await fetch('/api/summarize', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: AbortSignal.any([signal, AbortSignal.timeout(100_000)]) })
      const data = (await res.json()) as FinalResult | { error: string }
      if (!isCurrent()) return
      if (!res.ok || 'error' in data) {
        onToast('总结生成失败，问答记录仍会保存。')
      } else {
        finalResult = data; summarySucceeded = true
      }
    } catch { if (!isCurrent()) return; onToast('总结请求失败，问答记录仍会保存。') }

    if (!isCurrent()) return

    onSessionSaved(snapshot.id, {
      id: sessionId,
      context,
      claimContent: snapshot.content,
      rounds: finalRounds,
      claimAnalysis,
      finalResult,
      status: 'done',
      version,
      summaryStatus: summarySucceeded ? 'success' : 'failed',
    })
    if (summarySucceeded) onToast('练习已结束，可在「面试复盘」查看。')
  }, [activeClaimSnapshot, version, onToast, onSessionSaved])

  const saveInProgress = useCallback((claim: ResumeClaim, newRounds: InterviewRound[], nextQuestion: string, nextIntent: string) => {
    const snapshot = activeClaimSnapshot ?? claim
    const claimAnalysis = cache.current.get(cacheKey(snapshot))
    onSessionSaved(snapshot.id, {
      id: `${snapshot.id}:v${version}`,
      context: contextRef.current,
      claimContent: snapshot.content,
      rounds: newRounds,
      claimAnalysis: claimAnalysis ?? null,
      finalResult: null,
      status: 'in_progress',
      version,
      pendingQuestion: nextQuestion,
      pendingIntent: nextIntent,
    })
  }, [activeClaimSnapshot, version, onSessionSaved])

  const continueInterview = useCallback(async (claim: ResumeClaim, action: InterviewAction) => {
    if (!currentQuestion || loading || done || requests.current.size) return
    if (action === 'answer' && !answer.trim()) return
    if (action === 'clarify' && !annotation.trim()) return
    const snapshot = activeClaimSnapshot ?? claim
    const abort = new AbortController()
    const epoch = generation.current
    requests.current.add(abort)
    const isCurrent = () => generation.current === epoch && !abort.signal.aborted
    setLoading(true)
    try {
      const claimAnalysis = cache.current.get(cacheKey(snapshot))
      if (!claimAnalysis) throw new Error('声明分析未找到，请重新开始追问')
      const llm = getLlmSettings()
      const submittedAnswer = action === 'answer' ? answer : ''
      const submittedAnnotation = action === 'skip' ? '' : annotation
      const body: any = {
        claim: snapshot,
        context: contextRef.current,
        action, question: currentQuestion,
        answer: submittedAnswer, annotation: submittedAnnotation,
        rounds, verifyPoints: claimAnalysis.verifyPoints, trapPoints: claimAnalysis.trapPoints,
      }
      if (llm) body.llm = llm
      const res = await fetch('/api/interview/continue', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: AbortSignal.any([abort.signal, AbortSignal.timeout(100_000)]) })
      const data = (await res.json()) as InterviewContinueResult | { error: string }
      if (!isCurrent()) return
      if (!res.ok || 'error' in data) throw new Error('error' in data ? data.error : '生成下一问失败')
      const round: InterviewRound = {
        action, question: currentQuestion, questionIntent: currentIntent,
        answer: submittedAnswer, annotation: submittedAnnotation,
        evaluation: data.evaluation, nextReason: data.nextReason,
      }
      const newRounds = [...rounds, round]; setRounds(newRounds)
      writeInterviewInput(interviewInputKey(scope, snapshot, version, rounds.length, currentQuestion), { answer: '', annotation: '' })
      setCurrentQuestion(data.nextQuestion); setCurrentIntent(data.nextReason)
      setAnswer(''); setAnnotation('')
      if (data.isFinal) {
        setDone(true)
        await finalizeSession(snapshot, newRounds, abort.signal, isCurrent)
      } else {
        saveInProgress(snapshot, newRounds, data.nextQuestion, data.nextReason)
      }
    } catch (e) { if (isCurrent()) onError(e instanceof Error && e.name === 'TimeoutError' ? '追问超时，请重试。回答草稿已保留。' : e instanceof Error ? e.message : '追问失败') }
    finally { requests.current.delete(abort); if (isCurrent()) setLoading(false) }
  }, [currentQuestion, currentIntent, loading, done, answer, annotation, rounds, activeClaimSnapshot, finalizeSession, saveInProgress, onError, scope, version])

  const submit = useCallback((claim: ResumeClaim) => (
    continueInterview(claim, answer.trim() ? 'answer' : 'clarify')
  ), [answer, continueInterview])

  const skip = useCallback((claim: ResumeClaim) => continueInterview(claim, 'skip'), [continueInterview])

  const retryRound = useCallback(async (claim: ResumeClaim, index: number, revised: string) => {
    const original = rounds[index]
    if (!original || original.action !== 'answer' || !revised.trim() || revised.length > 12000 || requests.current.size) return
    const snapshot = activeClaimSnapshot ?? claim
    const abort = new AbortController(), epoch = generation.current
    requests.current.add(abort); setLoading(true); onError('')
    const isCurrent = () => epoch === generation.current && !abort.signal.aborted
    try {
      const analysis = cache.current.get(cacheKey(snapshot)) ?? buildClaimAnalysisFromClaim(snapshot)
      const response = await fetch('/api/interview/continue', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ claim: snapshot, context: contextRef.current, action: 'answer', question: original.question, answer: revised, annotation: original.annotation, rounds: rounds.slice(0, index), verifyPoints: analysis.verifyPoints, trapPoints: analysis.trapPoints, llm: getLlmSettings() ?? undefined }), signal: AbortSignal.any([abort.signal, AbortSignal.timeout(100000)]) })
      const data = await response.json()
      if (!isCurrent()) return
      if (!response.ok || data.error) throw new Error(data.error || '重答评估失败。')
      const updated = rounds.map((round, at) => {
        if (at !== index) return round
        const attempts = [...(round.previousAttempts ?? []), { answer: round.answer, annotation: round.annotation ?? '', score: round.evaluation.score, feedback: round.evaluation.answerSuggestion ?? '' }]
        return { ...round, answer: revised, evaluation: data.evaluation, previousAttempts: attempts.length > 20 ? [attempts[0], ...attempts.slice(-19)] : attempts }
      })
      setRounds(updated)
      if (done) await finalizeSession(snapshot, updated, abort.signal, isCurrent)
      else saveInProgress(snapshot, updated, currentQuestion, currentIntent)
    } catch (cause) { if (isCurrent()) { const message = cause instanceof Error ? cause.message : '重答失败。'; onError(message); throw new Error(message) } }
    finally { requests.current.delete(abort); if (isCurrent()) setLoading(false) }
  }, [rounds, activeClaimSnapshot, done, currentQuestion, currentIntent, finalizeSession, saveInProgress, onError])

  const regenerateSummary = useCallback(async (claim: ResumeClaim, session: InterviewSession) => {
    if (requests.current.size) return false
    const abort = new AbortController()
    const epoch = generation.current
    requests.current.add(abort)
    const isCurrent = () => generation.current === epoch && !abort.signal.aborted
    const snapshot: ResumeClaim = session.claimContent && session.claimContent !== claim.content
      ? { ...claim, content: session.claimContent }
      : claim
    const claimAnalysis = session.claimAnalysis ?? buildClaimAnalysisFromClaim(snapshot)
    cache.current.set(cacheKey(snapshot), claimAnalysis)
    const context = session.context ?? getContext?.(claim.id)
    setRegeneratingId(session.id)
    try {
      const llm = getLlmSettings()
      const body: any = { claim: snapshot, rounds: session.rounds, context }; if (llm) body.llm = llm
      const res = await fetch('/api/summarize', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: AbortSignal.any([abort.signal, AbortSignal.timeout(100_000)]) })
      const data = (await res.json()) as FinalResult | { error: string }
      if (!isCurrent()) return false
      if (!res.ok || 'error' in data) {
        onToast('重新生成总结失败，请稍后再试。')
        return false
      }
      onSessionSaved(snapshot.id, {
        id: `${snapshot.id}:v${session.version}`,
        context,
        claimContent: snapshot.content,
        rounds: session.rounds,
        claimAnalysis,
        finalResult: data,
        status: 'done',
        version: session.version,
        summaryStatus: 'success',
      })
      onToast('复盘已重新生成，可在「面试复盘」查看。')
      return true
    } catch (e) {
      if (!isCurrent()) return false
      onError(e instanceof Error ? e.message : '重新生成总结失败')
      return false
    } finally { requests.current.delete(abort); if (isCurrent()) setRegeneratingId(null) }
  }, [onError, onToast, onSessionSaved, getContext])

  const setInterviewerStyle = (style: NonNullable<InterviewContext['interviewerStyle']>) => {
    if (done || requests.current.size) return
    setStyleState(style)
    contextRef.current = { jobDescription: '', reviewProgress: [], ...contextRef.current, interviewerStyle: style }
    if (activeClaimSnapshot && !done && !requests.current.size) saveInProgress(activeClaimSnapshot, rounds, currentQuestion, currentIntent)
  }
  const covered = mergeCoveredPoints(rounds, [], (activeClaimSnapshot?.masteryPoints ?? []).map(point => point.point))
  const updateInput = (field: 'answer' | 'annotation', action: SetStateAction<string>) => {
    const value = typeof action === 'function' ? action(inputs.current[field]) : action
    inputs.current = { ...inputs.current, [field]: value }
    if (activeClaimSnapshot && currentQuestion && !done) {
      const saved = writeInterviewInput(interviewInputKey(scope, activeClaimSnapshot, version, rounds.length, currentQuestion), inputs.current)
      setDraftSaved(saved)
      if (!saved) onError('回答草稿无法暂存，请复制内容备份后再切换。')
    }
    if (field === 'answer') setAnswer(value); else setAnnotation(value)
  }

  return {
    scope, rounds, currentQuestion, currentIntent, answer, setAnswer: (value: SetStateAction<string>) => updateInput('answer', value), annotation, setAnnotation: (value: string) => updateInput('annotation', value), loading, done,
    activeClaimSnapshot, version, covered, draftSaved,
    reset, start, restore, submit, skip, retryRound, interviewerStyle, setInterviewerStyle, regenerateSummary, regeneratingId,
  }
}

function hashClaimContent(content: string): number {
  let hash = 0
  for (let i = 0; i < content.length; i++) {
    hash = ((hash << 5) - hash) + content.charCodeAt(i) | 0
  }
  return hash
}

function buildClaimAnalysisFromClaim(claim: ResumeClaim): ClaimAnalysis {
  const verifyPoints: Array<{ point: string; importance: 'high' | 'medium' | 'low' }> =
    claim.masteryPoints.map((mp) => ({
      point: mp.point,
      importance: mp.importance,
    }))

  return {
    level: claim.role,
    verifyPoints,
    trapPoints: claim.trapPoints ?? [],
  }
}
