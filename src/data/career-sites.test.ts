import { describe, expect, it } from 'vitest'
import { careerSites, additionalCareerSites, companyFromCareerUrl, filterCareerSites } from './career-sites'
import { sourceUrlSchema } from '@/domain/mail-schema'

describe('招聘官网目录', () => {
  it('每个入口合法且不重复，同公司来源可准确识别，避免相似域名误认', () => {
    expect(new Set(careerSites.map(site => site.url)).size).toBe(careerSites.length)
    for (const site of careerSites) {
      expect(sourceUrlSchema.safeParse(site.url).success).toBe(true)
      expect(companyFromCareerUrl(site.url)).toBe(site.company)
    }
    expect(companyFromCareerUrl('https://job.tuya.com.evil.test/')).toBe('')
    expect(companyFromCareerUrl('https://jobs.unknown.test/')).toBe('')
    expect(additionalCareerSites.every(site => site.reviewedAt === '2026-10-23')).toBe(true)
  })
  it('可用公司、英文别名、域名与技术线索搜索，支持组合关键词', () => {
    expect(filterCareerSites('DiDi').map(site => site.company)).toEqual(['滴滴'])
    expect(filterCareerSites('虾皮').map(site => site.company)).toEqual(['虾皮'])
    expect(filterCareerSites('tiDB').map(site => site.company)).toEqual(['PingCAP'])
    expect(filterCareerSites('UMAYUN React').map(site => site.company)).toEqual(['优码云'])
    expect(filterCareerSites('不存在的公司')).toEqual([])
  })
  it('前端筛选只包含有公开线索的来源，不把招聘门户默认为在招前端', () => {
    expect(filterCareerSites('', true).every(site => !!site.frontendRoles?.length)).toBe(true)
    expect(filterCareerSites('涂鸦', true)).toEqual([])
    expect(filterCareerSites('绿雪', true)).toHaveLength(1)
  })
})
