import type { AssistantJob, AssistantPlan, AssistantTask, JobAssessment, JobAssistantTools, MatchingJob } from '@/domain/job-assistant'
import type { CareerPage } from '@/domain/mail-schema'
import { selectCareerJob } from '@/features/applications/career-selection'
import { careerUrlKey } from '@/features/applications/pasted-career'

export const ASSISTANT_JOB_LIMIT = 30
class CheckpointError extends Error {}
type RunnerTools = Pick<JobAssistantTools, 'discover' | 'read'> & {
  plan: () => Promise<{ plan: AssistantPlan; sources: Array<{ company: string; url: string }> }>
  match: (plan: AssistantPlan, jobs: MatchingJob[]) => Promise<{ results: JobAssessment[] }>
  checkpoint: (task: AssistantTask) => Promise<void>
  paused: () => boolean
}

export function titleMatches(title: string, keywords: string[]) {
  if (/前端|front.?end/i.test(keywords.join(' ')) && /芯片|集成电路|RTL|ASIC|\bSoC\b/i.test(title)) return false
  const normalized = (value: string) => value.toLowerCase().replace(/[\s_-]/g, '')
  return keywords.some(keyword => normalized(title).includes(normalized(keyword)))
}
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
  try {
    await save({ message: task.plan ? '继续读取和核对岗位…' : '正在整理求职条件…' })
    if (await stop()) return task
    if (!task.plan) {
      const planned = await tools.plan()
      await save({ plan: planned.plan, sources: planned.sources.map(source => ({ ...source, status: 'pending' })) })
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
        const discovery = await tools.discover(source.url)
        await save({ jobs: collectAssistantJobs(discovery.pages ?? [], plan, task.jobs) })
        const details = discovery.links.filter(link => link.kind === 'job' && titleMatches(link.label, plan.keywords)
          && !(discovery.pages ?? []).some(page => page.url === link.url)
          && !task.jobs.some(job => job.page.url === link.url)).slice(0, 5)
        for (const detail of details) {
          if (await stop()) return task
          if (task.jobs.length >= ASSISTANT_JOB_LIMIT) break
          try { const page = await tools.read(detail.url); await save({ jobs: collectAssistantJobs([page], plan, task.jobs) }) }
          catch (error) { if (error instanceof CheckpointError) throw error; failure = '部分岗位详情未读到，可稍后重试。' }
        }
        if (!discovery.pages?.length && !details.length) failure = '没有读到符合方向的岗位，可能需要在官网查看。'
      } catch (error) { if (error instanceof CheckpointError) throw error; failure = '官网读取失败，可重试或手动打开查看。' }
      await save({ sources: task.sources.map((item, i) => i === index ? { ...item, status: failure ? 'failed' : 'done', error: failure || undefined } : item) })
    }
    while (task.jobs.some(job => !job.assessment && !job.error)) {
      if (await stop()) return task
      const batch = task.jobs.filter(job => !job.assessment && !job.error).slice(0, 5)
      await save({ message: `正在对照简历核对岗位（${task.jobs.filter(job => job.assessment).length}/${task.jobs.length}）…` })
      const matched = await tools.match(plan, batch.map(matchingInput))
      if (matched.results.length !== batch.length || new Set(matched.results.map(item => item.id)).size !== batch.length || matched.results.some(result => !batch.some(job => job.id === result.id))) throw new Error('岗位结果不完整，请继续任务重试。')
      await save({ jobs: task.jobs.map(job => {
        const assessment = matched.results.find(result => result.id === job.id)
        return assessment ? { ...job, assessment, error: undefined } : job
      }) })
    }
    if (await stop()) return task
    await save({ status: 'complete', message: task.jobs.length ? `已整理 ${task.jobs.length} 个岗位${task.jobs.length >= ASSISTANT_JOB_LIMIT ? '，达到本次 30 个上限，可缩小范围再找。' : '，可以核对后加入投递清单。'}` : '这次没有找到符合方向的岗位，可以调整目标或补充官网链接。' })
  } catch (error) {
    // A failed checkpoint must stop the run as well; do not continue costly work.
    task = { ...task, status: 'paused', message: error instanceof Error ? error.message : '任务中断，可以继续。', updatedAt: Date.now() }
    await tools.checkpoint(task)
  }
  return task
}
