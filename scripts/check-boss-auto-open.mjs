import assert from 'node:assert/strict'
import { chromium } from 'playwright-core'
import { createBossPreview } from './boss-preview.mjs'

// A disposable default browser context; all page traffic is synthetic.
const context = await chromium.launchPersistentContext('', { channel: 'msedge', headless: true, args: ['--remote-debugging-port=4341', '--remote-debugging-address=127.0.0.1'] })
let service
try {
  let cookieSeen = false, loads = 0
  await context.addCookies([{ name: 'fixture-session', value: 'fixture-only', url: 'https://www.zhipin.com', secure: true }])
  await context.route('**/*', route => {
    const request = route.request()
    if (request.url() !== 'https://www.zhipin.com/web/geek/jobs') return route.abort()
    loads++; cookieSeen ||= (request.headers().cookie || '').includes('fixture-session=fixture-only')
    return route.fulfill({ contentType: 'text/html; charset=utf-8', body: '<title>BOSS 自动打开测试</title><h1>模拟岗位列表</h1>' })
  })
  service = await createBossPreview({ port: 4328, fixture: true, attach: 'http://127.0.0.1:4341', deferConnect: true })
  const headers = { Authorization: `Bearer ${service.token}` }
  const post = path => fetch(service.origin + path, { method: 'POST', headers })
  const status = async () => (await fetch(service.origin + '/status', { headers })).json()
  const ready = async () => {
    const until = Date.now() + 15000
    while (Date.now() < until) { const value = await status(); if (value.ready) return value; if (value.error) throw new Error(value.error); await new Promise(resolve => setTimeout(resolve, 100)) }
    throw new Error('自动打开未完成')
  }
  assert.equal((await status()).phase, 'disconnected')
  assert.equal(loads, 0, 'startup must not connect or open Chrome on its own')
  assert.equal((await post('/connect')).status, 202)
  let state = await ready()
  assert.equal(loads, 1)
  assert.equal(state.tabs.length, 1)
  assert.equal(cookieSeen, true, 'new page must reuse the current browser session')
  assert.equal(state.protocolCommands['Target.createTarget'], 1)
  await Promise.all([post('/open-boss'), post('/open-boss')])
  assert.equal(loads, 1, 'repeated open requests must not create or reload pages')
  const tab = context.pages().find(page => page.url().startsWith('https://www.zhipin.com/'))
  assert(tab)
  await post('/disconnect')
  assert(!tab.isClosed(), 'disconnect must preserve the opened page and login')
  await post('/connect'); state = await ready()
  assert.equal(loads, 1, 'reconnecting must reuse the existing BOSS tab')
  assert.equal(state.protocolCommands['Target.createTarget'], undefined)
  await tab.close()
  await post('/refresh-tabs')
  assert.equal((await status()).phase, 'selecting')
  assert.equal((await post('/open-boss')).status, 200)
  await ready()
  assert.equal(loads, 2, 'explicit reopen after closing creates only one replacement')
  assert.equal((await status()).sentCount, 0)
  console.log('授权后自动打开、沿用会话、重复操作去重、重连复用及关闭后恢复检查通过；未发送。')
} finally { await service?.close(); await context.close() }
