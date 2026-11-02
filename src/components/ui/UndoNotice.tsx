'use client'

import { X } from 'lucide-react'
import type { useUndoQueue } from '@/hooks/use-undo-queue'

export function UndoNotice({ queue }: { queue: ReturnType<typeof useUndoQueue> }) {
  if (!queue.items.length) return null
  return <div className="fixed bottom-5 left-1/2 z-[60] max-w-[calc(100%-24px)] -translate-x-1/2 space-y-2" aria-live="polite">
    {queue.items.map(item => <div key={item.id} className="flex items-center gap-4 border border-line bg-white px-4 py-3 text-body shadow-card">
      <span className="min-w-0"><span className="block truncate">{item.label}</span>{item.error && <span role="alert" className="block text-label text-danger">{item.error}</span>}</span>
      <button type="button" className="shrink-0 underline" disabled={item.pending} onClick={() => void queue.undo(item.id)}>{item.pending ? '正在撤销…' : '撤销'}</button>
      <button type="button" className="shrink-0 text-text-tertiary" aria-label="关闭撤销提示" disabled={item.pending} onClick={() => queue.dismiss(item.id)}><X size={14} /></button>
    </div>)}
  </div>
}
