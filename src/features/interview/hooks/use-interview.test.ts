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
  vi.clearAllMocks(); vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true); vi.stubGlobal('fetch', fetchMock)
  context = { jobDescription: '支付接口开发', reviewProgress: [{ topic: '幂等键', status: 'open', note: '待练习' }] }
  fetchMock.mockImplementation(async (url: string) => Response.json(url === '/api/summarize' ? result : { evaluation: { score: 70, coveredPoints: ['说明方案'], missingPoints: [], answerSuggestion: '', evidenceQuotes: [] }, nextReason: '', isFinal: true, nextQuestion: '' }))
  host = document.createElement('div'); document.body.append(host); root = createRoot(host)
  await act(async () => root.render(createElement(Harness)))
})
afterEach(async () => { await act(async () => root.unmount()); host.remove(); vi.unstubAllGlobals() })
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
it('恢复和重新生成使用旧会话自己的背景，不被当前岗位覆盖', async () => {
  const saved: InterviewSession = { id: 'a:v2', claimContent: claim.content, rounds: [], claimAnalysis: { level: '通用', verifyPoints: [{ point: '说明方案', importance: 'high' }], trapPoints: [] }, finalResult: null, status: 'in_progress', version: 2, context: { jobDescription: '原来的岗位', reviewProgress: [] } }
  await act(async () => { expect(hook.restore(claim, saved)).toBe(true) })
  await act(async () => hook.setAnswer('数据库唯一约束'))
  await act(async () => hook.submit(claim))
  expect(JSON.parse(fetchMock.mock.calls[0][1].body).context).toEqual(saved.context)
  await act(async () => hook.regenerateSummary(claim, { ...saved, status: 'done' }))
  expect(JSON.parse(fetchMock.mock.calls.at(-1)![1].body).context).toEqual(saved.context)
})
