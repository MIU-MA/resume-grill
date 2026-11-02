import { expect, it, vi } from 'vitest'
import { discoverTencentCareers, isTencentCareer, readTencentCareer } from './tencent-careers'
const origin = 'https://careers.tencent.com'
const post = { PostId: '2098594908700061696', RecruitPostName: 'Java 后端开发工程师', Responsibility: '负责后端服务。', Requirement: '熟悉 Java、MySQL。', LocationName: '武汉', IsValid: true }
it('将求职关键词送到官网接口，保留精确岗位编号并读取完整任职要求', async () => {
  const read = vi.fn(async (url: string) => url.includes('/Query?') ? { Code: 200, Data: { Count: 1, Posts: [post] } } : { Code: 200, Data: post })
  const result = await discoverTencentCareers(origin, ['后端'], read)
  expect(new URL(read.mock.calls[0][0]).searchParams.get('keyword')).toBe('后端')
  expect(result.pages?.[0]).toMatchObject({ url: `${origin}/jobdesc.html?postId=${post.PostId}`, role: post.RecruitPostName, company: '腾讯' })
  expect(result.pages?.[0].jobDescription).toContain('熟悉 Java、MySQL')
  expect(result.pages?.[0].links?.[0].kind).toBe('apply')
})
it('接口没有岗位是真实空结果；接口失败或格式变化不能伪装为没有匹配岗位', async () => {
  const read = vi.fn(async () => ({ Code: 200, Data: { Count: 0, Posts: [] } }))
  expect((await discoverTencentCareers(origin, ['会计'], read)).pages).toEqual([])
  await expect(discoverTencentCareers(origin, ['会计'], async () => ({ Code: 403 }))).rejects.toThrow()
})
it('详情读取失败保留已读列表，并明确正文不完整', async () => {
  const result = await discoverTencentCareers(origin, ['后端'], async url => {
    if (!url.includes('/Query?')) throw new Error('timeout')
    return { Code: 200, Data: { Count: 40, Posts: [post] } }
  })
  expect(result.pages?.[0].role).toBe(post.RecruitPostName)
  expect(result.notes.join('')).toContain('部分任职要求未能读取')
  expect(result.notes.join('')).toContain('并非全部')
})
it('仅允许固定官网及 API 路径，阻止跨站跳转和错误岗位详情', async () => {
  expect(isTencentCareer('https://careers.tencent.com.evil.test/jobs')).toBe(false)
  await expect(discoverTencentCareers('https://evil.test', [])).rejects.toThrow('不是腾讯')
  const read = vi.fn(async (_url: string, _deadline: number, allowed: (url: string) => boolean) => {
    expect(allowed('https://evil.test/private')).toBe(false)
    expect(allowed(`${origin}/tencentcareer/api/post/ByPostId`)).toBe(true)
    expect(allowed(`${origin}/admin`)).toBe(false)
    return { Code: 200, Data: { ...post, PostId: '123' } }
  })
  await expect(readTencentCareer(`${origin}/jobdesc.html?postId=${post.PostId}`, undefined, read)).rejects.toThrow('编号不一致')
})
