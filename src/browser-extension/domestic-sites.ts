// Entry points inspected on 2026-10-24. Recognition is not a compatibility claim;
// no domestic site has passed a logged-in browser upload test yet.
const sites = [
  { id: 'tencent', name: '腾讯', hosts: ['careers.tencent.com'] },
  { id: 'bytedance', name: '字节跳动', hosts: ['jobs.bytedance.com'] },
  { id: 'alibaba', name: '阿里巴巴', hosts: ['talent.alibaba.com'] },
  { id: 'xiaohongshu', name: '小红书', hosts: ['job.xiaohongshu.com'] },
  { id: 'bilibili', name: 'B站', hosts: ['jobs.bilibili.com'] },
  { id: 'meituan', name: '美团', hosts: ['job.meituan.com', 'zhaopin.meituan.com'] },
  { id: 'jd', name: '京东', hosts: ['zhaopin.jd.com'] },
  { id: 'baidu', name: '百度', hosts: ['talent.baidu.com'] },
  { id: 'kuaishou', name: '快手', hosts: ['zhaopin.kuaishou.cn'] },
  { id: 'netease', name: '网易', hosts: ['hr.163.com'] },
] as const
export function domesticSite(hostname: string) { return sites.find(site => (site.hosts as readonly string[]).includes(hostname)) }

export function biliUploadLabel(element: Element): string | undefined {
  if (location.hostname === 'jobs.bilibili.com' && element.matches('input[type="file"]') && element.closest('.bili-resume-analysis')) return '简历附件'
}

export function biliUploadState(element: Element): 'confirmed' | 'pending' | undefined {
  if (!biliUploadLabel(element)) return
  const area = element.closest('.bili-resume-analysis')!
  // Public renderer shows this name only when the uploaded value has a URL.
  // Updating / parsing keeps the old value visible, so it must remain pending.
  if (area.querySelector('.ant-btn-loading') || /更新中|解析中/.test(area.textContent ?? '')) return 'pending'
  return area.querySelector('.bili-resume-annalysis-name')?.textContent?.trim() ? 'confirmed' : 'pending'
}

// Derived from the public BiliFormCard / BiliForm renderer, not captured from
// a logged-in DOM. Require exact host AND its section/card markup.
export function biliExperienceGroups(): Array<{ element: Element; label: string }> {
  if (location.hostname !== 'jobs.bilibili.com') return []
  return [...document.querySelectorAll('.bili-form-card-body .bili-form-multiple')].flatMap(element => {
    const header = element.closest('.bili-form-card-body')?.previousElementSibling
    const number = element.querySelector(':scope > .bili-form-multiple-tag')?.textContent?.trim()
    if (!header?.matches('.bili-form-card-header') || !number || !/^0?[1-9]\d*$/.test(number)) return []
    return [{ element, label: `${header.textContent?.trim()} ${Number(number)}` }]
  })
}
