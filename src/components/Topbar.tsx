import { Download, MoreHorizontal } from 'lucide-react'
import type { ResumeAnalysis } from '@/domain/resume-schema'
import { Button } from '@/components/Button'
import { SettingsPopover } from '@/components/SettingsPopover'

type LlmMode = { label: string; cls: 'local' | 'env' | 'mock' } | null

type TopbarProps = {
  analysis: ResumeAnalysis
  llmMode: LlmMode
  envConfigured: boolean
  clientConfigured: boolean
  onClientChanged: () => void
  onRerun: () => void
  onExport: () => void
  onLogoClick: () => void
}

export function Topbar({ analysis, llmMode, envConfigured, clientConfigured, onClientChanged, onRerun, onExport, onLogoClick }: TopbarProps) {
  return (
    <header className="flex h-16 items-center justify-between border-b border-border bg-white/92 backdrop-blur-lg px-7 sticky top-0 z-30">
      <div className="flex items-center gap-3 min-w-0">
        <div className="grid size-9 place-items-center rounded-[10px] bg-text-primary text-white font-extrabold tracking-[-0.03em] shadow-[0_1px_3px_rgba(16,24,40,0.04)] flex-none">
          <button type="button" onClick={onLogoClick} className="cursor-pointer" title="返回上传页"><span className="text-[13px]">RG</span></button>
        </div>
        <div className="flex min-w-0 flex-col">
          <strong className="text-[15px] font-bold tracking-[-0.01em]">{analysis.candidate} · {analysis.role}</strong>
          <span className="text-text-tertiary text-[12px] mt-0.5 truncate">{analysis.sourceFile}</span>
        </div>
      </div>
      <div className="flex items-center gap-2 flex-none">
        {llmMode && (
          <span className="text-text-tertiary text-[12px] hidden md:inline-flex items-center gap-2">
            <span className={`size-1.5 rounded-full ${llmMode.cls === 'local' ? 'bg-success' : llmMode.cls === 'env' ? 'bg-brand' : 'bg-warning'}`} />
            {llmMode.label}
          </span>
        )}
        <SettingsPopover envConfigured={envConfigured} clientConfigured={clientConfigured} onClientChanged={onClientChanged} compact />
        <Button variant="ghost" onClick={onRerun} className="hidden md:inline-flex"><MoreHorizontal size={16} /></Button>
        <Button variant="secondary" onClick={onExport}><Download size={16} />导出</Button>
      </div>
    </header>
  )
}
