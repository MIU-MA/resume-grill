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

// Existing recruiting portals, reviewed 2026-09-20.
export const careerSites = [
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
] as const
