import type { InterviewAction } from '@/domain/interview-schema'

export type InterviewTurn = {
  score?: number
  previousAttempts?: Array<{ answer: string; annotation: string; score: number; feedback: string }>
  action: InterviewAction
  question: string
  answer: string
  annotation?: string
  answerSuggestion?: string
  intent?: string
  evidenceQuotes?: string[]
}
