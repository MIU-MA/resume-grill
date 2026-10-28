import { set } from 'idb-keyval'
import type { ResumeComposition } from '@/domain/resume-composition'
import { composeResumeText } from '@/domain/resume-composition'
import { parseResumeStructure, extractResumeClaimCandidates } from '@/domain/resume-structure'
import type { ResumeTemplateId } from '@/domain/resume-template'
import type { ResumePhoto } from '@/domain/resume-photo'
import { PROFILE_LABELS, type WebsiteProfile } from '@/domain/website-automation'
import { loadWebsiteProfile, saveWebsiteProfile, seedWebsiteProfile } from '@/features/applications/website-automation'
import { loadExperiences, saveExperiences } from '@/features/applications/website-experience-storage'
import { createResumePdf } from './resume-pdf'
import type { ResumeDocument } from './resume-library'

export async function loadResumeComposition(source = ''): Promise<ResumeComposition> {
  const [saved, draft] = await Promise.all([loadWebsiteProfile(), loadExperiences(source)])
  const detected = Object.fromEntries(Object.entries(seedWebsiteProfile(source)).filter(([, value]) => value?.trim()))
  const profile = { ...saved, ...detected }
  const experiences = [...draft.items]
  if (!experiences.some(item => item.kind === 'education') && profile.school) experiences.unshift({ id: crypto.randomUUID(), kind: 'education', organization: profile.school, title: [profile.major, profile.degree].filter(Boolean).join(' · '), start: profile.educationStart ?? '', end: profile.educationEnd ?? '', description: '' })
  if (!experiences.some(item => item.kind === 'work') && profile.company) experiences.push({ id: crypto.randomUUID(), kind: 'work', organization: profile.company, title: profile.jobTitle ?? '', start: profile.workStart ?? '', end: profile.workEnd ?? '', description: '' })
  const sections = parseResumeStructure(source)
  const content = (kinds: string[]) => sections.filter(section => kinds.includes(section.kind)).map(section => section.lines.map(line => line.text).join('\n')).join('\n')
  const normalize = (text: string) => text.replace(/[^\p{L}\p{N}]/gu, '').toLowerCase()
  const representedProfile = normalize(Object.entries(profile).map(([key, value]) => `${PROFILE_LABELS[key as keyof WebsiteProfile]}${value}`).join(' '))
  const extra = sections.flatMap(section => {
    if (['profile', 'skills'].includes(section.kind)) return []
    const kind = section.kind === 'internship' ? 'work' : section.kind
    const entries = experiences.filter(item => item.kind === kind)
    // Confirmed website edits are authoritative. For local parsing, retain
    // anything not represented in the fields rather than silently dropping it.
    if (draft.confirmed && entries.length) return []
    const represented = section.kind === 'general' ? representedProfile : normalize(entries.map(item => [item.organization, item.title, item.start, item.end, item.description].join(' ')).join(' '))
    const remaining = section.lines.flatMap(line => section.kind === 'general' ? line.text.split(/[|｜]/) : [line.text]).filter(line => !represented.includes(normalize(line))).map(line => line.trim())
    return remaining.length ? [[section.title, ...remaining].join('\n')] : []
  }).join('\n\n')
  return { profile, experiences, summary: content(['profile']), skills: content(['skills']), extra }
}

export async function createComposedResume(value: ResumeComposition, template: ResumeTemplateId, photo?: ResumePhoto | null): Promise<{ document: ResumeDocument; reuseWarning?: string }> {
  const text = composeResumeText(value)
  const name = `${Array.from(value.profile.name?.trim() || '我的').filter(character => character.codePointAt(0)! >= 32).join('').replace(/[<>:"/\\|?*]/g, '')}-简历.pdf`
  const pdf = await createResumePdf(text, name, undefined, template, photo)
  const file = new File([await pdf.file.arrayBuffer()], name, { type: 'application/pdf' })
  const now = Date.now()
  const document: ResumeDocument = {
    id: `resume-document:composed:${crypto.randomUUID()}`, sourceFile: name, demo: false,
    extracted: { text, charCount: text.length, pageCount: pdf.pageCount }, originalFile: file, originalFileUpdatedAt: now,
    pdfTemplate: template, photo: photo ?? undefined,
    review: { rawText: text, analysisGoal: 'overall', jobDescription: '', reviewedCandidates: extractResumeClaimCandidates(text) }, updatedAt: now,
  }
  // Store the file first; a profile write failure must not discard a generated resume.
  await set(document.id, document)
  const results = await Promise.allSettled([saveWebsiteProfile(value.profile), saveExperiences(text, { items: value.experiences, confirmed: true })])
  return { document, reuseWarning: results.every(result => result.status === 'fulfilled') ? undefined : '简历已保存，但官网填写资料未能同步。' }
}
