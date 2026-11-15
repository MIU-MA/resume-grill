import assert from 'node:assert/strict'
import { randomUUID, createHash } from 'node:crypto'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, relative, resolve } from 'node:path'
import { tsImport } from 'tsx/esm/api'
import { createBossPreview } from './boss-preview.mjs'
import { createCanvas } from '@napi-rs/canvas'
const { createBossSimulation } = await tsImport('../src/browser-agent/boss-simulation.ts', import.meta.url)
const directory = await mkdtemp(join(tmpdir(), 'resume-grill-simulation-'))
const checked = relative(resolve(tmpdir()), resolve(directory))
if (!/^resume-grill-simulation-[^\\/]+$/.test(checked)) throw new Error('拒绝清理非测试临时目录')
const service = await createBossPreview({ port: 4328, attach: true, deferConnect: true, simulationDirectory: directory })
const auth = { Authorization: `Bearer ${service.token}`, 'Content-Type': 'application/json' }
const manager = {
  async start(value) { const response = await fetch(service.origin + '/simulation', { method: 'POST', headers: auth, body: JSON.stringify(value) }); const result = await response.json(); if (!response.ok) throw new Error(result.error); return result },
  async status(id) { return (await fetch(service.origin + '/simulation/' + id, { headers: auth })).json() },
  close: () => service.close(),
}
try {
  const image = createCanvas(40, 60).toBuffer('image/png')
  const input = { id: randomUUID(), jobs: [1, 2].map(index => ({ title: '演示岗位', company: '演示公司', url: `https://www.zhipin.com/job_detail/test-${index}.html`, greeting: '测试招呼语，不联系招聘方。' })), images: [{ name: '测试简历.png', type: 'image/png', sha256: createHash('sha256').update(image).digest('hex'), base64: image.toString('base64') }] }
  assert.equal((await fetch(service.origin + '/simulation', { method: 'POST', body: JSON.stringify(input) })).status, 401)
  await Promise.all([manager.start(input), manager.start(input)])
  const end = Date.now() + 20000
  let run
  do { run = await manager.status(input.id); if (run.state !== 'running') break; await new Promise(resolve => setTimeout(resolve, 100)) } while (Date.now() < end)
  assert.equal(run.state, 'finished', JSON.stringify(run))
  assert(run.tasks.every(task => task.state === 'verified' && task.steps.length === 2 && task.steps.every(step => step.state === 'verified' && step.receipt)))
  assert.equal((await manager.start(input)).updatedAt, run.updatedAt, 'repeated requests must not execute again')
  await assert.rejects(manager.start({ ...input, jobs: input.jobs.map(job => ({ ...job, greeting: '内容已更换' })) }), /内容已变化/)
  const browserState = await (await fetch(service.origin + '/status', { headers: auth })).json()
  assert.equal(browserState.browserConnected, false, 'simulation must never connect daily Chrome')
  assert.deepEqual(browserState.protocolCommands, {})
  const restored = createBossSimulation(directory)
  assert.equal((await restored.status(input.id)).state, 'finished')
  await restored.close()
  console.log('两岗位招呼语+真实图片输入、页面回执、重复请求去重、日志恢复检查通过；真实投递数为 0。')
} finally { if(service) await service.close(); await rm(resolve(directory), { recursive: true, force: true }) }
