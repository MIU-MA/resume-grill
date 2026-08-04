import { useState, useRef, useEffect } from 'react'
import { Download, FileJson, FileText, MoreHorizontal } from 'lucide-react'
import type { ResumeAnalysis } from '@/domain/resume-schema'
import { Button } from '@/components/ui/Button'
import { SettingsPopover } from '@/components/settings/SettingsPopover'

type LlmMode = { label: string; cls: 'local' | 'env' | 'mock' } | null

type WorkspaceTopBarProps = {
  analysis: ResumeAnalysis
  llmMode: LlmMode
  envConfigured: boolean
  clientConfigured: boolean
  onClientChanged: () => void
  onRerun: () => void
  onExport: () => void
  onExportJson: () => void
  onLogoClick: () => void
}

export function WorkspaceTopBar({ analysis, llmMode, envConfigured, clientConfigured, onClientChanged, onRerun, onExport, onExportJson, onLogoClick }: WorkspaceTopBarProps) {
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false)
    }
    if (menuOpen) document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [menuOpen])

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
        <div ref={menuRef} className="relative">
          <Button variant="secondary" onClick={() => setMenuOpen((o) => !o)}><Download size={16} />导出</Button>
          {menuOpen && (
            <div className="absolute right-0 top-full mt-1 w-44 rounded-lg border border-border bg-white shadow-[0_4px_16px_rgba(16,24,40,0.08)] py-1 z-40">
              <button
                type="button"
                className="flex w-full items-center gap-2 px-3.5 py-2.5 text-[13px] text-text-primary hover:bg-surface-hover transition-colors"
                onClick={() => { onExport(); setMenuOpen(false) }}
              >
                <FileText size={15} className="text-text-tertiary" />Markdown 报告
              </button>
              <button
                type="button"
                className="flex w-full items-center gap-2 px-3.5 py-2.5 text-[13px] text-text-primary hover:bg-surface-hover transition-colors"
                onClick={() => { onExportJson(); setMenuOpen(false) }}
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
