export type ReviewSchedule = { repetitions: number; interval: number; ease: number; dueAt: number; history: Array<{ at: number; quality: number }> }
/** SM-2: https://super-memory.com/english/ol/sm2.htm; calendar intervals are in days. */
export function scheduleReview(previous: ReviewSchedule | undefined, quality: number, now = Date.now()): ReviewSchedule {
  if (!Number.isInteger(quality) || quality < 0 || quality > 5) throw new Error('复习评分须为 0–5。')
  const old = previous ?? { repetitions: 0, interval: 0, ease: 2.5, dueAt: now, history: [] }
  const repetitions = quality < 3 ? 0 : old.repetitions + 1
  const interval = quality < 3 || repetitions === 1 ? 1 : repetitions === 2 ? 6 : Math.ceil(old.interval * old.ease)
  const ease = Math.max(1.3, old.ease + .1 - (5 - quality) * (.08 + (5 - quality) * .02))
  return { repetitions, interval, ease, dueAt: quality < 4 ? now : now + interval * 86_400_000, history: [...old.history, { at: now, quality }].slice(-100) }
}
