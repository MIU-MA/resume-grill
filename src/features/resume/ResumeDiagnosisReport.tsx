'use client'

import type { ReactNode } from 'react'
import { Download } from 'lucide-react'
import { DIAGNOSIS_DIMENSIONS, DIAGNOSIS_PRIORITIES, sortDiagnosisIssues, type ResumeDiagnosis } from '@/domain/resume-diagnosis'
import { Button } from '@/components/ui/Button'
import { buildDiagnosisReport } from '@/features/resume/lib/resume-diagnosis'
import { downloadText } from '@/features/report/lib/report'

type Props = {
  diagnosis: ResumeDiagnosis
  showToolbar?: boolean
  renderIssueEditor?: (evidence: string) => ReactNode
  onIssueSelect?: (evidence: string) => void
}

export function ResumeDiagnosisReport({ diagnosis, showToolbar = true, renderIssueEditor, onIssueSelect }: Props) {
  const issues = sortDiagnosisIssues(diagnosis.issues)


  return (
    <div className="resume-workbench diagnosis-layout flex h-full min-h-0 flex-col bg-surface" aria-label="简历检查结果">
      {showToolbar && <DiagnosisToolbar diagnosis={diagnosis} actions={<DiagnosisExportButton diagnosis={diagnosis} />} />}
      <div className="diagnosis-report-grid min-h-0 flex-1">
        <div className="diagnosis-findings min-w-0">
          <details open className="diagnosis-compact-summary border-b border-line bg-surface-soft px-5 py-3">
            <summary className="cursor-pointer text-label font-semibold">检查小结</summary>
            <div className="pt-5"><DiagnosisSummary diagnosis={diagnosis} /></div>
          </details>
          <div className="flex items-baseline justify-between gap-3 border-b border-line px-5 py-5 sm:px-7">
            <h2 className="m-0 text-title font-semibold">修改建议</h2>
            <span className="text-meta text-text-tertiary">按修改优先级排序</span>
          </div>
          {issues.map((issue, index) => <section key={index} className="border-b border-line px-5 py-5 sm:px-7" aria-label={issue.title + '详情'}>
            <div className="mb-3 flex items-start gap-3"><span className="font-mono text-meta text-text-tertiary">{String(index + 1).padStart(2, '0')}</span><h3 className="m-0 flex-1 text-section font-semibold">{issue.title}</h3><span className="workbench-status" data-tone={issue.priority === 'high' ? 'warning' : issue.priority === 'medium' ? 'info' : 'neutral'}>{DIAGNOSIS_PRIORITIES[issue.priority]}</span></div>
            <p className="mb-3 text-meta text-text-tertiary">{DIAGNOSIS_DIMENSIONS[issue.dimension]}</p>
            <p className="whitespace-pre-wrap break-words text-body leading-relaxed text-text-secondary">{issue.problem}</p>
            <h4 className="mb-2 mt-4 text-label font-semibold">怎么改</h4>
            <p className="m-0 whitespace-pre-wrap break-words text-body leading-relaxed">{issue.suggestion}</p>
            {renderIssueEditor?.(issue.evidence)}
            <details className="mt-4 text-label text-text-secondary"><summary className="cursor-pointer">简历原文与依据</summary>{issue.evidence ? <><blockquote className="mx-0 whitespace-pre-wrap break-words border-l-2 border-line bg-surface-soft px-4 py-3 text-body leading-relaxed">{issue.evidence}</blockquote>{onIssueSelect && <button type="button" className="underline" onClick={() => onIssueSelect(issue.evidence)}>在简历中定位</button>}</> : <p>这处需要补充内容，没有对应的原文。</p>}</details>
          </section>)}
          {issues.length === 0 && <p className="px-7 py-8 text-body text-text-secondary">这次没有发现明显问题。</p>}
          <p className="m-0 px-5 py-4 text-meta leading-relaxed text-text-tertiary sm:px-7">检查针对文字内容，排版可在简历预览中查看。</p>
        </div>
        <aside className="diagnosis-summary border-l border-line bg-surface-soft p-6" aria-label="检查小结">
          <DiagnosisSummary diagnosis={diagnosis} />
        </aside>
      </div>
    </div>
  )
}

function DiagnosisSummary({ diagnosis }: { diagnosis: ResumeDiagnosis }) {
  return <>
    <section className="border-b border-line pb-5">
      <h2 className="mb-3 mt-0 text-section font-semibold">检查小结</h2>
      <p className="m-0 whitespace-pre-wrap break-words text-body leading-[1.85] text-text-secondary">{diagnosis.summary}</p>
    </section>
    <section className="border-b border-line py-5">
      <h2 className="mb-4 mt-0 text-section font-semibold">先改这几处</h2>
      <ol className="m-0 list-none space-y-4 p-0">
        {diagnosis.nextSteps.map((step, index) => <li key={index} className="flex gap-3 text-body leading-[1.75] text-text-secondary"><span className="pt-0.5 font-mono text-meta text-text-tertiary">{String(index + 1).padStart(2, '0')}</span><span>{step}</span></li>)}
      </ol>
    </section>
    {diagnosis.strengths.length > 0 && <section className="diagnosis-strengths pt-5">
      <h2 className="mb-4 mt-0 text-section font-semibold">可以保留</h2>
      <div className="space-y-5">
        {diagnosis.strengths.map((item, index) => <div key={index}>
          <h3 className="m-0 text-label font-medium">{item.title}</h3>
          <p className="mb-2 mt-2 text-body leading-[1.75] text-text-secondary">{item.explanation}</p>
          <blockquote className="m-0 break-words border-l-2 border-line-strong pl-3 text-meta leading-[1.7] text-text-tertiary">{item.evidence}</blockquote>
        </div>)}
      </div>
    </section>}
  </>
}

export function DiagnosisToolbar({ diagnosis, actions }: { diagnosis?: ResumeDiagnosis; actions: ReactNode }) {
  const description = diagnosis
    ? diagnosis.issues.length + ' 条建议 · ' + diagnosis.issues.filter((item) => item.priority === 'high').length + ' 条先改' + (diagnosis.source === 'demo' ? ' · 免费示例，未调用模型' : '')
    : '内容、结构与表达'
  return (
    <div className="flex min-h-14 flex-none flex-wrap items-center justify-between gap-x-6 gap-y-2 border-b border-line px-4 py-2.5 sm:px-6">
      <div className="flex min-w-0 flex-wrap items-baseline gap-x-3 gap-y-1">
        <strong className="text-body font-semibold">简历检查</strong>
        <span className="text-meta text-text-tertiary">{description}</span>
      </div>
      <div className="flex flex-wrap items-center gap-1">{actions}</div>
    </div>
  )
}

export function DiagnosisExportButton({ diagnosis }: { diagnosis: ResumeDiagnosis }) {
  return <Button className="h-8 px-2.5 text-label" variant="ghost" onClick={() => downloadText('简历检查.md', buildDiagnosisReport(diagnosis))}><Download size={14} />导出</Button>
}
