import { AlertTriangle, ArrowRight, BarChart3, BookOpenCheck, Check, MessageSquareText, Paperclip, Target } from 'lucide-react'
import { CLAIM_CATEGORY_LABELS, type ResumeClaim } from '@/domain/resume-schema'
import type { Mode } from '@/types'
import { RISK_META } from '@/lib/risk'

type CurrentQuestion = { question: string; intent: string } | null

type InsightPanelProps = {
  mode: Mode
  selected: ResumeClaim
  currentQuestion: CurrentQuestion
  covered: string[]
  missing: string[]
  turnCount: number
  onStartInterview: () => void
}

const RISK_DOT: Record<string, string> = {
  high: 'bg-red',
  medium: 'bg-amber',
  low: 'bg-green',
}

export function InsightPanel({
  mode,
  selected,
  currentQuestion,
  covered,
  missing,
  turnCount,
  onStartInterview,
}: InsightPanelProps) {
  const interviewRisk = RISK_META[selected.interviewRisk]
  const exagRisk = RISK_META[selected.exaggerationRisk]

  return (
    <aside className="border-l border-line bg-surface overflow-y-auto" style={{ width: 280, maxHeight: 'calc(100vh - 54px)' }}>
      <div className="flex h-[42px] items-center gap-1.5 border-b border-line px-4 text-[11px] text-text-secondary"><BarChart3 size={15} /><strong>{mode === 'audit' ? '风险依据' : '本轮状态'}</strong></div>
      {mode === 'audit' ? (
        <>
          <section className="border-b border-line p-4">
            <div className="flex items-center justify-between">
              <span className="text-text-tertiary text-[10px]">面试风险</span>
              <span className="flex items-center gap-2 text-[11px] font-700 text-text-primary">
                <span className={`size-2 rounded-full ${RISK_DOT[selected.interviewRisk]}`} />{interviewRisk.label}
              </span>
            </div>
            <div className="mt-3 flex items-center justify-between">
              <span className="text-text-tertiary text-[10px]">可信风险</span>
              <span className="flex items-center gap-2 text-[11px] font-700 text-text-primary">
                <span className={`size-2 rounded-full ${RISK_DOT[selected.exaggerationRisk]}`} />{exagRisk.label}
              </span>
            </div>
          </section>

          <section className="border-b border-line px-4 py-3">
            <h3 className="flex items-center gap-1.5 m-0 mb-2 text-[10px] text-text-secondary"><AlertTriangle size={13} className="text-amber" />证据缺失</h3>
            {selected.evidenceGap.length === 0 ? <p className="m-0 text-text-tertiary text-[10px]">无明显证据缺失</p> : selected.evidenceGap.map((item) => <p className="relative my-[6px] pl-[11px] text-text-tertiary text-[10px] leading-[1.5] before:absolute before:left-0 before:top-[5px] before:size-1 before:rounded-full before:bg-amber" key={item}>{item}</p>)}
          </section>

          <section className="border-b border-line px-4 py-3">
            <h3 className="flex items-center gap-1.5 m-0 mb-2 text-[10px] text-text-secondary"><Check size={13} className="text-green" />已有证据</h3>
            {selected.evidence.length === 0 ? <p className="m-0 text-text-tertiary text-[10px]">简历中未提供明确证据</p> : selected.evidence.map((item) => <p className="relative my-[6px] pl-[11px] text-text-tertiary text-[10px] leading-[1.5] before:absolute before:left-0 before:top-[5px] before:size-1 before:rounded-full before:bg-text-tertiary" key={item}>{item}</p>)}
          </section>

          <section className="border-b border-line px-4 py-3">
            <h3 className="flex items-center gap-1.5 m-0 mb-2 text-[10px] text-text-secondary"><BookOpenCheck size={13} className="text-green" />评估要点</h3>
            {selected.evaluationPoints.map((point) => <p className="relative my-[6px] pl-[11px] text-text-tertiary text-[10px] leading-[1.5] before:absolute before:left-0 before:top-[5px] before:size-1 before:rounded-full before:bg-text-tertiary" key={point}>{point}</p>)}
          </section>

          <button type="button" className="relative mb-3 ml-3 mr-3 block w-[calc(100%-24px)] min-h-[56px] rounded-md bg-text-primary px-[34px] py-3 pl-[13px] text-left text-white hover:bg-text-primary/90" onClick={onStartInterview}>
            <span className="flex items-center gap-1.5"><MessageSquareText size={16} /><b className="text-[11px]">开始模拟拷打</b></span>
            <small className="mt-1 ml-[23px] block text-[10px] text-text-tertiary">从首轮追问开始，回答后继续动态追问</small>
            <ArrowRight size={16} className="absolute right-3 top-6 text-text-tertiary" />
          </button>

          <div className="mx-3 mb-3 flex items-center gap-2 rounded-[5px] border border-line bg-surface-soft p-[9px]">
            <Paperclip size={14} className="flex-none text-text-tertiary" />
            <div>
              <strong className="block text-[10px] text-text-secondary">补充证明材料</strong>
              <small className="mt-[2px] block text-text-tertiary text-[10px] leading-[1.5]">数据口径、复盘记录、同事或客户证言、可复现的统计方法等</small>
            </div>
          </div>
        </>
      ) : (
        <>
          <section className="flex flex-col items-center border-b border-line px-4 pt-[22px] pb-[18px] text-center">
            <span className="mb-2.5 grid size-[42px] place-items-center rounded-full bg-brand-soft text-brand"><MessageSquareText size={19} /></span>
            <strong className="max-w-[220px] text-[11px]">{selected.title}</strong>
            <p className="m-0 mt-1 text-text-tertiary text-[10px]">当前正在进行第 {turnCount + 1} 层追问 · {CLAIM_CATEGORY_LABELS[selected.category]}</p>
          </section>
          <section className="border-b border-line px-4 py-3">
            <h3 className="flex items-center gap-1.5 m-0 mb-2 text-[10px] text-text-secondary"><Target size={13} className="text-brand" />面试官关注点</h3>
            <p className="m-0 text-text-tertiary text-[10px]">{currentQuestion?.intent ?? '准备开始追问…'}</p>
          </section>
          <section className="border-b border-line px-4 py-3">
            <h3 className="m-0 mb-2 text-[10px] text-text-secondary">评估要点覆盖</h3>
            <div className="flex flex-wrap gap-1.5">
              {selected.evaluationPoints.map((point) => (
                <span key={point} className={`rounded px-[6px] py-1 text-[10px] ${covered.includes(point) ? 'text-green bg-green-soft' : 'text-text-secondary bg-surface-hover'}`}>{point}</span>
              ))}
            </div>
          </section>
          {missing.length > 0 && (
            <section className="border-b border-line px-4 py-3">
              <h3 className="flex items-center gap-1.5 m-0 mb-2 text-[10px] text-text-secondary"><AlertTriangle size={13} className="text-amber" />建议补充</h3>
              {missing.map((item) => <p className="relative my-[6px] pl-[11px] text-text-tertiary text-[10px] leading-[1.5] before:absolute before:left-0 before:top-[5px] before:size-1 before:rounded-full before:bg-amber" key={item}>{item}</p>)}
            </section>
          )}
          <section className="m-3 rounded-[5px] border border-warning/20 bg-warning-soft p-3 text-warning">
            <strong className="text-[10px]">回答建议</strong>
            <p className="m-0 mt-1 text-[10px] leading-[1.55]">按"背景与目标 → 你的角色与关键决策 → 主要挑战 → 结果与验证"的顺序回答，给出可验证的数据或案例。</p>
          </section>
        </>
      )}
    </aside>
  )
}
