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
