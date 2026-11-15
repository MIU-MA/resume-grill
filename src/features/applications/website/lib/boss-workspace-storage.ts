import { get, set } from 'idb-keyval'
import type { prepareBossApplications } from './boss-preparation'
export type BossDraft = ReturnType<typeof prepareBossApplications>['prepared'][number]
export type BossWorkspaceDraft = { target: string; resumeId: string; resumeUpdatedAt: number; resumeText: string; drafts: BossDraft[]; images: File[]; savedAt: number }
const KEY = 'boss-browser:workspace:v1'
export function loadBossWorkspace() { return get<BossWorkspaceDraft>(KEY) }
// Serialize writes so an older save cannot overwrite the latest reviewed text.
let pending = Promise.resolve()
export function saveBossWorkspace(value: BossWorkspaceDraft) {
  const write = pending.catch(() => undefined).then(() => set(KEY, value))
  pending = write
  return write
}
