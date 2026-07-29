'use client'

import { useState } from 'react'
import { ArrowLeft, ArrowRight, FileText, Loader2 } from 'lucide-react'
import type { ExtractedText } from '@/lib/pdf'

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
    <div className="uploader">
      <div className="uploader-card">
        <div className="uploader-eyebrow">文本确认</div>
        <h1>确认提取的简历文本</h1>
        <p className="uploader-sub">
          多栏 PDF 解析后文字顺序可能错乱，请在下方检查并修正后再分析。
          确认后的文本才会送入声明提取。
        </p>

        <div className="extract-meta">
          <span><FileText size={13} />{sourceFile}</span>
          <span>{extracted.pageCount} 页</span>
          <span>{text.length} 字</span>
        </div>

        <textarea
          className="paste-area extract-area"
          value={text}
          onChange={(event) => setText(event.target.value)}
          disabled={analyzing}
          placeholder="简历文本…"
        />

        <div className="uploader-actions">
          <button type="button" className="button secondary" onClick={onBack} disabled={analyzing}>
            <ArrowLeft size={14} />重新上传
          </button>
          <button
            type="button"
            className="button primary large"
            disabled={analyzing || text.trim().length === 0}
            onClick={() => onConfirm(text, sourceFile)}
          >
            {analyzing ? <Loader2 size={15} className="spin" /> : null}
            {analyzing ? '分析中…' : '确认并分析'}
            {!analyzing && <ArrowRight size={15} />}
          </button>
        </div>

        {error && <p className="uploader-error">{error}</p>}
      </div>
    </div>
  )
}
