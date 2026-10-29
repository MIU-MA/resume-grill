import { usableTailoringSchema, tailoringSections, type TailoringPlan } from '@/domain/resume-tailoring'
import { getLlmSettings } from '@/lib/settings'
import { prepareJobResume } from '@/features/resume/lib/job-preparation'
import { createResumeRevision } from '@/features/resume/lib/resume-revision'
import type { ResumePdfArtifact } from '@/features/resume/lib/resume-pdf'
import { updateResumeDocument } from '@/features/resume/lib/resume-library'
import type { AttachmentSource } from './mail-draft-storage'
import type { Draft, SavedJobPreparation } from './draft-state'
import { validResumeAttachment } from './draft-state'
import { DEFAULT_RESUME_TEMPLATE, type ResumeTemplateId } from '@/domain/resume-template'
import { createResumePdfRevision } from '@/features/resume/lib/resume-pdf-revision'
import type { ResumePhoto } from '@/domain/resume-photo'

export type TailoringSession = {
  sourceDocumentId: string; sourceFile: string; rawText: string
  sections: ReturnType<typeof tailoringSections>; plan: TailoringPlan
  template?: ResumeTemplateId
  originalFile?: File
  photo?: ResumePhoto
}
export type TailoredResume = {
  jobDescription: string; company: string; role: string
  sourceFile: File; source?: AttachmentSource
  documentId: string; text: string
  template?: ResumeTemplateId
}
export async function generateJobResume(draft: Draft, file: File, source: AttachmentSource | undefined, signal: AbortSignal, onPrepared?: (session: TailoringSession) => void): Promise<TailoringSession> {
  const document = await prepareJobResume({ job: { ...draft, jobDescription: draft.jobDescription ?? '' }, attachment: file, attachmentSource: source }, 'tailoring')
  if (signal.aborted) throw new DOMException('已取消', 'AbortError')
  const rawText = document.extracted.text
  const sections = tailoringSections(rawText)
  const session: TailoringSession = { sourceDocumentId: document.id, sourceFile: document.sourceFile, rawText, sections, plan: { company: '', role: '', sectionOrder: sections.map(section => section.id), changes: [], highlights: [], gaps: [] }, template: /\.pdf$/i.test(file.name) ? 'original' : document.pdfTemplate, originalFile: file, photo: document.photo }
  onPrepared?.(session)
  const response = await fetch('/api/tailor-resume', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, signal,
    body: JSON.stringify({ rawText, jobDescription: draft.jobDescription, llm: getLlmSettings() ?? undefined }),
  })
  const data = await response.json()
  if (!response.ok) throw new Error(data.error || '岗位版简历生成失败。')
  const plan = usableTailoringSchema(rawText, draft.jobDescription ?? '').parse(data)
  return { ...session, plan }
}
export function tailoringIsCurrent(draft: Draft, saved: SavedJobPreparation | undefined) {
  const tailored = saved?.tailoredResume
  return !!tailored && validResumeAttachment(saved?.attachment) && tailored.jobDescription === (draft.jobDescription ?? '').trim() && tailored.company === draft.company && tailored.role === draft.role
}
export async function previewJobResume(session: TailoringSession, text: string, company: string, role: string, template: ResumeTemplateId = DEFAULT_RESUME_TEMPLATE) {
  const artifact = await createResumePdfRevision(text, session.sourceFile, template, session.originalFile, session.rawText, session.photo)
  const filenamePart = (value: string, length: number) => Array.from(value).filter(character => character.codePointAt(0)! >= 32).join('').replace(/[<>:"/\\|?*]/g, '').slice(0, length)
  const suffix = filenamePart([company, role].filter(Boolean).join('-'), 70)
  const basename = filenamePart(session.sourceFile.replace(/\.[^.]*$/, ''), 60) || '简历'
  artifact.file = new File([await artifact.file.arrayBuffer()], `${basename}${suffix ? `-${suffix}` : ''}-投递版.pdf`, { type: 'application/pdf' })
  return artifact
}
export async function saveJobResume(session: TailoringSession, text: string, artifact: ResumePdfArtifact, target?: Pick<Draft, 'company' | 'role'>) {
  const document = await createResumeRevision(session.sourceDocumentId, text, session.rawText, artifact, { allowUnchanged: true })
  if (!target || !document.jobContext) return document
  const jobContext = { ...document.jobContext, company: target.company, role: target.role }
  await updateResumeDocument(document.id, { jobContext })
  return { ...document, jobContext }
}
