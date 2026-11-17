import { randomUUID, createHash } from 'node:crypto'
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises'
import { join, relative, resolve } from 'node:path'
import { tmpdir } from 'node:os'
import { createCanvas } from '@napi-rs/canvas'
import { afterEach, expect, it, vi } from 'vitest'
import { createBossBatch } from './boss-batch'
import type { BrowserRun } from '../domain/browser-application'

const directories: string[] = []
afterEach(async () => {
  for (const directory of directories.splice(0)) {
    if (!/^boss-remaining-[^\\/]+$/.test(relative(resolve(tmpdir()), resolve(directory)))) throw new Error('测试目录无效')
    await rm(directory, { recursive: true, force: true })
  }
})
async function fixture() {
  const directory = await mkdtemp(join(tmpdir(), 'boss-remaining-')); directories.push(directory)
  const image = createCanvas(2, 2).toBuffer('image/png'), sha256 = createHash('sha256').update(image).digest('hex')
  const id = randomUUID()
  const task = (index: number): BrowserRun['tasks'][number] => ({ url: `https://www.zhipin.com/job_detail/remaining-${index}.html`, company: `测试公司${index}`, title: '开发', state: 'queued', steps: [
    { id: `${index}:contact`, kind: 'contact', value: 'url', state: 'pending' },
    { id: `${index}:text`, kind: 'greeting', value: '原批次草稿', state: 'pending' },
    { id: `${index}:image:0`, kind: 'image', value: sha256, state: 'pending' },
  ] })
  const run: BrowserRun = { id, mode: 'boss', state: 'paused', createdAt: 1, updatedAt: 2, tasks: [task(0), task(1)] }
  run.tasks[0].state = 'uncertain'; run.tasks[0].steps[0].state = 'verified'; run.tasks[0].steps[0].receipt = 'existing-contact'
  const save = async () => writeFile(join(directory, id + '.json'), JSON.stringify({ run, fingerprint: 'original' }))
  await mkdir(join(directory, id, 'images'), { recursive: true }); await writeFile(join(directory, id, 'images', '0.png'), image); await save()
  const open = vi.fn()
  const current = (() => ({ browser: { isConnected: () => true, withJobPage: open }, source: { browserContextId: () => 'fixture' } })) as unknown as Parameters<typeof createBossBatch>[1]
  const manager = createBossBatch(directory, current, vi.fn())
  return { directory, id, image, sha256, run, save, manager, open }
}
it('继续只准备完全未执行的岗位，沿用原图片并重新核对，不直接发送', async () => {
  const value = await fixture()
  const preview = await value.manager.prepareRemaining(value.id)
  expect(preview.jobs.map(job => job.company)).toEqual(['测试公司1'])
  expect(preview.batchId).not.toBe(value.id)
  expect(preview.images[0].sha256).toBe(value.sha256)
  expect(preview.greetingMode).toBe('platform')
  expect(value.open).not.toHaveBeenCalled()
  await value.manager.close()
})
it('图片被替换不能悄悄使用新附件', async () => {
  const value = await fixture()
  await writeFile(join(value.directory, value.id, 'images', '0.png'), 'changed')
  await expect(value.manager.prepareRemaining(value.id)).rejects.toThrow('图片已变化')
  expect(value.open).not.toHaveBeenCalled()
})
it('没有完全未执行的岗位时拒绝继续，不能重试不确定图片', async () => {
  const value = await fixture()
  value.run.tasks[1].state = 'uncertain'; value.run.tasks[1].steps[2].state = 'uncertain'; await value.save()
  await expect(value.manager.prepareRemaining(value.id)).rejects.toThrow('没有完全未执行')
  expect(value.open).not.toHaveBeenCalled()
})
it('剩余岗位已被其他批次联系时仍会排除，不绕过去重', async () => {
  const value = await fixture()
  const another: BrowserRun = { ...value.run, id: randomUUID(), tasks: [{ ...value.run.tasks[1], state: 'verified' }] }
  await writeFile(join(value.directory, another.id + '.json'), JSON.stringify({ run: another, fingerprint: 'another' }))
  await expect(value.manager.prepareRemaining(value.id)).rejects.toThrow('已有联系记录')
  expect(value.open).not.toHaveBeenCalled()
})
