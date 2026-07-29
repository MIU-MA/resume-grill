import { ShieldAlert } from 'lucide-react'
import { CLAIM_CATEGORY_LABELS, type ResumeAnalysis } from '@/domain/resume-schema'
import { claimRisk } from '@/lib/risk'

type ClaimSidebarProps = {
  analysis: ResumeAnalysis
  selectedIndex: number
  onSelect: (index: number) => void
}

export function ClaimSidebar({ analysis, selectedIndex, onSelect }: ClaimSidebarProps) {
  return (
    <aside className="claim-sidebar">
      <div className="candidate">
        <div className="candidate-avatar">{analysis.candidate.slice(0, 2)}</div>
        <div>
          <strong>{analysis.candidate}</strong>
          <span>{analysis.role}</span>
        </div>
      </div>

      <div className="sidebar-heading">
        <span>简历声明</span>
        <b>{analysis.claims.length}</b>
      </div>
      <div className="claim-list">
        {analysis.claims.map((claim, index) => {
          const risk = claimRisk(claim.askLikelihood, claim.evidenceStrength)
          return (
            <button key={index} type="button" className={`claim-item ${selectedIndex === index ? 'active' : ''}`} onClick={() => onSelect(index)}>
              <span className={`risk-dot ${risk.color}`} />
              <span className="claim-item-copy">
                <small>{CLAIM_CATEGORY_LABELS[claim.category]}</small>
                <strong>{claim.title}</strong>
              </span>
              <span className={`claim-score ${risk.color}`}>{claim.askLikelihood}</span>
            </button>
          )
        })}
      </div>

      <div className="sidebar-foot">
        <ShieldAlert size={15} />
        <p><strong>评分不是能力结论</strong><br />它表示这句话在面试中被继续追问的概率。</p>
      </div>
    </aside>
  )
}
