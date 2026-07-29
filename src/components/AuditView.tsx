import { useState } from 'react'
import { ArrowRight, BookOpenCheck, ChevronDown, CircleHelp, ClipboardList, Code2, Flame, MessageSquareText } from 'lucide-react'
import { CLAIM_CATEGORY_LABELS, type ClaimCategory, type ResumeAnalysis, type ResumeClaim } from '@/domain/resume-schema'
import { claimRisk, type AuditStats } from '@/lib/risk'

const CATEGORY_BLURB: Record<ClaimCategory, string> = {
  skill: '技能声明需要说明使用场景与深度，而非罗列名词。',
  responsibility: '职责声明要区分“负责”的具体决策范围与边界。',
  achievement: '成果声明通常需要量化基线、统计口径与个人贡献。',
  scale: '规模声明要说明统计方式、周期与可比基准。',
  ability: '能力声明需要可复述的具体案例，而非形容词。',
  honor: '荣誉声明要说明级别、含金量与个人贡献。',
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
    <main className="audit-main">
      <section className="summary-strip">
        <div><span>被追问概率(均)</span><strong className="metric-danger">{stats.avgAskLikelihood}</strong><small>/ 100</small></div>
        <div><span>简历声明</span><strong>{stats.claimCount}</strong><small>条</small></div>
        <div><span>薄弱声明</span><strong>{stats.weakClaimCount}</strong><small>条</small></div>
        <div><span>待补证据</span><strong>{stats.totalGaps}</strong><small>处</small></div>
      </section>

      <section className="claim-header">
        <div className="eyebrow"><Code2 size={13} />{CLAIM_CATEGORY_LABELS[selected.category]} · {selected.role}</div>
        <div className="claim-title-row">
          <div>
            <h1>{selected.title}</h1>
            <p>{CATEGORY_BLURB[selected.category]}</p>
          </div>
          <div className={`risk-badge ${risk.color}`}>
            <Flame size={14} />{risk.label} · {selected.askLikelihood}
          </div>
        </div>
        <blockquote>
          <span>简历原文</span>
          “{selected.quote}”
        </blockquote>
      </section>

      <section className="question-section">
        <div className="section-title">
          <div>
            <h2>首轮追问</h2>
            <p>后续问题会在模拟面试中根据你的回答动态生成，而非随机抽取。</p>
          </div>
          <span>动态追问</span>
        </div>
        <div className="question-ladder">
          <article className={`question-row ${expanded ? 'expanded' : ''}`}>
            <button type="button" onClick={() => setExpanded((v) => !v)}>
              <span className="level-index">1</span>
              <span className="question-copy"><small>首轮追问</small><strong>{selected.initialQuestion}</strong></span>
              <ChevronDown size={16} className={expanded ? 'rotate' : ''} />
            </button>
            {expanded && (
              <div className="question-detail">
                <div><CircleHelp size={14} /><p><span>考察意图</span>验证这条声明是否经得起追问。</p></div>
                <div><BookOpenCheck size={14} /><p><span>回答应覆盖</span>{selected.evaluationPoints.join('；')}</p></div>
              </div>
            )}
          </article>
        </div>
      </section>

      <button type="button" className="start-interview mobile-start-interview" onClick={onStartInterview}>
        <span><MessageSquareText size={16} /><b>开始模拟拷打</b></span>
        <small>从首轮追问开始，回答后继续动态追问</small>
        <ArrowRight size={16} />
      </button>

      <button type="button" className="button secondary report-entry" onClick={onReport}>
        <ClipboardList size={14} />查看会话报告与改写建议
      </button>

      <p className="audit-summary">{analysis.summary}</p>
    </main>
  )
}
