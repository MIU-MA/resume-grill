import type { BrowserRun, BrowserTask, BrowserStep } from '../domain/browser-application.ts'

export type BrowserDeliveryAdapter = {
  open(task: BrowserTask): Promise<void>
  checkRecipient(task: BrowserTask): Promise<boolean>
  send(task: BrowserTask, step: BrowserStep): Promise<void>
  receipt(task: BrowserTask, step: BrowserStep): Promise<{ id: string; value: string } | null>
}

/** Persist intent before every side effect. Never replay a step with an ambiguous outcome. */
export async function runApplicationQueue(run: BrowserRun, adapter: BrowserDeliveryAdapter, save: (run: BrowserRun) => Promise<void>, stopped: () => boolean = () => false) {
  const persist = async () => { run.updatedAt = Math.max(Date.now(), run.updatedAt + 1); await save(structuredClone(run)) }
  run.state = 'running'
  for (const task of run.tasks) {
    if (task.state === 'verified' || task.state === 'uncertain') continue
    if (task.steps.some(step => step.state === 'sending' || step.state === 'uncertain')) {
      task.state = 'uncertain'; task.error = '上次执行未获得可靠回执，请先核对，不能自动重发。'; await persist(); continue
    }
    if (stopped()) { run.state = 'paused'; await persist(); return run }
    task.state = 'running'; await persist()
    try {
      await adapter.open(task)
      for (const step of task.steps) {
        if (step.state === 'verified') continue
        if (stopped()) { task.state = 'queued'; run.state = 'paused'; await persist(); return run }
        if (!await adapter.checkRecipient(task)) throw new Error('当前会话与选中岗位不一致，已停止此岗位。')
        step.state = 'sending'
        await persist() // A failed journal write must prevent sending.
        await adapter.send(task, step)
        const receipt = await adapter.receipt(task, step)
        if (!receipt?.id || receipt.value !== step.value || !await adapter.checkRecipient(task)) throw new Error('页面回执与本次内容或收件会话不一致。')
        step.state = 'verified'; step.receipt = receipt.id
        await persist()
      }
      task.state = 'verified'; task.verifiedAt = Date.now(); await persist()
    } catch (failure) {
      const inFlight = task.steps.find(step => step.state === 'sending')
      if (inFlight) inFlight.state = 'uncertain'
      task.state = inFlight || task.steps.some(step => step.state === 'verified') ? 'uncertain' : 'failed'
      task.error = failure instanceof Error ? failure.message : '执行失败'
      await persist()
      // Stop the batch on mismatch/unknown result instead of continuing blind.
      run.state = 'paused'; await persist(); return run
    }
  }
  run.state = run.tasks.some(task => task.state === 'uncertain' || task.state === 'failed') ? 'paused' : 'finished'; await persist(); return run
}
