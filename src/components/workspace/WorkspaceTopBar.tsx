import { Download, FileJson, FileText, Settings } from 'lucide-react'
import type { ResumeAnalysis } from '@/domain/resume-schema'
import { Button } from '@/components/ui/Button'
import { useDropdown } from '@/hooks/use-dropdown'
import type { LlmMode } from '@/hooks/use-llm-status'

type Props = {
  analysis: ResumeAnalysis
  llmMode: LlmMode | null
  onExport: () => void
  onExportJson: () => void
  onOpenSettings: () => void
}

export function WorkspaceTopBar({
  analysis,
  llmMode,
  onExport,
  onExportJson,
  onOpenSettings,
}: Props) {
  const exportMenu = useDropdown()

  return (
    <>
      <div className="flex min-w-0 items-center gap-3">
        <img
          src="/favicon.svg"
          alt="简历拷打机"
          className="size-8 flex-none max-[520px]:hidden"
        />
        <div className="flex min-w-0 flex-col">
          <strong className="truncate text-[14px] font-bold">
            {analysis.candidate} · {analysis.role}
          </strong>
          <span className="mt-0.5 truncate text-[11px] text-text-tertiary max-[520px]:hidden">
            {analysis.sourceFile}
          </span>
        </div>
      </div>
      <div className="flex flex-none items-center gap-2">
        {llmMode && (
          <span className="hidden items-center gap-1.5 text-[11px] text-text-tertiary md:inline-flex">
            <i
              className={`size-1.5 rounded-full ${
                llmMode.testResult === 'ok'
                  ? 'bg-success'
                  : llmMode.cls === 'env'
                    ? 'bg-brand'
                    : 'bg-warning'
              }`}
            />
            {llmMode.testResult === 'ok' ? '已连接' : llmMode.label}
          </span>
        )}
        <button
          type="button"
          onClick={onOpenSettings}
          className="grid size-8 place-items-center rounded-md text-text-tertiary hover:bg-surface-hover"
          aria-label="模型设置"
        >
          <Settings size={16} />
        </button>
        <div ref={exportMenu.ref} className="relative">
          <Button variant="secondary" onClick={exportMenu.toggle}>
            <Download size={15} />
            <span className="hidden sm:inline">导出</span>
          </Button>
          {exportMenu.open && (
            <div className="absolute right-0 top-full z-20 mt-1 w-40 rounded-lg border border-line bg-white p-1 shadow-[0_8px_24px_rgba(16,24,40,.12)]">
              <button
                type="button"
                onClick={() => {
                  onExport()
                  exportMenu.close()
                }}
                className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-[12px] hover:bg-surface-hover"
              >
                <FileText size={14} />
                导出 Markdown
              </button>
              <button
                type="button"
                onClick={() => {
                  onExportJson()
                  exportMenu.close()
                }}
                className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-[12px] hover:bg-surface-hover"
              >
                <FileJson size={14} />
                导出 JSON
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  )
}
