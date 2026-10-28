import { z } from 'zod'
import { parseResumeStructure } from './resume-structure'

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
      if (section && ['general', 'education', 'awards'].includes(section.kind)) fail('身份、教育和证书信息不改写')
      if (!compact(jd).includes(compact(change.requirement))) fail('岗位依据必须引用 JD 原文')
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
export const tailoringChangeKey = (change: { sectionId: string; lineIndex: number }) => `${change.sectionId}:${change.lineIndex}`
export function tailoredResumeText(sections: TailoringSection[], plan: TailoringPlan, accepted: ReadonlySet<string>, edits: Record<string, string> = {}, originalOrder = false) {
  const order = originalOrder ? sections.map(section => section.id) : plan.sectionOrder
  return order.map(id => {
    const section = sections.find(item => item.id === id)!
    const lines = section.lines.map((line, index) => {
      const key = `${id}:${index}`
      const change = plan.changes.find(item => tailoringChangeKey(item) === key)
      return change && accepted.has(key) ? edits[key] ?? change.after : line
    })
    return [...(section.kind === 'general' ? [] : [section.title]), ...lines].join('\n')
  }).join('\n\n').trim()
}
export function tailoringMail(sections: TailoringSection[], plan: TailoringPlan, accepted: ReadonlySet<string>, edits: Record<string, string>, person: string, company = plan.company, role = plan.role) {
  const excerpts = plan.highlights.map(item => {
    const original = sections.find(section => section.id === item.sectionId)?.lines[item.lineIndex] ?? ''
    const key = tailoringChangeKey(item)
    const change = plan.changes.find(entry => tailoringChangeKey(entry) === key)
    return (change && accepted.has(key) ? edits[key] ?? change.after : original).replace(/^[-•·\s]+/, '').slice(0, 240)
  }).filter(Boolean)
  return {
    subject: `${role ? `应聘${role}` : '求职申请'}${person ? `-${person}` : ''}`,
    body: `您好：\n\n${role ? `我想应聘${company || '贵公司'}的${role}岗位。` : '想向您投递一份简历。'}${excerpts.length ? `\n\n简历中与这个岗位相关的经历：\n${excerpts.map(text => `- ${text}`).join('\n')}` : ''}\n\n附件是我的简历，感谢您查看。${person ? `\n\n${person}` : ''}`,
  }
}
