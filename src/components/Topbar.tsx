import { ClipboardList, Download, FileText, RefreshCw, Upload } from 'lucide-react'
import type { ResumeAnalysis } from '@/domain/resume-schema'
import { Button } from '@/components/Button'

type LlmMode = { label: string; cls: 'local' | 'env' | 'mock' } | null

type TopbarProps = {
  analysis: ResumeAnalysis
  llmMode: LlmMode
  onReplaceResume: () => void
  onRerun: () => void
  onExport: () => void
  onReport: () => void
}

const CHIP: Record<string, string> = {
  local: 'text-[#1e6545] bg-green-soft',
  env: 'text-brand bg-brand-soft',
  mock: 'text-[#8a7440] bg-[#f3efe3]',
}

export function Topbar({ analysis, llmMode, onReplaceResume, onRerun, onExport, onReport }: TopbarProps) {
  return (
    <header className="flex h-[54px] items-center justify-between border-b border-line bg-surface px-5">
      <div className="flex items-center gap-3 min-w-0">
        <div className="grid size-7 place-items-center rounded-md text-white bg-[#1b2328] flex-none">
          <FileText size={14} />
        </div>
        <div className="flex min-w-0 flex-col">
          <strong className="text-xs leading-snug text-[#1a2024] truncate">{analysis.candidate} · {analysis.role}</strong>
          <span className="text-faint text-[9px] truncate">{analysis.sourceFile}</span>
        </div>
      </div>
      <div className="flex items-center gap-2 flex-none">
        {llmMode && (
          <span className={`hidden md1:inline-flex h-5 items-center gap-1 rounded px-1.5 text-[9px] font-650 whitespace-nowrap ${CHIP[llmMode.cls]}`}>
            <i className="size-1 rounded-full bg-current flex-none" />{llmMode.label}
          </span>
        )}
        <Button variant="secondary" className="h-7 text-[10px] px-2 hidden md1:inline-flex" onClick={onReport}><ClipboardList size={12} />会话报告</Button>
        <Button variant="secondary" className="h-7 text-[10px] px-2" onClick={onReplaceResume}><Upload size={12} />替换</Button>
        <button type="button" className="grid size-7 place-items-center rounded-[4px] border border-line-strong bg-white text-muted hover:bg-[#f0f3f5]" title="重新分析" onClick={onRerun}><RefreshCw size={13} /></button>
        <Button variant="primary" className="h-7 text-[10px] px-2" onClick={onExport}><Download size={12} />导出</Button>
      </div>
    </header>
  )
}
