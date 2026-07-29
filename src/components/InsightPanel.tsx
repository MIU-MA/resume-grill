import { AlertTriangle, ArrowRight, BarChart3, BookOpenCheck, Check, MessageSquareText, Paperclip, Target } from 'lucide-react'
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
  const risk = claimRisk(selected.askLikelihood, selected.evidenceStrength)

  return (
    <aside className="insight-panel">
      <div className="insight-heading"><BarChart3 size={15} /><strong>{mode === 'audit' ? '风险依据' : '本轮状态'}</strong></div>
      {mode === 'audit' ? (
        <>
          <section className="confidence-block">
            <span>被追问概率</span>
            <div className="confidence-value"><strong>{selected.askLikelihood}%</strong><small>{risk.label}</small></div>
            <div className="meter"><i style={{ width: `${selected.askLikelihood}%` }} /></div>
            <span className="meter-sub">证据完整度</span>
            <div className="confidence-value"><strong>{selected.evidenceStrength}%</strong><small>{selected.evidenceStrength >= 60 ? '较充分' : '偏薄弱'}</small></div>
            <div className="meter"><i className="meter-evidence" style={{ width: `${selected.evidenceStrength}%` }} /></div>
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

          <div className="repo-link"><Paperclip size={14} /><div><strong>补充证明材料</strong><small>数据口径、复盘记录、同事或客户证言、可复现的统计方法等</small></div></div>
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
            <p>按“背景与目标 &rarr; 你的角色与关键决策 &rarr; 主要挑战 &rarr; 结果与验证”的顺序回答，给出可验证的数据或案例。</p>
          </section>
        </>
      )}
    </aside>
  )
}
