import { describe, it, expect } from 'vitest'
import { computeStats, PRIORITY_META } from './risk'
import type { ResumeClaim } from '@/domain/resume-schema'

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
    expect(PRIORITY_META.high.label).toBe('优先测试')
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
