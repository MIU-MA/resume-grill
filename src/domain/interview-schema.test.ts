import { describe, expect, it } from 'vitest'
import { interviewRoundSchema } from './interview-schema'

const evaluation = { score: 0, coveredPoints: [], missingPoints: [], answerSuggestion: '' }

describe('interviewRoundSchema', () => {
  it('keeps old saved rounds compatible by defaulting to answer', () => {
    const round = interviewRoundSchema.parse({
      question: '问题', answer: '回答', annotation: '', evaluation, nextReason: '继续',
    })
    expect(round.action).toBe('answer')
  })

  it('preserves skipped rounds as a separate action', () => {
    const round = interviewRoundSchema.parse({
      action: 'skip', question: '问题', answer: '', annotation: '', evaluation, nextReason: '换一个问题',
    })
    expect(round.action).toBe('skip')
  })
})
