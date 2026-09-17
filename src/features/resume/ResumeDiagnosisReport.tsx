'use client'

import { useState, type ReactNode } from 'react'
import { ChevronDown, Download } from 'lucide-react'
import { DIAGNOSIS_DIMENSIONS, DIAGNOSIS_PRIORITIES, sortDiagnosisIssues, type ResumeDiagnosis } from '@/domain/resume-diagnosis'
import { Button } from '@/components/ui/Button'
import { buildDiagnosisReport } from '@/lib/resume-diagnosis'
import { downloadText } from '@/lib/report'

type Props = {
  diagnosis: ResumeDiagnosis
  showToolbar?: boolean
}

export function ResumeDiagnosisReport({ diagnosis, showToolbar = true }: Props) {
  const issues = sortDiagnosisIssues(diagnosis.issues)
  const [selection, setSelection] = useState<{ report: ResumeDiagnosis; index: number | null } | null>(null)
  const selectedIndex = selection?.report === diagnosis ? selection.index : issues.length ? 0 : null

  return (
    <div className="resume-workbench diagnosis-layout flex h-full min-h-0 flex-col bg-white" aria-label="简历检查结果">
      {showToolbar && <DiagnosisToolbar diagnosis={diagnosis} actions={<DiagnosisExportButton diagnosis={diagnosis} />} />}
      <div className="diagnosis-report-grid min-h-0 flex-1">
        <div className="diagnosis-findings min-w-0">
          <details className="diagnosis-compact-summary border-b border-line bg-surface-soft px-5 py-3">
            <summary className="cursor-pointer text-[13px] font-semibold">检查小结</summary>
            <div className="pt-5"><DiagnosisSummary diagnosis={diagnosis} /></div>
          </details>
          <div className="flex items-baseline justify-between gap-3 border-b border-line px-5 py-5 sm:px-7">
            <h2 className="m-0 text-[18px] font-semibold">修改建议</h2>
            <span className="text-[12px] text-text-tertiary">先看影响阅读的问题</span>
          </div>
          {issues.map((issue, index) => {
            const expanded = selectedIndex === index
            return <section key={index} className="border-b border-line">
              <button type="button" aria-expanded={expanded} aria-controls={'diagnosis-issue-' + index} onClick={() => setSelection({ report: diagnosis, index: expanded ? null : index })} className={['flex w-full items-start gap-3 border-l-2 px-4 py-4 text-left sm:gap-4 sm:px-6 sm:py-5', expanded ? 'border-brand bg-surface-soft' : 'border-transparent hover:bg-surface-soft'].join(' ')}>
                <span className="mt-1 flex-none font-mono text-[12px] text-text-tertiary">{String(index + 1).padStart(2, '0')}</span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[15px] font-semibold leading-relaxed">{issue.title}</span>
                  <span className="mt-1.5 block text-[12px] text-text-tertiary">{DIAGNOSIS_DIMENSIONS[issue.dimension]}</span>
                  {!expanded && <span className="mt-2 line-clamp-2 text-[13px] leading-relaxed text-text-secondary">{issue.problem}</span>}
                </span>
                <span className={['mt-1 flex-none text-[12px]', issue.priority === 'high' ? 'text-danger' : 'text-text-tertiary'].join(' ')}>{DIAGNOSIS_PRIORITIES[issue.priority]}</span>
                <ChevronDown size={15} className={['mt-1 flex-none text-text-tertiary transition-transform', expanded ? 'rotate-180' : ''].join(' ')} />
              </button>
              {expanded && <div id={'diagnosis-issue-' + index} className="px-5 pb-6 pt-4 sm:px-7" aria-label={issue.title + '详情'}>
                <div className="mb-5">
                  <h3 className="mb-2 mt-0 text-[12px] font-medium text-text-tertiary">简历原文</h3>
                  {issue.evidence ? <blockquote className="m-0 whitespace-pre-wrap break-words border-l-2 border-line-strong bg-surface-soft px-4 py-3 text-[14px] leading-[1.8] text-text-secondary">{issue.evidence}</blockquote>
                    : <p className="m-0 text-[13px] text-text-tertiary">这条建议针对章节或缺少的信息。</p>}
                </div>
                <div className="diagnosis-issue-columns">
                  <section>
                    <h3 className="mb-2 mt-0 text-[13px] font-semibold">哪里没写清</h3>
                    <p className="m-0 whitespace-pre-wrap break-words text-[14px] leading-[1.8] text-text-secondary">{issue.problem}</p>
                  </section>
                  <section>
                    <h3 className="mb-2 mt-0 text-[13px] font-semibold">怎么改</h3>
                    <p className="m-0 whitespace-pre-wrap break-words text-[14px] leading-[1.8]">{issue.suggestion}</p>
                  </section>
                </div>
              </div>}
            </section>
          })}
          {issues.length === 0 && <p className="px-7 py-8 text-[14px] text-text-secondary">这次没有发现明显需要修改的地方。可以继续选择练习内容。</p>}
          <p className="m-0 px-5 py-4 text-[12px] leading-relaxed text-text-tertiary sm:px-7">这里只检查导入的文字，原文件的排版请另外核对。</p>
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
      <h2 className="mb-3 mt-0 text-[14px] font-semibold">检查小结</h2>
      <p className="m-0 whitespace-pre-wrap break-words text-[14px] leading-[1.85] text-text-secondary">{diagnosis.summary}</p>
    </section>
    <section className="border-b border-line py-5">
      <h2 className="mb-4 mt-0 text-[14px] font-semibold">先改这几处</h2>
      <ol className="m-0 list-none space-y-4 p-0">
        {diagnosis.nextSteps.map((step, index) => <li key={index} className="flex gap-3 text-[13px] leading-[1.75] text-text-secondary"><span className="pt-0.5 font-mono text-[11px] text-text-tertiary">{String(index + 1).padStart(2, '0')}</span><span>{step}</span></li>)}
      </ol>
    </section>
    {diagnosis.strengths.length > 0 && <section className="pt-5">
      <h2 className="mb-4 mt-0 text-[14px] font-semibold">可以保留</h2>
      <div className="space-y-5">
        {diagnosis.strengths.map((item, index) => <div key={index}>
          <h3 className="m-0 text-[13px] font-medium">{item.title}</h3>
          <p className="mb-2 mt-2 text-[13px] leading-[1.75] text-text-secondary">{item.explanation}</p>
          <blockquote className="m-0 break-words border-l-2 border-line-strong pl-3 text-[12px] leading-[1.7] text-text-tertiary">{item.evidence}</blockquote>
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
        <strong className="text-[14px] font-semibold">简历检查</strong>
        <span className="text-[12px] text-text-tertiary">{description}</span>
      </div>
      <div className="flex flex-wrap items-center gap-1">{actions}</div>
    </div>
  )
}

export function DiagnosisExportButton({ diagnosis }: { diagnosis: ResumeDiagnosis }) {
  return <Button className="h-8 px-2.5 text-[12px]" variant="ghost" onClick={() => downloadText('简历检查.md', buildDiagnosisReport(diagnosis))}><Download size={14} />导出</Button>
}
