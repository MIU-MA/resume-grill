'use client'

import { useState, useRef, useCallback } from 'react'
import type { ResumeClaim } from '@/domain/resume-schema'
import type { ClaimAnalysis, InterviewAction, InterviewRound, InterviewSession, InterviewContinueResult, FinalResult } from '@/domain/interview-schema'
import { getLlmSettings } from '@/lib/settings'

type Callbacks = {
  onError: (msg: string) => void
  onToast: (msg: string) => void
  onSessionSaved: (claimId: string, session: InterviewSession) => void
}

type StartOptions = {
  version?: number
  claimContent?: string
}

export function useInterview(envConfigured: boolean, { onError, onToast, onSessionSaved }: Callbacks) {
  const [rounds, setRounds] = useState<InterviewRound[]>([])
  const [currentQuestion, setCurrentQuestion] = useState('')
  const [currentIntent, setCurrentIntent] = useState('')
  const [answer, setAnswer] = useState('')
  const [annotation, setAnnotation] = useState('')
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)
  const [activeClaimSnapshot, setActiveClaimSnapshot] = useState<ResumeClaim | null>(null)
  const [version, setVersion] = useState(1)

  const cache = useRef<Map<string, ClaimAnalysis>>(new Map())
  const cacheKey = (claim: ResumeClaim) => `${claim.id}:${hashClaimContent(claim.content)}`

  const reset = useCallback(() => {
    setRounds([]); setCurrentQuestion(''); setCurrentIntent(''); setAnswer(''); setAnnotation('')
    setDone(false); setActiveClaimSnapshot(null); setVersion(1)
  }, [])

  const restore = useCallback((claim: ResumeClaim, session: InterviewSession): boolean => {
    if (session.status !== 'in_progress') return false
    const snapshot: ResumeClaim = session.claimContent && session.claimContent !== claim.content
      ? { ...claim, content: session.claimContent }
      : claim
    setActiveClaimSnapshot(snapshot)
    setRounds(session.rounds)
    setCurrentQuestion(session.pendingQuestion ?? snapshot.initialQuestion)
    setCurrentIntent(session.pendingIntent ?? snapshot.initialIntent ?? '')
    setAnswer(''); setAnnotation(''); setDone(false)
    setVersion(session.version)
    if (session.claimAnalysis) {
      cache.current.set(cacheKey(snapshot), session.claimAnalysis)
    }
    return true
  }, [])

  const start = useCallback(async (claim: ResumeClaim, opts?: StartOptions) => {
    if (!getLlmSettings() && !envConfigured) {
      onError('请先配置 API Key（点击顶部齿轮图标 → Base URL + Key + Model）')
      return
    }
    setLoading(true); onError('')

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
      setCurrentIntent(effectiveClaim.initialIntent || '验证具体过程和个人贡献')

      if (typeof window !== 'undefined') {
        window.sessionStorage.setItem('resume-grill:active-claim', effectiveClaim.id)
      }

      onSessionSaved(effectiveClaim.id, {
        id: `${effectiveClaim.id}:v${resolvedVersion}`,
        claimContent: resolvedContent,
        rounds: [],
        claimAnalysis,
        finalResult: null,
        status: 'in_progress',
        version: resolvedVersion,
        pendingQuestion: effectiveClaim.initialQuestion,
        pendingIntent: effectiveClaim.initialIntent || '验证具体过程和个人贡献',
      })
    } catch (e) { onError(e instanceof Error ? e.message : '启动面试失败') }
    finally { setLoading(false) }
  }, [envConfigured, onError, onSessionSaved])

  const finalizeSession = useCallback(async (claim: ResumeClaim, finalRounds: InterviewRound[]) => {
    const snapshot = activeClaimSnapshot ?? claim
    let finalResult: FinalResult = {
      masteryScore: 0, masteryLevel: 'not_demonstrated',
      canExplain: [], cannotExplain: ['总结生成失败'],
      knowledgeGaps: [], rewriteSuggestion: '',
      answerSummary: '本次总结没有成功生成，但问答记录已经保留。',
      nextAction: '稍后重新生成总结。',
    }
    let summarySucceeded = false
    try {
      const llm = getLlmSettings()
      const body: any = { claim: snapshot, rounds: finalRounds }; if (llm) body.llm = llm
      const res = await fetch('/api/summarize', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      const data = (await res.json()) as FinalResult | { error: string }
      if (!res.ok || 'error' in data) {
        onToast('总结生成失败，问答记录仍会保存。')
      } else {
        finalResult = data; summarySucceeded = true
      }
    } catch { onToast('总结请求失败，问答记录仍会保存。') }
    onSessionSaved(snapshot.id, {
      id: `${snapshot.id}:v${version}`,
      claimContent: snapshot.content,
      rounds: finalRounds,
      claimAnalysis: cache.current.get(cacheKey(snapshot))!,
      finalResult,
      status: 'done',
      version,
      summaryStatus: summarySucceeded ? 'success' : 'failed',
    })
    if (summarySucceeded) onToast('追问已完成，可在「分析报告」查看结论。')
  }, [activeClaimSnapshot, version, onToast, onSessionSaved])

  const saveInProgress = useCallback((claim: ResumeClaim, newRounds: InterviewRound[], nextQuestion: string, nextIntent: string) => {
    const snapshot = activeClaimSnapshot ?? claim
    const claimAnalysis = cache.current.get(cacheKey(snapshot))
    onSessionSaved(snapshot.id, {
      id: `${snapshot.id}:v${version}`,
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
    if (!currentQuestion || loading || done) return
    if (action === 'answer' && !answer.trim()) return
    if (action === 'clarify' && !annotation.trim()) return
    const snapshot = activeClaimSnapshot ?? claim
    setLoading(true)
    try {
      const claimAnalysis = cache.current.get(cacheKey(snapshot))
      if (!claimAnalysis) throw new Error('声明分析未找到，请重新开始追问')
      const llm = getLlmSettings()
      const submittedAnswer = action === 'answer' ? answer : ''
      const submittedAnnotation = action === 'clarify' ? annotation : ''
      const body: any = {
        claim: snapshot,
        action, question: currentQuestion,
        answer: submittedAnswer, annotation: submittedAnnotation,
        rounds, verifyPoints: claimAnalysis.verifyPoints, trapPoints: claimAnalysis.trapPoints,
      }
      if (llm) body.llm = llm
      const res = await fetch('/api/interview/continue', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      const data = (await res.json()) as InterviewContinueResult | { error: string }
      if (!res.ok || 'error' in data) throw new Error('error' in data ? data.error : '生成下一问失败')
      const round: InterviewRound = {
        action, question: currentQuestion, questionIntent: currentIntent,
        answer: submittedAnswer, annotation: submittedAnnotation,
        evaluation: data.evaluation, nextReason: data.nextReason,
      }
      const newRounds = [...rounds, round]; setRounds(newRounds)
      setCurrentQuestion(data.nextQuestion); setCurrentIntent(data.nextReason)
      setAnswer(''); setAnnotation('')
      if (data.isFinal) {
        setDone(true)
        await finalizeSession(snapshot, newRounds)
      } else {
        saveInProgress(snapshot, newRounds, data.nextQuestion, data.nextReason)
      }
    } catch (e) { onError(e instanceof Error ? e.message : '追问失败') }
    finally { setLoading(false) }
  }, [currentQuestion, currentIntent, loading, done, answer, annotation, rounds, activeClaimSnapshot, finalizeSession, saveInProgress, onError])

  const submit = useCallback((claim: ResumeClaim) => (
    continueInterview(claim, answer.trim() ? 'answer' : 'clarify')
  ), [answer, continueInterview])

  const skip = useCallback((claim: ResumeClaim) => continueInterview(claim, 'skip'), [continueInterview])

  const [regenerating, setRegenerating] = useState(false)

  const regenerateSummary = useCallback(async (claim: ResumeClaim, session: InterviewSession) => {
    const snapshot: ResumeClaim = session.claimContent && session.claimContent !== claim.content
      ? { ...claim, content: session.claimContent }
      : claim
    const claimAnalysis = session.claimAnalysis ?? buildClaimAnalysisFromClaim(snapshot)
    cache.current.set(cacheKey(snapshot), claimAnalysis)
    setRegenerating(true)
    try {
      const llm = getLlmSettings()
      const body: any = { claim: snapshot, rounds: session.rounds }; if (llm) body.llm = llm
      const res = await fetch('/api/summarize', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      const data = (await res.json()) as FinalResult | { error: string }
      if (!res.ok || 'error' in data) {
        onToast('重新生成总结失败，请稍后再试。')
        return false
      }
      onSessionSaved(snapshot.id, {
        id: `${snapshot.id}:v${session.version}`,
        claimContent: snapshot.content,
        rounds: session.rounds,
        claimAnalysis,
        finalResult: data,
        status: 'done',
        version: session.version,
        summaryStatus: 'success',
      })
      onToast('总结已重新生成，可在「分析报告」查看。')
      return true
    } catch (e) {
      onError(e instanceof Error ? e.message : '重新生成总结失败')
      return false
    } finally { setRegenerating(false) }
  }, [onError, onToast, onSessionSaved])

  const covered = rounds[rounds.length - 1]?.evaluation?.coveredPoints ?? []

  return {
    rounds, currentQuestion, currentIntent, answer, setAnswer, annotation, setAnnotation, loading, done,
    activeClaimSnapshot, version, covered,
    reset, start, restore, submit, skip, regenerateSummary, regenerating,
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
