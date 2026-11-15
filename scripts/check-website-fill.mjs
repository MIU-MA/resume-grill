import assert from 'node:assert/strict'
import { fileURLToPath } from 'node:url'
import { build } from 'esbuild'
import { chromium } from 'playwright-core'

// Use a separate, network-isolated browser. Never attach a real recruitment account.
const root = fileURLToPath(new URL('../', import.meta.url))
const { outputFiles } = await build({ entryPoints: [fileURLToPath(new URL('../src/browser-extension/form-filler.ts', import.meta.url))], absWorkingDir: root, bundle: true, write: false, format: 'iife', globalName: 'ResumeFill' })
const browser = await chromium.launch({ channel: 'msedge', headless: true })
try {
  const context = await browser.newContext()
  let outside = 0
  await context.route('**/*', route => {
    if (route.request().url() === 'https://forms.resume-grill.invalid/apply') return route.fulfill({ contentType: 'text/html', body: '<title>Isolated form test</title>' })
    outside++; return route.abort()
  })
  const page = await context.newPage()
  await page.goto('https://forms.resume-grill.invalid/apply')
  const setup = async html => { await page.setContent(html); await page.addScriptTag({ content: outputFiles[0].text }) }
  const fill = data => page.evaluate(data => window.ResumeFill.fillApplication(data.profile ?? {}, [], data.attachment ?? null, '', data.experiences ?? []), data)
  const experiences = ['甲公司', '乙公司'].map((organization, index) => ({ id: String(index), kind: 'work', organization, title: '全栈工程师', start: '2023-01', end: '2024-02', description: `项目内容 ${index + 1}` }))
  await setup('<form><label>姓名<input id="name"></label><label>学历<select><option value="">请选择</option><option value="bachelor">本科</option></select></label><fieldset><legend>工作经历</legend><label>公司<input value="乙公司"></label><label>职位<input></label><label>开始时间<input type="month"></label><label>工作内容<textarea></textarea></label></fieldset><fieldset><legend>工作经历</legend><label>公司<input value="甲公司"></label><label>职位<input></label><label>开始时间<input type="month"></label><label>工作内容<textarea></textarea></label></fieldset><label>简历<input type="file" accept=".pdf"></label><button type="submit">提交申请</button></form>')
  await page.evaluate(() => { window.submits = 0; document.querySelector('form').onsubmit = event => { event.preventDefault(); window.submits++ } })
  const result = await fill({ profile: { name: '测试人', degree: '本科' }, experiences, attachment: { name: 'test.pdf', base64: 'JVBERi0xLjcK' } })
  assert.deepEqual(result.missing, [])
  assert.equal(result.uploaded, true)
  assert.deepEqual(await page.locator('textarea').evaluateAll(nodes => nodes.map(node => node.value)), ['项目内容 2', '项目内容 1'])
  assert.equal(await page.locator('select').inputValue(), 'bachelor')
  assert.equal(await page.locator('input[type=month]').first().inputValue(), '2023-01')
  assert.equal(await page.evaluate(() => window.submits), 0)
  assert.deepEqual((await fill({ profile: { name: '测试人', degree: '本科' }, experiences })).filled, [])

  await setup('<form><label>姓名<input id="name"></label><label>邮箱<input id="email" type="email"></label></form>')
  await page.evaluate(() => { document.querySelector('#name').onchange = () => { const form = document.querySelector('form'); form.replaceWith(form.cloneNode(true)) } })
  assert.deepEqual((await fill({ profile: { name: '测试人', email: 'test@example.com' } })).filled, ['姓名', '邮箱'])
  assert.equal(await page.locator('#email').inputValue(), 'test@example.com')

  await setup('<form><label>姓名<input></label></form>')
  await page.evaluate(() => { document.querySelector('input').onchange = event => setTimeout(() => { event.target.value = ''; document.querySelector('form').insertAdjacentHTML('beforeend', '<label>工作地点<input required></label>') }, 200) })
  const rejected = await fill({ profile: { name: '测试人' } })
  assert.deepEqual(rejected.filled, [])
  assert(rejected.missing.some(field => field.label.includes('工作地点')))
  assert.equal(outside, 0)
  console.log('独立浏览器检查通过：多段经历反序匹配、下拉与月份、附件、重复填写、节点替换、延迟撤回及新增必填项；未提交表单、未访问招聘网站。')
} finally { await browser.close() }
