import { describe, expect, it, vi } from 'vitest'
import type { AssistantPlan, AssistantTask, JobAssessment, MatchingJob } from '@/domain/job-assistant'
import type { CareerDiscovery, CareerPage } from '@/domain/mail-schema'
import { collectAssistantJobs, runJobAssistant, titleMatches } from './job-assistant-runner'

const plan: AssistantPlan = { keywords: ['前端', 'Frontend'], cities: [], experience: '', excludedCompanies: [], sourceUrls: ['https://example.com/jobs'] }
const page = (id: number): CareerPage => ({ url: `https://example.com/jobs/${id}`, company: '示例公司', role: '前端工程师', title: '前端工程师', emails: [], recommendedEmail: '', notes: [], jobDescription: '熟悉 React' })
const initial = (): AssistantTask => ({ version: 1, id: 'task', goal: '前端岗位', createdAt: 1, updatedAt: 1, resume: { id: 'resume', name: '简历.txt', text: 'React 项目', updatedAt: 1 }, status: 'paused', message: '', sources: [], jobs: [] })
const assessment = (job: MatchingJob): JobAssessment => ({ id: job.id, verdict: 'review', summary: '核对经验', checks: [{ requirement: '经验', status: 'unknown', jobQuote: '', resumeQuote: '' }] })
function setup() {
  const snapshots: AssistantTask[] = []
  const tools = {
    plan: vi.fn(async () => ({ plan, sources: [{ company: '示例公司', url: plan.sourceUrls[0] }] })),
    discover: vi.fn(async (): Promise<CareerDiscovery> => ({ pagesRead: 1, pages: [page(1)], links: [], notes: [] })),
    read: vi.fn(async () => page(2)),
    match: vi.fn(async (_plan: AssistantPlan, jobs: MatchingJob[]) => ({ results: jobs.map(assessment) })),
    checkpoint: vi.fn(async (task: AssistantTask) => { snapshots.push(structuredClone(task)) }),
    paused: vi.fn(() => false),
  }
  return { tools, snapshots }
}

describe('可恢复的求职任务', () => {
  it('连续来源没有职位时自动补充官网，并在后续官网完成前展示已匹配结果', async () => {
    const { tools, snapshots } = setup()
    const first = initial()
    first.plan = plan
    first.sources = [{ company: 'A', url: 'https://a.example/jobs', status: 'pending' }, { company: 'B', url: 'https://b.example/jobs', status: 'pending' }, { company: 'C', url: 'https://c.example/jobs', status: 'pending' }]
    first.reserveSources = [{ company: '备用', url: 'https://reserve.example/jobs' }]
    tools.discover.mockImplementation(async url => {
      if (url === 'https://reserve.example/jobs') return { pagesRead: 1, pages: [page(1)], links: [], notes: [] }
      if (url === 'https://c.example/jobs') expect(snapshots.some(task => task.jobs[0]?.assessment)).toBe(true)
      return { pagesRead: 1, pages: [], links: [], notes: [] }
    })
    const result = await runJobAssistant(first, tools)
    expect(tools.discover.mock.calls.map(args => args[0])).toEqual(['https://a.example/jobs', 'https://b.example/jobs', 'https://reserve.example/jobs', 'https://c.example/jobs'])
    expect(result.jobs[0].assessment).toBeDefined()
  })
  it('官网接口明确返回空列表时按真实空结果处理，不误报抓取失败', async () => {
    const { tools } = setup()
    tools.discover.mockResolvedValue({ pagesRead: 1, listingRead: true, pages: [], links: [], notes: [] })
    const task = await runJobAssistant(initial(), tools)
    expect(task.sources[0].status).toBe('done')
    expect(task.message).toContain('没有标题匹配项')
  })
  it('职位列表读取失败不能声称没有匹配岗位，查找条件传递给读取工具', async () => {
    const { tools } = setup()
    tools.discover.mockResolvedValue({ pagesRead: 1, pages: [], links: [], notes: ['页面依赖脚本加载'] })
    const task = await runJobAssistant(initial(), tools)
    expect(tools.discover).toHaveBeenCalledWith(plan.sourceUrls[0], plan.keywords)
    expect(task.sources[0].status).toBe('failed')
    expect(task.sources[0].error).toContain('不能据此判断')
    expect(task.message).toContain('未能读取')
    expect(task.message).not.toContain('没有找到符合方向')
  })
  it('按用户的财务目标收集岗位，并读取没有职位名称的详情链接', async () => {
    const { tools } = setup()
    const finance = { ...plan, keywords: ['会计', '财务', 'Accountant'] }
    tools.discover.mockResolvedValue({ pagesRead: 1, links: [{ url: 'https://example.com/jobs/finance', label: '查看详情', kind: 'job', sourceUrl: plan.sourceUrls[0] }] })
    tools.read.mockResolvedValue({ ...page(2), role: '财务会计', jobDescription: '负责税务申报。' })
    const result = await runJobAssistant({ ...initial(), goal: '财务工作', plan: finance, sources: [{ company: '示例公司', url: plan.sourceUrls[0], status: 'pending' }] }, tools)
    expect(tools.read).toHaveBeenCalledWith('https://example.com/jobs/finance')
    expect(result.jobs.map(job => job.page.role)).toEqual(['财务会计'])
    expect(result.jobs[0].assessment).toBeDefined()
  })
  it('保存读取结果后才匹配，已经完成的任务不会重复请求', async () => {
    const { tools, snapshots } = setup()
    tools.match.mockImplementation(async (_plan, jobs) => {
      expect(snapshots.at(-1)?.jobs.map(job => job.id)).toEqual(jobs.map(job => job.id))
      return { results: jobs.map(assessment) }
    })
    const done = await runJobAssistant(initial(), tools)
    expect(done.status).toBe('complete')
    expect(done.jobs[0].assessment).toBeDefined()
    await runJobAssistant(done, tools)
    expect(tools.plan).toHaveBeenCalledTimes(1)
    expect(tools.discover).toHaveBeenCalledTimes(1)
    expect(tools.match).toHaveBeenCalledTimes(1)
  })
  it('暂停保留当前读取结果，继续时不重新规划或重复保存岗位', async () => {
    const { tools } = setup()
    tools.discover.mockImplementation(async () => {
      tools.paused.mockReturnValue(true)
      return { pagesRead: 1, pages: [page(1)], links: [], notes: [] }
    })
    const paused = await runJobAssistant(initial(), tools)
    expect(paused.status).toBe('paused')
    expect(paused.jobs).toHaveLength(1)
    expect(tools.match).not.toHaveBeenCalled()
    tools.paused.mockReturnValue(false)
    const done = await runJobAssistant(paused, tools)
    expect(done.status).toBe('complete')
    expect(tools.discover).toHaveBeenCalledTimes(1)
  })
  it('某个官网失败仍处理其他来源，失败内容不丢弃', async () => {
    const { tools } = setup()
    tools.plan.mockResolvedValue({ plan, sources: [{ company: '失败公司', url: 'https://failed.example/jobs' }, { company: '示例公司', url: plan.sourceUrls[0] }] })
    tools.discover.mockRejectedValueOnce(new Error('network'))
    const done = await runJobAssistant(initial(), tools)
    expect(done.sources.map(source => source.status)).toEqual(['failed', 'done'])
    expect(done.jobs).toHaveLength(1)
    expect(done.status).toBe('complete')
  })
  it('第二批模型失败只重试未完成批次', async () => {
    const { tools } = setup()
    tools.discover.mockResolvedValue({ pagesRead: 1, pages: Array.from({ length: 6 }, (_, i) => page(i)), links: [], notes: [] })
    tools.match.mockImplementationOnce(async (_plan, jobs) => ({ results: jobs.map(assessment) })).mockRejectedValueOnce(new Error('模型超时'))
    const paused = await runJobAssistant(initial(), tools)
    expect(paused.status).toBe('paused')
    expect(paused.jobs.filter(job => job.assessment)).toHaveLength(5)
    const done = await runJobAssistant(paused, tools)
    expect(done.status).toBe('complete')
    expect(tools.match.mock.calls.map(call => call[1].length)).toEqual([5, 1, 1])
    expect(tools.discover).toHaveBeenCalledTimes(1)
  })
  it('任务存储失败立即停止，不继续读取或调用模型', async () => {
    const { tools } = setup()
    tools.checkpoint.mockRejectedValue(new Error('quota'))
    await expect(runJobAssistant(initial(), tools)).rejects.toThrow('quota')
    expect(tools.plan).not.toHaveBeenCalled()
    const next = setup()
    next.tools.checkpoint.mockImplementation(async task => { if (task.jobs.length) throw new Error('quota') })
    const paused = await runJobAssistant(initial(), next.tools)
    expect(paused.status).toBe('paused')
    expect(next.tools.match).not.toHaveBeenCalled()
    expect(next.tools.read).not.toHaveBeenCalled()
  })
  it('模型漏掉岗位会暂停，不能误标完成', async () => {
    const { tools } = setup()
    tools.match.mockResolvedValue({ results: [] })
    const paused = await runJobAssistant(initial(), tools)
    expect(paused.status).toBe('paused')
    expect(paused.jobs[0].assessment).toBeUndefined()
  })
  it('读取详情失败保留已找到的岗位，来源可重试', async () => {
    const { tools } = setup()
    tools.discover.mockResolvedValue({ pagesRead: 1, pages: [page(1)], notes: [], links: [{ url: page(2).url, sourceUrl: plan.sourceUrls[0], kind: 'job', label: '前端工程师' }] })
    tools.read.mockRejectedValue(new Error('network'))
    const done = await runJobAssistant(initial(), tools)
    expect(done.jobs).toHaveLength(1)
    expect(done.sources[0].status).toBe('failed')
  })
  it('排除芯片前端，保留同页不同岗位和独立联系人，过滤重复及排除公司', () => {
    expect(titleMatches('芯片前端工程师', plan.keywords)).toBe(false)
    expect(titleMatches('Senior Front-end Engineer', plan.keywords)).toBe(true)
    const listing = { ...page(1), jobs: [1, 2].map(id => ({ id: String(id), role: `前端工程师 ${id}`, emails: [], recommendedEmail: `job${id}@example.com`, jobDescription: `React ${id}` })) }
    const jobs = collectAssistantJobs([listing, listing], plan, [])
    expect(jobs).toHaveLength(2)
    expect(jobs.map(job => job.page.recommendedEmail)).toEqual(['job1@example.com', 'job2@example.com'])
    expect(collectAssistantJobs([listing], { ...plan, excludedCompanies: ['示例公司'] }, [])).toHaveLength(0)
    expect(collectAssistantJobs(Array.from({ length: 35 }, (_, i) => page(i)), plan, [])).toHaveLength(30)
  })
})

it('泛标题按本岗位正文判断方向；明确其他职业不借协作关键词混入', () => {
  const target = { ...plan, keywords: ['全栈'] }
  const results = collectAssistantJobs([
    { ...page(1), role: '软件工程师', jobDescription: '负责全栈开发。' },
    { ...page(2), role: '产品经理', jobDescription: '与全栈开发协作。' },
  ], target, [])
  expect(results.map(job => job.page.role)).toEqual(['软件工程师'])
})
