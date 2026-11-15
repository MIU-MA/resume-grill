import { createHash } from 'node:crypto'
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { simulationBatchSchema, type BrowserRun, type BrowserTask, type SimulationBatch } from '../domain/browser-application.ts'
type Options = { mode: BrowserRun['mode']; tasks?: (batch: SimulationBatch) => BrowserTask[]; execute: (batch: SimulationBatch, run: BrowserRun, save: (value: BrowserRun) => Promise<void>, stopped: () => boolean) => Promise<void> }
export function validateBrowserBatch(value: unknown) {
  const batch = simulationBatchSchema.parse(value)
  if (new Set(batch.images.map(image => image.sha256)).size !== batch.images.length) throw new Error('存在重复图片，请移除重复文件')
  let total = 0
  for (const image of batch.images) {
    const bytes = Buffer.from(image.base64, 'base64'); total += bytes.length
    const valid = image.type === 'image/png' ? bytes.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10])) : bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255
    if (!valid || !bytes.length || bytes.length > 5 * 1024 * 1024 || total > 10 * 1024 * 1024 || createHash('sha256').update(bytes).digest('hex') !== image.sha256) throw new Error('图片内容、大小或校验值不匹配')
  }
  return batch
}
export function createBrowserBatch(directory: string, options: Options) {
  const active = new Map<string, { run: BrowserRun; stop: boolean; fingerprint: string; done?: Promise<void> }>()
  const save = async (run: BrowserRun, fingerprint: string) => {
    await mkdir(directory, { recursive: true })
    const path = join(directory, `${run.id}.json`)
    await writeFile(path + '.tmp', JSON.stringify({ run, fingerprint }), { mode: 0o600 })
    await rename(path + '.tmp', path)
  }
  const load = async (id: string) => {
    if (!/^[a-f0-9-]{36}$/.test(id)) throw new Error('无效任务编号')
    try { return JSON.parse(await readFile(join(directory, `${id}.json`), 'utf8')) as { run: BrowserRun; fingerprint: string } }
    catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return undefined; throw error }
  }
  const recover = (run: BrowserRun) => {
    if (run.state === 'running') { run.state = 'paused'; for (const task of run.tasks) if (task.state === 'running') { task.state = 'uncertain'; task.error = '服务曾退出，请核对；不会自动重发。' } }
    return run
  }
  const begin = async (value: unknown) => {
    const batch = validateBrowserBatch(value)
    const fingerprint = createHash('sha256').update(JSON.stringify(batch)).digest('hex')
    const previous = active.get(batch.id) ?? await load(batch.id)
    if (previous) { if (previous.fingerprint !== fingerprint) throw new Error('同一任务编号的核对内容已变化，请新建批次'); return active.has(batch.id) ? previous.run : recover(previous.run) }
    if ([...active.values()].some(item => item.run.state === 'running')) throw new Error('已有批次正在执行')
    const now = Date.now()
    const run: BrowserRun = { id: batch.id, mode: options.mode, state: 'running', createdAt: now, updatedAt: now, tasks: options.tasks ? options.tasks(batch) : batch.jobs.map((job, index) => ({ ...job, state: 'queued', steps: [{ id: `${index}:text`, kind: 'greeting', value: job.greeting, state: 'pending' }, ...batch.images.map((image, number) => ({ id: `${index}:image:${number}`, kind: 'image' as const, value: image.sha256, state: 'pending' as const }))] })) }
    await save(run, fingerprint)
    const entry = { run, fingerprint, stop: false, done: undefined as Promise<void> | undefined }; active.set(run.id, entry)
    entry.done = (async () => {
      try { await options.execute(batch, run, current => save(current, fingerprint), () => entry.stop) }
      catch (error) { run.state = 'failed'; run.updatedAt = Math.max(Date.now(), run.updatedAt + 1); run.error = error instanceof Error ? error.message : '执行失败'; await save(run, fingerprint) }
    })()
    void entry.done.catch(() => { run.state = 'failed'; run.error = '执行日志保存失败，请核对；不能因此重新发送。' })
    return run
  }
  let admission = Promise.resolve()
  return {
    start(value: unknown) { const result = admission.catch(() => undefined).then(() => begin(value)); admission = result.then(() => undefined, () => undefined); return result },
    async status(id: string) { const current = active.get(id); if (current) return current.run; const saved = await load(id); if (!saved) throw new Error('没有找到批次'); return recover(saved.run) },
    stop(id: string) { const entry = active.get(id); if (entry) entry.stop = true },
    async close() { for (const entry of active.values()) entry.stop = true; await Promise.allSettled([...active.values()].map(entry => entry.done)) },
  }
}
