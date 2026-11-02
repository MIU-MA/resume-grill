import { expect, it } from 'vitest'
import { renderedCareerCards, renderedCareerDetail } from './rendered-career-pages'
import { renderedJobData } from './rendered-job-data'
import { normalizeCareerUrl } from './career-links'
it('从动态职位卡片保留真实详情链接，职位名不混入职责或其他卡片内容', () => {
  const pages = renderedCareerCards('<a href="/position/101/detail"><div class="positionItem-title">后端工程师</div><div class="positionItem-jobDesc">维护订单服务。</div></a><a href="/position/102/detail"><div class="positionItem-title">财务会计</div><div class="positionItem-jobDesc">处理税务。</div></a>', 'https://example.com/jobs')
  expect(pages.map(page => [page.role, page.url, page.jobDescription])).toEqual([['后端工程师', 'https://example.com/position/101/detail', '维护订单服务。'], ['财务会计', 'https://example.com/position/102/detail', '处理税务。']])
})
it('没有 href 的列表数据不能编造职位 URL；任职要求与对应职位一起提取', () => {
  const data = renderedJobData({ data: { items: [{ jdId: 10, jobName: '后端研发', jobDuty: '开发服务', jobQualification: '熟悉 Java' }, { id: 11, name: '运营', description: '活动执行', positionDemand: '活动经验' }, { id: 12, name: '部门', description: '团队介绍' }] } })
  expect(data).toHaveLength(2)
  expect(data[0]).toEqual({ id: '10', title: '后端研发', description: '岗位职责\n开发服务\n\n任职要求\n熟悉 Java' })
  expect(JSON.stringify(data)).not.toContain('https://')
})
it('SPA 招聘详情的 hash 路由不能被清掉，普通锚点和会话 ID 则移除', () => {
  expect(normalizeCareerUrl('https://example.com/recruit/#/social/job-info/5763')).toBe('https://example.com/recruit/#/social/job-info/5763')
  expect(normalizeCareerUrl('https://example.com/job;jsessionid=TEMPORARY?id=2#top')).toBe('https://example.com/job?id=2')
})
it('动态详情使用观察到的卡片标题解析职位描述和要求', () => {
  const page = renderedCareerDetail('<div class="positionTitle">后端工程师</div><h2>职位描述</h2><p>维护订单服务。</p><h2>职位要求</h2><p>熟悉 Java。</p>', 'https://example.com/jobs/1', '后端工程师')
  expect(page.role).toBe('后端工程师')
  expect(page.jobDescription).toContain('维护订单服务')
  expect(page.jobDescription).toContain('熟悉 Java')
  expect(page.jobs).toBeUndefined()
})
