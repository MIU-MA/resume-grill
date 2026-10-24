// Frontend roles manually checked in the official pages below; not a guarantee of availability.
// Keep the review date separate from the crawler's fetch date.
export const frontendReviewedAt = '2026-09-30'

// Shared with scripts/crawl-careers.ts. The workbench opens the company page, not a preset job.
export const crawlCareerSites = [
  { company: '杰诺科技', url: 'https://www.jienor.com/join/', frontendRoles: ['前端工程师'] },
  { company: '蜂动科技', url: 'https://www.fontdo.com/joinus', frontendRoles: ['Web 前端开发工程师'] },
  { company: '蓝曜炬辉', url: 'https://www.lanyaoai.com/careers', frontendRoles: ['高级前端工程师 · React / Next.js'] },
  { company: '华智客', url: 'https://huazhike.com/job', frontendRoles: ['Web前端开发工程师'] },
  { company: 'OSforce', url: 'https://www.osforce.com.cn/jobs', frontendRoles: ['前端开发工程师'] },
  { company: '环信', url: 'https://www.easemob.com/join/', frontendRoles: ['web前端工程师', '前端工程师（实习）', '高级前端工程师'] },
] as const

export type CareerSite = { company: string; url: string; aliases?: readonly string[]; frontendRoles?: readonly string[]; reviewedAt?: string }

// Public recruiting entries reviewed 2026-10-23. Role hints describe the page or
// its official search index, not confirmation that the position is still open.
export const additionalCareerSites: readonly CareerSite[] = [
  { company: '快手', url: 'https://zhaopin.kuaishou.cn/', aliases: ['Kuaishou'] },
  { company: '滴滴', url: 'https://talent.didiglobal.com/social/', aliases: ['DiDi'] },
  { company: '携程', url: 'https://careers.trip.com/', aliases: ['Trip.com'] },
  { company: '虾皮', url: 'https://careers.shopee.cn/', aliases: ['Shopee'] },
  { company: '360', url: 'https://hr.360.cn/hr/', aliases: ['奇虎'] },
  { company: '有赞', url: 'https://job.youzan.com/', aliases: ['Youzan'] },
  { company: '微盟', url: 'https://job.weimob.com/talent/society/', aliases: ['Weimob'] },
  { company: '涂鸦智能', url: 'https://job.tuya.com/', aliases: ['Tuya'] },
  { company: 'PingCAP', url: 'https://www.pingcap.com/careers/', aliases: ['TiDB', '平凯星辰'] },
  { company: 'Ping++', url: 'https://www.pingxx.com/career', aliases: ['简米'], frontendRoles: ['前端开发工程师'] },
  { company: 'Authing', url: 'https://www.authing.cn/joinus', aliases: ['身份云'], frontendRoles: ['前端开发工程师'] },
  { company: 'APUS', url: 'https://apuscn.com/cn/jobs', frontendRoles: ['Web前端研发工程师'] },
  { company: 'Websoft9', url: 'https://www.websoft9.com/careers/', frontendRoles: ['前端开发', '全栈工程师'] },
  { company: '泡游网络', url: 'https://www.xmpaoyou.com/job', frontendRoles: ['web前端开发'] },
  { company: '东道', url: 'https://www.dongdao.net/join_us/', frontendRoles: ['web前端工程师'] },
  { company: '绿雪智能', url: 'https://www.greensnowai.com/job/', frontendRoles: ['前端实习生', '前端开发工程师'] },
  { company: '大汤圆技术', url: 'https://www.datangyuan.cn/join-us', frontendRoles: ['软件工程师（前端 / 后端 / 全栈）'] },
  { company: '炜荣', url: 'https://www.wezonglobal.com/recruit', aliases: ['WEZON'], frontendRoles: ['前端开发工程师'] },
  { company: '画魂科技', url: 'https://www.huahuntech.com/careers.html', frontendRoles: ['前端开发工程师'] },
  { company: '优码云', url: 'https://www.umayun.com/careers', aliases: ['UMAYUN'], frontendRoles: ['高级前端工程师 · React / Next.js'] },
  { company: '星图维天信', url: 'https://etapes.com.cn/contact/join.html', frontendRoles: ['前端开发工程师'] },
].map(site => ({ ...site, reviewedAt: '2026-10-23' }))

// Original portals retain their 2026-09-20 review; legacy frontend pages retain
// frontendReviewedAt. New entries carry their own date instead of rewriting it.
export const careerSites: readonly CareerSite[] = [
  { company: '腾讯', url: 'https://careers.tencent.com/' },
  { company: '字节跳动', url: 'https://jobs.bytedance.com/' },
  { company: '阿里巴巴', url: 'https://talent.alibaba.com/' },
  { company: '小红书', url: 'https://job.xiaohongshu.com/' },
  { company: '哔哩哔哩（B站）', url: 'https://jobs.bilibili.com/' },
  { company: '美团', url: 'https://job.meituan.com/' },
  { company: '京东', url: 'https://zhaopin.jd.com/' },
  { company: '百度', url: 'https://talent.baidu.com/' },
  { company: '小米', url: 'https://hr.xiaomi.com/' },
  { company: '阿里云', url: 'https://careers.aliyun.com/' },
  ...crawlCareerSites,
  ...additionalCareerSites,
] as const

export function filterCareerSites(query = ''): CareerSite[] {
  const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean)
  return careerSites.filter(site => {
    const text = [site.company, site.url, ...(site.aliases ?? []), ...(site.frontendRoles ?? [])].join(' ').toLowerCase()
    return terms.every(term => text.includes(term))
  })
}

export function companyFromCareerUrl(value: string): string {
  try {
    const host = new URL(value).hostname.replace(/^www\./, '')
    return careerSites.find(site => new URL(site.url).hostname.replace(/^www\./, '') === host)?.company ?? ''
  } catch { return '' }
}
