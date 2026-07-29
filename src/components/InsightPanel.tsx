import { AlertTriangle, ArrowRight, BarChart3, BookOpenCheck, Check, GitBranch, MessageSquareText, Target } from 'lucide-react'
import { CLAIM_CATEGORY_LABELS, type ResumeClaim } from '@/domain/resume-schema'
import type { Mode } from '@/types'
import { verifiabilityToRisk } from '@/lib/risk'

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

export function InsightPanel({
  mode,
  selected,
  currentQuestion,
  covered,
  missing,
  turnCount,
  onStartInterview,
}: InsightPanelProps) {
  const risk = verifiabilityToRisk(selected.verifiability)

  return (
    <aside className="insight-panel">
      <div className="insight-heading"><BarChart3 size={15} /><strong>{mode === 'audit' ? '风险依据' : '本轮状态'}</strong></div>
      {mode === 'audit' ? (
        <>
          <section className="confidence-block">
            <span>可验证难度</span>
            <div className="confidence-value"><strong>{selected.verifiability}%</strong><small>{risk.label}</small></div>
            <div className="meter"><i style={{ width: `${selected.verifiability}%` }} /></div>
          </section>

          <section className="evidence-section">
            <h3><Check size={13} />已有证据</h3>
            {selected.evidence.length === 0 ? <p>简历中未提供明确证据</p> : selected.evidence.map((item) => <p key={item}>{item}</p>)}
          </section>

          <section className="evidence-section gaps">
            <h3><AlertTriangle size={13} />容易被追问</h3>
            {selected.evidenceGaps.map((item) => <p key={item}>{item}</p>)}
          </section>

          <section className="evidence-section">
            <h3><BookOpenCheck size={13} />评估要点</h3>
            {selected.evaluationPoints.map((point) => <p key={point}>{point}</p>)}
          </section>

          <button type="button" className="start-interview" onClick={onStartInterview}>
            <span><MessageSquareText size={16} /><b>开始模拟拷打</b></span>
            <small>从首轮追问开始，回答后继续动态追问</small>
            <ArrowRight size={16} />
          </button>

          <a className="repo-link" href="https://github.com/MIU-MA" target="_blank" rel="noreferrer"><GitBranch size={14} />关联 GitHub 证据 <ArrowRight size={13} /></a>
        </>
      ) : (
        <>
          <section className="interview-status">
            <span className="status-orbit"><MessageSquareText size={19} /></span>
            <strong>{selected.title}</strong>
            <p>当前正在进行第 {turnCount + 1} 层追问 · {CLAIM_CATEGORY_LABELS[selected.category]}</p>
          </section>
          <section className="evidence-section">
            <h3><Target size={13} />面试官关注点</h3>
            <p>{currentQuestion?.intent ?? '准备开始追问…'}</p>
          </section>
          <section className="keyword-section">
            <h3>评估要点覆盖</h3>
            <div>
              {selected.evaluationPoints.map((point) => (
                <span key={point} className={covered.includes(point) ? 'tag-covered' : ''}>{point}</span>
              ))}
            </div>
          </section>
          {missing.length > 0 && (
            <section className="evidence-section gaps">
              <h3><AlertTriangle size={13} />建议补充</h3>
              {missing.map((item) => <p key={item}>{item}</p>)}
            </section>
          )}
          <section className="interview-tip">
            <strong>回答建议</strong>
            <p>不要只解释概念。按“为什么选择 &rarr; 如何实现 &rarr; 遇到什么异常 &rarr; 怎样验证”的顺序回答。</p>
          </section>
        </>
      )}
    </aside>
  )
}
