import { createServer } from 'node:http'
import assert from 'node:assert/strict'
import { build } from 'esbuild'
import { chromium } from 'playwright-core'
import { mkdir } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { createBossPreview } from './boss-preview.mjs'

// Synthetic browser only: exercise the real React component and authenticated frame API.
const service = await createBossPreview({ port: 4328, fixture: true, headless: true, stream: false })
let viewer, host
try {
  const connection = { origin: service.origin, token: service.token }
  const demo = `import React, {useEffect,useState} from 'react';
import {BossLivePreview} from './src/features/applications/website/BossLivePreview.tsx';
function Demo(){
  const [connected,setConnected]=useState(false);
  useEffect(()=>{setConnected(true)},[]);
  return <BossLivePreview connection={${JSON.stringify(connection)}} connected={connected}/>;
}
`
  const bundle = (code, platform) => build({
    stdin: { contents: demo + code, resolveDir: process.cwd(), loader: 'tsx' },
    bundle: true, write: false, jsx: 'automatic', platform,
    ...(platform === 'node' ? { packages: 'external' } : {}),
    define: { 'process.env.NODE_ENV': '"production"' },
  })
  const [server, browser] = await Promise.all([
    bundle("import{renderToString}from'react-dom/server';export const html=renderToString(<Demo/>);", 'node'),
    bundle("import{hydrateRoot}from'react-dom/client';window.hydrateDemo=()=>hydrateRoot(document.getElementById('app'),<Demo/>);", 'browser'),
  ])
  const ssr = { exports: {} }
  new Function('require', 'module', 'exports', server.outputFiles[0].text)(createRequire(import.meta.url), ssr, ssr.exports)
  viewer = await chromium.launch({ channel: 'msedge', headless: true })
  const page = await viewer.newPage({ viewport: { width: 1100, height: 800 } })
  host = createServer((_req, res) => { res.setHeader('Content-Type', 'text/html; charset=utf-8'); res.end(`<div id="app">${ssr.exports.html}</div><script>${browser.outputFiles[0].text.replaceAll('</script', '<\\/script')}</script>`) })
  await new Promise(done => host.listen(4340, '127.0.0.1', done))
  let loads = 0
  service.page.on('request', req => { if (req.isNavigationRequest()) loads++ })
  page.on('console', message => { if(message.type()==='error') console.error(message.text()) }); page.on('pageerror',error=>console.error(error.message))
  await page.goto('http://127.0.0.1:4340/')
  // A frame emitted by SSR can finish loading before React attaches listeners.
  if (await page.locator('iframe').count()) await page.frameLocator('iframe').locator('#empty').waitFor({ state: 'attached' })
  await page.evaluate(() => window.hydrateDemo())
  await page.getByRole('button', { name: '开始预览' }).click()
  const image = page.frameLocator('iframe').locator('img[src^="blob:"]')
  await image.waitFor({ state: 'visible', timeout: 10000 }).catch(async error => { console.error(await page.locator('body').innerText()); throw error })
  await image.evaluate(node => node.decode())
  const before = await image.screenshot()
  const firstSource = await image.getAttribute('src')
  const originalScreenshot = service.page.screenshot
  service.page.screenshot = async function () {
    this.screenshot = originalScreenshot
    throw new Error('Cannot find context with specified id')
  }
  const temporaryFailure = page.waitForResponse(res => new URL(res.url()).pathname === '/live-frame' && res.status() === 409, { timeout: 5000 })
  await service.page.evaluate(() => { document.body.style.background = '#f5b462'; document.querySelector('h1').textContent = '实时画面已经变化' })
  assert.equal((await (await temporaryFailure).json()).code, 'FRAME_SWITCH')
  assert.equal(await image.getAttribute('src'), firstSource)
  await page.frames().find(frame => frame.url() === 'about:srcdoc').waitForFunction(src => document.querySelector('img')?.src !== src, firstSource, { timeout: 5000 })
  await image.evaluate(node => node.decode())
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
  console.log('直接打开、实时像素更新、切页后恢复、暂停、鉴权和零官网导航检查通过。')
} finally { await viewer?.close(); await service.close(); if(host) await new Promise(done => host.close(done)) }
