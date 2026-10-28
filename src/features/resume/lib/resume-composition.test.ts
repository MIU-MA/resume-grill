import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { composeResumeText } from '@/domain/resume-composition'
import type { ResumeComposition } from '@/domain/resume-composition'
const values = vi.hoisted(() => new Map<string, unknown>())
vi.mock('idb-keyval', () => ({ get: async (key: string) => values.get(key), set: async (key: string, value: unknown) => { values.set(key, value) }, update: vi.fn(), keys: vi.fn(), del: vi.fn() }))
import { loadResumeComposition, createComposedResume } from './resume-composition'
import { saveExperiences, loadExperiences } from '@/features/applications/website-experience-storage'
import { saveWebsiteProfile, loadWebsiteProfile } from '@/features/applications/website-automation'
import { resumeContentKey } from '@/lib/storage'
import { readFileSync } from 'node:fs'
beforeEach(() => { values.clear(); vi.stubGlobal('fetch', vi.fn(async () => new Response(readFileSync('public/fonts/NotoSansSC-Regular.ttf')))) })
afterEach(() => vi.unstubAllGlobals())
it('直接复用官网填写已核对的资料与经历，不用空检测结果覆盖保存的姓名邮箱', async () => {
  const source = '个人简介\n参与前端开发。\n专业技能\nTypeScript\n证书\n英语六级'
  await saveWebsiteProfile({ name: '林沐', email: 'lin@example.com', school: '测试大学', major: '软件工程' })
  const work = { id: 'work-1', kind: 'work' as const, organization: '测试软件', title: '开发实习生', start: '2025-03', end: '2025-06', description: '维护已有页面' }
  await saveExperiences(source, { items: [work], confirmed: true })
  const value = await loadResumeComposition(source)
  expect(value.profile.name).toBe('林沐')
  expect(value.profile.email).toBe('lin@example.com')
  expect(value.experiences).toContainEqual(work)
  expect(value.experiences.find(item => item.kind === 'education')?.organization).toBe('测试大学')
  expect(value.summary).toContain('参与前端开发')
  expect(value.skills).toBe('TypeScript')
  expect(value.extra).toContain('英语六级')
  expect(value.extra).not.toContain('维护已有页面')
})
it('没有任何经历或资料时仍提供字段，不编造任职公司、项目或成果', async () => {
  const value = await loadResumeComposition()
  expect(value.profile.name ?? '').toBe('')
  expect(value.experiences).toEqual([])
  expect(() => composeResumeText(value)).toThrow('至少补充')
})
it('本地解析未覆盖的个人描述和无日期经历保留在其他内容中，不因同类经历已识别而消失', async () => {
  const source = '姓名：林沐\n开源社区维护者\n项目经历\n没有日期的个人工具\n维护页面测试。\n\n列表工具 | 开发者 | 2025-01 — 2025-03\n使用 TypeScript 实现筛选。'
  const value = await loadResumeComposition(source)
  expect(value.experiences.some(item => item.organization === '列表工具')).toBe(true)
  expect(value.extra).toContain('开源社区维护者')
  expect(value.extra).toContain('没有日期的个人工具')
  expect(value.extra).toContain('维护页面测试')
  expect(value.extra).not.toContain('姓名：林沐')
  expect(composeResumeText(value)).toContain('没有日期的个人工具')
})
it('生成独立 PDF 和普通检查文档，确认的经历能被官网填写再次读取', async () => {
  const value: ResumeComposition = { profile: { name: '林沐', email: 'lin@example.com' }, experiences: [{ id: 'project-1', kind: 'project', organization: '页面管理工具', title: '开发者', start: '2025-01', end: '2025-03', description: '使用 TypeScript 实现列表筛选。' }], summary: '', skills: 'TypeScript', extra: '' }
  const { document } = await createComposedResume(value, 'classic')
  expect(document.originalFile?.type).toBe('application/pdf')
  expect(new TextDecoder().decode((await document.originalFile!.arrayBuffer()).slice(0, 4))).toBe('%PDF')
  expect(document.extracted.text).toContain('页面管理工具')
  expect(document.review?.jobDescription).toBe('')
  expect(document.jobContext).toBeUndefined()
  expect(values.get(document.id)).toEqual(document)
  expect(values.get('current-resume-document')).toBeUndefined()
  expect((await loadExperiences(document.extracted.text)).items).toEqual(value.experiences)
  expect((await loadWebsiteProfile()).name).toBe('林沐')
  expect(values.has(`website-experiences:v1:${resumeContentKey(document.extracted.text)}`)).toBe(true)
})
