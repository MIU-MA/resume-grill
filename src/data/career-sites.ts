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

// Official recruiting entries checked 2026-10-29. Evidence and fetch results
// are recorded in data/career-sites/review-2026-10-29.json.
export const expandedCareerSites: readonly CareerSite[] = [
  { company: '网易', url: 'https://hr.163.com/', aliases: ['NetEase'] },
  { company: '蚂蚁集团', url: 'https://talent.antgroup.com/', aliases: ['Ant Group', '支付宝'] },
  { company: '豆瓣', url: 'https://jobs.douban.com/', aliases: ['Douban'] },
  { company: '贝壳', url: 'https://join.ke.com/', aliases: ['KE', '链家'] },
  { company: '同程旅行', url: 'https://join.ly.com/', aliases: ['Tongcheng'] },
  { company: '用友', url: 'https://career.yonyou.com/', aliases: ['Yonyou'] },
  { company: '帆软', url: 'https://join.fanruan.com/', aliases: ['FanRuan', 'FineBI', '简道云'] },
  { company: '纷享销客', url: 'https://www.fxiaoke.com/crm/about-join/', aliases: ['FXiaoke'] },
  { company: '思特沃克', url: 'https://www.thoughtworks.com/zh-cn/careers', aliases: ['Thoughtworks'] },
  { company: '智谱', url: 'https://www.zhipuai.cn/zh/joinus', aliases: ['Z.ai', 'GLM', 'Zhipu'] },
  { company: '月之暗面', url: 'https://careers.kimi.com/', aliases: ['Kimi', 'Moonshot'] },
  { company: 'MiniMax', url: 'https://minimax.cn/careers', aliases: ['稀宇科技', '海螺AI'] },
  { company: '商汤科技', url: 'https://hr.sensetime.com/', aliases: ['SenseTime'] },
  { company: '依图科技', url: 'https://www.yitutech.com/cn/career', aliases: ['YITU'] },
  { company: 'EMQ 映云科技', url: 'https://careers.emqx.com/zh/job', aliases: ['EMQX'] },
  { company: '涛思数据', url: 'https://www.taosdata.com/careers', aliases: ['TDengine'] },
  { company: 'Zilliz', url: 'https://zilliz.com.cn/careers', aliases: ['Milvus'] },
  { company: '米哈游', url: 'https://jobs.mihoyo.com/', aliases: ['miHoYo', 'HoYoverse'] },
  { company: '莉莉丝', url: 'https://jobs.lilith.com/', aliases: ['Lilith'] },
  { company: '叠纸游戏', url: 'https://career.papegames.com/', aliases: ['Papergames'] },
  { company: '吉比特', url: 'https://join.g-bits.com/', aliases: ['G-bits', '雷霆游戏'] },
  { company: '多益网络', url: 'https://hr.duoyi.com/', aliases: ['Duoyi'] },
  { company: '乐元素', url: 'https://leyuansu.com/recruit', aliases: ['Happy Elements'] },
  { company: '华为', url: 'https://career.huawei.com/', aliases: ['Huawei'] },
  { company: '中兴通讯', url: 'https://job.zte.com.cn/', aliases: ['ZTE'] },
  { company: 'OPPO', url: 'https://careers.oppo.com/' },
  { company: 'vivo', url: 'https://career.vivo.com/' },
  { company: '联想', url: 'https://jobs.lenovo.com/', aliases: ['Lenovo'] },
  { company: '大疆', url: 'https://careers.dji.com/zh-CN/', aliases: ['DJI'] },
  { company: '宇树科技', url: 'https://www.unitree.com/cn/careers', aliases: ['Unitree'] },
  { company: '蔚来', url: 'https://nio.jobs.feishu.cn/', aliases: ['NIO'] },
  { company: '特斯拉', url: 'https://www.tesla.cn/careers/', aliases: ['Tesla'] },
  { company: '比亚迪', url: 'https://job.byd.com/', aliases: ['BYD'] },
  { company: '深信服', url: 'https://hr.sangfor.com/', aliases: ['Sangfor'] },
  { company: 'TP-LINK', url: 'https://hr.tp-link.com.cn/', aliases: ['普联'] },
  { company: '同花顺', url: 'https://job.10jqka.com.cn/', aliases: ['iFinD'] },
  { company: '富途', url: 'https://join.futunn.com/', aliases: ['Futu'] },
  { company: '恒生电子', url: 'https://job.hundsun.com/', aliases: ['Hundsun'] },
  { company: '得物', url: 'https://poizon.jobs.feishu.cn/', aliases: ['Dewu', 'POIZON'] },
  { company: '销售易', url: 'https://www.xiaoshouyi.com/about-us/join-us', aliases: ['Neocrm'] },
  { company: '北森', url: 'https://beisen.zhiye.com/', aliases: ['Beisen'] },
  { company: '金数据', url: 'https://jinshuju.net/f/t7TIWA', aliases: ['Jinshuju'] },
  { company: 'ProcessOn', url: 'https://www.processon.com/jobs', aliases: ['思维导图'], frontendRoles: ['前端开发'] },
  { company: '影石', url: 'https://www.insta360.com/cn/jobs', aliases: ['Insta360'] },
  { company: '理想汽车', url: 'https://www.lixiang.com/employ.html', aliases: ['Li Auto'] },
  { company: '小鹏汽车', url: 'https://xiaopeng.jobs.feishu.cn/index', aliases: ['XPeng'] },
  { company: '荣耀', url: 'https://www.hihonor.com/cn/career/', aliases: ['HONOR'] },
  { company: '安克创新', url: 'https://career.anker-in.com/', aliases: ['Anker'] },
  { company: '鹰角网络', url: 'https://career.hypergryph.com/', aliases: ['Hypergryph'] },
  { company: 'SmartX', url: 'https://www.smartx.com/jobs/', aliases: ['志凌海纳'] },
  { company: '七牛云', url: 'https://jobs.qiniu.com/', aliases: ['Qiniu'] },
].map(site => ({ ...site, reviewedAt: '2026-10-29' }))

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
  ...expandedCareerSites,
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
    const target = new URL(value)
    const normalizeHost = (name: string) => name === 'im.jinshuju.com' ? 'jinshuju.net' : name.replace(/^www\./, '')
    const host = normalizeHost(target.hostname)
    const matches = careerSites.filter(site => normalizeHost(new URL(site.url).hostname) === host)
    // Jinshuju hosts forms for unrelated organizations. Only the company's
    // published recruiting form belongs to this directory entry.
    if (host === 'jinshuju.net') return matches.find(site => {
      const path = new URL(site.url).pathname.replace(/\/$/, '')
      return target.pathname === path || target.pathname.startsWith(`${path}/`)
    })?.company ?? ''
    return matches[0]?.company ?? ''
  } catch { return '' }
}
