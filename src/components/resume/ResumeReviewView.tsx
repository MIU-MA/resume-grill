'use client'

import { useMemo, useState, type ReactNode } from 'react'
import {
  ArrowLeft,
  ArrowRight,
  BarChart3,
  BriefcaseBusiness,
  Check,
  ChevronDown,
  Combine,
  FileText,
  Layers3,
  ListChecks,
  Loader2,
  RefreshCw,
  Settings,
  Target,
  Trash2,
  Users,
  Wrench,
  type LucideIcon,
} from 'lucide-react'
import type { ExtractedText } from '@/lib/pdf'
import { Button } from '@/components/ui/Button'
import { ModelSettings } from '@/components/settings/ModelSettings'
import {
  ANALYSIS_GOALS,
  type AnalysisGoal,
  type ReviewedCandidate,
} from '@/domain/analysis-config'
import {
  extractResumeClaimCandidates,
  parseResumeStructure,
  type ResumeSectionKind,
} from '@/lib/resume-structure'

export type ResumeReviewSubmission = {
  rawText: string
  analysisGoal: AnalysisGoal
  reviewedCandidates: ReviewedCandidate[]
  jobDescription: string
}

type ReviewCandidate = ReviewedCandidate & {
  id: string
  enabled: boolean
}

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

const SECTION_LABELS: Record<ResumeSectionKind, string> = {
  general: '个人概况',
  profile: '个人总结',
  education: '教育经历',
  work: '工作经历',
  internship: '实习经历',
  project: '项目经历',
  skills: '技能能力',
  awards: '奖项证书',
  selfReview: '自我评价',
  custom: '其他章节',
}

const GOAL_ICONS: Record<AnalysisGoal, LucideIcon> = {
  overall: ListChecks,
  project: BriefcaseBusiness,
  skills: Wrench,
  achievement: BarChart3,
  leadership: Users,
}

export function ResumeReviewView({ sourceFile, extracted, analyzing, error, envConfigured, clientConfigured, onClientChanged, onConfirm, onBack }: ResumeReviewViewProps) {
  const [text, setText] = useState(extracted.text)
  const [structureText, setStructureText] = useState(extracted.text)
  const [sections, setSections] = useState(() => parseResumeStructure(extracted.text))
  const [candidates, setCandidates] = useState(() => createReviewCandidates(extracted.text))
  const [tab, setTab] = useState<'structure' | 'raw'>('structure')
  const [analysisGoal, setAnalysisGoal] = useState<AnalysisGoal>('overall')
  const [jobDescription, setJobDescription] = useState('')
  const [settingsOpen, setSettingsOpen] = useState(true)

  const selectedCandidates = candidates.filter((candidate) => candidate.enabled && candidate.content.trim().length >= 2)
  const groupedCandidates = useMemo(() => groupCandidates(candidates), [candidates])
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
    setCandidates((current) => current.filter((candidate) => candidate.id !== id))
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
            <p className="mt-2 text-[14px] leading-relaxed text-text-tertiary">检查章节和候选声明，最终分析只使用你保留的内容。</p>
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
          <aside className="self-start rounded-xl border border-border bg-white px-5 py-5 shadow-[0_1px_3px_rgba(16,24,40,0.04)] lg:sticky lg:top-5">
            <div className="mb-4 flex items-center gap-2">
              <Layers3 size={16} className="text-brand" />
              <h2 className="m-0 text-[14px] font-bold">解析概况</h2>
            </div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-4 border-b border-line pb-5">
              <DiagnosticStat label="章节" value={sections.length} />
              <DiagnosticStat label="经历章节" value={experienceSections} />
              <DiagnosticStat label="技能声明" value={skillClaims} />
              <DiagnosticStat label="候选声明" value={candidates.length} />
            </div>

            <div className="pt-4">
              <div className="mb-2 text-[11px] font-semibold text-text-tertiary">识别到的章节</div>
              <div className="space-y-1">
                {sections.map((section, index) => (
                  <div key={`${section.title}-${index}`} className="flex items-center justify-between gap-3 py-1.5 text-[12px]">
                    <span className="min-w-0 truncate text-text-secondary">{section.title || SECTION_LABELS[section.kind]}</span>
                    <span className="flex-none text-[11px] text-text-tertiary">{section.lines.length} 行</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-5 border-t border-line pt-4">
              <button type="button" onClick={() => setSettingsOpen((v) => !v)} className="flex w-full items-center justify-between gap-2 text-left" aria-expanded={settingsOpen}>
                <span className="flex min-w-0 flex-wrap items-center gap-1.5">
                  <Settings size={14} className="flex-none text-text-tertiary" />
                  <span className="text-[13px] font-bold">模型配置</span>
                </span>
                <ChevronDown size={14} className={`flex-none text-text-tertiary transition-transform ${settingsOpen ? 'rotate-180' : ''}`} />
              </button>
              {!envConfigured && !clientConfigured && (
                <p className="m-0 mt-1.5 text-[11px] font-semibold text-warning">未配置 · 真实简历分析需先配置</p>
              )}
              {settingsOpen && (
                <div className="mt-3">
                  <ModelSettings envConfigured={envConfigured} clientConfigured={clientConfigured} onClientChanged={onClientChanged} />
                </div>
              )}
            </div>
          </aside>

          <main className="min-w-0 overflow-hidden rounded-xl border border-border bg-white shadow-[0_1px_3px_rgba(16,24,40,0.04)]">
            <div className="flex h-12 items-center border-b border-line px-5" role="tablist" aria-label="简历检查视图">
              <ReviewTab active={tab === 'structure'} onClick={() => setTab('structure')}>结构与声明</ReviewTab>
              <ReviewTab active={tab === 'raw'} onClick={() => setTab('raw')}>原始文本</ReviewTab>
              <span className="ml-auto text-[12px] text-text-tertiary">已保留 {selectedCandidates.length} / {candidates.length} 条</span>
            </div>

            {tab === 'raw' ? (
              <section className="p-5">
                <div className="mb-3 flex items-center justify-between gap-4">
                  <div>
                    <h2 className="m-0 text-[14px] font-bold">PDF 提取文本</h2>
                    <p className="mt-1 text-[12px] text-text-tertiary">修正文字或顺序后，重新识别章节和候选声明。</p>
                  </div>
                  <Button variant="secondary" onClick={refreshStructure} disabled={!structureChanged || analyzing}>
                    <RefreshCw size={14} />重新识别结构
                  </Button>
                </div>
                <textarea
                  className="min-h-[520px] w-full resize-y rounded-xl border border-border-strong bg-white p-4 text-[13px] leading-[1.75] text-text-primary focus:border-brand focus:shadow-[0_0_0_3px_rgba(37,99,235,0.1)]"
                  value={text}
                  onChange={(event) => setText(event.target.value)}
                  disabled={analyzing}
                  placeholder="简历文本…"
                />
                {structureChanged && <p className="mt-2 text-[12px] text-warning">文本已修改，请重新识别结构后再分析。</p>}
              </section>
            ) : (
              <section>
                {groupedCandidates.length === 0 ? (
                  <div className="px-6 py-16 text-center">
                    <Target size={24} className="mx-auto mb-3 text-text-tertiary" />
                    <p className="m-0 text-[14px] font-semibold">没有识别到候选声明</p>
                    <p className="mt-2 text-[12px] text-text-tertiary">切换到原始文本检查章节标题和列表内容。</p>
                  </div>
                ) : groupedCandidates.map(([section, items]) => (
                  <div key={section} className="border-b border-line last:border-b-0">
                    <div className="flex items-center justify-between bg-surface-soft px-5 py-2.5">
                      <h2 className="m-0 text-[12px] font-bold text-text-secondary">{section}</h2>
                      <span className="text-[11px] text-text-tertiary">{items.length} 条</span>
                    </div>
                    {items.map((candidate) => {
                      const index = candidates.findIndex((item) => item.id === candidate.id)
                      const canMerge = candidates[index + 1]?.sourceSection === candidate.sourceSection
                      return (
                        <div key={candidate.id} className={`flex items-start gap-3 border-t border-line px-5 py-4 first:border-t-0 ${candidate.enabled ? '' : 'bg-surface-soft opacity-65'}`}>
                          <label className="mt-2 grid size-5 flex-none place-items-center">
                            <input
                              type="checkbox"
                              checked={candidate.enabled}
                              onChange={(event) => updateCandidate(candidate.id, { enabled: event.target.checked })}
                              className="size-4 accent-brand"
                              aria-label={`保留声明：${candidate.content}`}
                            />
                          </label>
                          <textarea
                            value={candidate.content}
                            onChange={(event) => updateCandidate(candidate.id, { content: event.target.value })}
                            disabled={analyzing}
                            rows={Math.max(2, Math.ceil(candidate.content.length / 48))}
                            className="min-h-[58px] min-w-0 flex-1 resize-y rounded-lg border border-border bg-white px-3 py-2 text-[13px] leading-relaxed text-text-primary focus:border-brand focus:shadow-[0_0_0_3px_rgba(37,99,235,0.1)]"
                            aria-label={`${section}声明内容`}
                          />
                          <div className="flex flex-none items-center gap-1 pt-1">
                            <button
                              type="button"
                              disabled={!canMerge || analyzing}
                              onClick={() => mergeWithNext(candidate.id)}
                              className="grid size-8 place-items-center rounded-lg bg-transparent text-text-tertiary hover:bg-brand-soft hover:text-brand disabled:cursor-not-allowed disabled:opacity-30"
                              title="与下一条合并"
                              aria-label="与下一条声明合并"
                            >
                              <Combine size={15} />
                            </button>
                            <button
                              type="button"
                              disabled={analyzing}
                              onClick={() => deleteCandidate(candidate.id)}
                              className="grid size-8 place-items-center rounded-lg bg-transparent text-text-tertiary hover:bg-danger-soft hover:text-danger"
                              title="删除声明"
                              aria-label="删除声明"
                            >
                              <Trash2 size={15} />
                            </button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                ))}
              </section>
            )}

            <section className="border-t border-line px-5 py-5">
              <div className="mb-3">
                <h2 className="m-0 text-[14px] font-bold">本次分析目标</h2>
                <p className="mt-1 text-[12px] text-text-tertiary">决定模型优先选择和追问哪类声明。</p>
              </div>
              <div className="grid grid-cols-5 gap-2 max-xl:grid-cols-3 max-md:grid-cols-1" role="radiogroup" aria-label="分析目标">
                {ANALYSIS_GOALS.map((goal) => {
                  const Icon = GOAL_ICONS[goal.value]
                  const active = analysisGoal === goal.value
                  return (
                    <label key={goal.value} className={`min-w-0 cursor-pointer rounded-lg border px-3 py-3 transition-colors ${active ? 'border-brand bg-brand-soft' : 'border-border bg-white hover:border-border-strong'}`}>
                      <input type="radio" name="analysis-goal" value={goal.value} checked={active} onChange={() => setAnalysisGoal(goal.value)} className="sr-only" />
                      <span className="flex items-center gap-2 text-[12px] font-bold text-text-primary">
                        <Icon size={14} className={active ? 'text-brand' : 'text-text-tertiary'} />{goal.label}
                        {active && <Check size={13} className="ml-auto text-brand" />}
                      </span>
                      <span className="mt-1.5 block text-[11px] leading-relaxed text-text-tertiary">{goal.description}</span>
                    </label>
                  )
                })}
              </div>
            </section>

            <section className="border-t border-line px-5 py-5">
              <div className="mb-3 flex items-start justify-between gap-4">
                <div>
                  <h2 className="m-0 text-[14px] font-bold">目标岗位描述 <span className="font-normal text-text-tertiary">可选</span></h2>
                  <p className="mt-1 text-[12px] text-text-tertiary">填写后会增加岗位匹配、简历缺口和针对性追问。</p>
                </div>
                {jobDescription.trim() && <span className="text-[11px] font-semibold text-brand">已加入匹配</span>}
              </div>
              <textarea
                className="min-h-[120px] w-full resize-y rounded-xl border border-border-strong bg-white p-4 text-[13px] leading-[1.75] text-text-primary placeholder:text-text-tertiary focus:border-brand focus:shadow-[0_0_0_3px_rgba(37,99,235,0.1)]"
                value={jobDescription}
                onChange={(event) => setJobDescription(event.target.value)}
                disabled={analyzing}
                placeholder="粘贴目标岗位的职责和任职要求…"
              />
            </section>

            <footer className="flex items-center justify-between gap-4 border-t border-line bg-surface-soft px-5 py-4 max-md:flex-col max-md:items-stretch">
              <div className="text-[12px] text-text-tertiary">
                {structureChanged ? '原始文本已变化，需重新识别结构' : `将提交 ${selectedCandidates.length} 条已确认声明`}
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
    </div>
  )
}

function createReviewCandidates(text: string): ReviewCandidate[] {
  return extractResumeClaimCandidates(text).map((candidate, index) => ({
    ...candidate,
    id: `candidate-${candidate.lineNumber}-${index}`,
    enabled: true,
  }))
}

function groupCandidates(candidates: ReviewCandidate[]): Array<[string, ReviewCandidate[]]> {
  const groups = new Map<string, ReviewCandidate[]>()
  candidates.forEach((candidate) => {
    const current = groups.get(candidate.sourceSection) ?? []
    current.push(candidate)
    groups.set(candidate.sourceSection, current)
  })
  return [...groups.entries()]
}

function isSkillSection(sourceSection: string): boolean {
  return /技能|技术|能力|skills?|competenc/i.test(sourceSection)
}

function DiagnosticStat({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="text-[20px] font-bold text-text-primary">{value}</div>
      <div className="mt-1 text-[11px] text-text-tertiary">{label}</div>
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
