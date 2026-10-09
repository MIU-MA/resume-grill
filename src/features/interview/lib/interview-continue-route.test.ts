import { beforeEach, describe, expect, it, vi } from 'vitest'
import { POST } from '../../../../app/api/interview/continue/route'
import { llmStructured, resolveLlmConfig } from '@/providers/openai-compatible'
import { rateLimit } from '@/lib/server-limits'
import type { InterviewRound } from '@/domain/interview-schema'
import type { ResumeClaim } from '@/domain/resume-schema'

vi.mock('@/providers/openai-compatible', () => ({ llmStructured: vi.fn(), resolveLlmConfig: vi.fn() }))
vi.mock('@/lib/server-limits', async (importOriginal) => ({
  ...await importOriginal<typeof import('@/lib/server-limits')>(), rateLimit: vi.fn(),
}))

const claim: ResumeClaim = {
  id: 'claim-1', title: '接口幂等', content: '负责接口幂等设计。', category: 'responsibility',
  role: '后端开发', sourceSection: '项目经历', capability: '接口幂等设计',
  masteryPoints: [{ point: '说明具体方案', dimension: 'practice', importance: 'high' }],
  initialQuestion: '如何实现？', initialIntent: '', trapPoints: [], testPriority: 'medium',
}
const evaluation = { score: 70, coveredPoints: ['说明具体方案'], missingPoints: [], answerSuggestion: '说明冲突后如何处理。', evidenceQuotes: ['用了版本号。', '伪造引用'] }
const round = (action: InterviewRound['action'] = 'answer'): InterviewRound => ({
  action, question: '怎么处理并发？', questionIntent: '', answer: action === 'answer' ? '用了版本号。' : '',
  annotation: action === 'clarify' ? '什么是版本号？' : '', evaluation, nextReason: '',
})
const request = (rounds: InterviewRound[], extra: Record<string, unknown> = {}) => new Request('http://localhost/api/interview/continue', {
  method: 'POST', body: JSON.stringify({ claim, question: '更新冲突后怎么办？', action: 'answer', answer: '用了版本号。',
    rounds, verifyPoints: [{ point: '说明具体方案', importance: 'high' }], trapPoints: [], ...extra }),
})
beforeEach(() => {
  vi.resetAllMocks()
  vi.mocked(rateLimit).mockReturnValue({ ok: true })
  vi.mocked(resolveLlmConfig).mockReturnValue({ baseUrl: 'https://example.com/v1', apiKey: 'test', model: 'test' })
  vi.mocked(llmStructured).mockResolvedValue({ evaluation, nextReason: '继续问冲突处理', isFinal: true, nextQuestion: '' })
})

describe('interview continuation', () => {
  it('continues after the fifth answer even when the model proposes finishing', async () => {
    const data = await (await POST(request(Array.from({ length: 4 }, () => round())))).json()
    expect(data.isFinal).toBe(false)
    expect(data.nextQuestion.trim()).not.toBe('')
    expect(data.evaluation.evidenceQuotes).toEqual(['用了版本号。'])
  })
  it('can finish after six answers with covered important points', async () => {
    expect((await (await POST(request(Array.from({ length: 5 }, () => round())))).json()).isFinal).toBe(true)
  })
  it('does not finish after six answers while an important point is still missing', async () => {
    const uncovered = { ...evaluation, coveredPoints: [] }
    vi.mocked(llmStructured).mockResolvedValue({ evaluation: uncovered, nextReason: '', isFinal: true, nextQuestion: '你具体做了哪一步？' })
    const rounds = Array.from({ length: 5 }, () => ({ ...round(), evaluation: uncovered }))
    expect((await (await POST(request(rounds))).json()).isFinal).toBe(false)
  })
  it('caps the combined answers and skips at ten questions', async () => {
    vi.mocked(llmStructured).mockResolvedValue({ evaluation, nextReason: '', isFinal: false, nextQuestion: '下一问' })
    const rounds = [...Array.from({ length: 5 }, () => round('skip')), ...Array.from({ length: 4 }, () => round())]
    expect((await (await POST(request(rounds))).json()).isFinal).toBe(true)
  })
  it('allows more than twelve history interactions without counting explanations as answers', async () => {
    const rounds = [...Array.from({ length: 13 }, () => round('clarify')), round()]
    const response = await POST(request(rounds))
    expect(response.status).toBe(200)
    expect((await response.json()).isFinal).toBe(false)
  })
  it('explains a term without advancing or ending the current question', async () => {
    const response = await POST(request(Array.from({ length: 8 }, () => round()), { action: 'clarify', answer: '', annotation: '什么是版本号？' }))
    const data = await response.json()
    expect(data.isFinal).toBe(false)
    expect(data.nextQuestion).toBe('更新冲突后怎么办？')
    expect(data.evaluation.score).toBe(0)
    expect(data.evaluation.evidenceQuotes).toEqual([])
  })
})
