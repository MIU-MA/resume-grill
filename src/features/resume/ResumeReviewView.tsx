'use client'

import { useMemo, useState, type ReactNode } from 'react'
import {
  ArrowLeft,
  ArrowRight,
  FileText,
  Menu,
  Settings,
  Loader2,
  X,
} from 'lucide-react'
import type { ExtractedText } from '@/lib/pdf'
import { Button } from '@/components/ui/Button'
import { WorkbenchFrame } from '@/components/layout/WorkbenchFrame'
import type { AnalysisGoal } from '@/domain/analysis-config'
import { parseResumeStructure } from '@/lib/resume-structure'
import type { ResumeReviewSubmission } from '@/application/types'
import type { ReviewCandidate } from '@/features/resume/resume-review-types'
import {
  createReviewCandidates,
  groupCandidates,
} from '@/features/resume/resume-review-utils'
import { ResumeReviewSidebar } from '@/features/resume/ResumeReviewSidebar'
import { ResumeTextEditor } from '@/features/resume/ResumeTextEditor'
import { ResumeCandidateList } from '@/features/resume/ResumeCandidateList'
import { ResumeAnalysisOptions } from '@/features/resume/ResumeAnalysisOptions'
import { ResumeDiagnosisStep } from '@/features/resume/ResumeDiagnosisStep'
import { SettingsDialog } from '@/features/settings/SettingsDialog'
import { useResumeDiagnosis } from '@/hooks/use-resume-diagnosis'

type ResumeReviewViewProps = {
  sourceFile: string
  demo: boolean
  extracted: ExtractedText
  analyzing: boolean
  error: string | null
  envConfigured: boolean
  clientConfigured: boolean
  onClientChanged: () => void
  onConfirm: (submission: ResumeReviewSubmission, sourceFile: string) => void
  onBack: () => void
}

export function ResumeReviewView({ sourceFile, demo, extracted, analyzing, error, envConfigured, clientConfigured, onClientChanged, onConfirm, onBack }: ResumeReviewViewProps) {
  const [text, setText] = useState(extracted.text)
  const [sections, setSections] = useState(() => parseResumeStructure(extracted.text))
  const [candidates, setCandidates] = useState(() => createReviewCandidates(extracted.text))
  const [tab, setTab] = useState<'diagnosis' | 'structure' | 'raw'>('diagnosis')
  const [analysisGoal, setAnalysisGoal] = useState<AnalysisGoal>('overall')
  const [jobDescription, setJobDescription] = useState('')
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [goalOpen, setGoalOpen] = useState(false)
  const [jdOpen, setJdOpen] = useState(false)
  const [lastDeleted, setLastDeleted] = useState<{ candidate: ReviewCandidate; index: number } | null>(null)
  const diagnosis = useResumeDiagnosis(text, jobDescription, envConfigured || clientConfigured, demo)

  const selectedCandidates = candidates.filter((candidate) => candidate.enabled && candidate.content.trim().length >= 2)
  const groupedCandidates = useMemo(() => groupCandidates(candidates), [candidates])
  const projectSectionTitles = useMemo(
    () =>
      new Set(
        sections
          .filter((section) => ['work', 'internship', 'project'].includes(section.kind))
          .map((section) => section.title),
      ),
    [sections],
  )
  const updateText = (value: string) => {
    setText(value)
    setSections(parseResumeStructure(value))
    setCandidates(createReviewCandidates(value))
    setEditingId(null)
    setLastDeleted(null)
  }

  const updateCandidate = (id: string, changes: Partial<ReviewCandidate>) => {
    setCandidates((current) => current.map((candidate) => candidate.id === id ? { ...candidate, ...changes } : candidate))
  }

  const deleteCandidate = (id: string) => {
    setCandidates((current) => {
      const index = current.findIndex((candidate) => candidate.id === id)
      const candidate = current[index]
      if (!candidate) return current
      setLastDeleted({ candidate, index })
      return current.filter((item) => item.id !== id)
    })
  }

  const undoDelete = () => {
    if (!lastDeleted) return
    setCandidates((current) => {
      const next = [...current]
      next.splice(Math.min(lastDeleted.index, next.length), 0, lastDeleted.candidate)
      return next
    })
    setLastDeleted(null)
  }

  const selectAll = () =>
    setCandidates((current) => current.map((candidate) => ({ ...candidate, enabled: true })))
  const clearAll = () =>
    setCandidates((current) => current.map((candidate) => ({ ...candidate, enabled: false })))
  const keepProjects = () =>
    setCandidates((candidateList) =>
      candidateList.map((candidate) => ({
        ...candidate,
        enabled: projectSectionTitles.has(candidate.sourceSection),
      })),
    )

  const scrollToSection = (index: number) => {
    setSidebarOpen(false)
    if (tab !== 'structure') setTab('structure')
    // 切到结构视图后等待渲染再滚动
    setTimeout(() => {
      document.getElementById(`resume-section-${index}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }, tab === 'structure' ? 0 : 30)
  }

  const mergeWithNext = (id: string) => {
    setCandidates((current) => {
      const index = current.findIndex((candidate) => candidate.id === id)
      const candidate = current[index]
      const next = current[index + 1]
      if (!candidate || !next || candidate.sourceSection !== next.sourceSection) return current
      const merged = {
        ...candidate,
        content: `${candidate.content.replace(/[；;。]\s*$/, '')}；${next.content}`,
        enabled: candidate.enabled || next.enabled,
      }
      return [...current.slice(0, index), merged, ...current.slice(index + 2)]
    })
  }

  const submit = () => {
    if (analyzing || selectedCandidates.length === 0) return
    if (!demo && !envConfigured && !clientConfigured) {
      setSettingsOpen(true)
      return
    }
    diagnosis.cancel()
    onConfirm({
      rawText: text.trim(),
      analysisGoal,
      jobDescription: jobDescription.trim(),
      diagnosis: diagnosis.report ?? undefined,
      reviewedCandidates: selectedCandidates.map(({ content, sourceSection, lineNumber }) => ({
        content: content.trim(),
        sourceSection,
        lineNumber,
      })),
    }, sourceFile)
  }

  return (
    <WorkbenchFrame className="flex flex-col">
      <header className="flex h-14 flex-none items-center gap-4 border-b border-line px-4 sm:px-6">
        <strong className="flex-none text-[14px] font-semibold">Resume Grill</strong>
        <span className="h-4 w-px flex-none bg-line" />
        <span className="flex min-w-0 flex-1 items-center gap-2 text-[12px] text-text-secondary"><FileText size={14} className="flex-none max-sm:hidden" /><span className="truncate">{sourceFile}</span></span>
        <span className="flex-none text-[12px] text-text-tertiary max-md:hidden">{text.length} 字 · {extracted.pageCount} 页</span>
        <div className="flex flex-none items-center gap-1">
          <Button aria-label="模型设置" className="h-8 px-2.5 text-[12px]" variant="ghost" disabled={analyzing} onClick={() => setSettingsOpen(true)}><Settings size={15} /><span className="max-sm:hidden">模型设置</span></Button>
          <Button aria-label="更换简历" className="h-8 px-2.5 text-[12px]" variant="ghost" onClick={onBack} disabled={analyzing}><ArrowLeft size={15} /><span className="max-sm:hidden">更换简历</span></Button>
        </div>
      </header>

      <div className="flex h-12 flex-none items-stretch gap-2 border-b border-line px-4 sm:px-6" role="tablist" aria-label="简历检查视图">
        <ReviewTab active={tab === 'diagnosis'} onClick={() => setTab('diagnosis')}>简历检查</ReviewTab>
        <ReviewTab active={tab === 'structure'} onClick={() => setTab('structure')}>调整练习内容</ReviewTab>
        <ReviewTab active={tab === 'raw'} onClick={() => setTab('raw')}>原始文本</ReviewTab>
      </div>

      <div className="relative flex min-h-0 flex-1">
        {tab === 'structure' && <>
          {sidebarOpen && <button type="button" className="absolute inset-0 z-30 bg-black/15 min-[900px]:hidden" aria-label="关闭目录" onClick={() => setSidebarOpen(false)} />}
          <div className={['min-h-0 flex-none flex-col border-r border-line bg-surface-soft min-[900px]:flex min-[900px]:w-52', sidebarOpen ? 'absolute inset-y-0 left-0 z-40 flex w-[260px] min-[900px]:static' : 'hidden'].join(' ')}>
            <div className="flex h-12 flex-none items-center justify-between border-b border-line px-5 text-[13px] min-[900px]:hidden">
              文档目录<button type="button" aria-label="收起目录" onClick={() => setSidebarOpen(false)}><X size={16} /></button>
            </div>
            <ResumeReviewSidebar sections={sections} sectionTitles={groupedCandidates.map(([title]) => title)} onSectionClick={scrollToSection} />
          </div>
        </>}

        <main className="flex min-h-0 min-w-0 flex-1 flex-col">
          {tab === 'diagnosis' ? (
            <ResumeDiagnosisStep diagnosis={diagnosis} configured={envConfigured || clientConfigured} demo={demo} analyzing={analyzing} jobDescription={jobDescription} onJobDescriptionChange={setJobDescription} onConfigure={() => setSettingsOpen(true)} />
          ) : tab === 'raw' ? (
            <ResumeTextEditor text={text} analyzing={analyzing} onTextChange={updateText} />
          ) : <>
            <div className="flex min-h-16 flex-none flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-3 sm:px-6">
              <div className="flex items-center gap-3">
                <button type="button" className="grid size-8 place-items-center text-text-secondary hover:bg-surface-hover min-[900px]:hidden" aria-label="打开文档目录" onClick={() => setSidebarOpen(true)}><Menu size={16} /></button>
                <strong className="text-[14px] font-semibold">调整练习内容</strong>
                <span className="text-[12px] text-text-tertiary">{selectedCandidates.length} / {candidates.length} 条</span>
              </div>
              <div className="flex items-center gap-1">
                <Button variant="ghost" className="h-8 px-2.5 text-[12px]" disabled={analyzing} onClick={selectAll}>全选</Button>
                <Button variant="ghost" className="h-8 px-2.5 text-[12px]" disabled={analyzing} onClick={clearAll}>清空</Button>
                <Button variant="ghost" className="h-8 px-2.5 text-[12px]" disabled={analyzing} onClick={keepProjects}>仅项目</Button>
              </div>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
              <div className="mx-auto max-w-[1040px]">
                <ResumeCandidateList groupedCandidates={groupedCandidates} candidates={candidates} sections={sections} editingId={editingId} analyzing={analyzing} onSetEditing={setEditingId} onUpdate={updateCandidate} onMergeWithNext={mergeWithNext} onDelete={deleteCandidate} />
                <ResumeAnalysisOptions
                  analysisGoal={analysisGoal}
                  goalOpen={goalOpen}
                  jobDescription={jobDescription}
                  jobDescriptionOpen={jdOpen}
                  analyzing={analyzing}
                  onToggleGoal={() => setGoalOpen((open) => !open)}
                  onGoalChange={setAnalysisGoal}
                  onToggleJobDescription={() => setJdOpen((open) => !open)}
                  onJobDescriptionChange={setJobDescription}
                />
              </div>
            </div>
          </>}
        </main>
      </div>

      {error && <p role="alert" className="m-0 flex-none border-t border-line px-6 py-2 text-[12px] text-danger">{error}</p>}
      <footer className="flex min-h-14 flex-none flex-wrap items-center justify-between gap-2 border-t border-line bg-surface-soft px-4 py-2.5 sm:px-6">
        <span className="text-[12px] text-text-tertiary" role="status">
          {selectedCandidates.length > 0 ? `已选 ${selectedCandidates.length} 条经历与技能，可直接进入练习` : '未选择练习内容，请在调整页选择或补充原文'}
        </span>
        <div className="flex items-center gap-2">
          {tab !== 'structure' && <Button variant="ghost" className="h-9 px-3 text-[12px]" disabled={analyzing} onClick={() => setTab('structure')}>调整内容</Button>}
          <Button variant="primary" className="h-9 whitespace-nowrap px-4 text-[13px]" disabled={analyzing || selectedCandidates.length === 0} onClick={submit}>
            {analyzing ? <Loader2 size={14} className="animate-spin" /> : null}
            {analyzing ? '正在准备练习' : diagnosis.loading ? '跳过检查，进入练习' : '进入面试练习'}{!analyzing && <ArrowRight size={14} />}
          </Button>
        </div>
      </footer>

      <SettingsDialog open={settingsOpen} onClose={() => setSettingsOpen(false)} envConfigured={envConfigured} clientConfigured={clientConfigured} onClientChanged={onClientChanged} />
      {lastDeleted && <div className="fixed bottom-16 left-1/2 z-50 flex max-w-[calc(100%-32px)] -translate-x-1/2 items-center gap-3 border border-line-strong bg-white px-4 py-2.5">
        <span className="truncate text-[12px] text-text-secondary">已删除：{lastDeleted.candidate.content.slice(0, 24)}</span>
        <button type="button" onClick={undoDelete} className="text-[12px] text-brand">撤销</button>
        <button type="button" onClick={() => setLastDeleted(null)} aria-label="关闭"><X size={14} /></button>
      </div>}
    </WorkbenchFrame>
  )
}

function ReviewTab({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" role="tab" aria-selected={active} onClick={onClick} className={['border-b-2 px-3 text-[13px] font-medium', active ? 'border-brand text-text-primary' : 'border-transparent text-text-tertiary hover:text-text-secondary'].join(' ')}>
      {children}
    </button>
  )
}
