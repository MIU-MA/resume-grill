import { BookOpenCheck, ChevronDown, CircleHelp, ClipboardList, Flame, MessageSquareText } from 'lucide-react'
import { CLAIM_CATEGORY_LABELS, type ResumeAnalysis, type ResumeClaim } from '@/domain/resume-schema'
import { claimRisk, type AuditStats, type RiskMeta } from '@/lib/risk'
import { Button } from '@/components/Button'

const RISK_DOT: Record<RiskMeta['color'], string> = {
  red: 'bg-red shadow-[0_0_0_3px_var(--color-red-soft)]',
  amber: 'bg-amber shadow-[0_0_0_3px_var(--color-amber-soft)]',
  green: 'bg-green shadow-[0_0_0_3px_var(--color-green-soft)]',
}

const RISK_BADGE: Record<RiskMeta['color'], string> = {
  red: 'text-[#a13232] bg-red-soft',
  amber: 'text-[#92500a] bg-amber-soft',
  green: 'text-[#1e6545] bg-green-soft',
}

type ClaimEntry = { claim: ResumeClaim; index: number }
type SectionGroup = { section: string; claims: ClaimEntry[] }

function groupBySection(claims: ResumeClaim[]): SectionGroup[] {
  const map = new Map<string, { claim: ResumeClaim; index: number }[]>()
  claims.forEach((claim, index) => {
    const sec = claim.sourceSection || '其他'
    if (!map.has(sec)) map.set(sec, [])
    map.get(sec)!.push({ claim, index })
  })
  // 维持每组首次出现的顺序
  return [...map.entries()].map(([section, claims]) => ({ section, claims }))
}

type AuditViewProps = {
  analysis: ResumeAnalysis
  selectedIndex: number
  stats: AuditStats
  onSelect: (index: number) => void
  onStartInterview: () => void
  onReport: () => void
}

export function AuditView({ analysis, selectedIndex, stats, onSelect, onStartInterview, onReport }: AuditViewProps) {
  const sections = groupBySection(analysis.claims)

  return (
    <main className="min-w-0 bg-canvas overflow-y-auto" style={{ maxHeight: 'calc(100vh - 54px)' }}>
      {/* 风险摘要条 */}
      <div className="flex items-center gap-6 border-b border-line bg-white px-6 py-3">
        <div className="flex items-center gap-2 text-[13px]">
          <Flame size={16} className="text-red" />
          <strong className="text-[#252d32]">{stats.weakClaimCount}</strong>
          <span className="text-muted text-[10px]">薄弱声明</span>
        </div>
        <div className="flex items-center gap-2 text-[13px]">
          <span className="text-amber font-750">⚠</span>
          <strong className="text-[#252d32]">{stats.totalGaps}</strong>
          <span className="text-muted text-[10px]">待补证据</span>
        </div>
        <div className="flex items-center gap-2 text-[13px]">
          <span className="text-green font-750">✓</span>
          <strong className="text-[#252d32]">{stats.claimCount - stats.weakClaimCount}</strong>
          <span className="text-muted text-[10px]">较稳固</span>
        </div>
        <div className="ml-auto flex items-center gap-1.5 text-muted text-[9px]">
          <span>被追问概率均值</span>
          <strong className="text-[#252d32] text-[13px]">{stats.avgAskLikelihood}</strong>
          <span>/ 100</span>
        </div>
      </div>

      {/* 声明列表 — 按段分组 */}
      <div className="px-6 pt-5 pb-10">
        {sections.map(({ section, claims: groupClaims }) => (
          <div key={section} className="mb-6">
            <div className="flex items-center justify-between mb-2">
              <h2 className="m-0 text-[13px] font-bold text-[#232b30]">{section}</h2>
              <span className="text-faint text-[9px]">{groupClaims.length} 条声明</span>
            </div>
            <div className="flex flex-col gap-2">
              {groupClaims.map(({ claim, index }: ClaimEntry) => {
                const r = claimRisk(claim.askLikelihood, claim.evidenceStrength)
                const isActive = index === selectedIndex
                return (
                  <article
                    key={index}
                    className={`rounded-md border bg-white transition-colors ${isActive ? 'border-brand ring-1 ring-brand/20' : 'border-line hover:border-line-strong'}`}
                  >
                    <button
                      type="button"
                      className="flex w-full items-center gap-3 px-4 py-3 text-left"
                      onClick={() => onSelect(index)}
                    >
                      <span className={`size-2 rounded-full flex-none ${RISK_DOT[r.color]}`} />
                      <div className="flex min-w-0 flex-1 flex-col">
                        <div className="flex items-center gap-2">
                          <small className="text-faint text-[8px]">{CLAIM_CATEGORY_LABELS[claim.category]} · {claim.role}</small>
                          <span className={`rounded px-1.5 py-px text-[8px] font-650 ${RISK_BADGE[r.color]}`}>{r.label}</span>
                        </div>
                        <strong className="text-[12px] font-650 text-[#30373c] mt-0.5">{claim.title}</strong>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        <span className="text-[11px] font-600 text-[#252d32]">{claim.askLikelihood}%</span>
                        <span className="text-faint text-[8px]">追问概率</span>
                      </div>
                      <ChevronDown size={14} className={`text-muted ml-1 transition-transform duration-200 flex-none ${isActive ? 'rotate-180' : ''}`} />
                    </button>

                    {/* 展开详情 */}
                    {isActive && (
                      <div className="border-t border-line px-4 pb-4 pt-3">
                        <blockquote className="relative m-0 mb-4 border-l-[3px] border-[#9eabb3] bg-[#f5f7f8] py-2 pl-3 text-[10px] leading-[1.6] text-[#4f5960]">
                          “{claim.quote}”
                        </blockquote>

                        <div className="mb-4">
                          <div className="flex items-center gap-2 mb-1 text-[9px] font-700 text-[#414b51]"><BookOpenCheck size={12} className="text-brand" />首轮追问</div>
                          <p className="m-0 text-[10px] text-[#2d353a] leading-[1.5]">{claim.initialQuestion}</p>
                        </div>

                        <div className="grid grid-cols-2 gap-4 mb-4">
                          <div>
                            <div className="flex items-center gap-2 mb-1 text-[9px] font-700 text-[#414b51]"><CircleHelp size={12} className="text-brand" />证据缺口</div>
                            {claim.evidenceGaps.length === 0 ? <p className="m-0 text-faint text-[9px]">—</p> : claim.evidenceGaps.map((g: string) => (
                              <p key={g} className="relative my-1 pl-2.5 text-muted text-[9px] leading-[1.5] before:absolute before:left-0 before:top-[5px] before:size-1 before:rounded-full before:bg-amber">{g}</p>
                            ))}
                          </div>
                          <div>
                            <div className="flex items-center gap-2 mb-1 text-[9px] font-700 text-[#414b51]"><BookOpenCheck size={12} className="text-green" />评估要点</div>
                            {claim.evaluationPoints.map((p) => (
                              <p key={p} className="relative my-1 pl-2.5 text-muted text-[9px] leading-[1.5] before:absolute before:left-0 before:top-[5px] before:size-1 before:rounded-full before:bg-[#8ea09a]">{p}</p>
                            ))}
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <Button variant="primary" size="large" className="h-[34px]" onClick={onStartInterview}>
                            <MessageSquareText size={14} />开始模拟拷打
                          </Button>
                          <Button variant="secondary" className="h-[34px]" onClick={onReport}>
                            <ClipboardList size={13} />会话报告
                          </Button>
                        </div>
                      </div>
                    )}
                  </article>
                )
              })}
            </div>
          </div>
        ))}
      </div>
    </main>
  )
}
