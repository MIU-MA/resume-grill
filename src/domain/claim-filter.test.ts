import { describe, expect, it } from 'vitest'
import { isExcludedClaimContent } from './claim-filter'

describe('isExcludedClaimContent', () => {
  it.each([
    '电话：13800138000',
    '邮箱: candidate@example.com',
    '性别：男 | 年龄：26岁',
    '求职意向：产品经理',
    '5年前端开发经验',
    '电商后台管理系统 2022.01 - 2023.05',
  ])('excludes personal information and headings: %s', (content) => {
    expect(isExcludedClaimContent(content)).toBe(true)
  })

  it('keeps a concrete experience claim even when it contains a date', () => {
    expect(isExcludedClaimContent('2023年负责客户续约流程，将续约率提升12%')).toBe(false)
  })
})
