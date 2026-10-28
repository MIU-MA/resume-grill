import { z } from 'zod'
import { parseResumeStructure } from './resume-structure'
import { modelCanRewriteLine, preservedIntroductionFacts } from './resume-tailoring-policy'

export function tailoringSections(rawText: string) {
  return parseResumeStructure(rawText).map((section, index) => ({
    id: `section-${index}`, title: section.title, kind: section.kind,
    lines: section.lines.map(line => line.text),
  }))
}
export type TailoringSection = ReturnType<typeof tailoringSections>[number]
export const tailoringPlanSchema = z.object({
  company: z.string().trim().max(120), role: z.string().trim().max(120),
  sectionOrder: z.array(z.string()).min(1).max(100),
  changes: z.array(z.object({
    sectionId: z.string(), lineIndex: z.number().int().nonnegative(),
    after: z.string().trim().min(1).max(3000),
    requirement: z.string().trim().min(1).max(600),
    reason: z.string().trim().min(1).max(400),
  }).strict()).max(80),
  highlights: z.array(z.object({ sectionId: z.string(), lineIndex: z.number().int().nonnegative() }).strict()).max(3),
  gaps: z.array(z.string().trim().min(1).max(400)).max(8),
  notices: z.array(z.string().trim().min(1).max(200)).max(8).optional(),
}).strict()
export type TailoringPlan = z.infer<typeof tailoringPlanSchema>
const compact = (value: string) => value.replace(/\s/g, '').toLowerCase()
export function groundedTailoringSchema(rawText: string, jd: string) {
  const sections = tailoringSections(rawText)
  return tailoringPlanSchema.superRefine((plan, ctx) => {
    const fail = (message: string) => ctx.addIssue({ code: 'custom', message })
    const ids = sections.map(section => section.id)
    if (plan.sectionOrder.length !== ids.length || new Set(plan.sectionOrder).size !== ids.length || plan.sectionOrder.some(id => !ids.includes(id))) fail('简历章节缺失或重复')
    if (sections[0]?.kind === 'general' && plan.sectionOrder[0] !== sections[0].id) fail('个人信息须保留在开头')
    const changed = new Set<string>()
    for (const change of plan.changes) {
      const section = sections.find(item => item.id === change.sectionId)
      const before = section?.lines[change.lineIndex]
      const key = `${change.sectionId}:${change.lineIndex}`
      if (!before || changed.has(key)) { fail('修改位置不存在或重复'); continue }
      changed.add(key)
      if (section && !modelCanRewriteLine(section, change.lineIndex)) fail('姓名、联系方式、教育和证书等事实不改写；个人概况中的自我介绍可以调整')
      if (section?.kind === 'general' && !preservedIntroductionFacts(before, change.after)) fail('自我介绍中的毕业届别和学历须保留')
      if (!compact(jd).includes(compact(change.requirement))) fail('岗位依据必须引用 JD 原文')
      for (const claim of ['主导', '独立负责', '独立完成', '带领团队', '从零搭建', '精通']) {
        if (change.after.includes(claim) && !before.includes(claim)) fail('修改不能夸大原文的贡献或能力')
      }
      // Do not let a rewrite silently introduce tools, dates or numerical claims.
      const sourceTokens = new Set(before.match(/[A-Za-z][A-Za-z\d.+#/-]*|\d+(?:[.,]\d+)*(?:%|％)?/g)?.map(token => token.toLowerCase()) ?? [])
      for (const token of change.after.match(/[A-Za-z][A-Za-z\d.+#/-]*|\d+(?:[.,]\d+)*(?:%|％)?/g) ?? []) {
        if (!sourceTokens.has(token.toLowerCase())) fail('修改中出现原段落没有的技术名称、日期或数字')
      }
    }
    for (const item of plan.highlights) if (!sections.find(section => section.id === item.sectionId)?.lines[item.lineIndex]) fail('邮件引用的经历不存在')
    for (const value of [plan.company, plan.role]) if (value && !compact(jd).includes(compact(value))) fail('公司和岗位须来自 JD 原文')
  })
}
/** Keep usable suggestions from one response; never ask the model again just to repair one bad line. */
export function usableTailoringSchema(rawText: string, jd: string) {
  const sections = tailoringSections(rawText)
  const strict = groundedTailoringSchema(rawText, jd)
  return tailoringPlanSchema.transform(plan => {
    const notices = [...(plan.notices ?? [])]
    const originalOrder = sections.map(section => section.id)
    const normalized: TailoringPlan = { ...plan, changes: [], highlights: [], sectionOrder: originalOrder }
    if (plan.sectionOrder.length !== originalOrder.length || new Set(plan.sectionOrder).size !== originalOrder.length || plan.sectionOrder.some(id => !originalOrder.includes(id))) notices.push('章节顺序未能核对，已保留原顺序。')
    for (const field of ['company', 'role'] as const) if (plan[field] && !compact(jd).includes(compact(plan[field]))) { normalized[field] = ''; notices.push(`未能从 JD 核对${field === 'company' ? '公司' : '岗位'}，已留空。`) }
    const used = new Set<string>()
    for (const change of plan.changes) {
      const key = tailoringChangeKey(change)
      const result = strict.safeParse({ ...normalized, changes: [change] })
      if (!used.has(key) && result.success) { normalized.changes.push(change); used.add(key) }
      else {
        const section = sections.find(section => section.id === change.sectionId)
        notices.push(`已忽略${section?.title ?? '未知位置'}第 ${change.lineIndex + 1} 条建议：${result.success ? '位置重复' : result.error.issues[0].message}`.slice(0, 200))
      }
    }
    normalized.highlights = plan.highlights.filter(item => !!sections.find(section => section.id === item.sectionId)?.lines[item.lineIndex])
    if (notices.length) normalized.notices = [...new Set(notices)].slice(0, 8)
    return normalized
  })
}
export const tailoringChangeKey = (change: { sectionId: string; lineIndex: number }) => `${change.sectionId}:${change.lineIndex}`
export function tailoringSourceRanges(rawText: string, sections: TailoringSection[]) {
  const positions: number[] = []
  let normalized = ''
  for (let index = 0; index < rawText.length; index++) if (!/\s/.test(rawText[index])) { normalized += rawText[index]; positions.push(index) }
  let cursor = 0
  const ranges = new Map<string, { start: number; end: number }>()
  for (const section of sections) for (const [lineIndex, line] of section.lines.entries()) {
    const quote = line.replace(/\s/g, '')
    const match = normalized.indexOf(quote, cursor)
    const key = tailoringChangeKey({ sectionId: section.id, lineIndex })
    if (match < 0 || !quote) continue
    cursor = match + quote.length
    ranges.set(key, { start: positions[match], end: positions[cursor - 1] + 1 })
  }
  return ranges
}
/** Manual edits always take precedence; untouched source formatting stays byte-for-byte identical. */
export function tailoredOriginalResumeText(rawText: string, sections: TailoringSection[], plan: TailoringPlan, accepted: ReadonlySet<string>, edits: Record<string, string> = {}) {
  const ranges = tailoringSourceRanges(rawText, sections)
  const replacements: Array<{ start: number; end: number; text: string }> = []
  for (const section of sections) for (const [lineIndex] of section.lines.entries()) {
    const key = tailoringChangeKey({ sectionId: section.id, lineIndex })
    const change = plan.changes.find(change => tailoringChangeKey(change) === key)
    const replacement = Object.hasOwn(edits, key) ? edits[key] : change && accepted.has(key) ? change.after : undefined
    if (replacement === undefined) continue
    const range = ranges.get(key)
    if (!range) throw new Error('这条内容无法对应到上传原文，请核对后再修改。')
    replacements.push({ ...range, text: replacement })
  }
  let text = rawText
  for (const replacement of replacements.reverse()) text = text.slice(0, replacement.start) + replacement.text + text.slice(replacement.end)
  return text
}
export function tailoredResumeText(sections: TailoringSection[], plan: TailoringPlan, accepted: ReadonlySet<string>, edits: Record<string, string> = {}, originalOrder = false) {
  const order = originalOrder ? sections.map(section => section.id) : plan.sectionOrder
  return order.map(id => {
    const section = sections.find(item => item.id === id)!
    const lines = section.lines.map((line, index) => {
      const key = `${id}:${index}`
      const change = plan.changes.find(item => tailoringChangeKey(item) === key)
      return Object.hasOwn(edits, key) ? edits[key] : change && accepted.has(key) ? change.after : line
    })
    return [...(section.kind === 'general' ? [] : [section.title]), ...lines].join('\n')
  }).join('\n\n').trim()
}
export function tailoringMail(sections: TailoringSection[], plan: TailoringPlan, accepted: ReadonlySet<string>, edits: Record<string, string>, person: string, company = plan.company, role = plan.role) {
  const excerpts = plan.highlights.map(item => {
    const original = sections.find(section => section.id === item.sectionId)?.lines[item.lineIndex] ?? ''
    const key = tailoringChangeKey(item)
    const change = plan.changes.find(entry => tailoringChangeKey(entry) === key)
    return (Object.hasOwn(edits, key) ? edits[key] : change && accepted.has(key) ? change.after : original).replace(/^[-•·\s]+/, '').slice(0, 240)
  }).filter(Boolean)
  return {
    subject: `${role ? `应聘${role}` : '求职申请'}${person ? `-${person}` : ''}`,
    body: `您好：\n\n${role ? `我想应聘${company || '贵公司'}的${role}岗位。` : '想向您投递一份简历。'}${excerpts.length ? `\n\n简历中与这个岗位相关的经历：\n${excerpts.map(text => `- ${text}`).join('\n')}` : ''}\n\n附件是我的简历，感谢您查看。${person ? `\n\n${person}` : ''}`,
  }
}
