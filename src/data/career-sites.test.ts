import { describe, expect, it } from 'vitest'
import { careerSites, additionalCareerSites, expandedCareerSites, companyFromCareerUrl, filterCareerSites } from './career-sites'
import { sourceUrlSchema } from '@/domain/mail-schema'
import { readFileSync } from 'node:fs'

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
    expect(expandedCareerSites.every(site => site.reviewedAt === '2026-10-29')).toBe(true)
  })
  it('可用公司、英文别名、域名与技术线索搜索，支持组合关键词', () => {
    expect(filterCareerSites('DiDi').map(site => site.company)).toEqual(['滴滴'])
    expect(filterCareerSites('虾皮').map(site => site.company)).toEqual(['虾皮'])
    expect(filterCareerSites('tiDB').map(site => site.company)).toEqual(['PingCAP'])
    expect(filterCareerSites('UMAYUN React').map(site => site.company)).toEqual(['优码云'])
    expect(filterCareerSites('不存在的公司')).toEqual([])
    expect(filterCareerSites('Kimi').map(site => site.company)).toEqual(['月之暗面'])
    expect(filterCareerSites('Insta360').map(site => site.company)).toEqual(['影石'])
    expect(filterCareerSites('ProcessOn 前端').map(site => site.company)).toEqual(['ProcessOn'])
  })
  it('不输入关键词时展示全部官网，不按技术方向排除公司', () => {
    expect(filterCareerSites()).toEqual(careerSites)
    expect(filterCareerSites('涂鸦')).toHaveLength(1)
  })
  it('共享表单平台只认已核对的招聘表单，不把其他企业的表单当作金数据招聘', () => {
    expect(companyFromCareerUrl('https://jinshuju.net/f/t7TIWA?from=careers')).toBe('金数据')
    expect(companyFromCareerUrl('https://im.jinshuju.com/f/t7TIWA')).toBe('金数据')
    expect(companyFromCareerUrl('https://im.jinshuju.com/f/another-company')).toBe('')
    expect(companyFromCareerUrl('https://jinshuju.net/f/another-company')).toBe('')
    expect(companyFromCareerUrl('https://jinshuju.net/f/t7TIWA-unknown')).toBe('')
    expect(companyFromCareerUrl('https://jinshuju.net/')).toBe('')
    expect(companyFromCareerUrl('https://jobs.qiniu.com/social/jobs/123')).toBe('七牛云')
  })
  it('本批每个新增入口都有对应核对记录，官网来源和实际落地页均为合法公开地址', () => {
    const audit = JSON.parse(readFileSync('data/career-sites/review-2026-10-29.json', 'utf8')) as { sites: Array<{ company: string; url: string; sourceUrl: string; status: number; finalUrl: string; reviewedAt: string }> }
    for (const site of expandedCareerSites) {
      const record = audit.sites.find(entry => entry.company === site.company && entry.url === site.url)
      expect(record, `${site.company} 缺少核对记录`).toBeDefined()
      expect(record!.reviewedAt).toBe(site.reviewedAt)
      expect(record!.status).toBe(200)
      expect(sourceUrlSchema.safeParse(record!.sourceUrl).success).toBe(true)
      expect(sourceUrlSchema.safeParse(record!.finalUrl).success).toBe(true)
      expect(new URL(record!.finalUrl).pathname).not.toMatch(/(?:^|\/)404(?:\.|\/|$)/)
    }
  })
})
