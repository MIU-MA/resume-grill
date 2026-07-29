import { ShieldAlert } from 'lucide-react'
import { CLAIM_CATEGORY_LABELS, type ResumeAnalysis } from '@/domain/resume-schema'
import { claimRisk, type RiskMeta } from '@/lib/risk'

type ClaimSidebarProps = {
  analysis: ResumeAnalysis
  selectedIndex: number
  onSelect: (index: number) => void
}

const RISK_DOT: Record<RiskMeta['color'], string> = {
  red: 'bg-red shadow-[0_0_0_3px_var(--color-red-soft)]',
  amber: 'bg-amber shadow-[0_0_0_3px_var(--color-amber-soft)]',
  green: 'bg-green shadow-[0_0_0_3px_var(--color-green-soft)]',
}

const RISK_SCORE: Record<RiskMeta['color'], string> = {
  red: 'text-red',
  amber: 'text-amber',
  green: 'text-green',
}

export function ClaimSidebar({ analysis, selectedIndex, onSelect }: ClaimSidebarProps) {
  return (
    <aside className="flex flex-col border-line bg-surface md2:min-h-[calc(100vh-58px)] md2:border-r max-md1:min-h-0 max-md1:border-b">
      <div className="flex items-center gap-[10px] border-b border-line px-[15px] py-[15px] pb-[13px] max-md1:hidden">
        <div className="grid size-[34px] place-items-center rounded-full flex-none bg-[#e7ecef] text-[#28343a] text-[11px] font-extrabold">{analysis.candidate.slice(0, 2)}</div>
        <div className="flex min-w-0 flex-col">
          <strong className="text-[13px]">{analysis.candidate}</strong>
          <span className="text-muted mt-[2px] text-[10px]">{analysis.role}</span>
        </div>
      </div>

      <div className="flex h-[38px] items-center justify-between px-[15px] text-muted text-[10px] font-750 uppercase max-md1:h-[34px]">
        <span>简历声明</span>
        <b className="min-w-[20px] rounded bg-[#eef1f2] px-[5px] py-[2px] text-center text-[#5c656b]">{analysis.claims.length}</b>
      </div>
      <div className="flex flex-col gap-[2px] px-2 max-md1:flex-row max-md1:gap-[6px] max-md1:overflow-x-auto max-md1:px-[10px] max-md1:pb-[10px]">
        {analysis.claims.map((claim, index) => {
          const risk = claimRisk(claim.askLikelihood, claim.evidenceStrength)
          return (
            <button
              key={index}
              type="button"
              className={`grid min-h-[55px] w-full grid-cols-[8px_minmax(0,1fr)_30px] items-center gap-[9px] rounded-[5px] px-2 py-[7px] text-left ${selectedIndex === index ? 'bg-brand-soft' : 'bg-transparent hover:bg-[#f4f6f7]'} max-md1:min-w-[190px] max-md1:border max-md1:border-line`}
              onClick={() => onSelect(index)}
            >
              <span className={`size-[6px] mt-[9px] self-start rounded-full ${RISK_DOT[risk.color]}`} />
              <span className="flex min-w-0 flex-col">
                <small className="text-faint mb-[2px] text-[10px]">{CLAIM_CATEGORY_LABELS[claim.category]}</small>
                <strong className={`overflow-hidden text-ellipsis whitespace-nowrap text-[11px] font-650 ${selectedIndex === index ? 'text-[#183b86]' : 'text-[#30373c]'}`}>{claim.title}</strong>
              </span>
              <span className={`justify-self-end font-mono text-[11px] font-bold leading-none ${RISK_SCORE[risk.color]}`}>{claim.askLikelihood}</span>
            </button>
          )
        })}
      </div>

      <div className="mt-auto flex gap-2 border-t border-line bg-[#f8f9fa] px-[14px] py-[13px] text-muted max-md1:hidden">
        <ShieldAlert size={15} className="mt-px flex-none text-[#748087]" />
        <p className="m-0 text-[10px] leading-[1.55]"><strong className="text-[#505a60]">评分不是能力结论</strong><br />它表示这句话在面试中被继续追问的概率。</p>
      </div>
    </aside>
  )
}
