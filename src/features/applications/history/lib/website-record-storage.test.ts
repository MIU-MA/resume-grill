import { beforeEach, expect, it, vi } from 'vitest'
import { changeApplicationProgress } from '@/domain/application-progress'
import { MAIL_DRAFTS_KEY, type DraftStore } from '../../mail/lib/mail-draft-storage'
import { APPLICATION_TRACKER_KEY, emptyApplicationTracker } from './application-tracker-storage'
import { saveWebsiteRecord } from './website-record-storage'

const db = vi.hoisted(() => ({ values: new Map<string, unknown>(), failKey: '' }))
vi.mock('idb-keyval', async original => ({
  ...await original<typeof import('idb-keyval')>(),
  createStore: () => (_mode: string, callback: (store: IDBObjectStore) => unknown) => {
    const pending = new Map(db.values)
    let aborted = false
    const transaction = { error: null, oncomplete: null as (() => void) | null, onabort: null as (() => void) | null,
      abort: () => { aborted = true; queueMicrotask(() => transaction.onabort?.()) } }
    const store = {
      transaction,
      get: (key: string) => {
        const request = { result: db.values.get(key), onsuccess: null as (() => void) | null }
        queueMicrotask(() => {
          request.onsuccess?.()
          if (!aborted) {
            db.values = pending
            transaction.oncomplete?.()
          }
        })
        return request
      },
      put: (value: unknown, key: string) => {
        if (db.failKey === key) throw new Error('磁盘已满')
        pending.set(key, value)
      },
    }
    return Promise.resolve(callback(store as unknown as IDBObjectStore))
  },
}))
const store = (): DraftStore => ({ drafts: [], attachment: null, websiteApplications: [] })
beforeEach(() => { db.values.clear(); db.failKey = '' })
it('官网记录和进展一次提交，保留已有备注及其他岗位的进展', async () => {
  const tracker = emptyApplicationTracker()
  tracker.progress.a = changeApplicationProgress(undefined, { note: '保留备注' }, 1)
  tracker.progress.b = changeApplicationProgress(undefined, { stage: 'offer' }, 1)
  db.values.set(APPLICATION_TRACKER_KEY, tracker)
  const draftStore = store()
  const saved = await saveWebsiteRecord(draftStore, 'a', 'interview')
  expect(db.values.get(MAIL_DRAFTS_KEY)).toBe(draftStore)
  expect(db.values.get(APPLICATION_TRACKER_KEY)).toBe(saved)
  expect(saved.progress.a.note).toBe('保留备注'); expect(saved.progress.a.stage).toBe('interview')
  expect(saved.progress.b.stage).toBe('offer')
})
it.each([MAIL_DRAFTS_KEY, APPLICATION_TRACKER_KEY])('任一写入失败均回滚，两份旧数据保留，之后可重试：%s', async key => {
  const previousDrafts = store(), previousTracker = emptyApplicationTracker()
  db.values.set(MAIL_DRAFTS_KEY, previousDrafts); db.values.set(APPLICATION_TRACKER_KEY, previousTracker)
  db.failKey = key
  await expect(saveWebsiteRecord(store(), 'a', 'interview')).rejects.toThrow('磁盘已满')
  expect(db.values.get(MAIL_DRAFTS_KEY)).toBe(previousDrafts)
  expect(db.values.get(APPLICATION_TRACKER_KEY)).toBe(previousTracker)
  db.failKey = ''
  expect((await saveWebsiteRecord(store(), 'a', 'interview')).progress.a.stage).toBe('interview')
})
