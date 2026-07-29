import { BookOpenCheck, ChevronDown, CircleHelp, ClipboardList, Flame, MessageSquareText, ShieldAlert } from 'lucide-react'
import { CLAIM_CATEGORY_LABELS, type ResumeAnalysis, type ResumeClaim } from '@/domain/resume-schema'
import { claimRisk, type AuditStats, type RiskMeta } from '@/lib/risk'
import { Button } from '@/components/Button'

const RISK_EMOJI: Record<RiskMeta['color'], string> = { red: '🔥', amber: '⚠️', green: '✓' }
const RISK_BADGE: Record<RiskMeta['color'], string> = {
  red: 'text-[#a13232] bg-red-soft',
  amber: 'text-[#92500a] bg-amber-soft',
  green: 'text-[#1e6545] bg-green-soft',
}

type ClaimEntry = { claim: ResumeClaim; index: number }
type SectionGroup = { section: string; claims: ClaimEntry[] }

function groupBySection(claims: ResumeClaim[]): SectionGroup[] {
  const map = new Map<string, ClaimEntry[]>()
  claims.forEach((claim, index) => {
    const sec = claim.sourceSection || '其他'
    if (!map.has(sec)) map.set(sec, [])
    map.get(sec)!.push({ claim, index })
  })
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
      {/* ── 候选人 & 解析总览 ── */}
      <section className="bg-white border-b border-line px-8 py-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-faint text-[10px] uppercase tracking-[0.08em]">简历解析结果</span>
              <span className="h-px flex-1 bg-line max-w-[80px]" />
            </div>
            <div className="flex items-baseline gap-3 mt-1">
              <h1 className="m-0 text-[22px] font-bold text-[#182025] leading-[1.2]">候选人</h1>
              <strong className="text-[22px] font-bold text-[#182025]">{analysis.candidate}</strong>
              <span className="text-muted text-[13px]">{analysis.role}</span>
            </div>
            <p className="m-0 mt-1 text-muted text-[11px] max-w-[600px] leading-[1.6]">{analysis.summary}</p>
          </div>

          <div className="flex flex-col items-end gap-2 flex-none">
            <div className="flex items-center gap-5 text-[11px]">
              <div className="flex items-center gap-1">
                <ShieldAlert size={14} className="text-red" />
                <strong className="text-[#252d32]">{stats.weakClaimCount}</strong>
                <span className="text-muted">薄弱</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="text-amber font-700">⚠</span>
                <strong className="text-[#252d32]">{stats.totalGaps}</strong>
                <span className="text-muted">缺口</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="text-green font-700">✓</span>
                <strong className="text-[#252d32]">{stats.claimCount - stats.weakClaimCount}</strong>
                <span className="text-muted">稳固</span>
              </div>
            </div>
            <div className="text-faint text-[10px]">
              追问概率均值 <strong className="text-[#252d32] text-[15px]">{stats.avgAskLikelihood}</strong><span className="text-faint">/100</span>
            </div>
          </div>
        </div>

        {/* 识别经历 chips */}
        <div className="mt-5 flex flex-wrap items-center gap-2">
          <span className="text-faint text-[10px] mr-1">识别经历</span>
          {sections.map(({ section, claims: groupClaims }) => (
            <span key={section} className="rounded-full border border-line bg-[#fafbfb] px-3 py-1.5 text-[11px] text-[#3e484e]">
              {section}<b className="ml-1.5 text-[10px] text-[#252d32]">{groupClaims.length}</b>
            </span>
          ))}
          {sections.length === 0 && <span className="text-faint text-[10px]">未识别到具体段落</span>}
        </div>
      </section>

      {/* ── 声明列表 ── */}
      <div className="px-8 pt-6 pb-10">
        {sections.map(({ section, claims: groupClaims }) => (
          <div key={section} className="mb-8">
            <div className="flex items-center gap-3 mb-4">
              <h2 className="m-0 text-[14px] font-bold text-[#1a2024] shrink-0">{section}</h2>
              <span className="h-px flex-1 bg-line" />
              <span className="text-faint text-[10px] shrink-0">{groupClaims.length} 条声明</span>
            </div>

            <div className="flex flex-col gap-3">
              {groupClaims.map(({ claim, index }: ClaimEntry) => {
                const risk = claimRisk(claim.askLikelihood, claim.evidenceStrength)
                const isActive = index === selectedIndex
                const expectedQuestions = claim.evidenceGaps.length + claim.evaluationPoints.length

                return (
                  <article
                    key={index}
                    className={`rounded-lg border bg-white transition-colors cursor-pointer ${isActive ? 'border-brand ring-1 ring-brand/20' : 'border-line hover:border-line-strong'}`}
                    onClick={() => onSelect(index)}
                  >
                    {/* 收拢态 */}
                    <div className="flex items-center gap-3 px-4 py-3.5">
                      <span className="text-[16px] flex-none">{RISK_EMOJI[risk.color]}</span>
                      <span className={`rounded px-1.5 py-px text-[10px] font-650 flex-none ${RISK_BADGE[risk.color]}`}>{risk.label}</span>

                      <div className="flex min-w-0 flex-1 flex-col">
                        <strong className="text-[13px] font-650 text-[#30373c]">"{claim.quote}"</strong>
                        {!isActive && (
                          <div className="mt-1.5 flex items-center gap-3 text-[10px]">
                            <span className="text-muted truncate">
                              原因：{claim.evidenceGaps.slice(0, 2).join('、')}{claim.evidenceGaps.length > 2 ? ` 等${claim.evidenceGaps.length}项` : ''}
                            </span>
                            <span className="text-faint">|</span>
                            <span className="text-brand font-600 shrink-0">预估追问 {expectedQuestions} 个</span>
                          </div>
                        )}
                      </div>

                      <div className="flex items-center gap-3 flex-none">
                        <span className="text-faint text-[10px]">{CLAIM_CATEGORY_LABELS[claim.category]}</span>
                        <ChevronDown size={14} className={`text-muted transition-transform duration-200 ${isActive ? 'rotate-180' : ''}`} />
                      </div>
                    </div>

                    {/* 展开详情 */}
                    {isActive && (
                      <div className="border-t border-line px-4 pb-4 pt-3">
                        {/* 原因 */}
                        <div className="mb-4">
                          <div className="flex items-center gap-1.5 mb-2 text-[10px] font-700 text-[#465057]">
                            <CircleHelp size={12} className="text-amber" />为什么是{risk.label}
                          </div>
                          <div className="flex flex-col gap-1">
                            {claim.evidenceGaps.length === 0 ? (
                              <p className="m-0 text-muted text-[11px]">简历中已提供较充分的证据。</p>
                            ) : (
                              claim.evidenceGaps.map((gap: string) => (
                                <p key={gap} className="m-0 text-muted text-[11px] leading-[1.6]">· {gap}</p>
                              ))
                            )}
                          </div>
                        </div>

                        {/* 首轮追问 */}
                        <div className="mb-4">
                          <div className="flex items-center gap-1.5 mb-1 text-[10px] font-700 text-[#465057]">
                            <MessageSquareText size={12} className="text-brand" />首轮追问
                          </div>
                          <p className="m-0 text-[13px] font-650 text-[#2d353a] leading-[1.5]">{claim.initialQuestion}</p>
                        </div>

                        {/* 评估要点 */}
                        <div className="mb-4">
                          <div className="flex items-center gap-1.5 mb-1 text-[10px] font-700 text-[#465057]">
                            <BookOpenCheck size={12} className="text-green" />需覆盖 {claim.evaluationPoints.length} 个要点
                          </div>
                          <div className="flex flex-wrap gap-1.5">
                            {claim.evaluationPoints.map((point: string) => (
                              <span key={point} className="rounded bg-[#eef1f3] px-2 py-1 text-[10px] text-[#526069]">{point}</span>
                            ))}
                          </div>
                        </div>

                        {/* 预估追问 */}
                        <div className="flex items-center gap-2 rounded-md bg-brand-soft px-3 py-2 mb-4">
                          <Flame size={14} className="text-brand" />
                          <span className="text-[11px] text-brand">
                            <strong className="font-700">预计 {expectedQuestions} 轮追问</strong>
                            <span className="ml-1 text-[10px]">· {claim.evidenceGaps.length} 证据缺口 + {claim.evaluationPoints.length} 评估要点</span>
                          </span>
                        </div>

                        {/* 操作 */}
                        <div className="flex items-center gap-2">
                          <Button variant="primary" size="large" className="h-[34px]" onClick={(e) => { e.stopPropagation(); onStartInterview() }}><MessageSquareText size={14} />开始追问</Button>
                          <Button variant="secondary" className="h-[34px]" onClick={(e) => { e.stopPropagation(); onReport() }}><ClipboardList size={13} />会话报告</Button>
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
