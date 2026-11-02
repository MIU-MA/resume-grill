import { describe, expect, it } from 'vitest'
import type { CareerPage } from '@/domain/mail-schema'
import { careerJobRows, careerSiteKey, emptyCareerJobs, recordCareerDiscovery } from './career-jobs'

const page: CareerPage = {
  url: 'https://example.com/jobs/1',
  title: '前端工程师',
  emails: [],
  company: '示例公司',
  role: '前端工程师',
  recommendedEmail: 'hr@example.com',
  notes: [],
  jobs: [{ id: 'job-1', role: '前端工程师', emails: [], recommendedEmail: 'hr@example.com' }],
}

describe('招聘官网岗位缓存', () => {
  it('把已读取的页面和岗位链接整理成去重后的行', () => {
    const store = recordCareerDiscovery(emptyCareerJobs(), {
      company: '示例公司',
      url: 'https://example.com/jobs',
      discovery: {
        pagesRead: 1,
        notes: [],
        pages: [page],
        links: [
          { url: page.url, label: '查看详情', kind: 'job', sourceUrl: 'https://example.com/jobs' },
          { url: 'https://example.com/jobs/2', label: '后端工程师', kind: 'job', sourceUrl: 'https://example.com/jobs' },
          { url: 'https://example.com/jobs/3', label: '投递入口', kind: 'apply', sourceUrl: 'https://example.com/jobs' },
        ],
      },
    })
    const rows = careerJobRows(store)
    expect(rows).toHaveLength(3)
    expect(rows.map(row => row.role)).toEqual(expect.arrayContaining(['前端工程师', '后端工程师', '投递入口']))
    expect(rows.find(row => row.role === '前端工程师')?.page?.role).toBe('前端工程师')
    expect(rows.find(row => row.role === '前端工程师')?.email).toBe('hr@example.com')
  })

  it('重新读取失败时保留上一次可读的岗位，并把来源标成失败', () => {
    const first = recordCareerDiscovery(emptyCareerJobs(), {
      company: '示例公司',
      url: 'https://example.com/jobs',
      discovery: { pagesRead: 1, notes: [], pages: [page], links: [] },
    })
    const failed = recordCareerDiscovery(first, { company: '示例公司', url: 'https://example.com/jobs', error: '超时' })
    expect(careerJobRows(failed)).toHaveLength(1)
    expect(failed.sites[careerSiteKey('https://example.com/jobs')]?.status).toBe('failed')
    expect(failed.sites[careerSiteKey('https://example.com/jobs')]?.error).toBe('超时')
  })

  it('同一岗位重复读取不会产生重复行', () => {
    const input = { company: '示例公司', url: 'https://example.com/jobs', discovery: { pagesRead: 1, notes: [], pages: [page], links: [] } }
    const once = recordCareerDiscovery(emptyCareerJobs(), input)
    const twice = recordCareerDiscovery(once, input)
    expect(careerJobRows(twice)).toHaveLength(1)
  })
})
