import { describe, it, expect } from 'vitest'
import {
  computeStats,
  PRIORITY_META,
  effectivePriority,
  summarizeClaimProgress,
  averageMasteryPct,
  priorityCount,
  WEAK_SCORE_THRESHOLD,
} from './risk'
import type { ResumeClaim } from '@/domain/resume-schema'
import type { InterviewRound, InterviewSession } from '@/domain/interview-schema'

const claim = (testPriority: 'high' | 'medium' | 'low', masteryCount = 3): ResumeClaim => ({
  id: `claim-${testPriority}`,
  content: 'q',
  title: 't',
  category: 'achievement',
  role: '销售',
  sourceSection: '工作经历',
  capability: '测试能力',
  masteryPoints: Array.from({ length: masteryCount }, (_, i) => ({
    point: `要点 ${i + 1}`,
    dimension: 'practice' as const,
    importance: (i === 0 ? 'high' : 'medium') as 'high' | 'medium' | 'low',
  })),
  initialQuestion: 'q',
  initialIntent: '',
  trapPoints: [],
  testPriority,
})

describe('PRIORITY_META', () => {
  it('三档优先级有正确的标签与颜色', () => {
    expect(PRIORITY_META.high.color).toBe('red')
    expect(PRIORITY_META.high.label).toBe('重点练习')
    expect(PRIORITY_META.medium.color).toBe('amber')
    expect(PRIORITY_META.low.color).toBe('green')
  })
})

describe('computeStats', () => {
  it('空数组返回全零', () => {
    expect(computeStats([])).toEqual({
      claimCount: 0,
      highCount: 0,
      mediumCount: 0,
      lowCount: 0,
      totalMasteryPoints: 0,
    })
  })
  it('按测试优先级统计高中低数量与能力要点数', () => {
    const stats = computeStats([claim('high', 4), claim('medium', 3), claim('low', 2)])
    expect(stats.claimCount).toBe(3)
    expect(stats.highCount).toBe(1)
    expect(stats.mediumCount).toBe(1)
    expect(stats.lowCount).toBe(1)
    expect(stats.totalMasteryPoints).toBe(9)
  })
})

// ── 声明进度派生 ──────────────────────────────────────────────

const round = (covered: string[]): InterviewRound => ({
  action: 'answer',
  question: 'q',
  questionIntent: '',
  answer: 'a',
  annotation: '',
  evaluation: { score: 80, coveredPoints: covered, missingPoints: [], answerSuggestion: '', evidenceQuotes: [] },
  nextReason: '',
})

const session = (version: number, status: 'done' | 'in_progress', score: number, covered: string[]): InterviewSession => ({
  id: `s${version}`,
  claimContent: 'q',
  rounds: [round(covered)],
  claimAnalysis: null,
  finalResult: status === 'done' ? {
    masteryScore: score,
    canExplain: [],
    cannotExplain: [],
    knowledgeGaps: [],
    answerSummary: '',
    nextAction: '',
    rewriteSuggestion: '',
  } : null,
  status,
  version,
})

describe('effectivePriority', () => {
  it('未覆盖时回退到声明自带值', () => {
    expect(effectivePriority(claim('medium'), {})).toBe('medium')
  })
  it('覆盖值优先', () => {
    const c = claim('medium')
    expect(effectivePriority(c, { [c.id]: 'high' })).toBe('high')
  })
})

describe('summarizeClaimProgress', () => {
  it('覆盖 done/prepared/todo 三种状态', () => {
    const c1 = claim('high'), c2 = claim('medium'), c3 = claim('low')
    const progress = summarizeClaimProgress([c1, c2, c3], {
      [c1.id]: [session(1, 'done', 4, ['a', 'b'])],
    }, [c2.id])
    expect(progress[c1.id].status).toBe('done')
    expect(progress[c1.id].latestScore).toBe(4)
    expect(progress[c1.id].covered).toBe(2)
    expect(progress[c1.id].total).toBe(3)
    expect(progress[c2.id].status).toBe('prepared')
    expect(progress[c3.id].status).toBe('todo')
  })
  it('未测试且无记录时 latestScore 为 null', () => {
    const c = claim('medium')
    expect(summarizeClaimProgress([c], {}, [])[c.id].latestScore).toBeNull()
  })
})

describe('averageMasteryPct', () => {
  it('没有测试返回 null', () => {
    expect(averageMasteryPct({})).toBeNull()
  })
  it('有测试时返回平均分百分比（/5）', () => {
    const progress = { a: { status: 'done', latestScore: 4, covered: 1, total: 3 }, b: { status: 'done', latestScore: 2, covered: 1, total: 3 } }
    expect(averageMasteryPct(progress)).toBe(60)
  })
})

describe('priorityCount', () => {
  it('按合并后优先级统计', () => {
    const c1 = claim('medium'), c2 = claim('low')
    expect(priorityCount([c1, c2], { [c1.id]: 'high' }, 'high')).toBe(1)
    expect(priorityCount([c1, c2], {}, 'medium')).toBe(1)
  })
})

it('待补强阈值为 2', () => {
  expect(WEAK_SCORE_THRESHOLD).toBe(2)
})
