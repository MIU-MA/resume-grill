import { chromium, type Browser } from 'playwright-core'
import { createBrowserBatch } from './browser-batch.ts'
import { runApplicationQueue, type BrowserDeliveryAdapter } from './application-queue.ts'
import type { SimulationBatch } from '../domain/browser-application.ts'
const address = 'https://resume-grill.invalid/simulation'
const fixture = `<!doctype html><meta charset="utf-8"><h1>模拟招聘会话</h1><main data-recipient=""></main><textarea></textarea><button id="send">发送到模拟会话</button><input type="file" accept="image/png,image/jpeg"><div id="messages"></div><script>
let next=0;const messages=document.querySelector('#messages');
document.querySelector('#send').onclick=()=>{const message=document.createElement('p');message.dataset.receipt=String(++next);message.dataset.step=window.currentStep;message.dataset.value=document.querySelector('textarea').value;message.textContent=message.dataset.value;messages.append(message)};
document.querySelector('input').onchange=async event=>{const file=event.target.files[0];if(!file)return;const bytes=await file.arrayBuffer();const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),b=>b.toString(16).padStart(2,'0')).join('');const image=document.createElement('img');image.src=URL.createObjectURL(file);await image.decode();image.dataset.receipt=String(++next);image.dataset.step=window.currentStep;image.dataset.value=hash;messages.append(image);event.target.value=''};
</script>`
export function createBossSimulation(directory: string) {
  return createBrowserBatch(directory, { mode: 'simulation', execute: async (batch: SimulationBatch, run, save, stopped) => {
    let browser: Browser | undefined
    try {
      for (const channel of ['msedge', 'chrome']) { try { browser = await chromium.launch({ channel, headless: true }); break } catch {} }
      if (!browser) throw new Error('未找到可用 Chrome / Edge，未执行模拟任务')
      const context = await browser.newContext({ serviceWorkers: 'block', acceptDownloads: false })
      await context.route('**/*', route => route.request().url() === address ? route.fulfill({ contentType: 'text/html', body: fixture }) : route.abort())
      const page = await context.newPage()
      const adapter: BrowserDeliveryAdapter = {
        async open(task) { await page.goto(address); await page.locator('main').evaluate((node, url) => { (node as HTMLElement).dataset.recipient = url }, task.url) },
        async checkRecipient(task) { return page.url() === address && await page.locator('main').getAttribute('data-recipient') === task.url },
        async send(_task, step) {
          await page.evaluate(id => { (window as unknown as { currentStep: string }).currentStep = id }, step.id)
          if (step.kind === 'greeting') { await page.locator('textarea').fill(step.value); await page.locator('#send').click() }
          else { const image = batch.images.find(item => item.sha256 === step.value); if (!image) throw new Error('模拟任务的图片不存在'); await page.locator('input').setInputFiles({ name: image.name, mimeType: image.type, buffer: Buffer.from(image.base64, 'base64') }) }
        },
        async receipt(_task, step) {
          await page.waitForFunction(id => [...document.querySelectorAll<HTMLElement>('[data-step]')].some(node => node.dataset.step === id), step.id, { timeout: 5000 })
          return page.locator('[data-step]').evaluateAll((nodes, id) => { const node = nodes.find(node => (node as HTMLElement).dataset.step === id) as HTMLElement | undefined; return node ? { id: node.dataset.receipt!, value: node.dataset.value! } : null }, step.id)
        },
      }
      await runApplicationQueue(run, adapter, save, stopped)
    } finally { await browser?.close() }
  } })
}
