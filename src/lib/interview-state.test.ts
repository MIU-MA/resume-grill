import { describe, expect, it } from 'vitest'
import { canonicalizeVerifyPoints, mergeCoveredPoints, shouldFinishInterview } from './interview-state'
import type { InterviewRound } from '@/domain/interview-schema'

const round = (coveredPoints: string[]): InterviewRound => ({
  question: '问题',
  answer: '回答',
  annotation: '',
  evaluation: { score: 70, coveredPoints, missingPoints: [], answerSuggestion: '' },
  nextReason: '继续确认',
})

describe('interview state', () => {
  it('keeps model importance but uses the claim points as the canonical text', () => {
    expect(canonicalizeVerifyPoints(
      ['说明个人贡献', '说明结果'],
      [{ point: '个人贡献是什么', importance: 'high' }],
    )).toEqual([
      { point: '说明个人贡献', importance: 'high' },
      { point: '说明结果', importance: 'medium' },
    ])
  })

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
