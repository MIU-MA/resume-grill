// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { inspectBossDetail, readBossDetailDocument } from './boss-inspection'
const expected = { url: 'https://www.zhipin.com/job_detail/one.html', title: 'Full Stack Developer', company: '示例公司' }
const page = { evaluate: async <T,>(read: () => T) => await read() }
beforeEach(() => {
  vi.stubGlobal('location', { href: expected.url + '?securityId=private' })
  vi.spyOn(HTMLElement.prototype, 'getClientRects').mockImplementation(function (this: HTMLElement) { return (this.closest('[hidden]') ? [] : [{}]) as unknown as DOMRectList })
  Object.defineProperty(HTMLElement.prototype, 'innerText', { configurable: true, get() { return this.textContent ?? '' } })
  document.title = '职位详情'
  document.body.innerHTML = '<div class="job-banner"><h1>Full Stack Developer</h1></div><div class="sider-company"><div class="company-name">示例公司</div></div><section class="job-sec-text">React、TypeScript、Node.js，负责业务系统。</section><button>立即沟通</button><div hidden class="geetest_panel">安全验证</div>'
})
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); document.body.innerHTML = ''; delete (HTMLElement.prototype as unknown as Record<string, unknown>).innerText })
it('读取完整 JD 并严格核对身份，不读取私有查询参数、不点击沟通', async () => {
  const clicked = vi.fn(); document.querySelector('button')!.onclick = clicked
  const result = await inspectBossDetail(page, expected)
  expect(result).toMatchObject({ matched: true, blockers: [], kind: 'detail', communication: { enabled: 1, count: 1 } })
  expect(result.description).toContain('Node.js')
  expect(JSON.stringify(result)).not.toContain('private')
  expect(clicked).not.toHaveBeenCalled()
})
it('相同岗位名称但公司或链接不同也不能采用', async () => {
  expect((await inspectBossDetail(page, { ...expected, company: '另一家公司' })).matched).toBe(false)
  expect((await inspectBossDetail(page, { ...expected, url: 'https://www.zhipin.com/job_detail/two.html' })).blockers).not.toHaveLength(0)
})
it('验证和登录优先于正文，不误用页面中仍残留的 JD', async () => {
  document.querySelector('.geetest_panel')!.removeAttribute('hidden')
  expect(await inspectBossDetail(page, expected)).toMatchObject({ kind: 'verification', description: '', matched: false })
  document.querySelector('.geetest_panel')!.remove()
  vi.stubGlobal('location', { href: 'https://www.zhipin.com/web/user/' })
  expect(readBossDetailDocument()).toMatchObject({ kind: 'login', description: '' })
})
it('正文截断、公司缺失或按钮禁用不伪装成可发送', async () => {
  document.querySelector('.job-sec-text')!.textContent = '岗位要求'.repeat(6000)
  document.querySelector('button')!.disabled = true
  const result = await inspectBossDetail(page, expected)
  expect(result.truncated).toBe(true); expect(result.blockers.length).toBeGreaterThan(0)
  expect(result.communication.enabled).toBe(0)
  document.querySelector('.company-name')!.remove()
  expect((await inspectBossDetail(page, expected)).matched).toBe(false)
})
it('不把公司官网按钮当公司名，也不把公司介绍混进岗位要求', async () => {
  document.querySelector('.sider-company')!.innerHTML = '<div class="company-info"><a href="https://example.com/">公司官网</a><a href="/gongsi/example.html">示例公司</a></div>'
  document.querySelector('.job-sec-text')!.outerHTML = '<section class="job-sec"><h3>职位描述</h3><div class="job-sec-text">React 和 TypeScript 项目开发。</div></section><section class="job-sec"><h3>公司介绍</h3><div class="job-sec-text">公司从事 Java、Go、Python 外包服务。</div></section>'
  const result = await inspectBossDetail(page, expected)
  expect(result.company).toBe('示例公司')
  expect(result.description).toContain('React')
  expect(result.description).not.toContain('Python')
})
