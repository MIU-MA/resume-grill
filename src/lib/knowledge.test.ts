import { describe, expect, it } from 'vitest'
import { createBlindSpotId } from './blind-spots'
import {
  createKnowledgeItemId,
  deriveKnowledgeItems,
  mergeKnowledgeItems,
  type KnowledgeItem,
} from './knowledge'
import type { ResumeAnalysis } from '@/domain/resume-schema'
import type { InterviewSession } from '@/domain/interview-schema'

const analysis: ResumeAnalysis = {
  candidate: '张三', role: '后端开发', sourceFile: 'resume.txt', rawText: '负责接口幂等设计', summary: '',
  claims: [{
    id: 'claim-1', content: '负责接口幂等设计', title: '接口幂等', category: 'responsibility', role: '后端开发',
    sourceSection: '项目经历',
    capability: '接口幂等设计',
    masteryPoints: [{ point: '说明方案', dimension: 'practice', importance: 'high' }],
    initialQuestion: '怎么做的？',
    initialIntent: '',
    trapPoints: [],
    testPriority: 'medium',
  }],
}

const clarifySession: InterviewSession = {
  id: 'claim-1:v1', claimContent: '负责接口幂等设计', claimAnalysis: null, finalResult: null, status: 'done', version: 1,
  rounds: [{
    action: 'clarify',
    question: '如何保证接口幂等？', answer: '', annotation: '不理解幂等是什么意思', nextReason: '换一种问法',
    evaluation: { score: 0, coveredPoints: [], missingPoints: ['说明方案'], answerSuggestion: '同一个请求重复执行时，结果不会重复产生。' },
  }],
}

const doneSession: InterviewSession = {
  id: 'claim-1:v1', claimContent: '负责接口幂等设计', claimAnalysis: null, status: 'done', version: 1,
  finalResult: {
    masteryScore: 3, masteryLevel: 'partial',
    canExplain: ['说明方案'], cannotExplain: [], knowledgeGaps: ['幂等性在分布式锁下的边界', '乐观锁并发冲突'],
    answerSummary: '', nextAction: '', rewriteSuggestion: '',
  },
  rounds: [],
}

describe('deriveKnowledgeItems', () => {
  it('derives a blind-spot item from a clarify annotation', () => {
    const items = deriveKnowledgeItems(analysis, { 'claim-1': [clarifySession] }, [])
    expect(items).toEqual([
      expect.objectContaining({
        id: createBlindSpotId('claim-1', '不理解幂等是什么意思'),
        source: 'blind-spot',
        title: '不理解幂等是什么意思',
        detail: '同一个请求重复执行时，结果不会重复产生。',
        claimId: 'claim-1',
        claimTitle: '接口幂等',
        status: 'open',
      }),
    ])
  })

  it('derives knowledge-gap items from finalResult.knowledgeGaps', () => {
    const items = deriveKnowledgeItems(analysis, { 'claim-1': [doneSession] }, [])
    expect(items).toHaveLength(2)
    expect(items.map((i) => i.source)).toEqual(['knowledge-gap', 'knowledge-gap'])
    expect(items[0]).toEqual(expect.objectContaining({
      title: '幂等性在分布式锁下的边界',
      claimId: 'claim-1',
      status: 'open',
    }))
  })

  it('marks blind-spot as mastered when id is in masteredBlindSpotIds', () => {
    const id = createBlindSpotId('claim-1', '不理解幂等是什么意思')
    const items = deriveKnowledgeItems(analysis, { 'claim-1': [clarifySession] }, [id])
    const spot = items.find((i) => i.source === 'blind-spot')
    expect(spot?.status).toBe('mastered')
  })
})

describe('createKnowledgeItemId', () => {
  it('is stable across whitespace differences', () => {
    expect(createKnowledgeItemId('幂等性 边界')).toBe(createKnowledgeItemId('幂等性边界'))
  })
})

describe('mergeKnowledgeItems', () => {
  const base: KnowledgeItem[] = [{
    id: 'knowledge-a', source: 'knowledge-gap', title: '已有项', detail: '', claimId: 'claim-1',
    claimTitle: '接口幂等', status: 'open', note: '用户备注', createdAt: 1, updatedAt: 1,
  }]

  it('adds only missing ids', () => {
    const derived = [
      { ...base[0] }, // 已存在 id
      {
        id: 'knowledge-b', source: 'knowledge-gap', title: '新项', detail: '', claimId: 'claim-1',
        claimTitle: '接口幂等', status: 'open', note: '', createdAt: 2, updatedAt: 2,
      },
    ]
    const merged = mergeKnowledgeItems(base, derived)
    expect(merged.map((i) => i.id)).toEqual(['knowledge-a', 'knowledge-b'])
  })

  it('returns the same reference when nothing is new', () => {
    expect(mergeKnowledgeItems(base, [{ ...base[0] }])).toBe(base)
  })

  it('keeps user edits on existing items', () => {
    const userEdited = { ...base[0], title: '用户改过的标题', status: 'mastered' as const }
    const derived = [{ ...base[0], title: '推导重写的标题', status: 'open' as const }]
    const merged = mergeKnowledgeItems([userEdited], derived)
    expect(merged[0].title).toBe('用户改过的标题')
    expect(merged[0].status).toBe('mastered')
  })
})
