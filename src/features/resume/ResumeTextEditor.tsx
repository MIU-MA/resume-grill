type ResumeTextEditorProps = {
  text: string
  analyzing: boolean
  onTextChange: (value: string) => void
}

export function ResumeTextEditor({ text, analyzing, onTextChange }: ResumeTextEditorProps) {
  return (
    <section className="flex h-full min-h-0 flex-col">
      <div className="flex min-h-16 flex-none flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-3 sm:px-6">
        <div className="flex flex-wrap items-baseline gap-3">
          <h2 className="m-0 text-[14px] font-semibold">简历原始文本</h2>
          <span className="text-[12px] text-text-tertiary">核对文字、段落和章节顺序</span>
        </div>
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
        <p className="mx-auto mb-0 mt-3 w-full max-w-[1040px] text-[12px] leading-relaxed text-text-tertiary">修改原文后会自动重新提取练习内容，覆盖之前的内容调整。简历检查需手动重新运行。</p>
      </div>
    </section>
  )
}
