import { resumeSnapshot, resumeSnapshotSummary, resumeSnapshotInput } from '@/domain/resume-snapshot'
import { loadResumeDocument } from './resume-library'

async function request(path = '', body?: string) {
  let response: Response
  try {
    response = await fetch(`/api/local-resumes${path}`, {
      method: body ? 'POST' : 'GET', cache: 'no-store', signal: AbortSignal.timeout(10000),
      ...(body ? { body, headers: { 'Content-Type': 'application/json' } } : {}),
    })
  } catch { throw new Error(body ? '连接中断，请刷新备份列表确认是否已保存，再决定是否重试。' : '无法读取备份，请检查连接后重试。') }
  let value: unknown
  try { value = await response.json() }
  catch { throw new Error('本机服务返回了无法读取的数据，请检查服务版本。') }
  if (!response.ok) throw new Error(value && typeof value === 'object' && 'error' in value && typeof value.error === 'string' ? value.error : '本机备份操作失败。')
  return value
}

export async function listResumeSnapshots() {
  return resumeSnapshotSummary.array().max(100).parse(await request())
}

export async function saveResumeSnapshot(id: string) {
  const document = await loadResumeDocument(id)
  if (!document) throw new Error('这份简历已被删除，请刷新简历库。')
  const input = resumeSnapshotInput.safeParse({ sourceName: document.sourceFile, rawText: document.review?.rawText ?? document.extracted.text })
  if (!input.success) throw new Error('正文为空、超过 1 MiB，或来源名称过长，无法保存文本快照。')
  return resumeSnapshot.parse(await request('', JSON.stringify(input.data)))
}

export async function readResumeSnapshot(id: string) {
  if (!/^[a-f0-9]{32}$/.test(id)) throw new Error('备份编号无效。')
  const document = resumeSnapshot.parse(await request(`/${id}`))
  if (document.id !== id) throw new Error('读取结果与所选备份不一致。')
  return document
}
