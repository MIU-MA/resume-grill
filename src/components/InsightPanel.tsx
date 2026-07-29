import { AlertTriangle, ArrowRight, BarChart3, BookOpenCheck, Check, ChevronLeft, ChevronRight, MessageSquareText, Paperclip, Target } from 'lucide-react'
import { CLAIM_CATEGORY_LABELS, type ResumeClaim } from '@/domain/resume-schema'
import type { Mode } from '@/types'
import { claimRisk } from '@/lib/risk'

type CurrentQuestion = { question: string; intent: string } | null

type InsightPanelProps = {
  mode: Mode
  selected: ResumeClaim
  currentQuestion: CurrentQuestion
  covered: string[]
  missing: string[]
  turnCount: number
  onStartInterview: () => void
  sidebarOpen: boolean
  onToggleSidebar: () => void
}

export function InsightPanel({
  mode,
  selected,
  currentQuestion,
  covered,
  missing,
  turnCount,
  onStartInterview,
  sidebarOpen,
  onToggleSidebar,
}: InsightPanelProps) {
  const risk = claimRisk(selected.askLikelihood, selected.evidenceStrength)

  return (
    <aside className="relative shrink-0 overflow-hidden border-l border-line bg-surface transition-[width] duration-300 max-md2:hidden" style={{ width: sidebarOpen ? 280 : 0, maxHeight: 'calc(100vh - 54px)' }}>
      {/* 把手 */}
      <button
        type="button"
        onClick={onToggleSidebar}
        className="absolute -left-[6px] top-1/2 z-10 -translate-y-1/2 flex h-10 w-[6px] cursor-pointer items-center justify-center rounded-l border-y border-l border-line bg-[#f0f3f5] hover:bg-[#e4e8ea] transition-colors group"
        title={sidebarOpen ? '收起侧栏' : '展开侧栏'}
      >
        {sidebarOpen ? (
          <ChevronRight size={10} className="text-muted transition-transform group-hover:text-ink" />
        ) : (
          <ChevronLeft size={10} className="text-muted transition-transform group-hover:text-ink" />
        )}
      </button>

      <div className="h-full overflow-y-auto" style={{ width: 280 }}>
        <div className="flex h-[42px] items-center gap-[7px] border-b border-line px-4 text-[11px] text-[#3e484e]"><BarChart3 size={15} /><strong>{mode === 'audit' ? '风险依据' : '本轮状态'}</strong></div>
      {mode === 'audit' ? (
        <>
          <section className="border-b border-line p-4">
            <span className="text-muted text-[10px]">被追问概率</span>
            <div className="mt-[5px] flex items-baseline gap-[6px]"><strong className="text-[20px]">{selected.askLikelihood}%</strong><small className="text-faint text-[10px]">{risk.label}</small></div>
            <div className="mt-[9px] h-[5px] overflow-hidden rounded bg-[#e9edef]"><i className="block h-full rounded bg-brand" style={{ width: `${selected.askLikelihood}%` }} /></div>
            <span className="mt-3 block text-muted text-[10px]">证据完整度</span>
            <div className="mt-[5px] flex items-baseline gap-[6px]"><strong className="text-[20px]">{selected.evidenceStrength}%</strong><small className="text-faint text-[10px]">{selected.evidenceStrength >= 60 ? '较充分' : '偏薄弱'}</small></div>
            <div className="mt-[9px] h-[5px] overflow-hidden rounded bg-[#e9edef]"><i className="block h-full rounded bg-green" style={{ width: `${selected.evidenceStrength}%` }} /></div>
          </section>

          <section className="border-b border-line px-4 py-[14px]">
            <h3 className="flex items-center gap-[6px] m-0 mb-[9px] text-[10px] text-[#465057]"><Check size={13} className="text-green" />已有证据</h3>
            {selected.evidence.length === 0 ? <p className="m-0 text-muted text-[10px]">简历中未提供明确证据</p> : selected.evidence.map((item) => <p className="relative my-[6px] pl-[11px] text-muted text-[10px] leading-[1.5] before:absolute before:left-0 before:top-[5px] before:size-1 before:rounded-full before:bg-[#8ea09a]" key={item}>{item}</p>)}
          </section>

          <section className="border-b border-line px-4 py-[14px]">
            <h3 className="flex items-center gap-[6px] m-0 mb-[9px] text-[10px] text-[#465057]"><AlertTriangle size={13} className="text-amber" />容易被追问</h3>
            {selected.evidenceGaps.map((item) => <p className="relative my-[6px] pl-[11px] text-muted text-[10px] leading-[1.5] before:absolute before:left-0 before:top-[5px] before:size-1 before:rounded-full before:bg-amber" key={item}>{item}</p>)}
          </section>

          <section className="border-b border-line px-4 py-[14px]">
            <h3 className="flex items-center gap-[6px] m-0 mb-[9px] text-[10px] text-[#465057]"><BookOpenCheck size={13} className="text-green" />评估要点</h3>
            {selected.evaluationPoints.map((point) => <p className="relative my-[6px] pl-[11px] text-muted text-[10px] leading-[1.5] before:absolute before:left-0 before:top-[5px] before:size-1 before:rounded-full before:bg-[#8ea09a]" key={point}>{point}</p>)}
          </section>

          <button type="button" className="relative mb-3 ml-3 mr-3 block w-[calc(100%-24px)] min-h-[65px] rounded-md bg-[#1d272c] px-[34px] py-3 pl-[13px] text-left text-white hover:bg-[#131a1e]" onClick={onStartInterview}>
            <span className="flex items-center gap-[7px]"><MessageSquareText size={16} /><b className="text-[11px]">开始模拟拷打</b></span>
            <small className="mt-[5px] ml-[23px] block text-[10px] text-[#aeb8bd]">从首轮追问开始，回答后继续动态追问</small>
            <ArrowRight size={16} className="absolute right-3 top-6 text-[#b9c1c5]" />
          </button>

          <div className="mx-3 mb-3 flex items-center gap-2 rounded-[5px] border border-line bg-[#f8f9fa] p-[9px]">
            <Paperclip size={14} className="flex-none text-muted" />
            <div>
              <strong className="block text-[10px] text-[#4a535a]">补充证明材料</strong>
              <small className="mt-[2px] block text-faint text-[10px] leading-[1.5]">数据口径、复盘记录、同事或客户证言、可复现的统计方法等</small>
            </div>
          </div>
        </>
      ) : (
        <>
          <section className="flex flex-col items-center border-b border-line px-[14px] pt-[22px] pb-[18px] text-center">
            <span className="mb-[10px] grid size-[42px] place-items-center rounded-full bg-brand-soft text-brand"><MessageSquareText size={19} /></span>
            <strong className="max-w-[220px] text-[11px]">{selected.title}</strong>
            <p className="m-0 mt-1 text-muted text-[10px]">当前正在进行第 {turnCount + 1} 层追问 · {CLAIM_CATEGORY_LABELS[selected.category]}</p>
          </section>
          <section className="border-b border-line px-4 py-[14px]">
            <h3 className="flex items-center gap-[6px] m-0 mb-[9px] text-[10px] text-[#465057]"><Target size={13} className="text-brand" />面试官关注点</h3>
            <p className="m-0 text-muted text-[10px]">{currentQuestion?.intent ?? '准备开始追问…'}</p>
          </section>
          <section className="border-b border-line px-4 py-[14px]">
            <h3 className="m-0 mb-[9px] text-[10px] text-[#465057]">评估要点覆盖</h3>
            <div className="flex flex-wrap gap-[5px]">
              {selected.evaluationPoints.map((point) => (
                <span key={point} className={`rounded px-[6px] py-1 text-[10px] ${covered.includes(point) ? 'text-green bg-green-soft' : 'text-[#526069] bg-[#eef1f3]'}`}>{point}</span>
              ))}
            </div>
          </section>
          {missing.length > 0 && (
            <section className="border-b border-line px-4 py-[14px]">
              <h3 className="flex items-center gap-[6px] m-0 mb-[9px] text-[10px] text-[#465057]"><AlertTriangle size={13} className="text-amber" />建议补充</h3>
              {missing.map((item) => <p className="relative my-[6px] pl-[11px] text-muted text-[10px] leading-[1.5] before:absolute before:left-0 before:top-[5px] before:size-1 before:rounded-full before:bg-amber" key={item}>{item}</p>)}
            </section>
          )}
          <section className="m-3 rounded-[5px] border border-[#eadcc2] bg-[#fff8eb] p-3 text-[#5d4b2d]">
            <strong className="text-[10px]">回答建议</strong>
            <p className="m-0 mt-[5px] text-[10px] leading-[1.55]">按“背景与目标 &rarr; 你的角色与关键决策 &rarr; 主要挑战 &rarr; 结果与验证”的顺序回答，给出可验证的数据或案例。</p>
          </section>
        </>
      )}
      </div>
    </aside>
  )
}
