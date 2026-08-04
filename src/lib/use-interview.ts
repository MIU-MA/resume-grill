'use client'

import { useState, useRef, useCallback } from 'react'
import type { ResumeClaim } from '@/domain/resume-schema'
import type { ClaimAnalysis, InterviewAction, InterviewRound, InterviewSession, InterviewContinueResult, FinalResult } from '@/domain/interview-schema'
import type { LlmSettings } from '@/lib/settings'
import { getLlmSettings } from '@/lib/settings'

type Callbacks = {
  onError: (msg: string) => void
  onToast: (msg: string) => void
  onSessionSaved: (claimId: string, session: InterviewSession) => void
}

type StartOptions = {
  /** 版本号（重测/改写时传入，避免 React 状态异步问题） */
  version?: number
  /** 改写后的声明文本（改写模式传入） */
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

  // 缓存键：claim.id + 内容哈希，改写后不会复用原文分析
  const cache = useRef<Map<string, ClaimAnalysis>>(new Map())
  const cacheKey = (claim: ResumeClaim) => `${claim.id}:${hashClaimContent(claim.content)}`

  const reset = useCallback(() => {
    setRounds([]); setCurrentQuestion(''); setCurrentIntent(''); setAnswer(''); setAnnotation('')
    setDone(false); setActiveClaimSnapshot(null); setVersion(1)
  }, [])

  const restore = useCallback((claimId: string, session: InterviewSession): boolean => {
    if (session.status !== 'in_progress') return false
    setRounds(session.rounds)
    setCurrentQuestion(session.pendingQuestion ?? '')
    setCurrentIntent(session.pendingIntent ?? '')
    setAnswer(''); setAnnotation(''); setDone(false)
    setVersion(session.version)
    if (session.claimContent) {
      setActiveClaimSnapshot(createSnapshot(claimId, session.claimContent))
    }
    if (session.claimAnalysis) {
      const key = session.claimContent
        ? `${claimId}:${hashClaimContent(session.claimContent)}`
        : `${claimId}:0`
      cache.current.set(key, session.claimAnalysis)
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

    // 改写/重测：用参数同步设置 state（不依赖 React 异步批处理）
    if (opts?.version && opts.version > 1) {
      setVersion(opts.version)
      if (isRewrite) setActiveClaimSnapshot(createSnapshot(claim.id, resolvedContent))
      setRounds([]); setAnswer(''); setAnnotation(''); setDone(false)
    }

    try {
      // 构造改写声明（如果有改写内容），后续全部用 snapshot
      const effectiveClaim: ResumeClaim = isRewrite
        ? { ...claim, content: resolvedContent }
        : claim
      if (!isRewrite) setActiveClaimSnapshot(effectiveClaim)

      // 从 claim 数据直接构造 ClaimAnalysis，不调 API
      const key = cacheKey(effectiveClaim)
      let claimAnalysis = cache.current.get(key) ?? null
      if (!claimAnalysis) {
        claimAnalysis = buildClaimAnalysisFromClaim(effectiveClaim)
        cache.current.set(key, claimAnalysis)
      }

      setCurrentQuestion(effectiveClaim.initialQuestion)
      setCurrentIntent(effectiveClaim.initialIntent || '验证具体过程和个人贡献')

      // 立即持久化（用显式参数，不读 state）
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
      confidence: 0, risk: 'medium',
      canExplain: [], cannotExplain: ['总结生成失败'],
      suggestions: [], rewriteSuggestion: '',
      answerSummary: '本次总结没有成功生成，但问答记录已经保留。',
      evidenceUsed: [], missingEvidence: [], nextAction: '稍后重新生成总结。',
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

  const covered = rounds[rounds.length - 1]?.evaluation?.coveredPoints ?? []

  return {
    rounds, currentQuestion, currentIntent, answer, setAnswer, annotation, setAnnotation, loading, done,
    activeClaimSnapshot, version, covered,
    reset, start, restore, submit, skip,
  }
}

// ── 工具函数 ──

function hashClaimContent(content: string): number {
  let hash = 0
  for (let i = 0; i < content.length; i++) {
    hash = ((hash << 5) - hash) + content.charCodeAt(i) | 0
  }
  return hash
}

function createSnapshot(id: string, content: string): ResumeClaim {
  return { id, content } as ResumeClaim
}

function buildClaimAnalysisFromClaim(claim: ResumeClaim): ClaimAnalysis {
  // 优先用 LLM 生成的 verifyPoints，否则从 evaluationPoints 退化
  const rawVp = (claim as Record<string, unknown>).verifyPoints as Array<{ point: string; importance: string }> | undefined
  const rawTp = (claim as Record<string, unknown>).trapPoints as string[] | undefined
  const rawIntent = (claim as Record<string, unknown>).initialIntent as string | undefined

  const verifyPoints: Array<{ point: string; importance: 'high' | 'medium' | 'low' }> =
    rawVp && rawVp.length > 0
      ? rawVp.map((vp) => ({
          point: vp.point,
          importance: (vp.importance === 'high' || vp.importance === 'medium' || vp.importance === 'low')
            ? vp.importance : 'medium',
        }))
      : claim.evaluationPoints.map((point, i) => ({
          point,
          importance: (i === 0 ? 'high' : 'medium') as 'high' | 'medium' | 'low',
        }))

  return {
    level: (claim as Record<string, unknown>).level as string ?? claim.role,
    verifyPoints,
    trapPoints: rawTp ?? [],
  }
}
