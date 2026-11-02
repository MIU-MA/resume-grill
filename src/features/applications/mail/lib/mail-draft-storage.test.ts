import { describe, expect, it, vi } from 'vitest'
import { createDraftWriter, type DraftStore } from './mail-draft-storage'

const store = (id: string): DraftStore => ({
  drafts: [{ id, company: '公司', role: '前端', sourceUrl: '', recipient: '', subject: '', body: '', sourceConfirmed: false }],
  attachment: null,
})

describe('草稿持久化', () => {
  it('显式保存等待前一次自动保存，旧内容不会覆盖新内容', async () => {
    let release!: () => void
    const gate = new Promise<void>(resolve => { release = resolve })
    const saved: string[] = []
    const save = vi.fn(async (value: DraftStore) => {
      if (value.drafts[0].id === 'old') await gate
      saved.push(value.drafts[0].id)
    })
    const persist = createDraftWriter(save)
    const first = persist(store('old'))
    const second = persist(store('new'))
    await vi.waitFor(() => expect(save).toHaveBeenCalledTimes(1))
    expect(saved).toEqual([])
    release()
    await Promise.all([first, second])
    expect(saved).toEqual(['old', 'new'])
  })

  it('一次写入失败会向调用者报错，后续保存仍能继续', async () => {
    const save = vi.fn<(value: DraftStore) => Promise<void>>()
      .mockRejectedValueOnce(new Error('storage unavailable'))
      .mockResolvedValueOnce(undefined)
    const persist = createDraftWriter(save)
    const first = persist(store('old'))
    const second = persist(store('new'))
    await expect(first).rejects.toThrow('storage unavailable')
    await expect(second).resolves.toBeUndefined()
    expect(save).toHaveBeenLastCalledWith(store('new'))
  })
})
