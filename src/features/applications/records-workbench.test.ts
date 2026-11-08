// @vitest-environment jsdom
import { act, createElement, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { useMailWorkbench } from './hooks/use-mail-workbench'
import { initialMailDefaults } from './mail/lib/mail-defaults'
import { buildApplicationEntries } from './history/lib/application-entry'
import { emptyApplicationTracker } from './history/lib/application-tracker-storage'
import type { Draft, WebsiteApplication } from './mail/lib/draft-state'
import type { DraftStore } from './mail/lib/mail-draft-storage'
const state = vi.hoisted(() => ({
  count: 20,
  save: vi.fn(async () => emptyApplicationTracker()),
  persist: vi.fn(async (store: DraftStore, commit?: (store: DraftStore) => Promise<void>) => { await commit?.(store) }),
}))
const makeDraft = (id: string): Draft => ({ id, company: '演示公司', role: '开发', recipient: 'hr@example.com', sourceUrl: '', subject: '应聘', body: '简历见附件', sourceConfirmed: true })
const record: WebsiteApplication = { ...makeDraft('website'), recipient: '', sourceUrl: 'https://example.com/jobs/1', applicationUrl: 'https://apply.example.com/form/1', channel: 'website', appliedAt: 1 }
vi.mock('./hooks/use-mail-agent', () => ({ useMailAgent: () => ({ snapshot: null }) }))
vi.mock('./history/lib/website-record-storage', () => ({ saveWebsiteRecord: () => state.save() }))
vi.mock('./history/hooks/use-application-tracker', () => ({ useApplicationTracker: () => ({ tracker: emptyApplicationTracker(), commit: (work: () => Promise<unknown>) => work() }) }))
vi.mock('./mail/hooks/use-mail-drafts', () => ({ useMailDrafts: () => {
  const [drafts, setDrafts] = useState(Array.from({ length: state.count }, (_, index) => makeDraft(String(index))))
  const [websiteApplications, setWebsiteApplications] = useState([record])
  const [selectedId, setSelectedId] = useState<string | null>(record.id)
  const [selectedDraftIds, setSelectedDraftIds] = useState(drafts.map(draft => draft.id))
  const [preparationByJob, setPreparationByJob] = useState({})
  return { drafts, setDrafts, websiteApplications, setWebsiteApplications, selectedId, setSelectedId, selectedDraftIds, setSelectedDraftIds, preparationByJob, setPreparationByJob, attachment: null, libraryAttachments: [], hydrated: true, defaults: initialMailDefaults(), persist: state.persist, setTab: vi.fn() }
} }))
let hook!: ReturnType<typeof useMailWorkbench>
let root: ReturnType<typeof createRoot>
function Harness() { hook = useMailWorkbench({ mode: 'application-history', onNavigate: vi.fn(), onPrepare: vi.fn() }); return null }
beforeEach(async () => {
  state.count = 20; state.save.mockReset().mockImplementation(async () => emptyApplicationTracker())
  state.persist.mockClear()
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true); sessionStorage.clear()
  root = createRoot(document.createElement('div'))
  await act(async () => root.render(createElement(Harness)))
})
afterEach(async () => { await act(async () => root.unmount()); vi.unstubAllGlobals() })
const entry = () => buildApplicationEntries({ websites: [record] })[0]
const values = () => ({ company: '改名公司', role: record.role, channel: 'website' as const, contact: '', sourceUrl: record.sourceUrl, appliedAt: 2, note: '', stage: 'awaiting' as const })
it('修改公司和日期保留申请入口，主动清空岗位链接可以保存', async () => {
  await act(async () => hook.setRecordDialog({ mode: 'edit', entry: entry() }))
  await act(async () => hook.saveRecord(values()))
  expect(hook.entries[0].website?.applicationUrl).toBe(record.applicationUrl)
  expect(hook.entries[0].company).toBe('改名公司')
  await act(async () => hook.setRecordDialog({ mode: 'edit', entry: hook.entries[0] }))
  await act(async () => hook.saveRecord({ ...values(), sourceUrl: '' }))
  expect(hook.entries[0].website?.sourceUrl).toBe('')
  expect(hook.entries[0].website?.applicationUrl).toBe(record.applicationUrl)
})
it('事务失败保留记录和编辑窗口，成功重试后才更新界面', async () => {
  await act(async () => hook.setRecordDialog({ mode: 'edit', entry: entry() }))
  state.save.mockRejectedValueOnce(new Error('存储失败'))
  await act(async () => { await expect(hook.saveRecord(values())).rejects.toThrow('存储失败') })
  expect(hook.entries[0].website).toEqual(record); expect(hook.recordDialog).not.toBeNull()
  await act(async () => hook.saveRecord(values()))
  expect(hook.entries[0].company).toBe('改名公司'); expect(hook.recordDialog).toBeNull()
})
it('清单满时不移除官网记录；腾出位置后可移回且不会重复加入', async () => {
  await act(async () => hook.returnWebsiteToDrafts(entry()))
  expect(hook.drafts).toHaveLength(20); expect(hook.entries).toHaveLength(1); expect(hook.error).toContain('已满')
  await act(async () => hook.removeDraft('0'))
  await act(async () => hook.returnWebsiteToDrafts(entry()))
  expect(hook.drafts).toHaveLength(20); expect(hook.entries).toHaveLength(0)
  expect(hook.error).toBe('')
  await act(async () => hook.returnWebsiteToDrafts(entry()))
  expect(hook.drafts).toHaveLength(20)
  expect(hook.selectedDraftIds.filter(id => id === record.id)).toHaveLength(1)
})
it('撤销删除在清单满时保留重试机会，腾出位置后恢复', async () => {
  await act(async () => hook.removeDraft('0'))
  const undoId = hook.undo.items[0].id
  await act(async () => hook.addDraft())
  await act(async () => hook.undo.undo(undoId))
  expect(hook.drafts).toHaveLength(20); expect(hook.undo.items[0].error).toContain('重试')
  const added = hook.drafts.find(draft => !/^\d+$/.test(draft.id))!
  await act(async () => hook.removeDraft(added.id))
  await act(async () => hook.undo.undo(undoId))
  expect(hook.drafts).toHaveLength(20); expect(hook.drafts.some(draft => draft.id === '0')).toBe(true)
})
