import { z } from 'zod'

export const EXPERIENCE_KINDS = { education: '教育经历', work: '工作 / 实习', project: '项目经历' } as const
export const experienceSchema = z.object({
  id: z.string().min(1).max(100), kind: z.enum(['education', 'work', 'project']),
  organization: z.string().trim().max(200), title: z.string().trim().max(200),
  start: z.string().max(30), end: z.string().max(30), description: z.string().max(5000),
}).strict()
export const experiencesSchema = z.array(experienceSchema).max(30)
export type WebsiteExperience = z.infer<typeof experienceSchema>

// Conservative local extraction: preserve the source description and require review.
export function parseWebsiteExperiences(text: string): WebsiteExperience[] {
  let kind: WebsiteExperience['kind'] | undefined
  let entry: WebsiteExperience | undefined
  const result: WebsiteExperience[] = []
  const range = /((?:19|20)\d{2}[./年-]\d{1,2}月?)\s*(?:-|—|–|~|～|至)\s*((?:19|20)\d{2}[./年-]\d{1,2}月?|至今|现在|Present)/i
  const date = (value: string) => value.replace(/^(\d{4})[./年-](\d{1,2})月?$/, (_, y, m) => `${y}-${m.padStart(2, '0')}`)
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.replace(/^\s*#{1,6}\s*/, '').replace(/\*\*/g, '').trim()
    const heading = line.replace(/[：:]$/, '')
    const section = /^(教育经历|教育背景|Education)$/i.test(heading) ? 'education' : /^(工作经历|实习经历|工作与实习经历|Work Experience|Internship Experience)$/i.test(heading) ? 'work' : /^(项目经历|项目经验|Projects)$/i.test(heading) ? 'project' : undefined
    if (section) { kind = section; entry = undefined; continue }
    if (/^(技能|专业技能|个人信息|联系方式|自我评价|获奖经历|证书|Skills|Summary|Certifications)[：:]?$/i.test(line)) { kind = undefined; entry = undefined; continue }
    if (!kind || !line) continue
    const dates = line.match(range)
    if (dates && !/^[-•·]/.test(line) && result.length < 30) {
      const parts = line.replace(dates[0], '').replace(/^[\s|｜]+|[\s|｜]+$/g, '').split(/\s*[|｜]\s*/)
      entry = { id: `entry-${result.length + 1}`, kind, organization: (parts.shift() ?? '').slice(0, 200), title: parts.join(' / ').slice(0, 200), start: date(dates[1]), end: date(dates[2]), description: '' }
      result.push(entry)
    } else if (entry) entry.description = [entry.description, raw.trim()].filter(Boolean).join('\n').slice(0, 5000)
  }
  return result
}
