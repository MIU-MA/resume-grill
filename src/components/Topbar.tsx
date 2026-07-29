import { Download, FileText, Loader2, RefreshCw, Target, Upload } from 'lucide-react'
import type { ResumeAnalysis } from '@/domain/resume-schema'

type LlmMode = { label: string; cls: 'local' | 'env' | 'mock' } | null

type TopbarProps = {
  analysis: ResumeAnalysis
  analyzing: boolean
  llmMode: LlmMode
  onReplaceResume: () => void
  onRerun: () => void
  onExport: () => void
}

export function Topbar({ analysis, analyzing, llmMode, onReplaceResume, onRerun, onExport }: TopbarProps) {
  return (
    <header className="topbar">
      <div className="brand-block">
        <div className="brand-mark"><Target size={18} /></div>
        <div>
          <strong>简历拷打机</strong>
          <span>Resume Drill</span>
        </div>
      </div>
      <div className="topbar-context">
        <FileText size={14} />
        <span>{analysis.sourceFile}</span>
        <span className="analysis-state"><i /> {analyzing ? '分析中' : '分析完成'}</span>
      </div>
      <div className="topbar-actions">
        <span className={`mode-chip ${llmMode?.cls ?? ''}`}>
          <i />{llmMode ? llmMode.label : '检测中…'}
        </span>
        <button type="button" className="button secondary" onClick={onReplaceResume}><Upload size={14} />替换简历</button>
        <button type="button" className="icon-button" title="重新分析" onClick={onRerun} disabled={analyzing}>{analyzing ? <Loader2 size={15} className="spin" /> : <RefreshCw size={15} />}</button>
        <button type="button" className="button primary" onClick={onExport}><Download size={14} />导出报告</button>
      </div>
    </header>
  )
}
