import { describe, expect, it } from 'vitest'
import { resumeContentKey } from './storage'
import { reviewedCandidatesKey } from '@/domain/analysis-config'

describe('resumeContentKey', () => {
  it('treats whitespace-only differences as the same resume', () => {
    expect(resumeContentKey('张三\n\n产品经理')).toBe(resumeContentKey(' 张三  产品经理 '))
  })

  it('changes when resume content changes', () => {
    expect(resumeContentKey('张三 产品经理')).not.toBe(resumeContentKey('张三 运营经理'))
  })
})

describe('reviewedCandidatesKey', () => {
  it('ignores incomplete legacy candidate records', () => {
    expect(reviewedCandidatesKey([null, {}, { content: undefined }, { content: '负责客户续约' }])).toContain('负责客户续约')
  })
})
