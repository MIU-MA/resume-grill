import { describe, expect, it, vi } from 'vitest'
import { discoverCareers } from './career-discovery'
import { extractCareerLinks, normalizeCareerUrl } from './career-links'
import { extractCareerEmails, readCareerPage } from './public-page'

describe('official recruiting link discovery', () => {
  it('resolves actual links, strips tracking, preserves job IDs and rejects unsafe or irrelevant links', () => {
    const links = extractCareerLinks(`<a href="/careers">加入我们</a>
      <a href="/jobs/42?utm_source=home&amp;jobId=42#top">前端工程师</a>
      <a href="/jobs/42?jobId=42">重复岗位</a>
      <a href="https://apply.vendor.example/form">在线申请</a>
      <a href="javascript:alert(1)">招聘</a><a href="http://example.com/jobs">招聘</a>
      <a href="https://user:pass@example.com/jobs">招聘</a><a href="/login">申请职位</a>
      <a href="/policy.pdf">招聘政策</a><a href="/about">关于我们</a>
      <a href="/industry/engineering-construction.html">工程建设</a>
      <script><a href="/jobs/fake">工程师</a></script>`, 'https://example.com/')
    expect(links.map(link => [link.url, link.kind])).toEqual([
      ['https://example.com/careers', 'entry'], ['https://example.com/jobs/42?jobId=42', 'job'], ['https://apply.vendor.example/form', 'apply'],
    ])
    expect(links.every(link => link.sourceUrl === 'https://example.com/')).toBe(true)
    expect(normalizeCareerUrl('https://example.com/jobs?jobId=43')).not.toBe(normalizeCareerUrl('https://example.com/jobs?jobId=42'))
  })
  it('extracts JobPosting metadata URLs without inventing URLs', () => {
    expect(extractCareerLinks(`<script type="application/ld+json">{"@graph":[{"@type":"JobPosting","title":"Researcher","url":"/opening/123"},{"@type":"JobPosting","title":"Missing URL"}]}</script>`, 'https://example.com').map(link => [link.label, link.url, link.kind])).toEqual([['Researcher', 'https://example.com/opening/123', 'job']])
  })
  it('follows same-host recruiting entries, breaks cycles and only lists external applications', async () => {
    const pages: Record<string, string> = {
      'https://example.com/': '<a href="/careers">招聘</a>',
      'https://example.com/careers': '<a href="/">加入我们</a><a href="/careers/social">社会招聘</a><a href="https://vendor.example/jobs">招聘入口</a>',
      'https://example.com/careers/social': '<a href="/positions/123">前端工程师</a><a href="https://vendor.example/apply/123">立即申请</a>',
    }
    const read = vi.fn(async (url: string) => extractCareerEmails(pages[url], url))
    const result = await discoverCareers('https://example.com/', read)
    expect(read.mock.calls.map(args => args[0])).toEqual(Object.keys(pages))
    expect(result.pagesRead).toBe(3)
    expect(result.links.some(link => link.url.endsWith('/positions/123') && link.kind === 'job')).toBe(true)
    expect(result.notes.join(' ')).toContain('其他域名')
  })
  it('returns discovered links when a subsequent page fails, and caps requests at six', async () => {
    const read = vi.fn(async (url: string) => {
      if (url.endsWith('/careers/0')) throw new Error('HTTP 403')
      return extractCareerEmails(Array.from({ length: 20 }, (_, i) => `<a href="/careers/${i}">招聘入口 ${i}</a>`).join(''), url)
    })
    const result = await discoverCareers('https://example.com', read)
    expect(read).toHaveBeenCalledTimes(6)
    expect(result.links).toHaveLength(20)
    expect(result.pagesRead).toBe(5)
    expect(result.notes.join(' ')).toContain('HTTP 403')
    expect(result.notes.join(' ')).toContain('限制')
  })
  it('reports an unreadable starting page instead of fabricating results', async () => {
    await expect(discoverCareers('https://example.com', async () => { throw new Error('HTTP 403') })).rejects.toThrow('HTTP 403')
    await expect(discoverCareers('http://127.0.0.1')).rejects.toThrow()
  })
  it('passes a host restriction to the reader, blocking external redirects before DNS or HTTP', async () => {
    let allow: ((url: string) => boolean) | undefined
    await discoverCareers('https://www.example.com/', async (url, _redirects, _deadline, scope) => {
      allow = scope
      return extractCareerEmails('', url)
    })
    expect(allow!('https://example.com/careers')).toBe(true)
    expect(allow!('https://example.com.evil.test/jobs')).toBe(false)
    await expect(readCareerPage('https://evil.test/jobs', 1, Date.now() + 1000, allow)).rejects.toThrow('其他网站')
  })
  it('bounds output on large pages', () => {
    const html = Array.from({ length: 300 }, (_, i) => `<a href="/jobs/${i}">工程师 ${i}</a>`).join('')
    expect(extractCareerLinks(html, 'https://example.com')).toHaveLength(100)
  })
})
