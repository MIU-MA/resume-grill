'use client'

import { useState, useRef, useCallback } from 'react'
import type { ResumeClaim } from '@/domain/resume-schema'
import type { ClaimAnalysis, InterviewRound, InterviewSession, InterviewStart, InterviewContinueResult, FinalResult } from '@/domain/interview-schema'
import type { LlmSettings } from '@/lib/settings'
import { getLlmSettings } from '@/lib/settings'

type Callbacks = {
  onError: (msg: string) => void
  onToast: (msg: string) => void
  onSessionSaved: (claimContent: string, session: InterviewSession) => void
}

export function useInterview(envConfigured: boolean, { onError, onToast, onSessionSaved }: Callbacks) {
  const [rounds, setRounds] = useState<InterviewRound[]>([])
  const [currentQuestion, setCurrentQuestion] = useState('')
  const [currentIntent, setCurrentIntent] = useState('')
  const [answer, setAnswer] = useState('')
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)
  const [rewriteContent, setRewriteContent] = useState<string | null>(null)
  const [version, setVersion] = useState(1)
  const cache = useRef<Map<string, ClaimAnalysis>>(new Map())

  const reset = useCallback(() => {
    setRounds([]); setCurrentQuestion(''); setCurrentIntent(''); setAnswer('')
    setDone(false); setRewriteContent(null); setVersion(1)
  }, [])

  const prepareRewrite = useCallback((rewrittenContent: string, newVersion: number) => {
    setRewriteContent(rewrittenContent); setVersion(newVersion)
    setRounds([]); setAnswer(''); setDone(false)
  }, [])

  const start = useCallback(async (claim: ResumeClaim) => {
    if (!getLlmSettings() && !envConfigured) {
      onError('请先配置 API Key（点击顶部齿轮图标 → Base URL + Key + Model）')
      return
    }
    setLoading(true); onError('')
    try {
      const cacheKey = claim.content
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
    try {
      const llm = getLlmSettings()
      const body: any = { claim, rounds: finalRounds }; if (llm) body.llm = llm
      const res = await fetch('/api/summarize', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      const data = (await res.json()) as FinalResult | { error: string }
      let finalResult: FinalResult
      if (!res.ok || 'error' in data) {
        finalResult = { confidence: 0, risk: 'medium', canExplain: [], cannotExplain: ['总结生成失败'], suggestions: [], rewriteSuggestion: '' }
      } else { finalResult = data }
      onSessionSaved(claim.content, {
        id: claim.content,
        claimContent: rewriteContent ?? claim.content,
        rounds: finalRounds,
        claimAnalysis: cache.current.get(claim.content)!,
        finalResult,
        status: 'done',
        version,
      })
      onToast('追问已完成，可在「分析报告」查看结论。')
    } catch { onToast('总结生成失败，但会话已保存。') }
  }, [rewriteContent, version, onToast, onSessionSaved])

  const submit = useCallback(async (claim: ResumeClaim) => {
    if (!currentQuestion || loading || done) return
    if (answer.trim().length < 8) return
    setLoading(true)
    try {
      const claimAnalysis = cache.current.get(claim.content)
      if (!claimAnalysis) throw new Error('声明分析未找到，请重新开始追问')
      const llm = getLlmSettings()
      const body: any = { claim, question: currentQuestion, answer, rounds, verifyPoints: claimAnalysis.verifyPoints, trapPoints: claimAnalysis.trapPoints }
      if (llm) body.llm = llm
      const res = await fetch('/api/interview/continue', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      const data = (await res.json()) as InterviewContinueResult | { error: string }
      if (!res.ok || 'error' in data) throw new Error('error' in data ? data.error : '生成下一问失败')
      const round: InterviewRound = { question: currentQuestion, answer, evaluation: data.evaluation, nextReason: data.nextReason }
      const newRounds = [...rounds, round]; setRounds(newRounds)
      setCurrentQuestion(data.nextQuestion); setCurrentIntent(data.nextReason)
      setAnswer('')
      if (data.isFinal) {
        setDone(true)
        await finalizeSession(claim, newRounds)
      }
    } catch (e) { onError(e instanceof Error ? e.message : '追问失败') }
    finally { setLoading(false) }
  }, [currentQuestion, loading, done, answer, rounds, finalizeSession, onError])

  const covered = rounds[rounds.length - 1]?.evaluation?.coveredPoints ?? []

  return {
    rounds, currentQuestion, currentIntent, answer, setAnswer, loading, done,
    rewriteContent, version, covered,
    reset, prepareRewrite, start, submit,
  }
}
