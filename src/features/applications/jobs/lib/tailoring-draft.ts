import { z } from 'zod'
import { tailoringPlanSchema, usableTailoringSchema } from '@/domain/resume-tailoring'
import { RESUME_TEMPLATES } from '@/domain/resume-template'
import { resumeContentKey } from '@/lib/storage'
import type { Draft } from '../../mail/lib/draft-state'
import type { AttachmentSource } from '../../mail/lib/mail-draft-storage'

const schema = z.object({
  context: z.string(), rawText: z.string().max(20000), plan: tailoringPlanSchema,
  edits: z.record(z.string(), z.string().max(20000)), originalOrder: z.boolean(),
  company: z.string().max(120), role: z.string().max(120),
  mailEdit: z.object({ subject: z.string().max(200).optional(), body: z.string().max(12000).optional() }),
  template: z.enum(['original', ...RESUME_TEMPLATES.map(item => item.id)]),
})
export type TailoringDraft = z.infer<typeof schema>
export function tailoringDraftContext(draft: Draft, file: File, source?: AttachmentSource) {
  return JSON.stringify([draft.id, draft.jobDescription ?? '', draft.company, draft.role, draft.recipient, source?.id, source?.updatedAt, file.name, file.size, file.lastModified])
}
const key = (context: string) => `resume-grill:tailoring-draft:v1:${resumeContentKey(context)}`
export function readTailoringDraft(context: string, jd: string): TailoringDraft | null {
  try {
    const parsed = schema.safeParse(JSON.parse(sessionStorage.getItem(key(context)) ?? 'null'))
    if (!parsed.success || parsed.data.context !== context) return null
    const plan = usableTailoringSchema(parsed.data.rawText, jd).parse(parsed.data.plan)
    return { ...parsed.data, plan }
  } catch { return null }
}
export function writeTailoringDraft(draft: TailoringDraft) { sessionStorage.setItem(key(draft.context), JSON.stringify(draft)) }
export function clearTailoringDraft(context: string) { sessionStorage.removeItem(key(context)) }
