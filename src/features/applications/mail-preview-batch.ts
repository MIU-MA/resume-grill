import { batchSchema, type MailSender } from '@/domain/mail-schema'
import { draftPayload, validResumeAttachment, type Draft, type SavedJobPreparation } from './draft-state'
import { encodeAttachment } from './mail-attachment'
import { tailoringIsCurrent } from './job-resume-tailoring'
import type { AttachmentSource } from './mail-draft-storage'

export function mailDraftAttachment(draft: Draft, saved: SavedJobPreparation | undefined, fallback: File | null, fallbackSource?: AttachmentSource) {
  if (saved?.tailoredResume) {
    if (!tailoringIsCurrent(draft, saved)) throw new Error(`「${draft.company || draft.role || draft.recipient}」的岗位信息已修改，请重新生成岗位版简历，或改用原简历。`)
    if (!validResumeAttachment(saved.attachment)) throw new Error('岗位版附件无法读取，请重新生成。')
    return { file: saved.attachment, source: saved.attachmentSource }
  }
  if (!validResumeAttachment(fallback)) throw new Error('请选择这批投递要附上的简历原文件')
  return { file: fallback, source: fallbackSource }
}
export async function createMailPreviewBatch(targets: Draft[], preparation: Record<string, SavedJobPreparation>, fallback: File | null, source: AttachmentSource | undefined, sender: MailSender) {
  const picked = targets.map(draft => mailDraftAttachment(draft, preparation[draft.id], fallback, source))
  if (!picked.length) throw new Error('请先选择要投递的邮件。')
  const cache = new Map<File, Promise<string>>()
  const encode = (file: File) => { if (!cache.has(file)) cache.set(file, encodeAttachment(file)); return cache.get(file)! }
  const common = picked[0].file
  const attachment = { name: common.name, base64: await encode(common) }
  const jobs = await Promise.all(targets.map(async (draft, index) => ({
    ...draftPayload(draft),
    ...(picked[index].file === common ? {} : { attachment: { name: picked[index].file.name, base64: await encode(picked[index].file) } }),
  })))
  const batch = batchSchema.parse({ id: crypto.randomUUID(), sender, jobs, attachment })
  if (new TextEncoder().encode(JSON.stringify(batch)).byteLength > 8 * 1024 * 1024) throw new Error('这批岗位版附件合计过大，请减少本批选中的岗位。')
  const captured = Object.fromEntries(targets.map((draft, index) => [draft.id, { ...preparation[draft.id], jobDescription: draft.jobDescription ?? '', attachment: picked[index].file, attachmentSource: picked[index].source, attachmentUse: 'preview' as const }]))
  return { batch, captured }
}
