import type { AssistantJob, AssistantPlan, AssistantTask, JobAssessment, JobAssistantTools, MatchingJob } from '@/domain/job-assistant'
import type { CareerPage } from '@/domain/mail-schema'
import { matchesJobTitle } from '@/domain/job-search'
import { selectCareerJob } from '@/features/applications/jobs/lib/career-selection'
import { careerUrlKey } from '@/features/applications/jobs/lib/pasted-career'

export const ASSISTANT_JOB_LIMIT = 30
class CheckpointError extends Error {}
type RunnerTools = Pick<JobAssistantTools, 'discover' | 'read'> & {
  plan: () => Promise<{ plan: AssistantPlan; sources: Array<{ company: string; url: string }>; reserveSources?: Array<{ company: string; url: string }> }>
  match: (plan: AssistantPlan, jobs: MatchingJob[]) => Promise<{ results: JobAssessment[] }>
  checkpoint: (task: AssistantTask) => Promise<void>
  paused: () => boolean
}

export const titleMatches = matchesJobTitle
export function assistantJobKey(page: Pick<CareerPage, 'url' | 'role'>) { return `${careerUrlKey(page.url)}\n${page.role.trim()}` }
export function collectAssistantJobs(pages: CareerPage[], plan: AssistantPlan, existing: AssistantJob[]): AssistantJob[] {
  const result = [...existing]
  const seen = new Set(existing.map(job => job.id))
  for (const page of pages) {
    const choices = page.jobs?.length ? page.jobs.map(job => selectCareerJob(page, job.id)) : page.role ? [page] : []
    for (const choice of choices) {
      if (!titleMatches(choice.role, plan.keywords) || plan.excludedCompanies.some(company => choice.company.toLowerCase().includes(company.toLowerCase()))) continue
      const id = assistantJobKey(choice)
      if (seen.has(id) || result.length >= ASSISTANT_JOB_LIMIT) continue
      seen.add(id); result.push({ id, page: choice })
    }
  }
  return result
}
export function matchingInput(job: AssistantJob): MatchingJob {
  return { id: job.id, company: job.page.company, role: job.page.role, url: job.page.url, description: job.page.jobDescription ?? '' }
}

// Persist completed tool results before moving on. Model tools can only plan and
// assess; the runner exposes no send-email or arbitrary network tool to the model.
export async function runJobAssistant(initial: AssistantTask, tools: RunnerTools): Promise<AssistantTask> {
  let task: AssistantTask = { ...initial, status: 'running' }
  const save = async (change: Partial<AssistantTask>) => {
    const next = { ...task, ...change, updatedAt: Date.now() }
    try { await tools.checkpoint(next) }
    catch { throw new CheckpointError('任务进度没有保存成功，已停止。请检查浏览器存储后继续。') }
    task = next
  }
  const stop = async () => {
    if (!tools.paused()) return false
    await save({ status: 'paused', message: '已暂停，可以继续。' }); return true
  }
  const assess = async (plan: AssistantPlan, flush = true) => {
    while (task.jobs.filter(job => !job.assessment && !job.error).length >= (flush ? 1 : 5)) {
      if (await stop()) return false
      const batch = task.jobs.filter(job => !job.assessment && !job.error).slice(0, 5)
      await save({ message: `正在对照简历核对岗位（${task.jobs.filter(job => job.assessment).length}/${task.jobs.length}）…` })
      const matched = await tools.match(plan, batch.map(matchingInput))
      if (matched.results.length !== batch.length || new Set(matched.results.map(item => item.id)).size !== batch.length || matched.results.some(result => !batch.some(job => job.id === result.id))) throw new Error('岗位结果不完整，请继续任务重试。')
      await save({ jobs: task.jobs.map(job => {
        const assessment = matched.results.find(result => result.id === job.id)
        return assessment ? { ...job, assessment, error: undefined } : job
      }) })
    }
    return true
  }
  try {
    await save({ message: task.plan ? '继续读取和核对岗位…' : '正在整理求职条件…' })
    if (await stop()) return task
    if (!task.plan) {
      const planned = await tools.plan()
      await save({ plan: planned.plan, sources: planned.sources.map(source => ({ ...source, status: 'pending' })), ...(planned.reserveSources?.length ? { reserveSources: planned.reserveSources } : {}) })
    }
    const plan = task.plan!
    for (let index = 0; index < task.sources.length; index++) {
      if (await stop()) return task
      const source = task.sources[index]
      if (source.status !== 'pending') continue
      if (task.jobs.length >= ASSISTANT_JOB_LIMIT) break
      await save({ message: `正在读取 ${source.company}（${index + 1}/${task.sources.length}）…` })
      let failure = ''
      try {
        const discovery = await tools.discover(source.url, plan.keywords)
        await save({ jobs: collectAssistantJobs(discovery.pages ?? [], plan, task.jobs) })
        const details = discovery.links.filter(link => link.kind === 'job' && (titleMatches(link.label, plan.keywords) || /^(?:查看|岗位|职位)?详情$|^(?:view|job)\s*details?$/i.test(link.label.trim()))
          && !(discovery.pages ?? []).some(page => page.url === link.url)
          && !task.jobs.some(job => job.page.url === link.url)).slice(0, 5)
        for (const detail of details) {
          if (await stop()) return task
          if (task.jobs.length >= ASSISTANT_JOB_LIMIT) break
          try { const page = await tools.read(detail.url); await save({ jobs: collectAssistantJobs([page], plan, task.jobs) }) }
          catch (error) { if (error instanceof CheckpointError) throw error; failure = '部分岗位详情未读到，可稍后重试。' }
        }
        if (!discovery.listingRead && !discovery.pages?.length && !details.length) failure = '没有读到可用的职位列表，可能依赖脚本或登录；不能据此判断没有匹配岗位。'
        if (discovery.notes.some(note => /时间限制/.test(note))) failure = '部分入口未读完，已找到的岗位已保留，可稍后重试这个来源。'
      } catch (error) { if (error instanceof CheckpointError) throw error; failure = error instanceof Error ? error.message : '官网读取失败，可重试或手动打开查看。' }
      await save({ sources: task.sources.map((item, i) => i === index ? { ...item, status: failure ? 'failed' : 'done', error: failure || undefined } : item) })
      // Show the first usable results before waiting for all remaining websites.
      // Subsequent small results are grouped to avoid extra model calls.
      if (!await assess(plan, !task.jobs.some(job => job.assessment))) return task
      if (!task.jobs.length && task.reserveSources?.length && (index >= 1 || index === task.sources.length - 1)) {
        const known = new Set(task.sources.map(item => item.url))
        const reserve = task.reserveSources.filter(item => !known.has(item.url) && !plan.excludedCompanies.some(company => item.company.toLowerCase().includes(company.toLowerCase()))).slice(0, 4)
        await save({ reserveSources: [], sources: [...task.sources.slice(0, index + 1), ...reserve.map(item => ({ ...item, status: 'pending' as const })), ...task.sources.slice(index + 1)], message: '当前来源没有读到匹配岗位，正在自动更换招聘来源…' })
      }
    }
    if (!await assess(plan)) return task
    if (await stop()) return task
    await save({ status: 'complete', message: task.jobs.length ? `已整理 ${task.jobs.length} 个岗位${task.jobs.length >= ASSISTANT_JOB_LIMIT ? '，达到本次 30 个上限，可缩小范围再找。' : '，可以核对后加入投递清单。'}` : task.sources.every(source => source.status === 'failed') ? '这次未能读取到可核对的职位列表，不能判断是否有匹配岗位。可重试失败来源或粘贴岗位正文。' : '已读取的岗位中没有标题匹配项，可以调整目标或补充官网链接。' })
  } catch (error) {
    // A failed checkpoint must stop the run as well; do not continue costly work.
    task = { ...task, status: 'paused', message: error instanceof Error ? error.message : '任务中断，可以继续。', updatedAt: Date.now() }
    await tools.checkpoint(task)
  }
  return task
}
