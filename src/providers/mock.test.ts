import { describe, it, expect } from 'vitest'
import { mockAnalyze, mockNextQuestion, mockSummarize } from './mock'
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

  it('输出双指标 askLikelihood/evidenceStrength 而非旧 verifiability', () => {
    const a = mockAnalyze(SALE_RESUME, 'r.txt')
    for (const c of a.claims) {
      expect(c.askLikelihood).toBeGreaterThanOrEqual(0)
      expect(c.askLikelihood).toBeLessThanOrEqual(100)
      expect(c.evidenceStrength).toBeGreaterThanOrEqual(0)
      expect(c.evidenceStrength).toBeLessThanOrEqual(100)
      expect('verifiability' in c).toBe(false)
    }
  })

  it('噪声过滤：公司+职位+日期行与小标题不作为声明', () => {
    const a = mockAnalyze(
      '张明\n高级销售经理\n工作经历：\nXX科技 销售经理 2021-2023\n- 季度销售额提升30%\n- 获年度最佳新人奖',
      'r.txt',
    )
    const quotes = a.claims.map((c) => c.quote)
    // 公司+职位+日期行不应出现
    expect(quotes.some((q) => /XX科技/.test(q) && /2021/.test(q))).toBe(false)
    // 小标题不应作为声明
    expect(quotes.some((q) => q.replace(/[:：]$/, '') === '工作经历')).toBe(false)
    // 量化成果声明应被保留
    expect(quotes.some((q) => /季度销售额提升30%/.test(q))).toBe(true)
  })
})

const baseClaim: ResumeClaim = {
  quote: 'q',
  title: 't',
  category: 'achievement',
  role: '销售',
  sourceSection: '工作经历',
  askLikelihood: 90,
  evidenceStrength: 25,
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

  it('coveredPoints 是 evaluationPoints 的子集（不超 100%）', () => {
    const turns: InterviewTurn[] = [{ question: 'q', answer: '详细回答了 p1 和 p2 的情况说明' }]
    const next = mockNextQuestion(baseClaim, turns)
    for (const p of next.coveredPoints) {
      expect(baseClaim.evaluationPoints).toContain(p)
    }
    expect(next.coveredPoints.length).toBeLessThanOrEqual(baseClaim.evaluationPoints.length)
  })
})

describe('mockSummarize', () => {
  it('给出覆盖度与改写建议', () => {
    const turns: InterviewTurn[] = [{ question: 'q', answer: '说明基线是1500万' }]
    const { finalSummary, rewriteSuggestion } = mockSummarize(baseClaim, turns, ['p1'], ['p2', 'p3'])
    expect(finalSummary).toContain('1')
    expect(finalSummary).toContain('p1')
    expect(finalSummary).toContain('p2')
    expect(rewriteSuggestion).toContain('改写')
    expect(rewriteSuggestion.length).toBeGreaterThan(10)
  })
})
