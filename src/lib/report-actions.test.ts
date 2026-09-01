import { describe, it, expect } from 'vitest'
import { deriveTopActions } from './report-actions'
import type { ResumeAnalysis, ResumeClaim } from '@/domain/resume-schema'
import type { InterviewSession } from '@/domain/interview-schema'

const claim = (id: string, over: Partial<ResumeClaim> = {}): ResumeClaim => ({
  id,
  content: 'q',
  title: `声明 ${id}`,
  category: 'achievement',
  role: '销售',
  sourceSection: '工作经历',
  capability: '测试能力',
  masteryPoints: [{ point: 'p1', dimension: 'practice', importance: 'high' }],
  initialQuestion: 'q',
  initialIntent: '',
  trapPoints: [],
  testPriority: 'medium',
  ...over,
})

const analysis = (claims: ResumeClaim[]): ResumeAnalysis => ({
  candidate: '张三',
  role: '销售',
  sourceFile: 'a.txt',
  rawText: 'raw',
  summary: 's',
  claims,
})

const session = (id: string, opts: { score?: number; cannot?: string[]; annotation?: string } = {}): InterviewSession => ({
  id,
  claimContent: 'q',
  rounds: [{
    action: 'answer',
    question: 'q',
    questionIntent: '',
    answer: 'a',
    annotation: opts.annotation ?? '',
    evaluation: { score: 80, coveredPoints: ['p1'], missingPoints: [], answerSuggestion: '', evidenceQuotes: [] },
    nextReason: '',
  }],
  claimAnalysis: null,
  finalResult: opts.score != null ? {
    masteryScore: opts.score,
    canExplain: [],
    cannotExplain: opts.cannot ?? [],
    knowledgeGaps: [],
    answerSummary: '',
    nextAction: '',
    rewriteSuggestion: '',
  } : null,
  status: opts.score != null ? 'done' : 'in_progress',
  version: 1,
})

describe('deriveTopActions', () => {
  it('优先挑出未测试的高优先级声明，最多 2 条', () => {
    const c1 = claim('c1', { testPriority: 'high' })
    const c2 = claim('c2', { testPriority: 'high' })
    const c3 = claim('c3', { testPriority: 'high' })
    const actions = deriveTopActions(analysis([c1, c2, c3]), {}, [])
    expect(actions.length).toBe(2)
    expect(actions[0].kind).toBe('untested-high')
    expect(actions[1].kind).toBe('untested-high')
  })

  it('无未测试高优先级时，选已测试但分数最低且有未讲清的声明', () => {
    const c1 = claim('c1', { testPriority: 'high' })
    const c2 = claim('c2', { testPriority: 'low' })
    const a = analysis([c1, c2])
    const sessions = { [c1.id]: [session('s1', { score: 3, cannot: ['x'] })] }
    const actions = deriveTopActions(a, sessions, [])
    expect(actions.length).toBe(1)
    expect(actions[0].kind).toBe('weak-claim')
    expect(actions[0].claimId).toBe(c1.id)
  })

  it('存在未掌握盲区时给出一条聚合项', () => {
    const c1 = claim('c1')
    const a = analysis([c1])
    const sessions = { [c1.id]: [session('s1', { annotation: '不懂术语' })] }
    const actions = deriveTopActions(a, sessions, [])
    expect(actions[actions.length - 1].kind).toBe('blind-spot')
    expect(actions[actions.length - 1].claimId).toBeNull()
  })

  it('全部满足时不足 limit 则少给', () => {
    const actions = deriveTopActions(analysis([claim('c1')]), {}, [])
    expect(actions.length).toBe(0)
  })

  it('尊重 limit 上限', () => {
    const c1 = claim('c1', { testPriority: 'high' })
    const c2 = claim('c2', { testPriority: 'high' })
    const c3 = claim('c3', { testPriority: 'high' })
    const actions = deriveTopActions(analysis([c1, c2, c3]), {}, [], 1)
    expect(actions.length).toBe(1)
  })

  it('读取用户调整后的练习顺序', () => {
    const c1 = claim('c1', { testPriority: 'low' })
    const actions = deriveTopActions(
      analysis([c1]),
      {},
      [],
      3,
      { c1: 'high' },
    )

    expect(actions[0]).toMatchObject({
      kind: 'untested-high',
      claimId: 'c1',
    })
  })
})
