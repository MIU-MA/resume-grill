import { groundedTailoringSchema, tailoringSections, type TailoringPlan } from '@/domain/resume-tailoring'
import { getLlmSettings } from '@/lib/settings'
import { prepareJobResume } from '@/features/resume/lib/job-preparation'
import { createResumeRevision } from '@/features/resume/lib/resume-revision'
import { createResumePdf, type ResumePdfArtifact } from '@/features/resume/lib/resume-pdf'
import { updateResumeDocument } from '@/features/resume/lib/resume-library'
import type { AttachmentSource } from './mail-draft-storage'
import type { Draft, SavedJobPreparation } from './draft-state'
import { validResumeAttachment } from './draft-state'

export type TailoringSession = {
  sourceDocumentId: string; sourceFile: string; rawText: string
  sections: ReturnType<typeof tailoringSections>; plan: TailoringPlan
}
export type TailoredResume = {
  jobDescription: string; company: string; role: string
  sourceFile: File; source?: AttachmentSource
  documentId: string; text: string
}
export async function generateJobResume(draft: Draft, file: File, source: AttachmentSource | undefined, signal: AbortSignal): Promise<TailoringSession> {
  const document = await prepareJobResume({ job: { ...draft, jobDescription: draft.jobDescription ?? '' }, attachment: file, attachmentSource: source })
  if (signal.aborted) throw new DOMException('已取消', 'AbortError')
  const rawText = document.review?.rawText ?? document.extracted.text
  const response = await fetch('/api/tailor-resume', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, signal,
    body: JSON.stringify({ rawText, jobDescription: draft.jobDescription, llm: getLlmSettings() ?? undefined }),
  })
  const data = await response.json()
  if (!response.ok) throw new Error(data.error || '岗位版简历生成失败。')
  const plan = groundedTailoringSchema(rawText, draft.jobDescription ?? '').parse(data)
  return { sourceDocumentId: document.id, sourceFile: document.sourceFile, rawText, sections: tailoringSections(rawText), plan }
}
export function tailoringIsCurrent(draft: Draft, saved: SavedJobPreparation | undefined) {
  const tailored = saved?.tailoredResume
  return !!tailored && validResumeAttachment(saved?.attachment) && tailored.jobDescription === (draft.jobDescription ?? '').trim() && tailored.company === draft.company && tailored.role === draft.role
}
export async function previewJobResume(session: TailoringSession, text: string, company: string, role: string) {
  const artifact = await createResumePdf(text, session.sourceFile)
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
