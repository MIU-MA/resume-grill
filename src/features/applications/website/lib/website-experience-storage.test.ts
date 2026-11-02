import { beforeEach, expect, it, vi } from 'vitest'
const db = vi.hoisted(() => new Map<string, unknown>())
vi.mock('idb-keyval', () => ({ get: vi.fn(async (key: string) => db.get(key)), set: vi.fn(async (key: string, value: unknown) => { db.set(key, value) }) }))
import { loadExperiences, saveExperiences } from './website-experience-storage'
beforeEach(() => db.clear())
it('同一原文恢复已核对内容，改版简历重新提取且不沿用确认', async () => {
  const source = '工作经历\n甲公司 2020.01-2022.01'
  const draft = await loadExperiences(source)
  draft.items[0].title = '前端工程师'; draft.confirmed = true
  await saveExperiences(source, draft)
  expect(await loadExperiences(source)).toEqual(draft)
  const revised = await loadExperiences(source.replace('甲公司', '乙公司'))
  expect(revised.confirmed).toBe(false)
  expect(revised.items[0].organization).toBe('乙公司')
})
