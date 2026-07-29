'use client'

import { useEffect, useState } from 'react'
import { Check, X } from 'lucide-react'
import { AuditView } from '@/components/AuditView'
import { ClaimSidebar } from '@/components/ClaimSidebar'
import { InsightPanel } from '@/components/InsightPanel'
import { InterviewView } from '@/components/InterviewView'
import { ResumeUploader } from '@/components/ResumeUploader'
import { Topbar } from '@/components/Topbar'
import type { ResumeAnalysis } from '@/domain/resume-schema'
import type { InterviewTurn, NextQuestion } from '@/domain/interview-schema'
import { downloadReport } from '@/lib/report'
import { computeStats } from '@/lib/risk'
import type { LlmSettings } from '@/lib/settings'
import { getLlmSettings, hasClientLlm } from '@/lib/settings'
import type { Mode } from '@/types'
import './App.css'

const FIRST_INTENT = '首轮追问，验证这条声明是否经得起追问。'

type LlmMode = { label: string; cls: 'local' | 'env' | 'mock' }

function App() {
  const [analysis, setAnalysis] = useState<ResumeAnalysis | null>(null)
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [mode, setMode] = useState<Mode>('audit')

  // 面试会话状态
  const [turns, setTurns] = useState<InterviewTurn[]>([])
  const [currentQuestion, setCurrentQuestion] = useState<{ question: string; intent: string } | null>(null)
  const [covered, setCovered] = useState<string[]>([])
  const [missing, setMissing] = useState<string[]>([])
  const [answer, setAnswer] = useState('')
  const [interviewLoading, setInterviewLoading] = useState(false)
  const [interviewDone, setInterviewDone] = useState(false)

  const [analyzing, setAnalyzing] = useState(false)
  const [interviewHint, setInterviewHint] = useState(false)
  const [toast, setToast] = useState('')
  const [error, setError] = useState<string | null>(null)

  // 当前 LLM 模式：本地 Key / 服务端 Key / 规则示例
  const [envConfigured, setEnvConfigured] = useState(false)
  const [clientConfigured, setClientConfigured] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    fetch('/api/status')
      .then((r) => r.json())
      .then((d: { envConfigured: boolean }) => setEnvConfigured(d.envConfigured))
      .catch(() => undefined)
    setClientConfigured(hasClientLlm())
    setMounted(true)
  }, [])

  const llmMode: LlmMode | null = !mounted
    ? null
    : clientConfigured
      ? { label: '本地 Key', cls: 'local' }
      : envConfigured
        ? { label: '服务端 Key', cls: 'env' }
        : { label: '规则示例', cls: 'mock' }

  const refreshClientLlm = () => setClientConfigured(hasClientLlm())

  const selected = analysis?.claims[selectedIndex] ?? null
  const stats = analysis ? computeStats(analysis.claims) : null

  const showToast = (message: string, duration = 3200) => {
    setToast(message)
    window.setTimeout(() => setToast(''), duration)
  }

  const handleAnalyze = async (rawText: string, sourceFile: string) => {
    if (!rawText.trim()) {
      setError('没有提取到简历文本，请换一份文件或直接粘贴文本。')
      return
    }
    setAnalyzing(true)
    setError(null)
    try {
      const llm = getLlmSettings()
      const body: { rawText: string; sourceFile: string; llm?: LlmSettings } = { rawText, sourceFile }
      if (llm) body.llm = llm
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = (await res.json()) as ResumeAnalysis | { error: string }
      if (!res.ok || 'error' in data) {
        throw new Error('error' in data ? data.error : '分析失败')
      }
      setAnalysis(data)
      setSelectedIndex(0)
      setMode('audit')
      showToast(`已载入「${data.candidate}」的简历，识别到 ${data.claims.length} 条可验证声明。`)
    } catch (e) {
      setError(e instanceof Error ? e.message : '分析失败')
    } finally {
      setAnalyzing(false)
    }
  }

  const replaceResume = () => {
    setAnalysis(null)
    setError(null)
    setMode('audit')
  }

  const selectClaim = (index: number) => {
    setSelectedIndex(index)
    setMode('audit')
    resetInterview()
  }

  const resetInterview = () => {
    setTurns([])
    setCurrentQuestion(null)
    setCovered([])
    setMissing([])
    setAnswer('')
    setInterviewDone(false)
    setInterviewHint(false)
  }

  const startInterview = () => {
    if (!selected) return
    resetInterview()
    setMode('interview')
    setCurrentQuestion({ question: selected.initialQuestion, intent: FIRST_INTENT })
    setMissing(selected.evaluationPoints)
    window.scrollTo({ top: 0, left: 0 })
  }

  const submitAnswer = async () => {
    if (!selected || !currentQuestion || interviewLoading || interviewDone) return
    const newTurn: InterviewTurn = { question: currentQuestion.question, answer }
    const newTurns = [...turns, newTurn]
    setTurns(newTurns)
    setAnswer('')
    setInterviewLoading(true)
    try {
      const llm = getLlmSettings()
      const body: { claim: typeof selected; turns: InterviewTurn[]; llm?: LlmSettings } = {
        claim: selected,
        turns: newTurns,
      }
      if (llm) body.llm = llm
      const res = await fetch('/api/interview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = (await res.json()) as NextQuestion | { error: string }
      if (!res.ok || 'error' in data) {
        throw new Error('error' in data ? data.error : '生成下一问失败')
      }
      setCovered(data.coveredPoints)
      setMissing(data.missingPoints)
      setCurrentQuestion({ question: data.question, intent: data.intent })
      if (data.isFinal) {
        setInterviewDone(true)
        showToast('本轮追问已完成，建议优先补齐未命中的要点。')
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : '生成下一问失败')
    } finally {
      setInterviewLoading(false)
    }
  }

  const nextOrFinish = () => {
    if (interviewDone) {
      setMode('audit')
      resetInterview()
    }
  }

  if (!analysis || !selected || !stats) {
    return (
      <ResumeUploader
        analyzing={analyzing}
        error={error}
        onAnalyze={handleAnalyze}
        envConfigured={envConfigured}
        clientConfigured={clientConfigured}
        onClientChanged={refreshClientLlm}
      />
    )
  }

  return (
    <div className="app-shell">
      {toast && (
        <div className="toast" role="status">
          <Check size={15} />
          <span>{toast}</span>
          <button type="button" onClick={() => setToast('')} aria-label="关闭提示"><X size={14} /></button>
        </div>
      )}

      <Topbar
        analysis={analysis}
        analyzing={analyzing}
        llmMode={llmMode}
        onReplaceResume={replaceResume}
        onRerun={() => handleAnalyze(analysis.rawText, analysis.sourceFile)}
        onExport={() => downloadReport(analysis)}
      />

      <div className="workspace">
        <ClaimSidebar analysis={analysis} selectedIndex={selectedIndex} onSelect={selectClaim} />

        {mode === 'audit' ? (
          <AuditView
            analysis={analysis}
            selected={selected}
            stats={stats}
            onStartInterview={startInterview}
          />
        ) : (
          <InterviewView
            selected={selected}
            turns={turns}
            currentQuestion={currentQuestion}
            covered={covered}
            missing={missing}
            answer={answer}
            loading={interviewLoading}
            done={interviewDone}
            showHint={interviewHint}
            onAnswerChange={setAnswer}
            onToggleHint={() => setInterviewHint((v) => !v)}
            onSubmit={submitAnswer}
            onFinish={nextOrFinish}
            onBackToAudit={() => {
              setMode('audit')
              resetInterview()
            }}
          />
        )}

        <InsightPanel
          mode={mode}
          selected={selected}
          currentQuestion={currentQuestion}
          covered={covered}
          missing={missing}
          turnCount={turns.length}
          onStartInterview={startInterview}
        />
      </div>
    </div>
  )
}

export default App
