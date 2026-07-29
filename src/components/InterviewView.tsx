import { AlertTriangle, ArrowLeft, ArrowRight, Check, CircleHelp, Loader2, MessageSquareText, Sparkles } from 'lucide-react'
import type { ResumeClaim } from '@/domain/resume-schema'
import type { InterviewTurn } from '@/domain/interview-schema'
import { Button } from '@/components/Button'

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
    <main className="min-w-0 bg-canvas min-h-[calc(100vh-58px)]">
      <div className="flex h-[46px] items-center justify-between bg-white px-6 border-b border-line">
        <button type="button" className="flex items-center gap-[6px] bg-transparent text-muted text-[9px] hover:text-ink" onClick={onBackToAudit}><ArrowLeft size={15} />返回风险报告</button>
        <span className="text-muted font-mono text-[9px] font-600">模拟追问 · {roundLabel}</span>
      </div>
      <div className="h-[3px] bg-[#e4e8ea]"><span className="block h-full bg-brand transition-[width] duration-300" style={{ width: `${coverage}%` }} /></div>

      <div className="mx-auto max-w-[760px] px-[38px] pt-[54px] pb-[70px] max-md1:px-[18px] max-md1:pt-[34px] max-md1:pb-[50px]">
        <div className="flex items-center gap-[6px] text-brand text-[9px] font-750 uppercase"><MessageSquareText size={14} />面试官 · 动态追问</div>
        {currentQuestion && (
          <>
            <h1 className="mt-3 mb-[9px] max-w-[700px] text-[24px] leading-[1.45] text-[#172026] max-md1:text-[20px]">{currentQuestion.question}</h1>
            <p className="m-0 text-muted text-[10px]">这道题在验证：{currentQuestion.intent}</p>
          </>
        )}

        <label className="mt-[29px] block">
          <span className="mb-[7px] block text-[9px] font-750 text-[#404a50]">你的回答</span>
          <textarea
            className="w-full min-h-[178px] resize-y rounded-md border border-line-strong bg-white px-[15px] pt-[14px] pb-[30px] text-[11px] leading-[1.7] text-[#283136] disabled:bg-[#f8f9fa]"
            value={answer}
            onChange={(event) => onAnswerChange(event.target.value)}
            disabled={loading || done}
            placeholder="按真实面试的方式回答。先说结论，再结合项目说明取舍和实现细节…"
          />
          <small className="relative float-right -mt-[26px] mr-3 text-faint text-[8px]">{answer.length} 字</small>
        </label>

        {!done ? (
          <div className="mt-3 flex items-center justify-between">
            <Button variant="secondary" onClick={onToggleHint}><CircleHelp size={14} />{showHint ? '隐藏提示' : '查看提示'}</Button>
            <Button variant="primary" size="large" disabled={answer.trim().length < 8 || loading} onClick={onSubmit}>
              {loading ? <Loader2 size={15} className="animate-spin" /> : null}
              {loading ? '生成下一问…' : '提交回答'}
              {!loading && <ArrowRight size={15} />}
            </Button>
          </div>
        ) : (
          <div className="mt-3 flex items-center justify-end gap-3">
            <span className="text-green text-[9px]">本轮追问已完成</span>
            <Button variant="primary" size="large" onClick={onFinish}>完成本轮<ArrowRight size={15} /></Button>
          </div>
        )}

        {showHint && !done && (
          <div className="mt-[14px] flex gap-[10px] rounded-[5px] border border-[#ead5ae] bg-amber-soft p-3 text-[#72521e]">
            <Sparkles size={15} className="flex-none" />
            <div><strong className="block text-[9px]">回答应覆盖</strong><p className="m-0 mt-1 text-[9px]">{selected.evaluationPoints.join('、')}</p></div>
          </div>
        )}

        {(turns.length > 0 || done) && (
          <section className="mt-5 grid grid-cols-[122px_1fr] rounded-md border border-line bg-white max-md1:grid-cols-1">
            <div className="flex min-h-[170px] flex-col items-center justify-center border-r border-line max-md1:min-h-[110px] max-md1:border-r-0 max-md1:border-b">
              <strong className="text-brand text-[34px] leading-none">{covered.length}</strong>
              <span className="text-faint text-[9px]">/ {totalPoints} 要点</span>
              <small className="mt-[10px] rounded bg-brand-soft px-[7px] py-[3px] text-brand text-[8px]">已覆盖 {coverage}%</small>
            </div>
            <div className="p-4 px-[18px]">
              <h3 className="m-0 mb-[7px] text-[9px] text-[#4e585e]">回答命中</h3>
              {covered.length === 0 && <p className="text-amber text-[9px]">暂无命中要点，继续回答试试。</p>}
              {covered.map((point) => <p className="flex items-start gap-[7px] my-[6px] text-muted text-[9px] leading-[1.45]" key={point}><Check size={13} className="mt-px flex-none text-green" />{point}</p>)}
              {missing.length > 0 && <h3 className="mt-3 mb-[7px] text-[9px] text-[#4e585e]">建议补充</h3>}
              {missing.map((point) => <p className="flex items-start gap-[7px] my-[6px] text-muted text-[9px] leading-[1.45]" key={point}><AlertTriangle size={13} className="mt-px flex-none text-amber" />{point}</p>)}
            </div>
          </section>
        )}
      </div>
    </main>
  )
}
