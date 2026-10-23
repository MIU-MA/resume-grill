import { publicWebsiteQueue, websiteBatchSchema, type FormResult, type WebsiteAnswer, type WebsiteBatch, type WebsiteJob, type WebsiteProfile, type WebsiteQueue } from '../domain/website-automation'

export type QueueTools = {
  load: () => Promise<WebsiteQueue | null>; save: (queue: WebsiteQueue | null) => Promise<void>
  open: (url: string) => Promise<number>; focus: (tabId: number) => Promise<void>
  fill: (job: WebsiteJob, queue: WebsiteQueue) => Promise<FormResult>
}
export function createWebsiteQueue(tools: QueueTools) {
  let pending = Promise.resolve()
  const serial = <T>(work: () => Promise<T>) => {
    const result = pending.catch(() => undefined).then(work)
    pending = result.then(() => undefined, () => undefined)
    return result
  }
  const write = async (queue: WebsiteQueue) => { queue.updatedAt = Date.now(); await tools.save(queue) }
  const recover = async () => serial(async () => {
    const queue = await tools.load()
    if (queue) {
      queue.running = false
      for (const job of queue.jobs) if (['opening', 'filling'].includes(job.status)) { job.status = 'waiting'; job.detail = '浏览器或扩展已重启，点击继续检查当前页面。'; job.attempt = undefined }
      await write(queue)
    }
  })
  const stage = (input: WebsiteBatch) => serial(async () => {
    const batch = websiteBatchSchema.parse(input)
    const previous = await tools.load()
    if (previous && previous.id !== batch.id && previous.jobs.some(job => !['done', 'skipped'].includes(job.status))) throw new Error('扩展中还有未处理的岗位，请先完成或清空上一批。')
    if (previous?.id === batch.id) return publicWebsiteQueue(previous)
    const queue: WebsiteQueue = { ...batch, jobs: batch.jobs.map(job => ({ ...job, status: 'pending' })), running: false, updatedAt: Date.now(), answers: previous?.answers ?? [] }
    await write(queue); return publicWebsiteQueue(queue)
  })
  const pump = async () => {
    // Each tool result is checked against its attempt before saving: pause, skip,
    // clear and resume commands can safely arrive while a page is loading.
    const work = await serial(async () => {
      const queue = await tools.load()
      if (!queue?.running || queue.jobs.some(job => ['opening', 'filling'].includes(job.status))) return null
      const job = queue.jobs.find(job => job.status === 'pending')
      if (!job) { queue.running = false; await write(queue); return null }
      job.status = job.tabId === undefined ? 'opening' : 'filling'; job.attempt = crypto.randomUUID(); job.detail = ''
      await write(queue)
      return { queue, job: { ...job }, attempt: job.attempt }
    })
    if (!work) return
    try {
      let tabId = work.job.tabId
      if (tabId === undefined) tabId = await tools.open(work.job.url)
      const captured = await serial(async () => {
        const queue = await tools.load(); const job = queue?.jobs.find(job => job.id === work.job.id)
        if (!queue || !job || job.attempt !== work.attempt || !['opening', 'filling'].includes(job.status)) return null
        job.tabId = tabId; job.status = 'filling'; await write(queue)
        return { queue, job: { ...job } }
      })
      if (!captured) return
      const result = await tools.fill(captured.job, captured.queue)
      await serial(async () => {
        const queue = await tools.load(); const job = queue?.jobs.find(job => job.id === work.job.id)
        if (!queue || !job || job.attempt !== work.attempt) return
        job.result = result; job.status = result.missing.length ? 'waiting' : 'ready'; job.detail = result.message; job.attempt = undefined
        await write(queue)
      })
    } catch (error) {
      await serial(async () => {
        const queue = await tools.load(); const job = queue?.jobs.find(job => job.id === work.job.id)
        if (!queue || !job || job.attempt !== work.attempt) return
        job.status = 'waiting'; job.attempt = undefined; job.detail = error instanceof Error ? error.message : '页面未能处理，可稍后继续。'
        await write(queue)
      })
    }
    await pump()
  }
  const command = async (action: 'start' | 'pause' | 'resume-job' | 'done' | 'skip' | 'clear', id?: string, profile?: WebsiteProfile, answers?: WebsiteAnswer[], options?: { authorizedOrigin?: string; reopen?: boolean }) => {
    const snapshot = await serial(async () => {
      const queue = await tools.load()
      if (!queue) throw new Error('先从工作台添加一批官网申请。')
      if (action === 'clear') { await tools.save(null); return null }
      if (profile) queue.profile = { ...queue.profile, ...profile }
      if (answers) for (const answer of answers) {
        queue.answers = queue.answers.filter(item => !(item.origin === answer.origin && item.scope === answer.scope && item.label === answer.label)); queue.answers.push(answer)
      }
      queue.answers = queue.answers.slice(-80)
      if (action === 'start') queue.running = true
      if (action === 'pause') queue.running = false
      if (['resume-job', 'done', 'skip'].includes(action)) {
        const job = queue.jobs.find(job => job.id === id)
        if (!job) throw new Error('没有找到这个岗位。')
        if (['opening', 'filling'].includes(job.status)) throw new Error('页面正在填写，请稍后再操作。')
        if (action === 'resume-job') {
          if (['done', 'skipped'].includes(job.status)) throw new Error('已结束的岗位不会再次填写。')
          job.status = 'pending'; job.result = undefined; job.attempt = undefined; queue.running = true
          if (options?.authorizedOrigin) job.authorizedOrigins = [...new Set([new URL(job.url).origin, ...(job.authorizedOrigins ?? []), options.authorizedOrigin])]
          if (options?.reopen) job.tabId = undefined
          // Reuse newly supplied common data for other blocked forms, without
          // retrying login, custom widgets or unrelated questions automatically.
          for (const other of queue.jobs) if (other.id !== job.id && other.status === 'waiting' && other.result?.missing.length && other.result.missing.every(field => field.kind === 'profile' && field.key && queue.profile[field.key])) {
            other.status = 'pending'; other.result = undefined; other.attempt = undefined
          }
        } else { job.status = action === 'done' ? 'done' : 'skipped'; job.attempt = undefined }
      }
      await write(queue); return publicWebsiteQueue(queue)
    })
    if (snapshot?.running) void pump().catch(() => undefined)
    return snapshot
  }
  const focus = async (id: string) => {
    const queue = await tools.load(); const job = queue?.jobs.find(job => job.id === id)
    if (job?.tabId === undefined) throw new Error('这个岗位还未打开，请先开始填写。')
    await tools.focus(job.tabId)
  }
  return { stage, command, focus, recover, snapshot: async () => publicWebsiteQueue(await tools.load()), pump }
}
