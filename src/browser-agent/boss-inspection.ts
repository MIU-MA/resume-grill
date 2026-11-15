import type { BossInspection } from '../domain/boss-inspection.ts'

// Serialized into the selected job page. Read DOM only; never click, type or read chat messages.
export function readBossDetailDocument() {
  const visible = (node: Element) => node.getClientRects().length > 0 && getComputedStyle(node).visibility !== 'hidden'
  const text = (selector: string) => Array.from(document.querySelectorAll<HTMLElement>(selector)).filter(visible).map(node => node.innerText.trim()).find(Boolean) ?? ''
  const url = new URL(location.href)
  const canonical = url.origin + url.pathname
  const verification = !!Array.from(document.querySelectorAll('.geetest_panel, .verify-wrap, [id*="captcha"], [class*="captcha"]')).find(visible) || /安全验证|访问验证/.test(document.title)
  const login = url.pathname.startsWith('/web/user') || !!Array.from(document.querySelectorAll('.login-dialog, .boss-login-wrapper')).find(visible)
  const detail = /^\/job_detail\/[^/]+\.html$/.test(url.pathname)
  const kind = verification ? 'verification' : login ? 'login' : detail ? 'detail' : 'unknown'
  if (kind !== 'detail') return { kind, url: canonical, title: '', company: '', description: '', truncated: false, communication: { count: 0, enabled: 0, labels: [] as string[] } }
  const title = text('.job-banner h1, .job-banner .name h1, .job-detail .job-name, .job-primary .name h1')
  const company = text('.sider-company .company-name, .job-company .company-name, .company-info .company-name') || text('.sider-company .company-info a[href*="/gongsi/"]')
  const descriptions = Array.from(document.querySelectorAll<HTMLElement>('.job-sec-text, .job-detail-section .text, .job-detail .job-description')).filter(visible)
  const marked = descriptions.filter(node => /职位描述|岗位职责|任职要求|工作职责/.test(node.closest('.job-sec, .job-detail-section, section')?.querySelector('h2, h3, .title')?.textContent ?? ''))
  const relevant = marked.length ? marked : descriptions.slice(0, 1)
  const description = [...new Set(relevant.map(node => node.innerText.trim()).filter(Boolean))].join('\n\n')
  const buttons = Array.from(document.querySelectorAll<HTMLElement>('a, button')).filter(node => visible(node) && /^(立即沟通|继续沟通|立即申请|投递简历)$/.test(node.innerText.trim()))
  return { kind, url: canonical, title, company, description: description.slice(0, 20000), truncated: description.length > 20000, communication: {
    count: buttons.length, enabled: buttons.filter(node => !node.hasAttribute('disabled') && node.getAttribute('aria-disabled') !== 'true' && !node.classList.contains('disabled') && getComputedStyle(node).pointerEvents !== 'none').length,
    labels: [...new Set(buttons.map(node => node.innerText.trim()))],
  } }
}

export async function inspectBossDetail(page: { evaluate: <T>(fn: () => T) => Promise<Awaited<T>> }, expected: { url: string; title: string; company: string }): Promise<BossInspection> {
  const raw = await page.evaluate(readBossDetailDocument)
  const normalize = (text: string) => text.normalize('NFKC').replace(/\s+/g, '').toLowerCase()
  const blockers: string[] = []
  if (raw.kind === 'login') blockers.push('详情页要求登录，请在官网完成登录后重试。')
  if (raw.kind === 'verification') blockers.push('详情页出现验证，请在官网处理；不会绕过或自动刷新。')
  if (raw.kind === 'unknown') blockers.push('没有识别到岗位详情页面。')
  const matched = raw.kind === 'detail' && raw.url === expected.url && !!raw.title && !!raw.company && normalize(raw.title) === normalize(expected.title) && normalize(raw.company) === normalize(expected.company)
  if (raw.kind === 'detail' && !matched) blockers.push('详情页的岗位、公司或链接与所选卡片不一致，未采用此 JD。')
  if (raw.kind === 'detail' && !raw.description) blockers.push('没有读到完整岗位描述。')
  if (raw.truncated) blockers.push('岗位描述超过读取长度，未作为完整 JD 使用。')
  return { ...raw, kind: raw.kind as BossInspection['kind'], matched, blockers }
}
