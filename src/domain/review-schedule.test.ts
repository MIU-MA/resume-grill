import { expect, it } from 'vitest'
import { scheduleReview } from './review-schedule'
it('首次、第二次和后续复习按间隔推进，忘记时重置并在本轮再练', () => {
  const first = scheduleReview(undefined, 5, 1000)
  expect(first.interval).toBe(1); expect(first.dueAt).toBe(86401000)
  const second = scheduleReview(first, 4, first.dueAt)
  expect(second.interval).toBe(6)
  const third = scheduleReview(second, 5, second.dueAt)
  expect(third.interval).toBeGreaterThan(6)
  const failed = scheduleReview(third, 0, 123)
  expect(failed.repetitions).toBe(0); expect(failed.dueAt).toBe(123)
  expect(failed.history).toHaveLength(4)
  expect(scheduleReview(failed, 4, 124).interval).toBe(1)
})
it('拒绝非法评分，难度系数不会低于 1.3', () => {
  expect(() => scheduleReview(undefined, 9)).toThrow()
  let value = scheduleReview(undefined, 0)
  for (let index = 0; index < 20; index++) value = scheduleReview(value, 0)
  expect(value.ease).toBe(1.3)
})
