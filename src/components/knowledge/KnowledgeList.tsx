import { Check, Lightbulb } from 'lucide-react'
import type { KnowledgeItem } from '@/lib/knowledge'
import { KNOWLEDGE_SOURCE_META } from '@/components/knowledge/knowledge-meta'

type KnowledgeListProps = {
  items: KnowledgeItem[]
  selectedId: string | null
  onSelect: (id: string) => void
}

export function KnowledgeList({
  items,
  selectedId,
  onSelect,
}: KnowledgeListProps) {
  return (
    <div className="overflow-hidden rounded-lg bg-white shadow-card">
      <div className="flex items-center justify-between border-b border-line px-4 py-3">
        <div className="text-[13px] font-bold">条目列表</div>
        <div className="text-[12px] text-text-tertiary">{items.length} 条</div>
      </div>
      {items.length === 0 ? (
        <div className="px-6 py-14 text-center">
          <Lightbulb size={22} className="mx-auto mb-3 text-text-tertiary" />
          <p className="m-0 text-[13px] font-semibold text-text-primary">
            没有匹配的条目
          </p>
          <p className="mt-1.5 text-[12px] text-text-tertiary">
            调整筛选条件，或完成一次模拟面试后再来看看。
          </p>
        </div>
      ) : (
        <div className="divide-y divide-line">
          {items.map((item) => {
            const active = item.id === selectedId
            const meta = KNOWLEDGE_SOURCE_META[item.source]
            const learned = item.status === 'mastered'
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onSelect(item.id)}
                className={`flex w-full items-center justify-between gap-3 px-4 py-2.5 text-left transition-colors ${
                  active ? 'bg-brand-soft' : 'hover:bg-surface-soft'
                }`}
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span
                      className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${
                        active
                          ? 'bg-white/60 text-brand'
                          : meta.className
                      }`}
                    >
                      {meta.label}
                    </span>
                    {learned && (
                      <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-success">
                        <Check size={10} />已学会
                      </span>
                    )}
                  </div>
                  <p className="mt-1 truncate text-[13px] font-medium text-text-primary">
                    {item.title}
                  </p>
                </div>
                <span className="flex-none text-[11px] text-text-tertiary">
                  {formatUpdatedAt(item.updatedAt)}
                </span>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

function formatUpdatedAt(timestamp: number): string {
  const date = new Date(timestamp)
  const diff = Date.now() - timestamp
  if (diff < 60_000) return '刚刚'
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)} 分钟前`
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)} 小时前`
  return new Intl.DateTimeFormat('zh-CN', {
    month: '2-digit',
    day: '2-digit',
  }).format(date)
}
