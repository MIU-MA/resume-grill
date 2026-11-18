import type { BossJob, BossJobRead } from '../domain/boss-search.ts'

export function readBossJobList(): { address: string; query: string; state: BossJobRead['state']; jobs: BossJob[] } {
  const address = location.href
  const query = new URL(address).searchParams.get('query') ?? ''
  const { result, visible } = {
    result(state: BossJobRead['state'], jobs: BossJob[] = []) { return { address, query, state, jobs } },
    visible(node: HTMLElement) { return node.getClientRects().length > 0 && getComputedStyle(node).visibility !== 'hidden' },
  }
  const verification = /安全验证|滑动验证|请完成验证/
  const login = /扫码登录|登录后查看|请先登录|登录\s*[/／]\s*注册/
  const prompts = [...document.querySelectorAll<HTMLElement>('[role="dialog"], dialog, .login-dialog, .login-register-dialog, .verify-wrap, .geetest_panel')].filter(visible).map(node => node.innerText).join(' ')
  if (verification.test(prompts)) return result('verification')
  if (/\/(?:web\/user\/|passport\/)?(?:login|register)(?:\/|$)/.test(location.pathname) || login.test(prompts)) return result('login')
  if (document.readyState === 'loading' || [...document.querySelectorAll<HTMLElement>('[aria-busy="true"], .job-list-loading')].some(visible)) return result('loading')

  const jobs: BossJob[] = []
  const seen = new Set<string>()
  const cards = document.querySelectorAll<HTMLElement>('.job-card-wrapper, .job-card-box, .job-card-wrap')
  for (const node of cards) {
    const link = node.querySelector<HTMLAnchorElement>('a[href*="/job_detail/"]')
    if (!link || !visible(link)) continue
    const card = link.closest('li') ?? node
    const url = new URL(link.href)
    if (url.protocol !== 'https:' || !(url.hostname === 'zhipin.com' || url.hostname.endsWith('.zhipin.com')) || !/^\/job_detail\/[^/]+\.html$/.test(url.pathname)) continue
    const href = url.origin + url.pathname
    if (seen.has(href)) continue
    const name = card.querySelector('.job-name, .job-title, [class*=job-name], [class*=job-title]') ?? link
    const title = (name.getAttribute('title') || name.textContent || '').trim()
      .replace(/[\uE000-\uF8FF].*$/s, '').replace(/\s*\d+(?:\.\d+)?[-–]\d+(?:\.\d+)?[Kk万千].*$/s, '').trim()
    if (!title) continue
    seen.add(href)
    const salary = card.querySelector('.salary')?.textContent?.trim() ?? ''
    jobs.push({
      title,
      company: card.querySelector('.company-name, a[href*="/gongsi/"]')?.textContent?.trim() ?? '',
      salary: /[\uE000-\uF8FF]/.test(salary) ? '' : salary,
      url: href,
      description: (card.querySelector('.job-desc, .job-info, .job-labels, .tag-list')?.textContent ?? card.innerText).trim().slice(0, 1200),
    })
    if (jobs.length === 30) break
  }
  if (jobs.length) return result('ready', jobs)

  const body = document.body?.innerText ?? ''
  if (verification.test(body)) return result('verification')
  if (login.test(body)) return result('login')
  const busy = [...document.querySelectorAll<HTMLElement>('[aria-busy="true"], .job-list-loading, .loading')].some(visible)
  if (busy || /正在加载|加载中/.test(body)) return result('loading')
  if (location.pathname === '/web/geek/jobs' && /暂无(?:相关|符合条件的?)?职位|没有找到(?:相关)?职位|未找到(?:相关)?职位|暂无搜索结果/.test(body)) return result('empty')
  return result('unsupported')
}
