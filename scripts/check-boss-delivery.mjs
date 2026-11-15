import assert from 'node:assert/strict'
import { chromium } from 'playwright-core'
import { createCanvas } from '@napi-rs/canvas'
import { createHash, randomUUID } from 'node:crypto'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { resolve, relative, join } from 'node:path'
import { createBossPreview } from './boss-preview.mjs'

const directory = await mkdtemp(join(tmpdir(), 'resume-grill-delivery-'))
const checked = relative(resolve(tmpdir()), resolve(directory))
if (!/^resume-grill-delivery-[^\\/]+$/.test(checked)) throw new Error('测试临时目录无效')
const owner = await chromium.launch({ channel: 'msedge', headless: true, proxy: { server: 'http://127.0.0.1:9' }, args: ['--remote-debugging-port=4332', '--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE 127.0.0.1, EXCLUDE localhost'] })
let service
const counts = { contact: 0, text: 0, image: 0 }
const detail = index => `<!doctype html><meta charset="utf-8"><div class="job-banner"><h1>全栈开发${index}</h1></div><div class="sider-company"><div class="company-name">测试公司${index === '3' ? '错误' : index}</div></div><section class="job-sec-text">使用 React 和 Node.js 完成全栈开发。</section><button id="contact">立即沟通</button><div id="panel"></div><script>
let next=0;
document.querySelector('#contact').onclick=()=>{fetch('https://fixture.invalid/contact');document.querySelector('#contact').hidden=true;document.querySelector('#panel').innerHTML='<div class="chat-editor"><div id="chat-input" class="chat-input" contenteditable="true"></div><button id="send">发送</button><input type="file" accept="image/png,image/jpeg"></div><div id="messages"></div>';document.querySelector('#send').onclick=()=>{const editor=document.querySelector('#chat-input');const message=document.createElement('div');message.className='chat-message-self';message.dataset.mid=String(++next);const text=document.createElement('span');text.className='message-content';text.textContent=editor.textContent;message.append(text);if(${index !== '4'})document.querySelector('#messages').append(message);editor.textContent='';fetch('https://fixture.invalid/text')};document.querySelector('input').onchange=async event=>{const file=event.target.files[0];const image=document.createElement('img');image.src=URL.createObjectURL(file);await image.decode();const message=document.createElement('div');message.className='chat-message-self';message.dataset.mid=String(++next);message.append(image);document.querySelector('#messages').append(message);fetch('https://fixture.invalid/image')}};
</script>`
try {
  const context = await owner.newContext()
  await context.route('**/*', route => {
    const url = new URL(route.request().url())
    if (url.hostname === 'fixture.invalid') { if (url.pathname.slice(1) in counts) counts[url.pathname.slice(1)]++; return route.fulfill({ contentType: 'application/json', body: '{}' }) }
    if (url.hostname !== 'www.zhipin.com') return route.abort()
    const match = url.pathname.match(/^\/job_detail\/fixture-(\d)\.html$/)
    if (match) return route.fulfill({ contentType: 'text/html', body: detail(match[1]) })
    if (url.pathname === '/web/geek/jobs') return route.fulfill({ contentType: 'text/html; charset=utf-8', body: '<title>批次测试列表</title><h1>模拟岗位列表</h1>' })
    return route.abort()
  })
  const source = await context.newPage(); await source.goto('https://www.zhipin.com/web/geek/jobs')
  service = await createBossPreview({ port: 4328, fixture: true, attach: 'http://127.0.0.1:4332', deferConnect: true, autoOpenBoss: false, deliveryDirectory: directory })
  const headers = { Authorization: `Bearer ${service.token}`, 'Content-Type': 'application/json' }
  const call = async (path, body) => { const response = await fetch(service.origin + path, { method: body === undefined ? 'GET' : 'POST', headers, ...(body === undefined ? {} : { body: JSON.stringify(body) }) }); return { status: response.status, value: await response.json() } }
  const until = async (read, done, timeout = 25000) => { const end = Date.now() + timeout; while (Date.now() < end) { const value = await read(); if (done(value)) return value; await new Promise(resolve => setTimeout(resolve, 100)) } throw new Error('测试等待超时') }
  await call('/connect', {})
  const state = await until(() => call('/status'), result => result.value.phase === 'selecting')
  await call('/select', { id: state.value.tabs[0].id })
  const bytes = createCanvas(24, 32).toBuffer('image/png')
  const batch = { id: randomUUID(), jobs: [1, 2].map(index => ({ url: `https://www.zhipin.com/job_detail/fixture-${index}.html`, company: `测试公司${index}`, title: `全栈开发${index}`, greeting: `测试岗位${index}，使用 React 和 Node.js 完成项目。` })), images: [{ name: '测试简历.png', type: 'image/png', base64: bytes.toString('base64'), sha256: createHash('sha256').update(bytes).digest('hex') }] }
  const preview = await call('/boss-batch/preview', batch)
  assert.equal(preview.status, 200, JSON.stringify(preview))
  assert.deepEqual(counts, { contact: 0, text: 0, image: 0 }, 'preview must have zero contact/send/upload effects')
  assert.equal((await call('/boss-batch/confirm', { id: preview.value.id, confirmed: false, defaultGreetingAccepted: true })).status, 400)
  assert.equal((await call('/boss-batch/confirm', { id: preview.value.id, confirmed: true, defaultGreetingAccepted: true })).status, 200)
  const result = await until(() => call('/boss-batch/' + batch.id), value => value.value.state !== 'running')
  assert.equal(result.value.state, 'finished', JSON.stringify(result.value))
  assert(result.value.tasks.every(task => task.state === 'verified' && task.steps.every(step => step.state === 'verified' && step.receipt)))
  assert.deepEqual(counts, { contact: 2, text: 2, image: 2 })
  await call('/boss-batch/confirm', { id: preview.value.id, confirmed: true, defaultGreetingAccepted: true })
  assert.deepEqual(counts, { contact: 2, text: 2, image: 2 }, 'retry must not contact or send twice')
  assert.equal((await call('/boss-batch/preview', { ...batch, id: randomUUID() })).status, 400, 'new batches must exclude contacted jobs')
  assert.equal(source.url(), 'https://www.zhipin.com/web/geek/jobs')
  assert(!source.isClosed())
  const execute = async input => {
    const prepared = await call('/boss-batch/preview', input)
    assert.equal(prepared.status, 200, JSON.stringify(prepared))
    assert.equal((await call('/boss-batch/confirm', { id: prepared.value.id, confirmed: true, defaultGreetingAccepted: true })).status, 200)
    return (await until(() => call('/boss-batch/' + input.id), value => value.value.state !== 'running')).value
  }
  const job = index => ({ url: `https://www.zhipin.com/job_detail/fixture-${index}.html`, company: `测试公司${index}`, title: `全栈开发${index}`, greeting: `核对过的测试正文${index}` })
  const wrong = await execute({ id: randomUUID(), jobs: [job(3)], images: [] })
  assert.equal(wrong.state, 'paused')
  assert.equal(wrong.tasks[0].state, 'failed')
  assert.deepEqual(counts, { contact: 2, text: 2, image: 2 }, 'identity mismatch must not contact anyone')
  const unknown = await execute({ id: randomUUID(), jobs: [job(4), job(5)], images: [] })
  assert.equal(unknown.state, 'paused')
  assert.equal(unknown.tasks[0].state, 'uncertain')
  assert.equal(unknown.tasks[0].steps[1].state, 'uncertain')
  assert.equal(unknown.tasks[1].state, 'queued')
  assert.deepEqual(counts, { contact: 3, text: 3, image: 2 }, 'missing receipt stops the batch without retries')
  assert.equal((await call('/boss-batch/preview', { id: randomUUID(), jobs: [job(4)], images: [] })).status, 400, 'uncertain send cannot be retried in a new batch')
  assert.equal((await call('/boss-batch/preview', { id: randomUUID(), jobs: [job(5)], images: [] })).status, 200, 'untouched jobs can be prepared again')
  console.log('隔离两岗位整批确认、建立沟通、文字+图片发送、回执、跨批次去重、身份错配阻断、缺失回执暂停和源页面保留检查通过；未访问真实招聘方。')
} finally { await service?.close(); await owner.close(); await rm(resolve(directory), { recursive: true, force: true }) }
