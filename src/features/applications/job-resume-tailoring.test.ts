import { readFileSync } from 'node:fs'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs'
import { generateJobResume, previewJobResume, saveJobResume } from './job-resume-tailoring'
import { tailoredResumeText, tailoringChangeKey, tailoringSections } from '@/domain/resume-tailoring'
import type { ResumeDocument } from '@/features/resume/lib/resume-library'
import type { Draft } from './draft-state'

const database = vi.hoisted(() => new Map<string, unknown>())
vi.mock('idb-keyval', () => ({
  get: vi.fn(async (key: string) => database.get(key)),
  set: vi.fn(async (key: string, value: unknown) => { database.set(key, value) }),
  update: vi.fn(async (key: string, updater: (value: unknown) => unknown) => { database.set(key, updater(database.get(key))) }),
  keys: vi.fn(async () => [...database.keys()]), del: vi.fn(),
}))
const font = readFileSync(new URL('../../../public/fonts/NotoSansSC-Regular.ttf', import.meta.url))
const rawText = '林同学\n项目经历\n- 使用 React 开发订单页面，参与接口联调'
const draft: Draft = { id: crypto.randomUUID(), company: '示例公司', role: '前端工程师', sourceUrl: '', recipient: 'hr@example.com', subject: '', body: '', sourceConfirmed: false, jobDescription: '示例公司 前端工程师，负责订单页面开发和接口联调' }
const plan = { company: '示例公司', role: '前端工程师', sectionOrder: tailoringSections(rawText).map(section => section.id), changes: [{ sectionId: 'section-1', lineIndex: 0, after: '- 使用 React 开发订单页面，并参与接口联调', requirement: '订单页面开发和接口联调', reason: '保持原有参与范围，明确页面与联调工作' }], highlights: [{ sectionId: 'section-1', lineIndex: 0 }], gaps: [] }
beforeEach(() => {
  database.clear()
  vi.stubGlobal('fetch', vi.fn(async (url: string) => url === '/api/tailor-resume' ? new Response(JSON.stringify(plan)) : new Response(font)))
})
afterEach(() => { vi.unstubAllGlobals() })
it('从原文件生成真实岗位版 PDF，提取文字匹配新稿，保存新版本而不覆盖原件', async () => {
  const file = new File([rawText], 'original.txt')
  const session = await generateJobResume(draft, file, undefined, new AbortController().signal)
  const original = database.get(session.sourceDocumentId) as ResumeDocument
  const text = tailoredResumeText(session.sections, session.plan, new Set(plan.changes.map(tailoringChangeKey)))
  const artifact = await previewJobResume(session, text, draft.company, draft.role)
  expect(artifact.file.name).toContain('示例公司-前端工程师-投递版.pdf')
  const task = getDocument({ data: new Uint8Array(await artifact.file.arrayBuffer()) })
  try {
    const document = await task.promise
    const content = await (await document.getPage(1)).getTextContent()
    expect(content.items.flatMap(item => 'str' in item ? [item.str] : []).join('').replace(/\s/g, '')).toContain('使用React开发订单页面，并参与接口联调')
  } finally { await task.destroy() }
  const saved = await saveJobResume(session, text, artifact, { company: '核对后的公司', role: '核对后的岗位' })
  expect(saved.originalFile).toBe(artifact.file)
  expect(saved.revisionOf).toBe(session.sourceDocumentId)
  expect(saved.review?.rawText).toBe(artifact.text)
  expect(saved.jobContext).toMatchObject({ company: '核对后的公司', role: '核对后的岗位' })
  const retained = database.get(session.sourceDocumentId) as ResumeDocument
  expect(retained.originalFile).toBe(file)
  expect(retained.review).toEqual(original.review)
  expect(retained.review?.rawText).toBe(rawText)
  expect(vi.mocked(fetch).mock.calls.filter(([url]) => url === '/api/tailor-resume')).toHaveLength(1)
  const request = vi.mocked(fetch).mock.calls.find(([url]) => url === '/api/tailor-resume')!
  expect(JSON.parse((request[1] as RequestInit).body as string)).toMatchObject({ rawText, jobDescription: draft.jobDescription })
}, 15000)
it('请求在解析后取消时不调用模型', async () => {
  const abort = new AbortController(); abort.abort()
  await expect(generateJobResume(draft, new File([rawText], 'original.txt'), undefined, abort.signal)).rejects.toThrow('已取消')
  expect(fetch).not.toHaveBeenCalled()
})
