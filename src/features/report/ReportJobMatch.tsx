import { AlertTriangle, CheckCircle2, Target } from 'lucide-react'
import type { ResumeAnalysis } from '@/domain/resume-schema'
import { ReportFact } from '@/features/report/ReportFact'

type ReportJobMatchProps = {
  jobMatch: NonNullable<ResumeAnalysis['jobMatch']>
}

export function ReportJobMatch({ jobMatch }: ReportJobMatchProps) {
  return (
    <section className="overflow-hidden rounded-lg bg-white shadow-card">
      <div className="flex items-center justify-between gap-4 border-b border-line bg-surface-soft px-5 py-4">
        <div className="flex items-center gap-2">
          <Target size={16} className="text-brand" />
          <div>
            <h2 className="m-0 text-[15px] font-bold">对照岗位要求</h2>
            <p className="mt-1 text-[12px] text-text-tertiary">
              看看哪些要求在简历里有对应经历，哪些还没写清。
            </p>
          </div>
        </div>
        <span className="text-[12px] text-text-tertiary">
          {jobMatch.requirements.length} 项要求
        </span>
      </div>
      <div className="divide-y divide-line">
        {jobMatch.requirements.map((item) => (
          <div
            key={item.requirement}
            className="grid grid-cols-[92px_minmax(0,1fr)_minmax(0,1.2fr)] gap-4 px-5 py-3.5 max-[720px]:grid-cols-1 max-[720px]:gap-1.5"
          >
            <div
              className={`flex items-center gap-1.5 text-[12px] font-semibold ${
                item.match === 'strong'
                  ? 'text-success'
                  : item.match === 'partial'
                    ? 'text-warning'
                    : 'text-danger'
              }`}
            >
              {item.match === 'strong' ? (
                <CheckCircle2 size={14} />
              ) : (
                <AlertTriangle size={14} />
              )}
              {item.match === 'strong'
                ? '有相关经历'
                : item.match === 'partial'
                  ? '还需补充'
                  : '简历没写'}
            </div>
            <p className="m-0 text-[13px] leading-relaxed text-text-primary">
              {item.requirement}
            </p>
            <div className="text-[12px] leading-relaxed text-text-tertiary">
              <p className="m-0">{item.note}</p>
              {item.evidence.length > 0 && (
                <p className="mt-1 text-text-secondary">
                  简历内容：{item.evidence.slice(0, 1).join('')}
                </p>
              )}
            </div>
          </div>
        ))}
      </div>
      {(jobMatch.gaps.length > 0 || jobMatch.interviewFocus.length > 0) && (
        <div className="grid grid-cols-2 gap-4 border-t border-line px-5 py-4 max-[720px]:grid-cols-1">
          <ReportFact
            label="还没写清的要求"
            value={joinReportItems(jobMatch.gaps)}
            tone="warning"
          />
          <ReportFact
            label="建议先练"
            value={joinReportItems(jobMatch.interviewFocus)}
          />
        </div>
      )}
    </section>
  )
}

function joinReportItems(items: string[]): string {
  return items.length > 0 ? items.slice(0, 3).join('；') : '暂无记录'
}
