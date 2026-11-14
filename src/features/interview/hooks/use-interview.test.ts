// @vitest-environment jsdom
import { act, createElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { useInterview } from './use-interview'
import { resumeClaimSchema } from '@/domain/resume-schema'
import type { InterviewContext } from '@/domain/interview-context'
import type { InterviewSession } from '@/domain/interview-schema'

vi.mock('@/lib/settings', () => ({ getLlmSettings: () => null }))
const claim = resumeClaimSchema.parse({ id: 'a', title: '接口幂等', content: '负责幂等设计', category: 'skill', role: '后端', sourceSection: '项目', capability: '幂等', masteryPoints: [{ point: '说明方案', dimension: 'practice', importance: 'high' }], initialQuestion: '怎么实现？' })
const result = { masteryScore: 3, canExplain: [], cannotExplain: [], knowledgeGaps: [], answerSummary: '', nextAction: '', rewriteSuggestion: '负责幂等设计', interviewQuestions: [{ question: '目前有哪些重复请求场景？', reason: '向业务面试官了解场景', followUp: '先问约束' }] }
let context: InterviewContext
let hook: ReturnType<typeof useInterview>
let root: Root
let host: HTMLDivElement
const callbacks = { onError: vi.fn(), onToast: vi.fn(), onSessionSaved: vi.fn() }
const fetchMock = vi.fn()
function Harness() { hook = useInterview(true, callbacks, () => context); return null }
beforeEach(async () => {
  window.sessionStorage.clear(); vi.clearAllMocks(); vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true); vi.stubGlobal('fetch', fetchMock)
  context = { jobDescription: '支付接口开发', reviewProgress: [{ topic: '幂等键', status: 'open', note: '待练习' }] }
  fetchMock.mockImplementation(async (url: string) => Response.json(url === '/api/summarize' ? result : { evaluation: { score: 70, coveredPoints: ['说明方案'], missingPoints: [], answerSuggestion: '', evidenceQuotes: [] }, nextReason: '', isFinal: true, nextQuestion: '' }))
  host = document.createElement('div'); document.body.append(host); root = createRoot(host)
  await act(async () => root.render(createElement(Harness)))
})
afterEach(async () => { await act(async () => root.unmount()); host.remove(); vi.unstubAllGlobals() })
it('单题重答保留原回答和评分，不新增轮次或改动下一问', async () => {
  fetchMock.mockImplementation(async () => Response.json({ evaluation: { score: 70, coveredPoints: ['说明方案'], missingPoints: [], answerSuggestion: '说明做法', evidenceQuotes: [] }, nextReason: '继续', isFinal: false, nextQuestion: '下一题' }))
  await act(async () => hook.start(claim))
  await act(async () => hook.setAnswer('首次回答'))
  await act(async () => hook.submit(claim))
  await act(async () => hook.retryRound(claim, 0, '更具体的回答'))
  expect(hook.rounds).toHaveLength(1); expect(hook.currentQuestion).toBe('下一题')
  expect(hook.rounds[0].answer).toBe('更具体的回答')
  expect(hook.rounds[0].previousAttempts?.[0]).toMatchObject({ answer: '首次回答', score: 70 })
  const saved = callbacks.onSessionSaved.mock.calls.at(-1)![1] as InterviewSession
  await act(async () => hook.reset())
  await act(async () => hook.restore(claim, saved))
  expect(hook.rounds[0].previousAttempts).toHaveLength(1)
})
it('重答失败保留旧回答；主动切换面试官风格后保存并传给模型', async () => {
  fetchMock.mockImplementation(async () => Response.json({ evaluation: { score: 40, coveredPoints: [], missingPoints: ['说明方案'], answerSuggestion: '', evidenceQuotes: [] }, nextReason: '', isFinal: false, nextQuestion: '下一题' }))
  await act(async () => hook.start(claim))
  await act(async () => hook.setAnswer('原回答'))
  await act(async () => hook.submit(claim))
  fetchMock.mockRejectedValueOnce(new Error('offline'))
  await act(async () => { await expect(hook.retryRound(claim, 0, '新回答')).rejects.toThrow('offline') })
  expect(hook.rounds[0].answer).toBe('原回答')
  await act(async () => hook.setInterviewerStyle('probing'))
  expect(callbacks.onSessionSaved.mock.calls.at(-1)![1].context.interviewerStyle).toBe('probing')
})
it.each(['success', 'error'])('切换练习后忽略旧追问的迟到结果：%s', async outcome => {
  await act(async () => hook.start(claim))
  const originalSession = callbacks.onSessionSaved.mock.calls.at(-1)![1] as InterviewSession
  await act(async () => hook.setAnswer('尚未完成的旧回答'))
  let resolve!: (value: Response) => void
  let reject!: (error: Error) => void
  fetchMock.mockImplementationOnce(() => new Promise<Response>((done, fail) => { resolve = done; reject = fail }))
  let pending!: Promise<void>
  await act(async () => { pending = hook.submit(claim) })
  const signal = fetchMock.mock.calls.at(-1)![1].signal as AbortSignal
  await act(async () => hook.reset())
  expect(signal.aborted).toBe(true); expect(hook.loading).toBe(false)
  const next = { ...claim, id: 'b', initialQuestion: '新问题' }
  await act(async () => hook.start(next))
  await act(async () => hook.setAnswer('新回答'))
  callbacks.onSessionSaved.mockClear(); callbacks.onError.mockClear()
  await act(async () => {
    if (outcome === 'success') resolve(Response.json({ isFinal: false, nextQuestion: '旧第二问', evaluation: {}, nextReason: '' }))
    else reject(new Error('旧请求失败'))
    await pending
  })
  expect(hook.currentQuestion).toBe('新问题'); expect(hook.answer).toBe('新回答')
  expect(callbacks.onSessionSaved).not.toHaveBeenCalled(); expect(callbacks.onError).not.toHaveBeenCalled()
  await act(async () => hook.restore(claim, originalSession))
  expect(hook.answer).toBe('尚未完成的旧回答')
})
it('重置时中止总结，迟到的总结不能写回会话或显示成功提示', async () => {
  await act(async () => hook.start(claim))
  await act(async () => hook.setAnswer('回答'))
  let resolve!: (value: Response) => void
  fetchMock.mockImplementation(async (url: string) => url === '/api/summarize' ? new Promise<Response>(done => { resolve = done }) : Response.json({ isFinal: true, nextQuestion: '', nextReason: '', evaluation: {} }))
  let pending!: Promise<void>
  await act(async () => { pending = hook.submit(claim) })
  expect(hook.done).toBe(true)
  const signal = fetchMock.mock.calls.at(-1)![1].signal as AbortSignal
  await act(async () => hook.reset())
  expect(signal.aborted).toBe(true)
  callbacks.onSessionSaved.mockClear(); callbacks.onToast.mockClear()
  await act(async () => { resolve(Response.json(result)); await pending })
  expect(callbacks.onSessionSaved).not.toHaveBeenCalled(); expect(callbacks.onToast).not.toHaveBeenCalled()
  expect(hook.loading).toBe(false); expect(hook.rounds).toEqual([])
})
it('重置后不接受迟到的重新生成复盘结果', async () => {
  await act(async () => hook.start(claim))
  const session = callbacks.onSessionSaved.mock.calls.at(-1)![1] as InterviewSession
  let resolve!: (value: Response) => void
  fetchMock.mockImplementationOnce(() => new Promise<Response>(done => { resolve = done }))
  let pending!: Promise<boolean>
  await act(async () => { pending = hook.regenerateSummary(claim, { ...session, status: 'done' }) })
  await act(async () => hook.reset())
  callbacks.onSessionSaved.mockClear()
  await act(async () => { resolve(Response.json(result)); expect(await pending).toBe(false) })
  expect(callbacks.onSessionSaved).not.toHaveBeenCalled(); expect(hook.regeneratingId).toBeNull()
})

it('旧复盘请求结束时不能清除新请求的忙碌状态', async () => {
  await act(async () => hook.start(claim))
  const session = callbacks.onSessionSaved.mock.calls.at(-1)![1] as InterviewSession
  let oldResolve!: (value: Response) => void, nextResolve!: (value: Response) => void
  fetchMock.mockImplementationOnce(() => new Promise<Response>(done => { oldResolve = done }))
  let oldPending!: Promise<boolean>, nextPending!: Promise<boolean>
  await act(async () => { oldPending = hook.regenerateSummary(claim, { ...session, status: 'done' }) })
  await act(async () => hook.reset())
  fetchMock.mockImplementationOnce(() => new Promise<Response>(done => { nextResolve = done }))
  const next = { ...session, id: 'a:v2', version: 2, status: 'done' as const }
  await act(async () => { nextPending = hook.regenerateSummary(claim, next) })
  await act(async () => { oldResolve(Response.json(result)); expect(await oldPending).toBe(false) })
  expect(hook.regeneratingId).toBe(next.id)
  await act(async () => { nextResolve(Response.json(result)); expect(await nextPending).toBe(true) })
  expect(hook.regeneratingId).toBeNull()
})
it('一次练习的追问、复盘和保存均使用开始时的岗位与复习记录', async () => {
  const original = structuredClone(context)
  await act(async () => hook.start(claim))
  expect(callbacks.onSessionSaved).toHaveBeenLastCalledWith('a', expect.objectContaining({ context: original }))
  context = { jobDescription: '其他岗位', reviewProgress: [] }
  await act(async () => hook.setAnswer('用唯一键检查重复请求'))
  await act(async () => hook.submit(claim))
  expect(fetchMock).toHaveBeenCalledTimes(2)
  for (const call of fetchMock.mock.calls) expect(JSON.parse(call[1].body).context).toEqual(original)
  expect(callbacks.onSessionSaved).toHaveBeenLastCalledWith('a', expect.objectContaining({ context: original, finalResult: result }))
})
it('改写后的新版本在启动、完成和重新生成复盘时保留自己的内容与版本', async () => {
  const rewritten = '负责支付接口幂等键与数据库唯一约束设计'
  await act(async () => hook.start(claim, { version: 3, claimContent: rewritten }))
  const expected = { id: 'a:v3', version: 3, claimContent: rewritten, context: structuredClone(context) }
  expect(callbacks.onSessionSaved).toHaveBeenLastCalledWith('a', expect.objectContaining({ ...expected, status: 'in_progress' }))
  await act(async () => hook.setAnswer('以唯一约束拦截重复请求'))
  await act(async () => hook.submit(claim))
  const saved = callbacks.onSessionSaved.mock.calls.at(-1)![1] as InterviewSession
  expect(saved).toMatchObject({ ...expected, status: 'done', finalResult: result })
  await act(async () => hook.reset())
  context = { jobDescription: '当前其他岗位', reviewProgress: [] }
  await act(async () => hook.regenerateSummary(claim, saved))
  expect(callbacks.onSessionSaved).toHaveBeenLastCalledWith('a', expect.objectContaining({ ...expected, finalResult: result }))
  for (const call of fetchMock.mock.calls) expect(JSON.parse(call[1].body).claim.content).toBe(rewritten)
})
it('恢复和重新生成使用旧会话自己的背景，不被当前岗位覆盖', async () => {
  const saved: InterviewSession = { id: 'a:v2', claimContent: claim.content, rounds: [], claimAnalysis: { level: '通用', verifyPoints: [{ point: '说明方案', importance: 'high' }], trapPoints: [] }, finalResult: null, status: 'in_progress', version: 2, context: { jobDescription: '原来的岗位', reviewProgress: [] } }
  await act(async () => { expect(hook.restore(claim, saved)).toBe(true) })
  await act(async () => hook.setAnswer('数据库唯一约束'))
  await act(async () => hook.submit(claim))
  expect(JSON.parse(fetchMock.mock.calls[0][1].body).context).toEqual(saved.context)
  await act(async () => hook.regenerateSummary(claim, { ...saved, status: 'done' }))
  expect(JSON.parse(fetchMock.mock.calls.at(-1)![1].body).context).toEqual(saved.context)
})

it('未提交回答按简历与轮次保存，重载可恢复，提交成功才清除', async () => {
  await act(async () => hook.start(claim))
  const saved = callbacks.onSessionSaved.mock.calls.at(-1)![1] as InterviewSession
  await act(async () => { hook.setAnswer('尚未提交的回答'); hook.setAnnotation('术语需要解释') })
  await act(async () => root.unmount()); root = createRoot(host)
  await act(async () => root.render(createElement(Harness)))
  await act(async () => hook.restore(claim, { ...saved, version: 2 }))
  expect(hook.answer).toBe('')
  await act(async () => hook.restore(claim, saved))
  expect(hook.answer).toBe('尚未提交的回答'); expect(hook.annotation).toBe('术语需要解释')
  fetchMock.mockRejectedValueOnce(new Error('offline'))
  await act(async () => hook.submit(claim))
  expect(hook.answer).toBe('尚未提交的回答')
  await act(async () => hook.submit(claim))
  await act(async () => hook.restore(claim, saved))
  expect(hook.answer).toBe(''); expect(hook.annotation).toBe('')
})
