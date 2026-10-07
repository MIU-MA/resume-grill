import { describe, expect, it } from 'vitest'
import type { InterviewSession } from '@/domain/interview-schema'
import { getInterviewEntry } from './interview-entry'

const idle = { activeClaimSnapshot: null, currentQuestion: '', done: false }
const session = (version: number, status: InterviewSession['status'] = 'in_progress'): InterviewSession => ({
  id: `claim:v${version}`,
  claimContent: '负责订单系统',
  rounds: [],
  claimAnalysis: null,
  finalResult: null,
  status,
  version,
  pendingQuestion: '如何处理重复订单？',
})

describe('entering an interview', () => {
  it('keeps the live session instead of restoring over an unsent answer', () => {
    expect(getInterviewEntry('claim', [session(1)], {
      activeClaimSnapshot: { id: 'claim' }, currentQuestion: '正在回答的问题', done: false,
    })).toEqual({ action: 'continue' })
  })

  it('restores the newest unfinished version without changing the history order', () => {
    const history = [session(2), session(1), session(3, 'done')]
    expect(getInterviewEntry('claim', history, idle)).toEqual({ action: 'restore', session: history[0] })
    expect(history.map(item => item.version)).toEqual([2, 1, 3])
  })

  it('does not continue a different claim or a completed live session', () => {
    const saved = session(2)
    expect(getInterviewEntry('claim', [saved], {
      activeClaimSnapshot: { id: 'another' }, currentQuestion: '另一项内容的问题', done: false,
    })).toEqual({ action: 'restore', session: saved })
    expect(getInterviewEntry('claim', [session(2, 'done')], {
      activeClaimSnapshot: { id: 'claim' }, currentQuestion: '最后一问', done: true,
    })).toEqual({ action: 'start', version: 3 })
  })

  it('starts the first version for a new claim and uses the highest version for a retake', () => {
    expect(getInterviewEntry('claim', [], idle)).toEqual({ action: 'start', version: 1 })
    expect(getInterviewEntry('claim', [session(4, 'done'), session(1, 'done')], idle))
      .toEqual({ action: 'start', version: 5 })
  })
})
