import { get, set } from 'idb-keyval'
import { experiencesSchema, parseWebsiteExperiences, type WebsiteExperience } from '@/domain/website-experience'
import { resumeContentKey } from '@/lib/storage'

export type ExperienceDraft = { items: WebsiteExperience[]; confirmed: boolean }
const key = (source: string) => `website-experiences:v1:${resumeContentKey(source)}`
export async function loadExperiences(source: string): Promise<ExperienceDraft> {
  const saved = await get<{ source: string; items: unknown; confirmed: boolean }>(key(source))
  if (saved?.source === source && experiencesSchema.safeParse(saved.items).success) return { items: experiencesSchema.parse(saved.items), confirmed: saved.confirmed === true }
  return { items: parseWebsiteExperiences(source), confirmed: false }
}
export async function saveExperiences(source: string, draft: ExperienceDraft) {
  await set(key(source), { source, items: experiencesSchema.parse(draft.items), confirmed: draft.confirmed })
}
