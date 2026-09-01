import { X } from 'lucide-react'
import { Button } from '@/components/ui/Button'

type KnowledgeEditorProps = {
  title: string
  note: string
  onChange: (draft: { title: string; note: string }) => void
  onSubmit: () => void
  onCancel: () => void
}

export function KnowledgeEditor({
  title,
  note,
  onChange,
  onSubmit,
  onCancel,
}: KnowledgeEditorProps) {
  return (
    <div className="space-y-2.5 rounded-lg bg-white p-4 shadow-card">
      <div className="text-[13px] font-bold">添加知识点</div>
      <input
        autoFocus
        value={title}
        onChange={(event) => onChange({ title: event.target.value, note })}
        placeholder="记下要复习的内容…"
        className="w-full rounded-lg border border-line-strong bg-white px-3 py-2 text-[13px] text-text-primary placeholder:text-text-tertiary focus:border-brand focus:outline-none"
        onKeyDown={(event) => {
          if (event.key === 'Enter' && !event.shiftKey) onSubmit()
          if (event.key === 'Escape') onCancel()
        }}
      />
      <textarea
        value={note}
        onChange={(event) => onChange({ title, note: event.target.value })}
        placeholder="备注（可选）…"
        rows={2}
        className="w-full resize-y rounded-lg border border-line-strong bg-white px-3 py-2 text-[13px] text-text-primary placeholder:text-text-tertiary focus:border-brand focus:outline-none"
      />
      <div className="flex items-center justify-end gap-2">
        <Button variant="ghost" onClick={onCancel}>
          <X size={14} />取消
        </Button>
        <Button variant="primary" disabled={!title.trim()} onClick={onSubmit}>
          保存
        </Button>
      </div>
    </div>
  )
}
