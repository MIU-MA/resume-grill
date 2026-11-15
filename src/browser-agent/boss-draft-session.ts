import { randomBytes } from 'node:crypto'
import { bossDraftPreviewSchema, type BossComposerState, type BossDraftResult } from '../domain/boss-draft.ts'
import { runBossComposer } from './boss-composer.ts'
type Page = { url(): string; isClosed(): boolean; evaluate: <T, A>(fn: (arg: A) => T, arg: A) => Promise<Awaited<T>> }
export function createBossDraftSession(now: () => number = Date.now) {
  const pending = new Map<string, { page: Page; url: string; text: string; state: BossComposerState; expiresAt: number }>()
  return {
    clear() { pending.clear() },
    async preview(page: Page, value: unknown) {
      const draft = bossDraftPreviewSchema.parse(value)
      const state = await page.evaluate(runBossComposer, { action: 'inspect' }) as BossComposerState
      if (!state.chat || state.fields.length !== 1 || !state.fields[0].editable) throw new Error('请在 Chrome 手动打开对应的已有会话，再检查输入框。')
      if (!state.fields[0].empty) throw new Error('Chrome 输入框已有草稿，未覆盖。')
      const id = randomBytes(16).toString('hex'), expiresAt = now() + 30000
      if (pending.size >= 30) pending.delete(pending.keys().next().value!)
      pending.set(id, { page, url: page.url(), state, text: draft.text, expiresAt })
      return { id, expiresAt, company: draft.company, title: draft.title, state }
    },
    async fill(page: Page, id: string, confirmed: boolean): Promise<BossDraftResult> {
      if (!confirmed) throw new Error('请先核对 Chrome 当前会话与所选岗位。')
      const value = pending.get(id)
      pending.delete(id)
      if (!value || value.expiresAt <= now()) throw new Error('会话核对已过期，请重新检查。')
      if (value.page !== page || page.isClosed() || value.url !== page.url()) throw new Error('浏览器页面已变化，请重新检查。')
      return await page.evaluate(runBossComposer, { action: 'fill', text: value.text, expected: value.state }) as BossDraftResult
    },
  }
}
