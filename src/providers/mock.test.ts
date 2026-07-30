import { describe, it, expect } from 'vitest'
import { mockAnalyze } from './mock'

const SALE_RESUME =
  '张明\n高级销售经理\n- 季度销售额提升30%\n- 熟练使用CRM系统'

describe('mockAnalyze', () => {
  it('从真实文本提取声明，候选人与岗位随输入变化', () => {
    const a = mockAnalyze(SALE_RESUME, 'r.txt')
    expect(a.candidate).toBe('张明')
    expect(a.role).toBe('销售')
    expect(a.claims.length).toBeGreaterThan(0)
    expect(a.claims.some((c) => c.category === 'achievement')).toBe(true)
    expect(a.sourceFile).toBe('r.txt')
  })

  it('不同输入产出不同候选人与岗位', () => {
    const a1 = mockAnalyze('张明\n高级销售经理\n- 销售额提升30%', 'a.txt')
    const a2 = mockAnalyze('李华\n前端工程师\n- 熟练使用React', 'b.txt')
    expect(a1.candidate).not.toBe(a2.candidate)
    expect(a1.role).not.toBe(a2.role)
  })

  it('输出风险三件套 exaggerationRisk/interviewRisk/evidenceGap', () => {
    const a = mockAnalyze(SALE_RESUME, 'r.txt')
    for (const c of a.claims) {
      expect(['high', 'medium', 'low']).toContain(c.exaggerationRisk)
      expect(['high', 'medium', 'low']).toContain(c.interviewRisk)
      expect(Array.isArray(c.evidenceGap)).toBe(true)
      expect('askLikelihood' in c).toBe(false)
      expect('evidenceStrength' in c).toBe(false)
      expect('quote' in c).toBe(false)
    }
  })

  it('噪声过滤：公司+职位+日期行与小标题不作为声明', () => {
    const a = mockAnalyze(
      '张明\n高级销售经理\n工作经历：\nXX科技 销售经理 2021-2023\n- 季度销售额提升30%',
      'r.txt',
    )
    const contents = a.claims.map((c) => c.content)
    expect(contents.some((q) => /XX科技/.test(q) && /2021/.test(q))).toBe(false)
    expect(contents.some((q) => q.replace(/[:：]$/, '') === '工作经历')).toBe(false)
    expect(contents.some((q) => /季度销售额提升30%/.test(q))).toBe(true)
  })

  it('个人信息、求职意向和联系方式不作为声明', () => {
    const a = mockAnalyze(
      '张明\n性别：男\n电话：13800138000\n邮箱：zhang@example.com\n求职意向：销售经理\n- 负责重点客户续约，续约率提升20%',
      'r.txt',
    )
    expect(a.claims).toHaveLength(1)
    expect(a.claims[0].content).toContain('续约率提升20%')
  })

  it('技术能力章节保留为技能声明', () => {
    const a = mockAnalyze(
      '李华\n前端工程师\n技术能力\n前端：TypeScript、React、Vue 3、Next.js\n工程化：Docker、GitHub Actions',
      'resume.txt',
    )
    expect(a.claims.some((claim) => claim.category === 'skill' && claim.content.includes('TypeScript'))).toBe(true)
  })
})
