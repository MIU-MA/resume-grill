import { createStore, promisifyRequest } from 'idb-keyval'
import { changeApplicationProgress, type ApplicationStage } from '@/domain/application-progress'
import { MAIL_DRAFTS_KEY, type DraftStore } from '../../mail/lib/mail-draft-storage'
import { APPLICATION_TRACKER_KEY, normalizeApplicationTracker, type ApplicationTracker } from './application-tracker-storage'

// Use the existing idb-keyval database; both values belong to the same transaction.
let openStore: ReturnType<typeof createStore> | undefined
export function saveWebsiteRecord(store: DraftStore, id: string, stage: ApplicationStage): Promise<ApplicationTracker> {
  openStore ??= createStore('keyval-store', 'keyval')
  return openStore('readwrite', objectStore => {
    const transaction = objectStore.transaction
    const completed = promisifyRequest(transaction)
    let saved!: ApplicationTracker
    let failure: unknown
    const request = objectStore.get(APPLICATION_TRACKER_KEY)
    request.onsuccess = () => {
      try {
        const current = normalizeApplicationTracker(request.result)
        saved = { ...current, progress: { ...current.progress, [id]: changeApplicationProgress(current.progress[id], { stage }, Date.now()) } }
        objectStore.put(store, MAIL_DRAFTS_KEY)
        objectStore.put(saved, APPLICATION_TRACKER_KEY)
      } catch (error) { failure = error; transaction.abort() }
    }
    return completed.then(() => saved).catch(error => { throw failure ?? error })
  })
}
