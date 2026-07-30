import { describe, expect, it } from 'vitest'
import { buildStructuredResumeInput, extractLooseClaimCandidates, extractResumeClaimCandidates, isClaimGroundedInRawText, matchClaimCandidate } from './resume-structure'

const RESUME = `张三
电话：13800138000
产品经理

工作经历
示例科技 | 产品经理 | 2021.03 - 2024.06
- 负责会员产品规划，推动三个版本上线
- 将次月留存率从 28% 提升至 36%

项目经历：
会员增长项目 2023.01 - 2023.12
- 设计分层运营策略，覆盖 10 万用户

教育背景
示例大学 | 本科 | 2017 - 2021`

describe('resume structure', () => {
  it('separates identity, entry headers and claim candidates', () => {
    const input = buildStructuredResumeInput(RESUME)
    expect(input.identity).toContain('张三')
    expect(input.identity.some((line) => line.includes('13800138000'))).toBe(false)
    expect(input.claimCandidates.map((item) => item.content)).toEqual([
      '负责会员产品规划，推动三个版本上线',
      '将次月留存率从 28% 提升至 36%',
      '设计分层运营策略，覆盖 10 万用户',
    ])
    expect(input.claimCandidates.map((item) => item.sourceSection)).toEqual([
      '工作经历',
      '工作经历',
      '项目经历',
    ])
    expect(input.claimCandidates.some((item) => item.content.includes('示例科技'))).toBe(false)
    expect(input.claimCandidates.some((item) => item.content.includes('示例大学'))).toBe(false)
  })

  it('supports action bullets when a resume has no explicit section heading', () => {
    expect(extractResumeClaimCandidates('李四\n销售经理\n- 负责重点客户续约，续约率提升 20%')).toEqual([
      expect.objectContaining({ content: '负责重点客户续约，续约率提升 20%', sourceSection: '个人概况' }),
    ])
  })

  it('matches a model-selected clause back to its source section', () => {
    const candidates = extractResumeClaimCandidates(RESUME)
    expect(matchClaimCandidate('将次月留存率从 28% 提升至 36%', candidates)).toMatchObject({ sourceSection: '工作经历' })
  })

  it('keeps explicit technical capability lists as skill claims', () => {
    const candidates = extractResumeClaimCandidates([
      '王五',
      '技术能力',
      '前端：TypeScript、React、Vue 3、Next.js',
      '工程化：Docker、GitHub Actions、Monorepo',
    ].join('\n'))

    expect(candidates).toEqual([
      expect.objectContaining({ content: '前端：TypeScript、React、Vue 3、Next.js', sourceSection: '技术能力' }),
      expect.objectContaining({ content: '工程化：Docker、GitHub Actions、Monorepo', sourceSection: '技术能力' }),
    ])
  })

  it('accepts PDF nested bullets represented by a standalone o', () => {
    const candidates = extractResumeClaimCandidates([
      '项目经历',
      'o 基于 React 与 TypeScript 搭建管理后台，完成权限和异常处理。',
    ].join('\n'))

    expect(candidates).toEqual([
      expect.objectContaining({
        content: '基于 React 与 TypeScript 搭建管理后台，完成权限和异常处理。',
        sourceSection: '项目经历',
      }),
    ])
  })

  it('repairs wrapped statements stored by the previous PDF extractor', () => {
    const candidates = extractResumeClaimCandidates([
      '技术能力',
      '- 语言与基础：熟悉 TypeScript，具备组件化、模块化、异步编',
      '程和数据结构与算法基础。',
      '项目经历',
      'o 实现安全预览与版本管理，每次生成自动保存版',
      '本，支持预览、恢复、重命名和删除。',
    ].join('\n'))

    expect(candidates.map((candidate) => candidate.content)).toEqual([
      '语言与基础：熟悉 TypeScript，具备组件化、模块化、异步编程和数据结构与算法基础。',
      '实现安全预览与版本管理，每次生成自动保存版本，支持预览、恢复、重命名和删除。',
    ])
  })

  it('recovers action statements from flattened PDF text', () => {
    const flattened = '张三 产品经理 电话 13800138000 工作经历 示例科技 2021-2024 负责会员产品规划，推动三个版本上线 将次月留存率从28%提升至36%'
    expect(extractLooseClaimCandidates(flattened).map((item) => item.content)).toEqual([
      '负责会员产品规划，推动三个版本上线',
      '将次月留存率从28%提升至36%',
    ])
    expect(isClaimGroundedInRawText('负责会员产品规划，推动三个版本上线', flattened)).toBe(true)
  })
})
