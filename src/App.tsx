'use client'

import { useEffect, useState } from 'react'
import { Check, X } from 'lucide-react'
import { AuditView } from '@/components/AuditView'
import { ExtractedTextReview, type ResumeReviewSubmission } from '@/components/ExtractedTextReview'
import { InterviewView } from '@/components/InterviewView'
import { InterviewStatus } from '@/components/InterviewStatus'
import { ResumeUploader } from '@/components/ResumeUploader'
import { SessionReport } from '@/components/SessionReport'
import { Topbar } from '@/components/Topbar'
import type { ResumeAnalysis, ResumeClaim } from '@/domain/resume-schema'
import type { InterviewSession } from '@/domain/interview-schema'
import { computeStats } from '@/lib/risk'
import type { LlmSettings } from '@/lib/settings'
import { getLlmSettings } from '@/lib/settings'
import type { ExtractedText } from '@/lib/pdf'
import { downloadFullReport } from '@/lib/report'
import { deleteRecord, listRecords, loadRecord, newRecordId, resumeContentKey, saveRecord, updatePreparedClaims, upsertSession, type SavedRecord } from '@/lib/storage'
import type { Mode } from '@/types'
import { useAppNavigation } from '@/lib/use-app-navigation'
import { useLlmStatus } from '@/lib/use-llm-status'
import { useInterview } from '@/lib/use-interview'
import { reviewedCandidatesKey } from '@/domain/analysis-config'
import { extractResumeClaimCandidates } from '@/lib/resume-structure'

function App() {
  const { phase, mode, push, replace } = useAppNavigation()
  const { envConfigured, clientConfigured, mode: llmMode, refresh: refreshClientLlm } = useLlmStatus()

  const [analysis, setAnalysis] = useState<ResumeAnalysis | null>(null)
  const [pendingExtracted, setPendingExtracted] = useState<{ extracted: ExtractedText; sourceFile: string } | null>(null)
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [analyzing, setAnalyzing] = useState(false)

  const [sessions, setSessions] = useState<Record<string, InterviewSession[]>>({})
  const [preparedClaimIds, setPreparedClaimIds] = useState<string[]>([])
  const [recordId, setRecordId] = useState<string | null>(null)
  const [recovering, setRecovering] = useState(false)
  const [savedRecords, setSavedRecords] = useState<SavedRecord[]>([])
  const [loadingRecords, setLoadingRecords] = useState(true)

  const [toast, setToast] = useState('')
  const [error, setError] = useState<string | null>(null)
  const showToast = (m: string, d = 3200) => { setToast(m); window.setTimeout(() => setToast(''), d) }

  const iv = useInterview(envConfigured, {
    onError: setError,
    onToast: showToast,
    onSessionSaved: (claimId, session) => {
      setSessions(prev => {
        const list = prev[claimId] ?? []
        const idx = list.findIndex(s => s.version === session.version)
        return { ...prev, [claimId]: idx >= 0 ? list.map((s, i) => (i === idx ? session : s)) : [...list, session] }
      })
      if (recordId && analysis) upsertSession(recordId, analysis, claimId, session).catch(() => undefined)
    },
  })

  const selected = analysis?.claims[selectedIndex] ?? null
  const stats = analysis ? computeStats(analysis.claims) : null
  const activeClaim: ResumeClaim = iv.rewriteContent ? { ...selected!, content: iv.rewriteContent } : selected!
  const completedClaimCount = analysis
    ? analysis.claims.filter((claim) => (sessions[claim.id] ?? []).some((session) => session.status === 'done')).length
    : 0

  useEffect(() => {
    if (phase !== 'workspace' || analysis) return
    const sid = window.sessionStorage.getItem('resume-drill:active')
    if (!sid) return
    setRecovering(true)
    loadRecord(sid).then(record => {
      if (record) { setAnalysis(record.analysis); setRecordId(record.id); setSessions(record.sessions); setPreparedClaimIds(record.preparedClaimIds); setSelectedIndex(0) }
    }).catch(() => {}).finally(() => setRecovering(false))
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (phase !== 'upload') return
    setLoadingRecords(true)
    listRecords()
      .then(setSavedRecords)
      .catch(() => setSavedRecords([]))
      .finally(() => setLoadingRecords(false))
  }, [phase])

  const handleExtracted = (extracted: ExtractedText, sourceFile: string) => {
    setPendingExtracted({ extracted, sourceFile }); setError(null); push('review')
  }

  const handleConfirmText = async (submission: ResumeReviewSubmission, sourceFile: string) => {
    const { rawText, analysisGoal, reviewedCandidates, jobDescription } = submission
    if (!rawText.trim()) { setError('未检测到有效的简历正文，请尝试粘贴文本。'); return }
    setAnalyzing(true); setError(null)
    try {
      const records = recordId ? [] : await listRecords()
      const existing = recordId
        ? await loadRecord(recordId)
        : records.find((record) => resumeContentKey(record.analysis.rawText) === resumeContentKey(rawText))
          ?? records.find((record) => record.analysis.sourceFile === sourceFile)
      const existingCandidates = existing?.analysis.reviewedCandidates
        ?? (existing ? extractResumeClaimCandidates(existing.analysis.rawText) : [])
      const sameReview = existing
        && (existing.analysis.analysisGoal ?? 'overall') === analysisGoal
        && (existing.analysis.jobDescription ?? '') === jobDescription
        && reviewedCandidatesKey(existingCandidates) === reviewedCandidatesKey(reviewedCandidates)
      if (!recordId && existing && existing.analysis.rawText === rawText && sameReview) {
        openSavedRecord(existing)
        showToast(`已恢复「${existing.analysis.candidate}」的本地分析记录。`)
        return
      }
      const llm = getLlmSettings()
      const body: { rawText: string; sourceFile: string; analysisGoal: typeof analysisGoal; reviewedCandidates: typeof reviewedCandidates; jobDescription: string; llm?: LlmSettings } = {
        rawText,
        sourceFile,
        analysisGoal,
        reviewedCandidates,
        jobDescription,
      }
      if (llm) body.llm = llm
      const res = await fetch('/api/analyze', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      const data = (await res.json()) as ResumeAnalysis | { error: string }
      if (!res.ok || 'error' in data) throw new Error('error' in data ? data.error : '分析失败')
      const retainedSessions = existing
        ? Object.fromEntries(data.claims.flatMap((claim) => existing.sessions[claim.id] ? [[claim.id, existing.sessions[claim.id]]] : []))
        : {}
      const retainedPrepared = existing
        ? existing.preparedClaimIds.filter((claimId) => data.claims.some((claim) => claim.id === claimId))
        : []
      setAnalysis(data); setSelectedIndex(0); setSessions(retainedSessions); setPreparedClaimIds(retainedPrepared); push('workspace', 'audit')
      const id = recordId ?? existing?.id ?? newRecordId(data); setRecordId(id)
      window.sessionStorage.setItem('resume-drill:active', id)
      saveRecord({ id, analysis: data, sessions: retainedSessions, preparedClaimIds: retainedPrepared, updatedAt: Date.now() }).catch(() => undefined)
      showToast(`已载入「${data.candidate}」的简历，识别到 ${data.claims.length} 条声明。`)
    } catch (e) { setError(e instanceof Error ? e.message : '分析失败') }
    finally { setAnalyzing(false) }
  }

  const replaceResume = () => {
    setAnalysis(null); setPendingExtracted(null); setSessions({}); setPreparedClaimIds([]); setRecordId(null)
    setError(null); iv.reset()
    window.sessionStorage.removeItem('resume-drill:active')
    push('upload')
  }

  const openSavedRecord = (record: SavedRecord) => {
    setAnalysis(record.analysis); setSessions(record.sessions); setPreparedClaimIds(record.preparedClaimIds); setRecordId(record.id)
    setSelectedIndex(0); setPendingExtracted(null); setError(null); iv.reset()
    window.sessionStorage.setItem('resume-drill:active', record.id)
    push('workspace', 'audit')
  }

  const removeSavedRecord = async (id: string) => {
    await deleteRecord(id)
    setSavedRecords((records) => records.filter((record) => record.id !== id))
    if (window.sessionStorage.getItem('resume-drill:active') === id) {
      window.sessionStorage.removeItem('resume-drill:active')
    }
  }

  const togglePrepared = (claimId: string) => {
    setPreparedClaimIds((current) => {
      const next = current.includes(claimId)
        ? current.filter((id) => id !== claimId)
        : [...current, claimId]
      if (recordId && analysis) updatePreparedClaims(recordId, analysis, next).catch(() => undefined)
      return next
    })
  }

  const selectClaim = (index: number) => { setSelectedIndex(index); replace('workspace', 'audit'); iv.reset() }

  const startInterview = async () => {
    if (!selected) return
    iv.reset()
    replace('workspace', 'interview')
    await iv.start(selected)
  }

  const startRewriteInterview = (claim: ResumeClaim, rewrittenContent: string) => {
    const idx = analysis?.claims.findIndex(c => c.id === claim.id) ?? -1
    if (idx < 0) return
    setSelectedIndex(idx)
    const prevCount = (sessions[claim.id] ?? []).length
    iv.prepareRewrite(rewrittenContent, prevCount + 1)
    replace('workspace', 'interview')
    iv.start(claim).catch(() => undefined)
    window.scrollTo({ top: 0, left: 0 })
  }

  const goReport = () => { replace('workspace', 'report'); window.scrollTo({ top: 0, left: 0 }) }
  const exportFull = () => { if (!analysis) return; downloadFullReport(analysis, sessions) }


  if (recovering) return <div className="min-h-screen bg-bg" />

  if (phase === 'upload' || !analysis || !selected || !stats) {
    if (phase === 'review' && pendingExtracted) {
      return <ExtractedTextReview sourceFile={pendingExtracted.sourceFile} extracted={pendingExtracted.extracted} analyzing={analyzing} error={error} onConfirm={handleConfirmText} onBack={replaceResume} />
    }
    return <ResumeUploader analyzing={analyzing} error={error} onExtracted={handleExtracted} envConfigured={envConfigured} clientConfigured={clientConfigured} onClientChanged={refreshClientLlm} savedRecords={savedRecords} loadingRecords={loadingRecords} onOpenSaved={openSavedRecord} onDeleteSaved={removeSavedRecord} />
  }

  return (
    <div className="min-h-screen bg-bg">
      {toast && (
        <div className="fixed top-[72px] left-1/2 z-50 flex max-w-[520px] -translate-x-1/2 items-center gap-2 rounded-lg border border-border-strong bg-white px-4 py-2.5 text-[14px] text-text-primary shadow-[0_1px_3px_rgba(16,24,40,0.04)]" role="status">
          <Check size={15} className="text-success" /><span>{toast}</span>
          <button type="button" className="ml-2 text-text-tertiary hover:text-text-primary bg-transparent" onClick={() => setToast('')} aria-label="关闭"><X size={14} /></button>
        </div>
      )}
      <Topbar
        analysis={analysis} llmMode={llmMode} envConfigured={envConfigured} clientConfigured={clientConfigured}
        onClientChanged={refreshClientLlm} onRerun={() => handleConfirmText({
          rawText: analysis.rawText,
          analysisGoal: analysis.analysisGoal ?? 'overall',
          reviewedCandidates: analysis.reviewedCandidates ?? extractResumeClaimCandidates(analysis.rawText),
          jobDescription: analysis.jobDescription ?? '',
        }, analysis.sourceFile)}
        onExport={exportFull} onLogoClick={replaceResume}
      />

      <div className="w-[min(1440px,calc(100%-48px))] mx-auto mt-6 mb-10">
        <section className="flex items-end justify-between gap-6 mb-5">
          <div>
            <div className="text-brand text-[12px] font-bold uppercase tracking-[0.08em] mb-2">Resume audit</div>
            <h1 className="m-0 text-[28px] font-bold tracking-[-0.035em]">找出简历里最容易被问穿的那句话</h1>
            <p className="mt-2 text-text-tertiary text-[14px] leading-relaxed">不是随机生成八股，而是逐条验证经历中的证据、边界和真实贡献。</p>
          </div>
          <div className="inline-flex bg-[#eceff3] rounded-[10px] p-1 gap-0.5 flex-none" role="tablist">
            {(['audit', 'interview', 'report'] as Mode[]).map(v => (
              <button key={v} type="button" onClick={() => { replace('workspace', v); if (v === 'audit') iv.reset() }}
                className={`h-[34px] px-4 rounded-[7px] text-[13px] font-semibold transition-colors ${mode === v ? 'bg-white text-text-primary shadow-[0_1px_3px_rgba(16,24,40,0.04)]' : 'bg-transparent text-text-tertiary hover:text-text-secondary'}`}>
                {v === 'audit' ? '声明审计' : v === 'interview' ? '压力测试' : '分析报告'}
              </button>
            ))}
          </div>
        </section>

        <section className="grid grid-cols-4 gap-3 mb-[18px] max-[1050px]:grid-cols-2 max-[480px]:grid-cols-1">
          {([
            ['高风险声明', stats.highCount, 'text-danger', '建议优先准备证据'],
            ['证据缺口', stats.totalGaps, 'text-warning', '集中在量化口径和贡献'],
            ['可追问声明', stats.claimCount, '', '覆盖项目、技能和成果'],
            ['已完成测试', `${completedClaimCount} / ${stats.claimCount}`, 'text-success', `已验证 ${iv.covered.length} 个考察点`],
          ] as const).map(([label, value, color, hint]) => (
            <div key={label} className="bg-white border border-border rounded-xl p-4 shadow-[0_1px_3px_rgba(16,24,40,0.04)]">
              <div className="text-text-tertiary text-[12px] mb-2">{label}</div>
              <div className={`text-[22px] font-[750] tracking-[-0.025em] ${color}`}>{value}</div>
              <div className="text-text-tertiary text-[12px] mt-1.5">{hint}</div>
            </div>
          ))}
        </section>

        {mode === 'report' ? (
          <SessionReport analysis={analysis} sessions={sessions} onRewrite={startRewriteInterview} />
        ) : mode === 'audit' ? (
          <AuditView analysis={analysis} selectedIndex={selectedIndex} preparedClaimIds={preparedClaimIds} error={error} onSelect={selectClaim} onTogglePrepared={togglePrepared} onStartInterview={startInterview} onReport={goReport} />
        ) : (
          <div className="flex">
            <InterviewView
              selected={activeClaim}
              turns={iv.rounds.map(r => ({ question: r.question, answer: r.answer, answerSuggestion: r.evaluation.answerSuggestion }))}
              currentQuestion={iv.currentQuestion || null} currentIntent={iv.currentIntent || null}
              covered={iv.covered} answer={iv.answer} loading={iv.loading} done={iv.done}
              version={iv.version} error={error}
              onAnswerChange={iv.setAnswer} onSubmit={() => iv.submit(selected!)}
              onFinish={() => { if (iv.done) { replace('workspace', 'report'); iv.reset() } }}
              onBackToAudit={() => { replace('workspace', 'audit'); iv.reset() }}
            />
            <InterviewStatus selected={activeClaim} roundCount={iv.rounds.length} covered={iv.covered} />
          </div>
        )}
      </div>
    </div>
  )
}

export default App
