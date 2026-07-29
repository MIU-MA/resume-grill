import { AlertTriangle, ArrowLeft, ArrowRight, Check, CircleHelp, Loader2, MessageSquareText, Sparkles } from 'lucide-react'
import type { ResumeClaim } from '@/domain/resume-schema'
import type { InterviewTurn } from '@/domain/interview-schema'

type CurrentQuestion = { question: string; intent: string }

type InterviewViewProps = {
  selected: ResumeClaim
  turns: InterviewTurn[]
  currentQuestion: CurrentQuestion | null
  covered: string[]
  missing: string[]
  answer: string
  loading: boolean
  done: boolean
  showHint: boolean
  onAnswerChange: (value: string) => void
  onToggleHint: () => void
  onSubmit: () => void
  onFinish: () => void
  onBackToAudit: () => void
}

export function InterviewView({
  selected,
  turns,
  currentQuestion,
  covered,
  missing,
  answer,
  loading,
  done,
  showHint,
  onAnswerChange,
  onToggleHint,
  onSubmit,
  onFinish,
  onBackToAudit,
}: InterviewViewProps) {
  const totalPoints = selected.evaluationPoints.length
  const coverage = totalPoints > 0 ? Math.round((covered.length / totalPoints) * 100) : 0
  const roundLabel = done ? `已完成 ${turns.length} 轮` : `第 ${turns.length + 1} 轮`

  return (
    <main className="interview-main">
      <div className="interview-topline">
        <button type="button" onClick={onBackToAudit}><ArrowLeft size={15} />返回风险报告</button>
        <span>模拟追问 · {roundLabel}</span>
      </div>
      <div className="progress-track"><span style={{ width: `${coverage}%` }} /></div>

      <div className="interview-stage">
        <div className="interviewer-label"><MessageSquareText size={14} />技术面试官 · 动态追问</div>
        {currentQuestion && (
          <>
            <h1>{currentQuestion.question}</h1>
            <p className="interview-intent">这道题在验证：{currentQuestion.intent}</p>
          </>
        )}

        <label className="answer-box">
          <span>你的回答</span>
          <textarea
            value={answer}
            onChange={(event) => onAnswerChange(event.target.value)}
            disabled={loading || done}
            placeholder="按真实面试的方式回答。先说结论，再结合项目说明取舍和实现细节…"
          />
          <small>{answer.length} 字</small>
        </label>

        {!done ? (
          <div className="answer-actions">
            <button type="button" className="button secondary" onClick={onToggleHint}><CircleHelp size={14} />{showHint ? '隐藏提示' : '查看提示'}</button>
            <button type="button" className="button primary large" disabled={answer.trim().length < 8 || loading} onClick={onSubmit}>
              {loading ? <Loader2 size={15} className="spin" /> : null}
              {loading ? '生成下一问…' : '提交回答'}
              {!loading && <ArrowRight size={15} />}
            </button>
          </div>
        ) : (
          <div className="answer-actions end">
            <span>本轮追问已完成</span>
            <button type="button" className="button primary large" onClick={onFinish}>完成本轮<ArrowRight size={15} /></button>
          </div>
        )}

        {showHint && !done && (
          <div className="hint-panel"><Sparkles size={15} /><div><strong>回答应覆盖</strong><p>{selected.evaluationPoints.join('、')}</p></div></div>
        )}

        {(turns.length > 0 || done) && (
          <section className="evaluation">
            <div className="evaluation-score"><strong>{covered.length}</strong><span>/ {totalPoints} 要点</span><small>已覆盖 {coverage}%</small></div>
            <div className="evaluation-points">
              <h3>回答命中</h3>
              {covered.length === 0 && <p className="missing">暂无命中要点，继续回答试试。</p>}
              {covered.map((point) => <p className="matched" key={point}><Check size={13} />{point}</p>)}
              {missing.length > 0 && <h3>建议补充</h3>}
              {missing.map((point) => <p className="missing" key={point}><AlertTriangle size={13} />{point}</p>)}
            </div>
          </section>
        )}
      </div>
    </main>
  )
}
