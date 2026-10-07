import { describe, expect, it } from 'vitest'
import { mergeCoveredPoints, shouldFinishInterview } from './interview-state'
import type { InterviewRound } from '@/domain/interview-schema'

const round = (coveredPoints: string[]): InterviewRound => ({
  action: 'answer',
  question: '问题', questionIntent: '',
  answer: '回答',
  annotation: '',
  evaluation: { score: 70, coveredPoints, missingPoints: [], answerSuggestion: '', evidenceQuotes: [] },
  nextReason: '继续确认',
})

describe('interview state', () => {
  it('accumulates covered points across rounds and preserves canonical order', () => {
    expect(mergeCoveredPoints([round(['贡献'])], ['基线'], ['基线', '贡献', '结果'])).toEqual(['基线', '贡献'])
  })

  it('does not allow the model to end before three rounds', () => {
    expect(shouldFinishInterview(1, true, ['基线'], ['基线'])).toBe(false)
    expect(shouldFinishInterview(3, true, ['基线'], ['基线'])).toBe(true)
    expect(shouldFinishInterview(3, true, [], ['基线'])).toBe(false)
  })

  it('ends at five rounds even when the model keeps asking', () => {
    expect(shouldFinishInterview(5, false, [], ['基线'])).toBe(true)
  })
})
