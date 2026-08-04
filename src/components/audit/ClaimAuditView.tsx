import { type ResumeAnalysis } from '@/domain/resume-schema'
import { ClaimList } from '@/components/audit/ClaimList'
import { ClaimDetail } from '@/components/audit/ClaimDetail'

type AuditViewProps = {
  analysis: ResumeAnalysis
  selectedIndex: number
  preparedClaimIds: string[]
  error: string | null
  onSelect: (index: number) => void
  onTogglePrepared: (claimId: string) => void
  onStartInterview: () => void
  onReport: () => void
}

export function ClaimAuditView({ analysis, selectedIndex, preparedClaimIds, error, onSelect, onTogglePrepared, onStartInterview }: AuditViewProps) {
  const selected = analysis.claims[selectedIndex]

  return (
    <div className="grid grid-cols-[380px_minmax(0,1fr)] gap-4 items-start max-[1050px]:grid-cols-[330px_minmax(0,1fr)] max-[760px]:grid-cols-1">
      {error && (
        <div className="col-span-full bg-danger-soft border border-danger/20 rounded-xl px-5 py-3 text-[14px] text-danger">{error}</div>
      )}
      <aside className="bg-white border border-border rounded-xl shadow-[0_1px_3px_rgba(16,24,40,0.04)] overflow-hidden max-h-[650px]">
        <ClaimList analysis={analysis} selectedIndex={selectedIndex} preparedClaimIds={preparedClaimIds} onSelect={onSelect} />
      </aside>
      <article className="bg-white border border-border rounded-xl shadow-[0_1px_3px_rgba(16,24,40,0.04)] overflow-hidden">
        <ClaimDetail claim={selected} prepared={preparedClaimIds.includes(selected.id)} onTogglePrepared={() => onTogglePrepared(selected.id)} onStartInterview={onStartInterview} />
      </article>
    </div>
  )
}
