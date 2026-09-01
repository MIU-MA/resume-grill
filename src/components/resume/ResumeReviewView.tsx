'use client'

import { useMemo, useState, type ReactNode } from 'react'
import {
  ArrowLeft,
  ArrowRight,
  FileText,
  Loader2,
  X,
} from 'lucide-react'
import type { ExtractedText } from '@/lib/pdf'
import { Button } from '@/components/ui/Button'
import type { AnalysisGoal } from '@/domain/analysis-config'
import { parseResumeStructure } from '@/lib/resume-structure'
import type { ResumeReviewSubmission } from '@/lib/types'
import type { ReviewCandidate } from '@/components/resume/resume-review-types'
import {
  createReviewCandidates,
  groupCandidates,
  isSkillSection,
} from '@/components/resume/resume-review-utils'
import { ResumeReviewSidebar } from '@/components/resume/ResumeReviewSidebar'
import { ResumeTextEditor } from '@/components/resume/ResumeTextEditor'
import { ResumeCandidateList } from '@/components/resume/ResumeCandidateList'
import { ResumeAnalysisOptions } from '@/components/resume/ResumeAnalysisOptions'

type ResumeReviewViewProps = {
  sourceFile: string
  extracted: ExtractedText
  analyzing: boolean
  error: string | null
  envConfigured: boolean
  clientConfigured: boolean
  onClientChanged: () => void
  onConfirm: (submission: ResumeReviewSubmission, sourceFile: string) => void
  onBack: () => void
}

export function ResumeReviewView({ sourceFile, extracted, analyzing, error, envConfigured, clientConfigured, onClientChanged, onConfirm, onBack }: ResumeReviewViewProps) {
  const [text, setText] = useState(extracted.text)
  const [structureText, setStructureText] = useState(extracted.text)
  const [sections, setSections] = useState(() => parseResumeStructure(extracted.text))
  const [candidates, setCandidates] = useState(() => createReviewCandidates(extracted.text))
  const [tab, setTab] = useState<'structure' | 'raw'>('structure')
  const [analysisGoal, setAnalysisGoal] = useState<AnalysisGoal>('overall')
  const [jobDescription, setJobDescription] = useState('')
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [goalOpen, setGoalOpen] = useState(false)
  const [jdOpen, setJdOpen] = useState(false)
  const [lastDeleted, setLastDeleted] = useState<{ candidate: ReviewCandidate; index: number } | null>(null)

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
  const experienceSections = sections.filter((section) => ['work', 'internship', 'project'].includes(section.kind)).length
  const skillClaims = candidates.filter((candidate) => isSkillSection(candidate.sourceSection)).length
  const structureChanged = text !== structureText

  const refreshStructure = () => {
    const normalized = text.trim()
    setText(normalized)
    setSections(parseResumeStructure(normalized))
    setCandidates(createReviewCandidates(normalized))
    setStructureText(normalized)
    setTab('structure')
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
    if (selectedCandidates.length === 0 || structureChanged) return
    onConfirm({
      rawText: text.trim(),
      analysisGoal,
      jobDescription: jobDescription.trim(),
      reviewedCandidates: selectedCandidates.map(({ content, sourceSection, lineNumber }) => ({
        content: content.trim(),
        sourceSection,
        lineNumber,
      })),
    }, sourceFile)
  }

  return (
    <div className="min-h-screen bg-bg px-6 py-8 max-[480px]:px-4">
      <div className="mx-auto w-full max-w-[1440px]">
        <header className="mb-6 flex items-start justify-between gap-6 max-md:flex-col">
          <div>
            <div className="mb-2 text-[12px] font-bold uppercase tracking-[0.08em] text-brand">Resume audit</div>
            <h1 className="m-0 text-[28px] font-bold tracking-[-0.035em] text-text-primary">确认简历结构与分析范围</h1>
            <p className="mt-2 text-[14px] leading-relaxed text-text-tertiary">检查章节和可练习的内容，分析时只使用你保留的部分。</p>
          </div>
          <div className="flex flex-col items-end gap-3 text-[12px] text-text-tertiary max-md:items-start">
            <div className="flex items-center gap-2 text-[11px] font-semibold">
              <span className="text-brand">1 原始文本</span>
              <span>/</span>
              <span className="text-brand">2 结构确认</span>
              <span>/</span>
              <span>3 AI 分析</span>
            </div>
            <div className="flex items-center gap-3">
              <FileText size={15} />
              <span className="max-w-[320px] truncate">{sourceFile}</span>
              <span>{extracted.pageCount} 页</span>
              <span>{text.length} 字</span>
            </div>
          </div>
        </header>

        <div className="grid grid-cols-[260px_minmax(0,1fr)] gap-5 max-lg:grid-cols-1">
          <ResumeReviewSidebar
            sections={sections}
            experienceSectionCount={experienceSections}
            skillClaimCount={skillClaims}
            candidateCount={candidates.length}
            settingsOpen={settingsOpen}
            envConfigured={envConfigured}
            clientConfigured={clientConfigured}
            onToggleSettings={() => setSettingsOpen((open) => !open)}
            onClientChanged={onClientChanged}
            onSectionClick={scrollToSection}
          />

          <main className="min-w-0 overflow-hidden rounded-lg border border-line bg-white shadow-card">
            <div className="flex h-12 items-center border-b border-line px-5" role="tablist" aria-label="简历检查视图">
              <ReviewTab active={tab === 'structure'} onClick={() => setTab('structure')}>结构与要点</ReviewTab>
              <ReviewTab active={tab === 'raw'} onClick={() => setTab('raw')}>原始文本</ReviewTab>
              <span className="ml-auto flex items-center gap-1.5 text-[12px] text-text-tertiary">
              <span className="flex-none">已保留 {selectedCandidates.length} / {candidates.length} 条</span>
              <span className="mx-1 h-4 w-px flex-none bg-line" />
              <button type="button" onClick={selectAll} className="bg-transparent text-brand hover:underline">全选</button>
              <button type="button" onClick={clearAll} className="bg-transparent text-text-tertiary hover:text-text-secondary hover:underline">清空</button>
              <button type="button" onClick={keepProjects} className="bg-transparent text-text-tertiary hover:text-text-secondary hover:underline">仅项目经历</button>
            </span>
            </div>

            {tab === 'raw' ? (
              <ResumeTextEditor
                text={text}
                structureChanged={structureChanged}
                analyzing={analyzing}
                onTextChange={setText}
                onRefreshStructure={refreshStructure}
              />
            ) : (
              <ResumeCandidateList
                groupedCandidates={groupedCandidates}
                candidates={candidates}
                sections={sections}
                editingId={editingId}
                analyzing={analyzing}
                onSetEditing={setEditingId}
                onUpdate={updateCandidate}
                onMergeWithNext={mergeWithNext}
                onDelete={deleteCandidate}
              />
            )}

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

            <footer className="sticky bottom-0 z-10 flex items-center justify-between gap-4 border-t border-line bg-surface-soft px-5 py-4 shadow-[0_-4px_12px_rgba(16,24,40,0.04)] max-md:flex-col max-md:items-stretch">
              <div className="text-[12px] text-text-tertiary">
                {structureChanged ? '原始文本已变化，需要重新识别结构' : `将使用 ${selectedCandidates.length} 个已确认要点`}
              </div>
              <div className="flex items-center justify-end gap-2">
                <Button variant="secondary" onClick={onBack} disabled={analyzing}>
                  <ArrowLeft size={14} />重新上传
                </Button>
                <Button variant="primary" size="large" disabled={analyzing || structureChanged || selectedCandidates.length === 0} onClick={submit}>
                  {analyzing ? <Loader2 size={15} className="animate-spin" /> : null}
                  {analyzing ? '分析中…' : '确认并分析'}
                  {!analyzing && <ArrowRight size={15} />}
                </Button>
              </div>
            </footer>

            {error && <p className="m-5 border-l-2 border-danger bg-danger-soft px-3 py-2 text-[12px] leading-relaxed text-danger">{error}</p>}
          </main>
        </div>
      </div>

      {lastDeleted && (
        <div className="fixed bottom-6 left-1/2 z-50 flex -translate-x-1/2 items-center gap-3 rounded-lg border border-line bg-white px-4 py-2.5 shadow-[0_8px_24px_rgba(16,24,40,0.12)]">
          <span className="max-w-[320px] truncate text-[13px] text-text-secondary">已删除「{lastDeleted.candidate.content.slice(0, 24)}」</span>
          <button type="button" onClick={undoDelete} className="bg-transparent text-[13px] font-semibold text-brand hover:underline">撤销</button>
          <button type="button" onClick={() => setLastDeleted(null)} className="grid size-6 place-items-center rounded-md bg-transparent text-text-tertiary hover:bg-surface-hover" aria-label="关闭">
            <X size={14} />
          </button>
        </div>
      )}
    </div>
  )
}

function ReviewTab({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={`h-full border-b-2 bg-transparent px-3 text-[13px] font-semibold ${active ? 'border-brand text-brand' : 'border-transparent text-text-tertiary hover:text-text-secondary'}`}
    >
      {children}
    </button>
  )
}
