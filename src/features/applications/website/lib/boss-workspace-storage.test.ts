import { expect, it, vi } from 'vitest'
import { set } from 'idb-keyval'
import { saveBossWorkspace, type BossWorkspaceDraft } from './boss-workspace-storage'
vi.mock('idb-keyval', () => ({ get: vi.fn(), set: vi.fn() }))
it('按顺序保存，写入失败后仍允许保存新稿', async () => {
  let release!: () => void
  vi.mocked(set).mockImplementationOnce(() => new Promise<void>(resolve => { release = resolve })).mockRejectedValueOnce(new Error('磁盘写入失败')).mockResolvedValue(undefined)
  const draft: BossWorkspaceDraft = { target: '全栈', resumeId: 'resume', resumeUpdatedAt: 1, resumeText: '简历原文', drafts: [], images: [], savedAt: 1 }
  const first = saveBossWorkspace(draft)
  const second = saveBossWorkspace({ ...draft, savedAt: 2 })
  const failure = expect(second).rejects.toThrow('磁盘写入失败')
  await vi.waitFor(() => expect(set).toHaveBeenCalledTimes(1))
  release(); await first; await failure
  await saveBossWorkspace({ ...draft, savedAt: 3 })
  expect(vi.mocked(set).mock.calls.map(call => (call[1] as BossWorkspaceDraft).savedAt)).toEqual([1, 2, 3])
})
