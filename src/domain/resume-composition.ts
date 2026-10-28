import { profileSchema, PROFILE_LABELS, type WebsiteProfile } from './website-automation'
import { experiencesSchema, type WebsiteExperience } from './website-experience'

export type ResumeComposition = { profile: WebsiteProfile; experiences: WebsiteExperience[]; summary: string; skills: string; extra: string }

/** Only compose confirmed input; do not infer achievements, job titles or dates. */
export function composeResumeText(value: ResumeComposition): string {
  const profile = profileSchema.parse(value.profile)
  const experiences = experiencesSchema.parse(value.experiences)
  const lines: string[] = []
  if (profile.name) lines.push(profile.name)
  const contacts = (['phone', 'email', 'city', 'github', 'portfolio'] as const).filter(key => profile[key]).map(key => `${PROFILE_LABELS[key]}：${profile[key]}`)
  if (contacts.length) lines.push(contacts.join(' | '))
  if (value.summary.trim()) lines.push('', '个人简介', value.summary.trim())
  if (value.skills.trim()) lines.push('', '专业技能', value.skills.trim())
  for (const [kind, title] of [['education', '教育经历'], ['work', '工作经历'], ['project', '项目经历']] as const) {
    const entries = experiences.filter(item => item.kind === kind && [item.organization, item.title, item.description].some(text => text.trim()))
    if (!entries.length) continue
    lines.push('', title)
    for (const entry of entries) {
      lines.push([entry.organization, entry.title, [entry.start, entry.end].filter(Boolean).join(' — ')].filter(Boolean).join(' | '))
      if (entry.description.trim()) lines.push(entry.description.trim())
    }
  }
  if (value.extra.trim()) lines.push('', '其他信息', value.extra.trim())
  const text = lines.join('\n').trim()
  if (!text || (!value.summary.trim() && !value.skills.trim() && !value.extra.trim() && !experiences.some(item => [item.organization, item.title, item.description].some(text => text.trim())))) throw new Error('请至少补充一段经历、技能或简介。')
  if (text.length > 20000) throw new Error('简历请控制在 20000 字以内。')
  return text
}
