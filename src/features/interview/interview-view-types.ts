import type { InterviewAction } from '@/domain/interview-schema'

export type InterviewTurn = {
  action: InterviewAction
  question: string
  answer: string
  annotation?: string
  answerSuggestion?: string
  intent?: string
  evidenceQuotes?: string[]
}
