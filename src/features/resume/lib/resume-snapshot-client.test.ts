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
  const document = { sourceFile: '简历.pdf', extracted: { text: '原文' }, review: { rawText: saved.rawText, jobDescription: '私有 JD' }, revisionDraft: { text: '未保存' }, originalFile: new File(['pdf'], '简历.pdf') } as ResumeDocument
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
  vi.mocked(loadResumeDocument).mockResolvedValue({ sourceFile: saved.sourceName, extracted: { text: saved.rawText } } as ResumeDocument)
  const fetcher = vi.fn().mockRejectedValue(new DOMException('aborted', 'AbortError'))
  vi.stubGlobal('fetch', fetcher)
  await expect(saveResumeSnapshot('local')).rejects.toThrow('确认是否已保存')
  expect(fetcher).toHaveBeenCalledOnce()
})

it('非 JSON 返回值给出可读错误', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('<html>not ready</html>')))
  await expect(listResumeSnapshots()).rejects.toThrow('无法读取的数据')
})
