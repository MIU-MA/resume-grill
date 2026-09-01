import type { KnowledgeItem } from '@/lib/knowledge'

export type KnowledgeStatusFilter = 'all' | 'open' | 'mastered'
export type KnowledgeSourceFilter = KnowledgeItem['source'] | 'all'
export type KnowledgeSort = 'updated' | 'claim'

export const KNOWLEDGE_STATUS_FILTERS: Array<{
  value: KnowledgeStatusFilter
  label: string
}> = [
  { value: 'all', label: '全部' },
  { value: 'open', label: '待复习' },
  { value: 'mastered', label: '已学会' },
]

export const KNOWLEDGE_SOURCE_FILTERS: Array<{
  value: KnowledgeSourceFilter
  label: string
}> = [
  { value: 'all', label: '全部来源' },
  { value: 'blind-spot', label: '没听懂' },
  { value: 'knowledge-gap', label: '面试复盘' },
  { value: 'manual', label: '手动添加' },
]

export const KNOWLEDGE_SOURCE_META: Record<
  KnowledgeItem['source'],
  { label: string; className: string }
> = {
  'blind-spot': {
    label: '没听懂',
    className: 'text-danger bg-danger-soft',
  },
  'knowledge-gap': {
    label: '需要复习',
    className: 'text-brand bg-brand-soft',
  },
  manual: {
    label: '手动添加',
    className: 'text-text-tertiary bg-surface-hover',
  },
}
