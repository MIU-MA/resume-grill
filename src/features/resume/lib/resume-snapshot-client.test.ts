import { afterEach, expect, it, vi } from 'vitest'
import { listResumeSnapshots, readResumeSnapshot, saveResumeSnapshot } from './resume-snapshot-client'
import type { ResumeDocument } from './resume-library'
import { loadResumeDocument } from './resume-library'

vi.mock('./resume-library', () => ({ loadResumeDocument: vi.fn() }))

afterEach(() => vi.unstubAllGlobals())
const id = 'a'.repeat(32)
const saved = { id, sourceName: '简历.pdf', rawText: '已保存正文', createdAt: 1 }

it('只发送当前正文和文件名，不发送附件、JD、草稿与检查结果', async () => {
  const fetcher = vi.fn().mockResolvedValue(Response.json(saved))
  vi.stubGlobal('fetch', fetcher)
  const document = { id: 'local-document-id', sourceFile: '简历.pdf', extracted: { text: '原文' }, review: { rawText: saved.rawText, jobDescription: '私有 JD' }, revisionDraft: { text: '未保存' }, originalFile: new File(['pdf'], '简历.pdf') } as ResumeDocument
  vi.mocked(loadResumeDocument).mockResolvedValue(document)
  await saveResumeSnapshot('local-document-id')
  expect(loadResumeDocument).toHaveBeenCalledWith('local-document-id')
  expect(JSON.parse(fetcher.mock.calls[0][1].body)).toEqual({ sourceName: '简历.pdf', rawText: saved.rawText })
  expect(fetcher.mock.calls[0][1].headers.Authorization).toBeUndefined()
})

it('保存前从存储读回；已删除的简历不会从旧界面数据重新上传', async () => {
  const fetcher = vi.fn()
  vi.stubGlobal('fetch', fetcher)
  vi.mocked(loadResumeDocument).mockResolvedValue(undefined)
  await expect(saveResumeSnapshot('deleted')).rejects.toThrow('已被删除')
  expect(fetcher).not.toHaveBeenCalled()
})

it('读取时核对编号并验证正文，非法数据不能导入', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(Response.json(saved)).mockResolvedValueOnce(Response.json({ ...saved, id: 'b'.repeat(32) })).mockResolvedValueOnce(Response.json({ ...saved, rawText: '' })))
  await expect(readResumeSnapshot(id)).resolves.toEqual(saved)
  await expect(readResumeSnapshot(id)).rejects.toThrow('不一致')
  await expect(readResumeSnapshot(id)).rejects.toThrow()
})

it('服务不可用会报错，不把失败当成空列表', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({ error: '无法连接 Go 服务' }, { status: 503 })))
  await expect(listResumeSnapshots()).rejects.toThrow('无法连接 Go 服务')
})

it('保存时连接中断不会自动重试，提示先核对是否已落库', async () => {
  vi.mocked(loadResumeDocument).mockResolvedValue({ id: 'local', sourceFile: saved.sourceName, extracted: { text: saved.rawText } } as ResumeDocument)
  const fetcher = vi.fn().mockRejectedValue(new DOMException('aborted', 'AbortError'))
  vi.stubGlobal('fetch', fetcher)
  await expect(saveResumeSnapshot('local')).rejects.toThrow('确认是否已保存')
  expect(fetcher).toHaveBeenCalledOnce()
})

it('非 JSON 返回值给出可读错误', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('<html>not ready</html>')))
  await expect(listResumeSnapshots()).rejects.toThrow('无法读取的数据')
})

it('保存后的响应体中断或结构错误，都提示先核对落库结果', async () => {
  vi.mocked(loadResumeDocument).mockResolvedValue({ id: 'local', sourceFile: saved.sourceName, extracted: { text: saved.rawText } } as ResumeDocument)
  const fetcher = vi.fn()
    .mockResolvedValueOnce(new Response(new ReadableStream({ start(controller) { controller.error(new DOMException('aborted', 'AbortError')) } })))
    .mockResolvedValueOnce(Response.json({ status: 'ok' }))
  vi.stubGlobal('fetch', fetcher)
  await expect(saveResumeSnapshot('local')).rejects.toThrow('确认是否已保存')
  await expect(saveResumeSnapshot('local')).rejects.toThrow('确认是否已保存')
  expect(fetcher).toHaveBeenCalledTimes(2)
})

it('结构不兼容的备份列表返回明确提示，不把 Zod 内部错误展示给用户', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json([{ id: 123 }])))
  await expect(listResumeSnapshots()).rejects.toThrow('格式不兼容')
})

it('保存响应必须对应实际提交的正文，不能误报成功', async () => {
  vi.mocked(loadResumeDocument).mockResolvedValue({ id: 'local', sourceFile: saved.sourceName, extracted: { text: saved.rawText } } as ResumeDocument)
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({ ...saved, rawText: '另一份正文' })))
  await expect(saveResumeSnapshot('local')).rejects.toThrow('确认是否已保存')
})

it('文本副本再次备份使用原始来源名，避免追加标签后超出长度限制', async () => {
  const sourceName = '字'.repeat(512)
  const copy = { id: 'resume-document:text-copy:copy', sourceFile: `${sourceName}（文本副本）`, snapshotSourceName: sourceName, extracted: { text: saved.rawText } } as ResumeDocument
  vi.mocked(loadResumeDocument).mockResolvedValue(copy)
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({ ...saved, sourceName })))
  await expect(saveResumeSnapshot(copy.id)).resolves.toMatchObject({ sourceName })
})

it('旧副本只移除系统追加的一层标签，保留原名；新 PDF 使用自己的文件名', async () => {
  const copy = { id: 'resume-document:text-copy:old', sourceFile: '简历.pdf（文本副本）（文本副本）', extracted: { text: saved.rawText } } as ResumeDocument
  vi.mocked(loadResumeDocument).mockResolvedValueOnce(copy).mockResolvedValueOnce({ ...copy, originalFile: new File(['new'], '新简历.pdf'), sourceFile: '新简历.pdf', snapshotSourceName: '旧来源.pdf' })
  vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(Response.json({ ...saved, sourceName: '简历.pdf（文本副本）' })).mockResolvedValueOnce(Response.json({ ...saved, sourceName: '新简历.pdf' })))
  await expect(saveResumeSnapshot(copy.id)).resolves.toMatchObject({ sourceName: '简历.pdf（文本副本）' })
  await expect(saveResumeSnapshot(copy.id)).resolves.toMatchObject({ sourceName: '新简历.pdf' })
})
