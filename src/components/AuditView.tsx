import { useState } from 'react'
import { ArrowRight, BookOpenCheck, ChevronDown, CircleHelp, ClipboardList, Code2, Flame, MessageSquareText } from 'lucide-react'
import { CLAIM_CATEGORY_LABELS, type ClaimCategory, type ResumeAnalysis, type ResumeClaim } from '@/domain/resume-schema'
import { claimRisk, type AuditStats, type RiskMeta } from '@/lib/risk'
import { Button } from '@/components/Button'

const CATEGORY_BLURB: Record<ClaimCategory, string> = {
  skill: '技能声明需要说明使用场景与深度，而非罗列名词。',
  responsibility: '职责声明要区分“负责”的具体决策范围与边界。',
  achievement: '成果声明通常需要量化基线、统计口径与个人贡献。',
  scale: '规模声明要说明统计方式、周期与可比基准。',
  ability: '能力声明需要可复述的具体案例，而非形容词。',
  honor: '荣誉声明要说明级别、含金量与个人贡献。',
}

const RISK_BADGE: Record<RiskMeta['color'], string> = {
  red: 'text-[#a13232] bg-red-soft',
  amber: 'text-[#92500a] bg-amber-soft',
  green: 'text-[#1e6545] bg-green-soft',
}

type AuditViewProps = {
  analysis: ResumeAnalysis
  selected: ResumeClaim
  stats: AuditStats
  onStartInterview: () => void
  onReport: () => void
}

export function AuditView({ analysis, selected, stats, onStartInterview, onReport }: AuditViewProps) {
  const [expanded, setExpanded] = useState(true)
  const risk = claimRisk(selected.askLikelihood, selected.evidenceStrength)

  return (
    <main className="min-w-0 bg-canvas">
      <section className="md3:grid-cols-4 max-md1:grid-cols-2 grid grid-cols-4 bg-white border-b border-line max-md1:h-auto">
        <div className="grid grid-cols-[auto_auto_1fr] content-center gap-x-1 border-r border-line px-[18px] py-0 h-[76px] max-md1:min-h-[62px] max-md1:border-b">
          <span className="col-span-full text-muted text-[9px] mb-[2px]">被追问概率(均)</span>
          <strong className="text-red text-[20px] leading-none">{stats.avgAskLikelihood}</strong>
          <small className="self-end pb-px text-faint text-[8px]">/ 100</small>
        </div>
        <div className="grid grid-cols-[auto_auto_1fr] content-center gap-x-1 border-r border-line px-[18px] py-0 h-[76px] max-md1:min-h-[62px] max-md1:border-b">
          <span className="col-span-full text-muted text-[9px] mb-[2px]">简历声明</span>
          <strong className="text-[#252d32] text-[20px] leading-none">{stats.claimCount}</strong>
          <small className="self-end pb-px text-faint text-[8px]">条</small>
        </div>
        <div className="grid grid-cols-[auto_auto_1fr] content-center gap-x-1 border-r border-line px-[18px] py-0 h-[76px] max-md1:min-h-[62px] max-md1:border-b max-md1:border-r-0">
          <span className="col-span-full text-muted text-[9px] mb-[2px]">薄弱声明</span>
          <strong className="text-[#252d32] text-[20px] leading-none">{stats.weakClaimCount}</strong>
          <small className="self-end pb-px text-faint text-[8px]">条</small>
        </div>
        <div className="grid grid-cols-[auto_auto_1fr] content-center gap-x-1 px-[18px] py-0 h-[76px] max-md1:min-h-[62px] max-md1:border-r-0">
          <span className="col-span-full text-muted text-[9px] mb-[2px]">待补证据</span>
          <strong className="text-[#252d32] text-[20px] leading-none">{stats.totalGaps}</strong>
          <small className="self-end pb-px text-faint text-[8px]">处</small>
        </div>
      </section>

      <section className="bg-surface border-b border-line px-[30px] py-7 pb-6 max-md1:px-5">
        <div className="flex items-center gap-[5px] text-brand text-[9px] font-750 uppercase"><Code2 size={13} />{CLAIM_CATEGORY_LABELS[selected.category]} · {selected.role}</div>
        <div className="flex items-start justify-between gap-5 mt-2 max-md1:flex-col">
          <div>
            <h1 className="m-0 text-[21px] leading-[1.25] text-[#182025] max-md1:text-[19px]">{selected.title}</h1>
            <p className="m-0 mt-[7px] max-w-[650px] text-muted text-[10px] leading-[1.6]">{CATEGORY_BLURB[selected.category]}</p>
          </div>
          <div className={`flex h-7 flex-none items-center gap-[5px] rounded px-[9px] text-[9px] font-750 ${RISK_BADGE[risk.color]}`}>
            <Flame size={14} />{risk.label} · {selected.askLikelihood}
          </div>
        </div>
        <blockquote className="relative m-0 mt-[18px] border-l-[3px] border-[#9eabb3] bg-[#f5f7f8] px-[14px] py-3 pl-[82px] text-[10px] leading-[1.6] text-[#4f5960] max-md1:pl-[13px] max-md1:pt-8">
          <span className="absolute left-[13px] top-[13px] text-faint text-[8px] font-750 uppercase max-md1:top-[10px]">简历原文</span>
          “{selected.quote}”
        </blockquote>
      </section>

      <section className="px-[30px] pt-6 pb-9 max-md1:px-5">
        <div className="flex items-end justify-between gap-5 mb-3">
          <div>
            <h2 className="m-0 text-[13px] text-[#232b30]">首轮追问</h2>
            <p className="m-0 mt-1 text-muted text-[9px]">后续问题会在模拟面试中根据你的回答动态生成，而非随机抽取。</p>
          </div>
          <span className="text-faint text-[9px]">动态追问</span>
        </div>
        <div className="border-t border-line-strong bg-white">
          <article className={`border-b border-line ${expanded ? '[&_button]:bg-[#f7f9fa]' : ''}`}>
            <button type="button" className="grid w-full min-h-[58px] grid-cols-[28px_minmax(0,1fr)_18px] items-center gap-[11px] bg-white px-[13px] py-[9px] text-left hover:bg-[#fafbfb]" onClick={() => setExpanded((v) => !v)}>
              <span className={`grid size-[25px] place-items-center rounded-full border font-mono text-[9px] font-650 ${expanded ? 'border-[#27343b] bg-[#27343b] text-white' : 'border-line-strong text-muted'}`}>1</span>
              <span className="flex min-w-0 flex-col gap-[3px]">
                <small className="text-faint text-[8px]">首轮追问</small>
                <strong className="text-[10px] font-650 leading-[1.45] text-[#2d353a]">{selected.initialQuestion}</strong>
              </span>
              <ChevronDown size={16} className={`text-[#8a949a] transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`} />
            </button>
            {expanded && (
              <div className="md3:grid-cols-[1fr_1.4fr] grid grid-cols-[1fr_1.4fr] gap-5 bg-[#f7f9fa] px-[52px] pb-[15px] max-md3:grid-cols-1 max-md3:gap-[10px] max-md1:pl-[52px] max-md1:pr-4">
                <div className="flex items-start gap-2">
                  <CircleHelp size={14} className="mt-[2px] flex-none text-brand" />
                  <p className="m-0 text-muted text-[9px] leading-[1.55]"><span className="block text-[#414b51] font-750 mb-[2px]">考察意图</span>验证这条声明是否经得起追问。</p>
                </div>
                <div className="flex items-start gap-2">
                  <BookOpenCheck size={14} className="mt-[2px] flex-none text-brand" />
                  <p className="m-0 text-muted text-[9px] leading-[1.55]"><span className="block text-[#414b51] font-750 mb-[2px]">回答应覆盖</span>{selected.evaluationPoints.join('；')}</p>
                </div>
              </div>
            )}
          </article>
        </div>
      </section>

      <button type="button" className="md2:hidden relative mb-[18px] ml-5 mr-5 block w-[calc(100%-40px)] min-h-[65px] rounded-md bg-[#1d272c] px-[34px] py-3 pl-[13px] text-left text-white max-md1:ml-3 max-md1:mr-3 max-md1:w-[calc(100%-24px)]" onClick={onStartInterview}>
        <span className="flex items-center gap-[7px]"><MessageSquareText size={16} /><b className="text-[10px]">开始模拟拷打</b></span>
        <small className="mt-[5px] ml-[23px] block text-[8px] text-[#aeb8bd]">从首轮追问开始，回答后继续动态追问</small>
        <ArrowRight size={16} className="absolute right-3 top-6 text-[#b9c1c5]" />
      </button>

      <Button variant="secondary" className="mx-[30px] mb-[18px]" onClick={onReport}>
        <ClipboardList size={14} />查看会话报告与改写建议
      </Button>

      <p className="m-0 px-[30px] pt-[18px] pb-[30px] text-muted text-[10px] leading-[1.6]">{analysis.summary}</p>
    </main>
  )
}
