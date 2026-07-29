import { ClipboardList, Download, FileText, Loader2, RefreshCw, Target, Upload } from 'lucide-react'
import type { ResumeAnalysis } from '@/domain/resume-schema'
import { Button } from '@/components/Button'

type LlmMode = { label: string; cls: 'local' | 'env' | 'mock' } | null

type TopbarProps = {
  analysis: ResumeAnalysis
  analyzing: boolean
  llmMode: LlmMode
  onReplaceResume: () => void
  onRerun: () => void
  onExport: () => void
  onReport: () => void
}

export function Topbar({ analysis, analyzing, llmMode, onReplaceResume, onRerun, onExport, onReport }: TopbarProps) {
  return (
    <header className="md3:grid-cols-[264px_minmax(240px,1fr)_auto] sticky top-0 z-20 grid h-[58px] min-h-[58px] grid-cols-[1fr_auto] items-center border-b border-line bg-surface">
      <div className="flex h-full items-center gap-[10px] border-r border-line pl-3 md3:pl-4 pr-4">
        <div className="grid size-[30px] place-items-center rounded-md text-white bg-[#1b2328]"><Target size={18} /></div>
        <div className="flex min-w-0 flex-col">
          <strong className="text-[13px] leading-[1.3]">简历拷打机</strong>
          <span className="text-faint text-[9px] uppercase">Resume Drill</span>
        </div>
      </div>
      <div className="hidden min-w-0 items-center gap-2 px-[18px] text-muted text-[11px] md2:flex">
        <FileText size={14} />
        <span className="overflow-hidden text-ellipsis whitespace-nowrap">{analysis.sourceFile}</span>
        <span className="flex flex-none items-center gap-[5px] border-l border-line pl-[10px] text-green">
          <i className="size-[6px] rounded-full bg-[#2f9a69]" /> {analyzing ? '分析中' : '分析完成'}
        </span>
      </div>
      <div className="flex items-center gap-[7px] pr-3">
        <span className={cnModeChip(llmMode)}>
          <i className="size-[6px] flex-none rounded-full bg-current" />{llmMode ? llmMode.label : '检测中…'}
        </span>
        <Button variant="secondary" className="hidden md2:inline-flex" onClick={onReport}><ClipboardList size={14} />会话报告</Button>
        <Button variant="secondary" className="hidden md2:inline-flex" onClick={onReplaceResume}><Upload size={14} />替换简历</Button>
        <Button size="icon" title="重新分析" onClick={onRerun} disabled={analyzing}>{analyzing ? <Loader2 size={15} className="animate-spin" /> : <RefreshCw size={15} />}</Button>
        <Button variant="primary" onClick={onExport} className="max-md1:w-8 max-md1:px-0 max-md1:text-[0px] max-md1:[&_svg]:m-0"><Download size={14} />导出报告</Button>
      </div>
    </header>
  )
}

function cnModeChip(mode: LlmMode): string {
  const base = 'inline-flex h-[21px] items-center gap-[5px] rounded-[3px] px-2 text-[9px] font-650 whitespace-nowrap max-md1:hidden'
  if (!mode) return `${base} bg-[#eef1f2] text-[#5c656b]`
  const variants = {
    local: 'text-[#1e6545] bg-green-soft',
    env: 'text-brand bg-brand-soft',
    mock: 'text-[#8a7440] bg-[#f3efe3]',
  }
  return `${base} ${variants[mode.cls]}`
}
