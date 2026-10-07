const PERSONAL_FIELD = /(?:姓名|性别|年龄|出生|生日|籍贯|民族|政治面貌|婚姻状况|联系电话|手机|电话|邮箱|电子邮件|微信|现居地|地址|期望薪资|求职意向)\s*[：:]/i
const EMAIL = /[\w.+-]+@[\w.-]+\.[a-z]{2,}/i
const PHONE = /(?:\+?86[-\s]?)?1[3-9]\d{9}/
const URL = /(?:https?:\/\/|www\.)\S+/i
const PROFILE_SUMMARY = /(?:\d+\s*年.{0,10}经验|应聘(?:岗位|职位)|目标岗位|期望岗位)/
const DEMOGRAPHIC = /(?:^|[|｜,，\s])(男|女)(?:$|[|｜,，\s])|\b\d{1,2}\s*岁\b/
const DATE = /(?:19|20)\d{2}(?:[.\-/年]\d{1,2})?/
const CONCRETE_ACTION = /负责|主导|参与|推动|组织|统筹|搭建|设计|实现|优化|提升|降低|增长|减少|缩短|提高|下降|节约|带领|建立|完成|解决|交付|签约|获客|转化|^开发/
const SECTION = /^(?:个人信息|基本信息|联系方式|求职意向|教育背景|工作经历|项目经验|项目经历|实习经历|技能|专业技能|荣誉奖项|自我介绍|个人总结|自我评价)\s*[：:]?$/

export function isExcludedClaimContent(content: string): boolean {
  const text = content.replace(/^[-•·*]\s*/, '').trim()
  if (!text || SECTION.test(text)) return true
  if (PERSONAL_FIELD.test(text) || EMAIL.test(text) || PHONE.test(text) || URL.test(text) || DEMOGRAPHIC.test(text)) return true
  if (PROFILE_SUMMARY.test(text)) return true
  if (DATE.test(text) && !CONCRETE_ACTION.test(text)) return true
  return false
}
