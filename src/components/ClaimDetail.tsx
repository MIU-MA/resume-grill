import { CircleHelp, MessageSquareText } from 'lucide-react'
import { type ResumeClaim } from '@/domain/resume-schema'
import { RISK_META } from '@/lib/risk'
import { Button } from '@/components/Button'

type ClaimDetailProps = { claim: ResumeClaim; onStartInterview: () => void }

export function ClaimDetail({ claim, onStartInterview }: ClaimDetailProps) {
  const risk = RISK_META[claim.interviewRisk]

  return (
    <div className="p-6 overflow-y-auto" style={{ maxHeight: 'calc(100vh - 60px)' }}>
      {/* 头部：original quote + risk score */}
      <div className="flex items-start justify-between gap-6 pb-[22px] border-b border-border">
        <div>
          <div className="text-text-tertiary text-[12px] mb-2">原始声明</div>
          <h2 className="m-0 text-[22px] leading-[1.5] tracking-[-0.02em] max-w-[820px]">"{claim.content}"</h2>
        </div>
        <div className="min-w-[116px] border border-border rounded-xl p-4 bg-surface-soft">
          <div className="text-text-tertiary text-[11px] mb-1">被追问风险</div>
          <div className={`text-[20px] font-[750] ${risk.color === 'red' ? 'text-danger' : risk.color === 'amber' ? 'text-warning' : 'text-success'}`}>{risk.label}</div>
        </div>
      </div>

      {/* 双列内容 */}
      <div className="grid grid-cols-[minmax(0,1.2fr)_minmax(270px,.8fr)] gap-7 pt-6 max-[1050px]:grid-cols-1">
        {/* 左列 */}
        <div>
          <section>
            <div className="flex items-center gap-2 text-[14px] font-bold mb-3">
              <CircleHelp size={17} className="text-text-tertiary" />为什么容易被继续追问
            </div>
            <div className="space-y-2.5">
              {claim.evidenceGap.length === 0 ? (
                <p className="text-[13px] text-text-secondary">简历中已提供较充分的证据。</p>
              ) : claim.evidenceGap.map((gap: string) => (
                <div key={gap} className="flex gap-3 items-start text-[13px] text-text-secondary leading-[1.6]">
                  <span className="mt-1.5 size-1.5 rounded-full bg-danger flex-none" />
                  <span>{gap}</span>
                </div>
              ))}
            </div>
          </section>

          <section className="mt-[26px]">
            <div className="flex items-center gap-2 text-[14px] font-bold mb-3">
              <MessageSquareText size={17} className="text-text-tertiary" />面试官可能先问
            </div>
            <div className="bg-surface-soft border border-border rounded-xl p-4">
              <div className="text-text-tertiary text-[11px] font-bold uppercase tracking-[0.04em] mb-2">First question</div>
              <div className="text-[15px] leading-[1.65] font-[650]">{claim.initialQuestion}</div>
            </div>
          </section>
        </div>

        {/* 右列 */}
        <aside>
          <section>
            <div className="text-[14px] font-bold mb-3">声明证据概览</div>
            <div className="border border-border rounded-xl p-4 bg-white">
              {claim.evidence.map((item: string) => (
                <div key={item} className="flex items-center justify-between gap-4 py-2.5 text-[13px] text-text-secondary border-b border-border last:border-b-0">
                  <span>{item}</span><span className="font-[650] text-text-primary">明确</span>
                </div>
              ))}
              {claim.evidenceGap.map((gap: string) => (
                <div key={gap} className="flex items-center justify-between gap-4 py-2.5 text-[13px] text-text-secondary border-b border-border last:border-b-0">
                  <span>{gap}</span>
                  <span className="font-[650] text-danger">缺失</span>
                </div>
              ))}
            </div>
          </section>

          <section className="mt-[26px]">
            <div className="text-[14px] font-bold mb-3">预计考察方向</div>
            <div className="space-y-2.5">
              {claim.evaluationPoints.map((point: string, i: number) => (
                <div key={point} className="flex items-start gap-2 text-[12px] text-text-secondary leading-[1.55]">
                  <span className={`size-[17px] rounded-full grid place-items-center flex-none mt-px text-[10px] font-extrabold ${i === 0 ? 'bg-success-soft text-success' : 'bg-surface-hover text-text-tertiary'}`}>{i === 0 ? '✓' : i + 1}</span>
                  <span>{point}</span>
                </div>
              ))}
            </div>
          </section>
        </aside>
      </div>

      {/* 底部操作 */}
      <div className="mt-6 flex justify-end gap-3">
        <Button variant="ghost">标记为已准备</Button>
        <Button variant="primary" size="large" onClick={onStartInterview}>
          <MessageSquareText size={16} />开始压力测试
        </Button>
      </div>
    </div>
  )
}
