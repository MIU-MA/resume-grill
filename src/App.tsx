'use client'

import { useEffect, useState } from 'react'
import { Check, X } from 'lucide-react'
import { AuditView } from '@/components/AuditView'
import { ClaimSidebar } from '@/components/ClaimSidebar'
import { ExtractedTextReview } from '@/components/ExtractedTextReview'
import { InsightPanel } from '@/components/InsightPanel'
import { InterviewView } from '@/components/InterviewView'
import { ResumeUploader } from '@/components/ResumeUploader'
import { SessionReport } from '@/components/SessionReport'
import { Topbar } from '@/components/Topbar'
import type { ResumeAnalysis, ResumeClaim } from '@/domain/resume-schema'
import type { InterviewSession, InterviewTurn, NextQuestion, SessionSummary } from '@/domain/interview-schema'
import { downloadFullReport } from '@/lib/report'
import { computeStats } from '@/lib/risk'
import type { LlmSettings } from '@/lib/settings'
import { getLlmSettings, hasClientLlm } from '@/lib/settings'
import type { ExtractedText } from '@/lib/pdf'
import { newRecordId, saveRecord, upsertSession } from '@/lib/storage'
import type { Mode } from '@/types'

const FIRST_INTENT = '首轮追问，验证这条声明是否经得起追问。'

type LlmMode = { label: string; cls: 'local' | 'env' | 'mock' }
type Phase = 'upload' | 'review' | 'workspace'

function App() {
  const [phase, setPhase] = useState<Phase>('upload')
  const [analysis, setAnalysis] = useState<ResumeAnalysis | null>(null)
  const [pendingExtracted, setPendingExtracted] = useState<{ extracted: ExtractedText; sourceFile: string } | null>(null)
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [mode, setMode] = useState<Mode>('audit')

  // 面试会话状态（当前选中声明的活跃追问）
  const [turns, setTurns] = useState<InterviewTurn[]>([])
  const [currentQuestion, setCurrentQuestion] = useState<{ question: string; intent: string } | null>(null)
  const [covered, setCovered] = useState<string[]>([])
  const [missing, setMissing] = useState<string[]>([])
  const [answer, setAnswer] = useState('')
  const [interviewLoading, setInterviewLoading] = useState(false)
  const [interviewDone, setInterviewDone] = useState(false)

  // 各声明的会话记录（claimId -> session），退出后保留，支撑会话报告
  const [sessions, setSessions] = useState<Record<string, InterviewSession>>({})
  const [recordId, setRecordId] = useState<string | null>(null)

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

  // 上传/粘贴/示例：先进入文本确认页，再分析
  const handleExtracted = (extracted: ExtractedText, sourceFile: string) => {
    setPendingExtracted({ extracted, sourceFile })
    setError(null)
    setPhase('review')
  }

  const handleConfirmText = async (rawText: string, sourceFile: string) => {
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
      setSessions({})
      setPhase('workspace')
      // 新建持久化记录
      const id = newRecordId(data)
      setRecordId(id)
      saveRecord({ id, analysis: data, sessions: {}, updatedAt: Date.now() }).catch(() => undefined)
      showToast(`已载入「${data.candidate}」的简历，识别到 ${data.claims.length} 条可验证声明。`)
    } catch (e) {
      setError(e instanceof Error ? e.message : '分析失败')
    } finally {
      setAnalyzing(false)
    }
  }

  const replaceResume = () => {
    setAnalysis(null)
    setPendingExtracted(null)
    setSessions({})
    setRecordId(null)
    setError(null)
    setMode('audit')
    setPhase('upload')
  }

  const selectClaim = (index: number) => {
    setSelectedIndex(index)
    setMode('audit')
    // 若该声明已有进行中的会话，恢复到该会话状态；否则重置
    const claim = analysis?.claims[index]
    const existing = claim ? sessions[claim.quote] : undefined
    if (existing && existing.status === 'in_progress') {
      setTurns(existing.turns)
      const lastQ = existing.turns[existing.turns.length - 1]?.question ?? claim?.initialQuestion ?? ''
      setCurrentQuestion({ question: lastQ, intent: '恢复上次进行中的追问。' })
      setCovered(existing.coveredPoints)
      setMissing(existing.missingPoints)
      setAnswer('')
      setInterviewDone(false)
      setInterviewHint(false)
    } else {
      resetInterview()
    }
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

  const persistSession = (claim: ResumeClaim, session: InterviewSession) => {
    setSessions((prev) => ({ ...prev, [claim.quote]: session }))
    if (recordId && analysis) {
      upsertSession(recordId, analysis, session).catch(() => undefined)
    }
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
      // 持久化进行中的会话
      persistSession(selected, {
        claimId: selected.quote,
        turns: newTurns,
        coveredPoints: data.coveredPoints,
        missingPoints: data.missingPoints,
        finalSummary: '',
        rewriteSuggestion: '',
        status: 'in_progress',
      })
      if (data.isFinal) {
        await finalizeSession(selected, newTurns, data.coveredPoints, data.missingPoints)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : '生成下一问失败')
    } finally {
      setInterviewLoading(false)
    }
  }

  // isFinal 时调用 summarize 生成结论与改写建议，落盘为 done 会话
  const finalizeSession = async (
    claim: ResumeClaim,
    finalTurns: InterviewTurn[],
    coveredPts: string[],
    missingPts: string[],
  ) => {
    setInterviewDone(true)
    try {
      const llm = getLlmSettings()
      const body: { claim: typeof claim; turns: InterviewTurn[]; covered: string[]; missing: string[]; llm?: LlmSettings } = {
        claim,
        turns: finalTurns,
        covered: coveredPts,
        missing: missingPts,
      }
      if (llm) body.llm = llm
      const res = await fetch('/api/summarize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = (await res.json()) as SessionSummary | { error: string }
      let summary: SessionSummary
      if (!res.ok || 'error' in data) {
        // 总结失败不阻断流程，给一个占位结论
        summary = { finalSummary: '总结生成失败，请稍后重试。', rewriteSuggestion: '' }
      } else {
        summary = data
      }
      const session: InterviewSession = {
        claimId: claim.quote,
        turns: finalTurns,
        coveredPoints: coveredPts,
        missingPoints: missingPts,
        finalSummary: summary.finalSummary,
        rewriteSuggestion: summary.rewriteSuggestion,
        status: 'done',
      }
      persistSession(claim, session)
      showToast('本轮追问已完成，可在「会话报告」查看结论与改写建议。')
    } catch {
      showToast('总结生成失败，但会话已保存。')
    }
  }

  const nextOrFinish = () => {
    if (interviewDone) {
      setMode('audit')
      resetInterview()
    }
  }

  // 会话报告：跳到 report 视图
  const goReport = () => {
    setMode('report')
    window.scrollTo({ top: 0, left: 0 })
  }

  const exportFull = () => {
    if (!analysis) return
    downloadFullReport(analysis, sessions)
  }

  // landing 上传页
  if (phase === 'upload' || !analysis || !selected || !stats) {
    if (phase === 'review' && pendingExtracted) {
      return (
        <ExtractedTextReview
          sourceFile={pendingExtracted.sourceFile}
          extracted={pendingExtracted.extracted}
          analyzing={analyzing}
          error={error}
          onConfirm={handleConfirmText}
          onBack={replaceResume}
        />
      )
    }
    return (
      <ResumeUploader
        analyzing={analyzing}
        error={error}
        onExtracted={handleExtracted}
        envConfigured={envConfigured}
        clientConfigured={clientConfigured}
        onClientChanged={refreshClientLlm}
      />
    )
  }

  return (
    <div className="min-h-screen bg-canvas">
      {toast && (
        <div className="fixed top-[70px] left-1/2 z-50 flex max-w-[520px] -translate-x-1/2 items-center gap-2 rounded-[5px] border border-[#b9dfcd] bg-[#f0faf5] px-[11px] py-[9px] text-[9px] text-[#24553f] shadow-[0_8px_26px_rgba(27,40,34,.13)]" role="status">
          <Check size={15} />
          <span>{toast}</span>
          <button type="button" className="ml-[6px] grid place-items-center bg-transparent p-0 text-[#658273] cursor-pointer" onClick={() => setToast('')} aria-label="关闭提示"><X size={14} /></button>
        </div>
      )}

      <Topbar
        analysis={analysis}
        analyzing={analyzing}
        llmMode={llmMode}
        onReplaceResume={replaceResume}
        onRerun={() => handleConfirmText(analysis.rawText, analysis.sourceFile)}
        onExport={exportFull}
        onReport={goReport}
      />

      {mode === 'report' ? (
        <SessionReport
          analysis={analysis}
          sessions={sessions}
          onBack={() => setMode('audit')}
          onExport={exportFull}
          onRedo={(claim) => {
            const idx = analysis.claims.findIndex((c) => c.quote === claim.quote)
            if (idx >= 0) {
              setSelectedIndex(idx)
              startInterview()
            }
          }}
          onSelect={(claim) => {
            const idx = analysis.claims.findIndex((c) => c.quote === claim.quote)
            if (idx >= 0) selectClaim(idx)
          }}
        />
      ) : (
        <div className="md2:grid-cols-[210px_minmax(0,1fr)] md3:grid-cols-[264px_minmax(520px,1fr)_300px] max-md1:block grid min-h-[calc(100vh-58px)] grid-cols-[264px_minmax(520px,1fr)_300px]">
          <ClaimSidebar analysis={analysis} selectedIndex={selectedIndex} onSelect={selectClaim} />

          {mode === 'audit' ? (
            <AuditView
              analysis={analysis}
              selected={selected}
              stats={stats}
              onStartInterview={startInterview}
              onReport={goReport}
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
      )}
    </div>
  )
}

export default App
