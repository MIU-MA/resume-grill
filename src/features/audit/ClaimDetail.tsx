import { ArrowRight, Check } from 'lucide-react'
import { type ResumeClaim, MASTERY_DIMENSION_LABELS, type TestPriority } from '@/domain/resume-schema'
import { Button } from '@/components/ui/Button'
import type { ClaimProgress } from '@/lib/risk'
import type { InterviewSession } from '@/domain/interview-schema'

type ClaimDetailProps = {
  claim: ResumeClaim
  priority: TestPriority
  prepared: boolean
  mastery: number | null
  onReport: () => void
  onTogglePrepared: () => void
  onStartInterview: () => void
  progress?: ClaimProgress
  historySessions?: InterviewSession[]
  onSetPriority?: (priority: TestPriority) => void
}

export function ClaimDetail({ claim, priority, prepared, mastery, onReport, onTogglePrepared, onStartInterview, progress, onSetPriority }: ClaimDetailProps) {
  return <div className="preparation-detail">
    <div className="preparation-scroll">
      <header className="preparation-heading">
        <div><p className="workbench-eyebrow">当前练习主题</p><h2>{claim.capability}</h2></div>
        <label className="preparation-priority">练习顺序<select value={priority} onChange={event => onSetPriority?.(event.target.value as TestPriority)}>
          <option value="high">重点练习</option><option value="medium">建议练习</option><option value="low">有空再练</option>
        </select></label>
      </header>
      <section className="resume-excerpt" aria-label="简历原文">
        <span className="workbench-eyebrow">简历原文</span><p>{claim.content}</p>
      </section>
      <div className="preparation-columns">
        <section className="preparation-points">
          <header className="detail-section-heading"><h3>回答时需要讲清</h3><span>{claim.masteryPoints.length} 个要点</span></header>
          <ol className="preparation-point-list">
            {claim.masteryPoints.map((point, index) => <li key={point.point}>
              <span className="point-number">{String(index + 1).padStart(2, '0')}</span>
              <div><p>{point.point}</p><span>{MASTERY_DIMENSION_LABELS[point.dimension]}</span></div>
            </li>)}
          </ol>
        </section>
        <aside className="preparation-notes">
          <h3>容易卡住的地方</h3>
          {claim.trapPoints.length ? <ul>{claim.trapPoints.map(trap => <li key={trap}>{trap}</li>)}</ul> : <p>暂无补充提醒。</p>}
          {mastery !== null && <div className="preparation-last-result"><span className="workbench-eyebrow">上次练习</span><p><strong>{mastery}</strong><span> / 5</span></p>{progress && <p>已覆盖 {progress.covered} / {progress.total} 个要点</p>}<button onClick={onReport}>查看复盘 ↗</button></div>}
        </aside>
      </div>
    </div>
    <footer className="preparation-actions">
      <span className="preparation-state"><span className={prepared ? 'is-ready' : ''} />{prepared ? '已准备，可以开始练习' : '准备好后，进入问答练习'}</span>
      <div><Button variant="secondary" onClick={onTogglePrepared} aria-pressed={prepared}>{prepared && <Check size={14} />}{prepared ? '已准备' : '标记已准备'}</Button><Button onClick={onStartInterview}>进入面试<ArrowRight size={14} /></Button></div>
    </footer>
  </div>
}
