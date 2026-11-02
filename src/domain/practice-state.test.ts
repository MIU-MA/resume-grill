import { expect, it } from 'vitest'
import { practiceState } from './practice-state'
import type { InterviewSession } from './interview-schema'
const idle = { activeClaimSnapshot: null, currentQuestion: '', rounds: [], done: false }
const session = (status: InterviewSession['status']): InterviewSession => ({ id: 'claim:v1', version: 1, status, rounds: [], finalResult: null, claimAnalysis: null })
it('统一未选、待开始、进行中与已完成的主操作', () => {
  expect(practiceState(undefined, [], idle)).toEqual({ state: 'unselected', label: '选内容' })
  expect(practiceState('claim', [], idle)).toEqual({ state: 'selected', label: '开始面试' })
  expect(practiceState('claim', [session('in_progress')], idle)).toEqual({ state: 'in_progress', label: '继续第 1 轮' })
  expect(practiceState('claim', [session('done')], idle)).toEqual({ state: 'completed', label: '查看复盘' })
})
