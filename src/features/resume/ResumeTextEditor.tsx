import { RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/Button'

type ResumeTextEditorProps = {
  text: string
  structureChanged: boolean
  analyzing: boolean
  onTextChange: (value: string) => void
  onRefreshStructure: () => void
}

export function ResumeTextEditor({ text, structureChanged, analyzing, onTextChange, onRefreshStructure }: ResumeTextEditorProps) {
  return (
    <section className="flex h-full min-h-0 flex-col">
      <div className="flex min-h-16 flex-none flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-3 sm:px-6">
        <div className="flex flex-wrap items-baseline gap-3">
          <h2 className="m-0 text-[14px] font-semibold">简历原始文本</h2>
          <span className="text-[12px] text-text-tertiary">核对文字、段落和章节顺序</span>
        </div>
        <Button className="h-8 px-2.5 text-[12px]" variant="secondary" onClick={onRefreshStructure} disabled={!structureChanged || analyzing}>
          <RefreshCw size={14} />重新识别结构
        </Button>
      </div>
      <div className="flex min-h-0 flex-1 flex-col bg-surface-soft p-4 sm:p-6">
        <textarea
          className="mx-auto min-h-0 w-full max-w-[1040px] flex-1 resize-none border border-line-strong bg-white p-5 text-[14px] leading-[1.9] text-text-primary focus:border-brand sm:p-7"
          aria-label="简历原始文本"
          value={text}
          onChange={(event) => onTextChange(event.target.value)}
          disabled={analyzing}
          placeholder="简历文本…"
        />
        {structureChanged && <p className="mx-auto mb-0 mt-3 w-full max-w-[1040px] text-[12px] leading-relaxed text-text-tertiary">改完后点击「重新识别结构」，再去选择练习内容。也可以返回「简历检查」查看新的修改建议。</p>}
      </div>
    </section>
  )
}
