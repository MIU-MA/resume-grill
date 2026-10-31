import { expect, it } from 'vitest'
import { applicationStage, changeApplicationProgress, emptyApplicationProgress } from './application-progress'

it('仅在进展改变时留下记录，修改联系人或备注不会伪造新阶段', () => {
  const initial = changeApplicationProgress(undefined, { stage: 'interview', contact: 'HR', interviewAt: '2026-11-03T14:30' }, 10)
  const next = changeApplicationProgress(initial, { stage: 'interview', note: '准备项目介绍' }, 20)
  expect(next.events).toEqual([{ stage: 'interview', at: 10 }])
  expect(next.contact).toBe('HR')
  expect(next.interviewAt).toBe('2026-11-03T14:30')
  expect(changeApplicationProgress(next, { stage: 'offer' }, 30).events).toEqual([{ stage: 'interview', at: 10 }, { stage: 'offer', at: 30 }])
  expect(initial.note).toBe('')
})
it('新岗位的面试记录与状态相互独立', () => {
  const a = emptyApplicationProgress(), b = emptyApplicationProgress()
  a.interviews.push({ id: 'first', title: '一面', at: '', notes: '缓存问题' })
  expect(b.interviews).toEqual([])
})
it('等待回复只属于已发送或手动确认官网申请的记录，不能从排队、失败推断出来', () => {
  expect(applicationStage(undefined, 'sent')).toBe('awaiting')
  expect(applicationStage(undefined, 'website')).toBe('awaiting')
  for (const status of ['queued', 'failed', 'uncertain', 'cancelled']) expect(applicationStage(undefined, status)).toBeUndefined()
  expect(applicationStage({ ...emptyApplicationProgress(), stage: 'replied' }, 'uncertain')).toBe('replied')
})
