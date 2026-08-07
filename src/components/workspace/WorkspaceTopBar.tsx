import { Download, FileJson, FileText } from 'lucide-react'
import type { ResumeAnalysis } from '@/domain/resume-schema'
import { Button } from '@/components/ui/Button'
import { SettingsPopover } from '@/components/settings/SettingsPopover'
import { useDropdown } from '@/hooks/use-dropdown'
import type { LlmMode } from '@/hooks/use-llm-status'

type WorkspaceTopBarProps = {
  analysis: ResumeAnalysis
  llmMode: LlmMode | null
  envConfigured: boolean
  clientConfigured: boolean
  onClientChanged: () => void
  onExport: () => void
  onExportJson: () => void
  onLogoClick: () => void
}

export function WorkspaceTopBar({ analysis, llmMode, envConfigured, clientConfigured, onClientChanged, onExport, onExportJson, onLogoClick }: WorkspaceTopBarProps) {
  const { open, toggle, close, ref: menuRef } = useDropdown()

  return (
    <header className="flex h-16 items-center justify-between border-b border-border bg-white/92 backdrop-blur-lg px-7 sticky top-0 z-30">
      <div className="flex items-center gap-3 min-w-0">
        <button type="button" onClick={onLogoClick} className="flex cursor-pointer items-center gap-2" title="返回上传页">
          <span className="grid size-9 flex-none place-items-center overflow-hidden rounded-[10px] bg-white shadow-[0_1px_3px_rgba(16,24,40,0.04)]">
            <img src="/favicon.svg" alt="简历拷打机" className="size-9" />
          </span>
        </button>
        <div className="flex min-w-0 flex-col">
          <strong className="text-[15px] font-bold tracking-[-0.01em]">{analysis.candidate} · {analysis.role}</strong>
          <span className="text-text-tertiary text-[12px] mt-0.5 truncate">{analysis.sourceFile}</span>
        </div>
      </div>
      <div className="flex items-center gap-2 flex-none">
        {llmMode && (
          <span className="text-text-tertiary text-[12px] hidden md:inline-flex items-center gap-2">
            <span className={`size-1.5 rounded-full ${llmMode.testResult === 'ok' ? 'bg-success' : llmMode.testResult === 'fail' ? 'bg-danger' : llmMode.cls === 'local' ? 'bg-success' : llmMode.cls === 'env' ? 'bg-brand' : 'bg-warning'}`} />
            {llmMode.testResult === 'ok' ? '已连接' : llmMode.testResult === 'fail' ? '连接失败' : llmMode.label}
          </span>
        )}
        <SettingsPopover envConfigured={envConfigured} clientConfigured={clientConfigured} onClientChanged={onClientChanged} compact />
        <div ref={menuRef} className="relative">
          <Button variant="secondary" onClick={toggle}><Download size={16} />导出</Button>
          {open && (
            <div className="absolute right-0 top-full mt-1 w-44 rounded-lg border border-border bg-white shadow-[0_4px_16px_rgba(16,24,40,0.08)] py-1 z-40">
              <button
                type="button"
                className="flex w-full items-center gap-2 px-3.5 py-2.5 text-[13px] text-text-primary hover:bg-surface-hover transition-colors"
                onClick={() => { onExport(); close() }}
              >
                <FileText size={15} className="text-text-tertiary" />Markdown 报告
              </button>
              <button
                type="button"
                className="flex w-full items-center gap-2 px-3.5 py-2.5 text-[13px] text-text-primary hover:bg-surface-hover transition-colors"
                onClick={() => { onExportJson(); close() }}
              >
                <FileJson size={15} className="text-text-tertiary" />JSON 数据备份
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
