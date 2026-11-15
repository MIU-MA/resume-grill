import { createServer } from 'node:http'
import assert from 'node:assert/strict'
import { build } from 'esbuild'
import { chromium } from 'playwright-core'
import { mkdir } from 'node:fs/promises'
import { createBossPreview } from './boss-preview.mjs'

// Synthetic browser only: exercise the real React component and authenticated frame API.
const service = await createBossPreview({ port: 4328, fixture: true, headless: true, stream: false })
let viewer, host
try {
  const connection = { origin: service.origin, token: service.token }
  const bundle = await build({ stdin: { contents: `import React from 'react';import{createRoot}from'react-dom/client';import{BossLivePreview}from'./src/features/applications/website/BossLivePreview.tsx';createRoot(document.getElementById('app')).render(React.createElement(BossLivePreview,{connection:${JSON.stringify(connection)},connected:true}));`, resolveDir: process.cwd(), loader: 'tsx' }, bundle: true, write: false, jsx: 'automatic', platform: 'browser', define: { 'process.env.NODE_ENV': '"production"' } })
  viewer = await chromium.launch({ channel: 'msedge', headless: true })
  const page = await viewer.newPage({ viewport: { width: 1100, height: 800 } })
  host = createServer((_req, res) => { res.setHeader('Content-Type', 'text/html'); res.end(`<div id="app"></div><script>${bundle.outputFiles[0].text.replaceAll('</script', '<\\/script')}</script>`) })
  await new Promise(done => host.listen(4340, '127.0.0.1', done))
  let loads = 0
  service.page.on('request', req => { if (req.isNavigationRequest()) loads++ })
  page.on('console', message => { if(message.type()==='error') console.error(message.text()) }); page.on('pageerror',error=>console.error(error.message))
  await page.goto('http://127.0.0.1:4340/')
  await page.getByRole('button', { name: '开始预览' }).click()
  const image = page.frameLocator('iframe').locator('img[src^="blob:"]')
  await image.waitFor({ state: 'visible', timeout: 10000 }).catch(async error => { console.error(await page.locator('body').innerText()); throw error })
  await image.evaluate(node => node.decode())
  const before = await image.screenshot()
  await service.page.evaluate(() => { document.body.style.background = '#f5b462'; document.querySelector('h1').textContent = '实时画面已经变化' })
  await page.waitForTimeout(1800)
  const after = await image.screenshot()
  assert(!before.equals(after), 'iframe must show changed pixels without manual refresh')
  const auth = { Authorization: `Bearer ${service.token}` }
  const status = async () => (await fetch(service.origin + '/status', { headers: auth })).json()
  assert((await status()).frameCount >= 2)
  assert.equal(loads, 0, 'live preview must never reload or navigate the source page')
  await page.getByRole('button', { name: '暂停画面' }).click()
  await page.waitForTimeout(300)
  const stopped = (await status()).frameCount
  await page.waitForTimeout(1500)
  assert.equal((await status()).frameCount, stopped, 'pause must stop collection')
  await mkdir('dist', { recursive: true })
  await page.screenshot({ path: 'dist/boss-live-preview-check.png', fullPage: true })
  await service.page.close()
  assert.equal((await fetch(service.origin + '/live-frame', { headers: auth })).status, 503)
  console.log('实时 iframe 像素更新、暂停、鉴权和零官网导航检查通过。')
} finally { await viewer?.close(); await service.close(); if(host) await new Promise(done => host.close(done)) }
