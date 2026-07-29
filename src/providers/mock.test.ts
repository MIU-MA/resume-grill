import { describe, it, expect } from 'vitest'
import { mockAnalyze, mockNextQuestion } from './mock'
import type { ResumeClaim } from '@/domain/resume-schema'
import type { InterviewTurn } from '@/domain/interview-schema'

const SALE_RESUME =
  '张明\n高级销售经理\n- 季度销售额提升30%\n- 获年度最佳新人奖\n- 熟练使用CRM系统'

describe('mockAnalyze', () => {
  it('从真实文本提取声明，候选人与岗位随输入变化', () => {
    const a = mockAnalyze(SALE_RESUME, 'r.txt')
    expect(a.candidate).toBe('张明')
    expect(a.role).toBe('销售')
    expect(a.claims.length).toBeGreaterThan(0)
    expect(a.claims.some((c) => c.category === 'achievement')).toBe(true)
    expect(a.claims.some((c) => c.category === 'honor')).toBe(true)
    expect(a.sourceFile).toBe('r.txt')
  })

  it('不同输入产出不同候选人与岗位', () => {
    const a1 = mockAnalyze('张明\n高级销售经理\n- 销售额提升30%', 'a.txt')
    const a2 = mockAnalyze('李华\n前端工程师\n- 熟练使用React', 'b.txt')
    expect(a1.candidate).not.toBe(a2.candidate)
    expect(a1.role).not.toBe(a2.role)
  })
})

const baseClaim: ResumeClaim = {
  quote: 'q',
  title: 't',
  category: 'achievement',
  role: '销售',
  verifiability: 90,
  evidence: [],
  evidenceGaps: ['g'],
  initialQuestion: '基线是多少？',
  evaluationPoints: ['p1', 'p2', 'p3'],
}

describe('mockNextQuestion', () => {
  it('模糊 / 过短回答触发澄清', () => {
    const turns: InterviewTurn[] = [{ question: '基线是多少？', answer: '不太清楚' }]
    const next = mockNextQuestion(baseClaim, turns)
    expect(next.isFinal).toBe(false)
    expect(next.question).toContain('具体')
  })

  it('具体回答推进到下一条追问', () => {
    const turns: InterviewTurn[] = [
      { question: '基线是多少？', answer: '改造前约1500万，我负责华东区大客户开发并主导签约' },
    ]
    const next = mockNextQuestion(baseClaim, turns)
    expect(next.isFinal).toBe(false)
    expect(next.question).toContain('如何计算')
  })
})
