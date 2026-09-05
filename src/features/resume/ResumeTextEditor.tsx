import { RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/Button'

type ResumeTextEditorProps = {
  text: string
  structureChanged: boolean
  analyzing: boolean
  onTextChange: (value: string) => void
  onRefreshStructure: () => void
}

export function ResumeTextEditor({
  text,
  structureChanged,
  analyzing,
  onTextChange,
  onRefreshStructure,
}: ResumeTextEditorProps) {
  return (
    <section className="p-5">
      <div className="mb-3 flex items-center justify-between gap-4">
        <div>
          <h2 className="m-0 text-[14px] font-bold">PDF 提取文本</h2>
          <p className="mt-1 text-[12px] text-text-tertiary">
            修正文字或顺序后，重新识别章节和可练习内容。
          </p>
        </div>
        <Button
          variant="secondary"
          onClick={onRefreshStructure}
          disabled={!structureChanged || analyzing}
        >
          <RefreshCw size={14} />重新识别结构
        </Button>
      </div>
      <textarea
        className="min-h-[520px] w-full resize-y rounded-lg border border-line-strong bg-white p-4 text-[13px] leading-[1.75] text-text-primary focus:border-brand focus:shadow-[0_0_0_3px_rgba(37,99,235,0.1)]"
        value={text}
        onChange={(event) => onTextChange(event.target.value)}
        disabled={analyzing}
        placeholder="简历文本…"
      />
      {structureChanged && (
        <p className="mt-2 text-[12px] text-warning">
          文本已修改，请重新识别结构后再分析。
        </p>
      )}
    </section>
  )
}
