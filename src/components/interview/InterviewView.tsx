import { useEffect, useRef, type Dispatch, type SetStateAction } from 'react'
import type { ResumeClaim } from '@/domain/resume-schema'
import type { InterviewTurn } from '@/components/interview/interview-view-types'
import { CurrentQuestion } from '@/components/interview/CurrentQuestion'
import { InterviewComposer } from '@/components/interview/InterviewComposer'
import { InterviewHeader } from '@/components/interview/InterviewHeader'
import { InterviewHistory } from '@/components/interview/InterviewHistory'

type InterviewViewProps = {
  selected: ResumeClaim
  turns: InterviewTurn[]
  currentQuestion: string | null
  currentIntent: string | null
  covered: string[]
  answer: string
  annotation: string
  loading: boolean
  done: boolean
  version: number
  error: string | null
  strictMode: boolean
  onToggleStrict: () => void
  statusOpen: boolean
  onToggleStatus: () => void
  onAnswerChange: Dispatch<SetStateAction<string>>
  onAnnotationChange: (value: string) => void
  onSubmit: () => void
  onSkip: () => void
  onFinish: () => void
  onBackToAudit: () => void
}

export function InterviewView({
  selected,
  turns,
  currentQuestion,
  currentIntent,
  covered,
  answer,
  annotation,
  loading,
  done,
  version,
  error,
  strictMode,
  onToggleStrict,
  statusOpen,
  onToggleStatus,
  onAnswerChange,
  onAnnotationChange,
  onSubmit,
  onSkip,
  onFinish,
  onBackToAudit,
}: InterviewViewProps) {
  const chatEndRef = useRef<HTMLDivElement>(null)
  const currentQuestionRef = useRef<HTMLDivElement>(null)
  const totalPoints = selected.masteryPoints.length
  const coverage = totalPoints > 0 ? Math.round((covered.length / totalPoints) * 100) : 0
  const answeredTurnCount = turns.filter((turn) => turn.action === 'answer').length

  const prevQuestionRef = useRef(currentQuestion)
  useEffect(() => {
    if (currentQuestion && currentQuestion !== prevQuestionRef.current) {
      currentQuestionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
    prevQuestionRef.current = currentQuestion
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [currentQuestion, turns.length])

  return (
    <main className="flex h-full min-h-0 w-full min-w-0 overflow-hidden border-r border-line bg-white">
      {/* 主面试区 */}
      <div className="flex-1 flex flex-col min-w-0">
        <InterviewHeader
          title={selected.title}
          version={version}
          roundNumber={answeredTurnCount + 1}
          coveredCount={covered.length}
          totalCount={totalPoints}
          coveragePercent={coverage}
          strictMode={strictMode}
          statusOpen={statusOpen}
          onBack={onBackToAudit}
          onToggleStrict={onToggleStrict}
          onToggleStatus={onToggleStatus}
        />

        <div className="flex-1 overflow-y-auto px-6 py-6">
          <div className="mx-auto max-w-[680px]">
            {error && (
              <div className="rounded-lg border border-danger/20 bg-danger-soft px-4 py-3 mb-6 text-[14px] text-danger">{error}</div>
            )}

            <InterviewHistory turns={turns} strictMode={strictMode} />

            <CurrentQuestion
              question={currentQuestion}
              intent={currentIntent}
              done={done}
              strictMode={strictMode}
              coveredCount={covered.length}
              totalCount={totalPoints}
              coveragePercent={coverage}
              sectionRef={currentQuestionRef}
            />

            <div ref={chatEndRef} />
          </div>
        </div>

        <InterviewComposer
          answer={answer}
          annotation={annotation}
          loading={loading}
          done={done}
          onAnswerChange={onAnswerChange}
          onAnnotationChange={onAnnotationChange}
          onSubmit={onSubmit}
          onSkip={onSkip}
          onFinish={onFinish}
        />
      </div>
    </main>
  )
}
