// @vitest-environment jsdom
import { act, createElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { JobDossier } from './JobDossier'
import { listRecords, type SavedRecord } from '@/lib/storage'
import { listResumeDocuments } from '@/features/resume/lib/resume-library'
import { emptyApplicationProgress } from '@/domain/application-progress'
vi.mock('@/lib/storage', () => ({ listRecords: vi.fn() }))
vi.mock('@/features/resume/lib/resume-library', () => ({ listResumeDocuments: vi.fn() }))
let host: HTMLDivElement; let root: Root
const onSave = vi.fn().mockResolvedValue(undefined), onOpenRecord = vi.fn()
const props = { id: 'job-a', title: '甲公司 / 前端', sourceUrl: '', disabled: false, onSave, onOpenRecord, jobRequirements: '当前 JD', delivery: '邮件正文' }
const record = (id: string, applicationId?: string) => ({ id, analysis: { jobContext: applicationId ? { applicationId } : undefined, sourceFile: `${id}.pdf`, claims: [] }, sessions: {}, updatedAt: 10 }) as unknown as SavedRecord
const button = (label: string) => [...host.querySelectorAll('button')].find(node => node.textContent === label)!
beforeEach(() => {
  vi.clearAllMocks(); vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  vi.mocked(listRecords).mockResolvedValue([record('a', 'job-a'), record('b', 'job-b'), record('general')])
  vi.mocked(listResumeDocuments).mockResolvedValue([])
  host = document.createElement('div'); document.body.append(host); root = createRoot(host)
})
afterEach(async () => { await act(async () => root.unmount()); host.remove(); vi.unstubAllGlobals() })
it('只聚合这个岗位的练习，不混入普通简历或其他岗位；可以打开原练习记录', async () => {
  await act(async () => root.render(createElement(JobDossier, props)))
  await act(async () => button('面试与复盘').click())
  expect(host.textContent).toContain('a.pdf')
  expect(host.textContent).not.toContain('b.pdf')
  expect(host.textContent).not.toContain('general.pdf')
  await act(async () => button('查看准备与复盘').click())
  expect(onOpenRecord).toHaveBeenCalledWith(expect.objectContaining({ id: 'a' }))
})
it('旧记录没有附件快照时不冒充当前附件；投递 JD 与后续修改分开展示', async () => {
  await act(async () => root.render(createElement(JobDossier, { ...props, submission: { jobDescription: '投递时 JD', at: 1, channel: 'mail' } })))
  expect(host.textContent).toContain('当前 JD')
  expect(host.textContent).toContain('投递时 JD')
  await act(async () => button('简历与投递').click())
  expect(host.textContent).toContain('没有保存投递附件原件')
  expect(host.textContent).toContain('邮件正文')
})
it('手动记录进展，失败保留输入，可重试；不触发邮件或模型调用', async () => {
  onSave.mockRejectedValueOnce(new Error('quota'))
  await act(async () => root.render(createElement(JobDossier, { ...props, progress: emptyApplicationProgress() })))
  await act(async () => button('求职进展').click())
  const select = host.querySelector('select')!
  await act(async () => { select.value = 'offer'; select.dispatchEvent(new Event('change', { bubbles: true })) })
  await act(async () => host.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })))
  expect(host.textContent).toContain('保存失败')
  expect(select.value).toBe('offer')
  await act(async () => host.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })))
  expect(onSave).toHaveBeenLastCalledWith(expect.objectContaining({ stage: 'offer' }))
  expect(host.textContent).toContain('已保存')
})
