'use client'

import { useState } from 'react'
import { ArrowLeft, ArrowRight, FileText, Loader2 } from 'lucide-react'
import type { ExtractedText } from '@/lib/pdf'
import { Button } from '@/components/Button'

type ExtractedTextReviewProps = {
  sourceFile: string
  extracted: ExtractedText
  analyzing: boolean
  error: string | null
  onConfirm: (text: string, sourceFile: string) => void
  onBack: () => void
}

export function ExtractedTextReview({ sourceFile, extracted, analyzing, error, onConfirm, onBack }: ExtractedTextReviewProps) {
  const [text, setText] = useState(extracted.text)

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-canvas px-5 py-10">
      <div className="w-full max-w-[540px] rounded-lg border border-line border-t border-t-brand bg-surface px-7 pt-7 pb-[26px] shadow-[0_1px_0_var(--color-line),0_8px_24px_rgba(27,40,34,.04)]">
        <div className="mb-[6px] text-brand text-[10px] font-750 tracking-[0.08em]">文本确认</div>
        <h1 className="m-0 mb-1.5 text-[17px] font-bold leading-[1.4] text-text-primary">确认提取的简历文本</h1>
        <p className="m-0 mb-5 text-text-tertiary text-[12px] leading-[1.65]">
          多栏 PDF 解析后文字顺序可能错乱，请在下方检查并修正后再分析。
          确认后的文本才会送入声明提取。
        </p>

        <div className="mb-3 flex items-center gap-4 text-text-tertiary text-[11px]">
          <span className="inline-flex items-center gap-1.5"><FileText size={13} />{sourceFile}</span>
          <span>{extracted.pageCount} 页</span>
          <span>{text.length} 字</span>
        </div>

        <textarea
          className="w-full min-h-[260px] resize-y rounded-lg border border-line-strong bg-white p-[11px] text-[12px] leading-[1.7] text-text-primary focus:border-brand focus:outline-2 focus:outline-brand focus:outline-offset-[-1px]"
          value={text}
          onChange={(event) => setText(event.target.value)}
          disabled={analyzing}
          placeholder="简历文本…"
        />

        <div className="mt-4 flex items-center justify-end gap-2">
          <Button variant="secondary" onClick={onBack} disabled={analyzing}>
            <ArrowLeft size={14} />重新上传
          </Button>
          <Button variant="primary" size="large" disabled={analyzing || text.trim().length === 0} onClick={() => onConfirm(text, sourceFile)}>
            {analyzing ? <Loader2 size={15} className="animate-spin" /> : null}
            {analyzing ? '分析中…' : '确认并分析'}
            {!analyzing && <ArrowRight size={15} />}
          </Button>
        </div>

        {error && <p className="mt-[14px] rounded-[0_3px_3px_0] border-l border-red bg-red-soft px-3 py-2 text-[11px] leading-[1.55] text-danger">{error}</p>}
      </div>
    </div>
  )
}
