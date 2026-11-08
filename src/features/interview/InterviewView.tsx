import { useEffect, useRef, type Dispatch, type SetStateAction } from 'react'
import type { ResumeClaim } from '@/domain/resume-schema'
import type { InterviewTurn } from '@/features/interview/interview-view-types'
import { CurrentQuestion } from '@/features/interview/CurrentQuestion'
import { InterviewComposer } from '@/features/interview/InterviewComposer'
import { InterviewHeader } from '@/features/interview/InterviewHeader'
import { InterviewHistory } from '@/features/interview/InterviewHistory'
import { resumeContentKey } from '@/lib/storage'

type InterviewViewProps = {
  scope?: string
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
  onRetry?: (index: number, answer: string) => Promise<void>
  onStyleChange?: (style: 'standard' | 'probing' | 'supportive') => void
  style?: 'standard' | 'probing' | 'supportive'
}

export function InterviewView({
  scope = 'local',
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
  onRetry,
  onStyleChange,
  style = 'standard',
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
    <main className="flex h-full min-h-0 w-full min-w-0 overflow-hidden bg-surface min-[1200px]:border-r min-[1200px]:border-line">
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

        <div className="flex-1 overflow-y-auto px-4 py-5 sm:px-6 sm:py-6">
          {onStyleChange && <label className="mb-3 flex items-center gap-3 text-label">面试官风格<select disabled={loading || done} value={style} onChange={event => onStyleChange(event.target.value as 'standard' | 'probing' | 'supportive')}><option value="standard">自然提问</option><option value="probing">深入追问</option><option value="supportive">引导解释</option></select></label>}
          <div className="mx-auto max-w-[clamp(720px,44vw,940px)]">
            {error && (
              <div className="rounded-lg border border-danger/20 bg-danger-soft px-4 py-3 mb-6 text-body text-danger">{error}</div>
            )}

            <InterviewHistory turns={turns} strictMode={strictMode} loading={loading} onRetry={onRetry} scope={`${scope}:${selected.id}:${version}:${resumeContentKey(selected.content)}`} />

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
          scope={`${scope}:${selected.id}:${version}:${resumeContentKey(currentQuestion ?? '')}`}
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
