'use client'

import { useState, useRef, useCallback } from 'react'
import type { ResumeClaim } from '@/domain/resume-schema'
import type { ClaimAnalysis, InterviewRound, InterviewSession, InterviewStart, InterviewContinueResult, FinalResult } from '@/domain/interview-schema'
import type { LlmSettings } from '@/lib/settings'
import { getLlmSettings } from '@/lib/settings'

type Callbacks = {
  onError: (msg: string) => void
  onToast: (msg: string) => void
  onSessionSaved: (claimId: string, session: InterviewSession) => void
}

export function useInterview(envConfigured: boolean, { onError, onToast, onSessionSaved }: Callbacks) {
  const [rounds, setRounds] = useState<InterviewRound[]>([])
  const [currentQuestion, setCurrentQuestion] = useState('')
  const [currentIntent, setCurrentIntent] = useState('')
  const [answer, setAnswer] = useState('')
  const [annotation, setAnnotation] = useState('')
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)
  const [rewriteContent, setRewriteContent] = useState<string | null>(null)
  const [version, setVersion] = useState(1)
  const cache = useRef<Map<string, ClaimAnalysis>>(new Map())

  const reset = useCallback(() => {
    setRounds([]); setCurrentQuestion(''); setCurrentIntent(''); setAnswer(''); setAnnotation('')
    setDone(false); setRewriteContent(null); setVersion(1)
  }, [])

  const prepareRewrite = useCallback((rewrittenContent: string, newVersion: number) => {
    setRewriteContent(rewrittenContent); setVersion(newVersion)
    setRounds([]); setAnswer(''); setAnnotation(''); setDone(false)
  }, [])

  const prepareRetest = useCallback((newVersion: number) => {
    setRewriteContent(null); setVersion(newVersion)
    setRounds([]); setAnswer(''); setAnnotation(''); setDone(false)
  }, [])

  const start = useCallback(async (claim: ResumeClaim) => {
    if (!getLlmSettings() && !envConfigured) {
      onError('请先配置 API Key（点击顶部齿轮图标 → Base URL + Key + Model）')
      return
    }
    setLoading(true); onError('')
    try {
      const cacheKey = claim.id
      let claimAnalysis = cache.current.get(cacheKey) ?? null
      if (!claimAnalysis) {
        const llm = getLlmSettings()
        const body: { claim: ResumeClaim; llm?: LlmSettings } = { claim }
        if (llm) body.llm = llm
        const r = await fetch('/api/analyze-claim', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
        const d = (await r.json()) as ClaimAnalysis | { error: string }
        if (!r.ok || 'error' in d) throw new Error('error' in d ? d.error : '声明分析失败')
        claimAnalysis = d; cache.current.set(cacheKey, claimAnalysis)
      }
      const llm = getLlmSettings()
      const body: { claim: ResumeClaim; verifyPoints: ClaimAnalysis['verifyPoints']; llm?: LlmSettings } = { claim, verifyPoints: claimAnalysis.verifyPoints }
      if (llm) body.llm = llm
      const r2 = await fetch('/api/interview/start', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      const d2 = (await r2.json()) as InterviewStart | { error: string }
      if (!r2.ok || 'error' in d2) throw new Error('error' in d2 ? d2.error : '生成第一问失败')
      setCurrentQuestion(d2.question); setCurrentIntent(d2.intent)
    } catch (e) { onError(e instanceof Error ? e.message : '启动面试失败') }
    finally { setLoading(false) }
  }, [envConfigured, onError])

  const finalizeSession = useCallback(async (claim: ResumeClaim, finalRounds: InterviewRound[]) => {
    let summarySucceeded = false
    let finalResult: FinalResult = {
      confidence: 0,
      risk: 'medium',
      canExplain: [],
      cannotExplain: ['总结生成失败'],
      suggestions: [],
      rewriteSuggestion: '',
      answerSummary: '本次总结没有成功生成，但问答记录已经保留。',
      evidenceUsed: [],
      missingEvidence: [],
      nextAction: '稍后重新生成总结。',
    }
    try {
      const llm = getLlmSettings()
      const body: any = { claim, rounds: finalRounds }; if (llm) body.llm = llm
      const res = await fetch('/api/summarize', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      const data = (await res.json()) as FinalResult | { error: string }
      if (!res.ok || 'error' in data) {
        onToast('总结生成失败，问答记录仍会保存。')
      } else {
        finalResult = data
        summarySucceeded = true
      }
    } catch { onToast('总结请求失败，问答记录仍会保存。') }
    onSessionSaved(claim.id, {
      id: `${claim.id}:v${version}`,
      claimContent: rewriteContent ?? claim.content,
      rounds: finalRounds,
      claimAnalysis: cache.current.get(claim.id)!,
      finalResult,
      status: 'done',
      version,
    })
    if (summarySucceeded) onToast('追问已完成，可在「分析报告」查看结论。')
  }, [rewriteContent, version, onToast, onSessionSaved])

  const submit = useCallback(async (claim: ResumeClaim) => {
    if (!currentQuestion || loading || done) return
    if (!answer.trim() && !annotation.trim()) return
    setLoading(true)
    try {
      const claimAnalysis = cache.current.get(claim.id)
      if (!claimAnalysis) throw new Error('声明分析未找到，请重新开始追问')
      const llm = getLlmSettings()
      const body: any = { claim, question: currentQuestion, answer, annotation, rounds, verifyPoints: claimAnalysis.verifyPoints, trapPoints: claimAnalysis.trapPoints }
      if (llm) body.llm = llm
      const res = await fetch('/api/interview/continue', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      const data = (await res.json()) as InterviewContinueResult | { error: string }
      if (!res.ok || 'error' in data) throw new Error('error' in data ? data.error : '生成下一问失败')
      const round: InterviewRound = { question: currentQuestion, answer, annotation, evaluation: data.evaluation, nextReason: data.nextReason }
      const newRounds = [...rounds, round]; setRounds(newRounds)
      setCurrentQuestion(data.nextQuestion); setCurrentIntent(data.nextReason)
      setAnswer('')
      setAnnotation('')
      if (data.isFinal) {
        setDone(true)
        await finalizeSession(claim, newRounds)
      }
    } catch (e) { onError(e instanceof Error ? e.message : '追问失败') }
    finally { setLoading(false) }
  }, [currentQuestion, loading, done, answer, annotation, rounds, finalizeSession, onError])

  const covered = rounds[rounds.length - 1]?.evaluation?.coveredPoints ?? []

  return {
    rounds, currentQuestion, currentIntent, answer, setAnswer, annotation, setAnnotation, loading, done,
    rewriteContent, version, covered,
    reset, prepareRewrite, prepareRetest, start, submit,
  }
}
