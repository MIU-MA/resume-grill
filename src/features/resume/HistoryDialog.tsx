'use client'

import { ArrowRight, FileText, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'
import type { SavedRecord } from '@/lib/storage'

type HistoryDialogProps = {
  open: boolean
  onClose: () => void
  records: SavedRecord[]
  loading: boolean
  onOpenRecord: (record: SavedRecord) => void
  onDeleteRecord: (id: string) => Promise<void>
  onNewResume: () => void
}

export function HistoryDialog({
  open,
  onClose,
  records,
  loading,
  onOpenRecord,
  onDeleteRecord,
  onNewResume,
}: HistoryDialogProps) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      label="历史简历"
      panelClassName="w-[min(560px,calc(100%-32px))] overflow-hidden rounded-lg border border-line bg-white shadow-[0_16px_48px_rgba(16,24,40,0.16)]"
    >
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <div>
            <h2 className="m-0 text-[15px] font-bold text-text-primary">历史简历</h2>
            <p className="mt-0.5 text-[12px] text-text-tertiary">打开之前分析过的简历，或上传一份新的。</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="grid size-8 place-items-center rounded-lg text-text-tertiary hover:bg-surface-hover hover:text-text-primary"
            aria-label="关闭"
          >
            <span aria-hidden="true" className="text-[16px] leading-none">×</span>
          </button>
        </div>

        <div className="max-h-[min(70vh,560px)] overflow-y-auto px-5 py-4">
          {loading ? (
            <div className="flex h-20 items-center justify-center text-[13px] text-text-tertiary">正在读取本地记录…</div>
          ) : records.length === 0 ? (
            <div className="py-12 text-center">
              <FileText size={22} className="mx-auto mb-3 text-text-tertiary" />
              <p className="m-0 text-[13px] font-semibold text-text-primary">还没有历史简历</p>
              <p className="mt-1.5 text-[12px] text-text-tertiary">上传一份简历并分析后，会保存在这里。</p>
            </div>
          ) : (
            <div className="space-y-2">
              {records.map((record) => {
                const completed = Object.values(record.sessions).flat().filter((s) => s.status === 'done').length
                return (
                  <div
                    key={record.id}
                    className="flex items-center gap-3 rounded-md border border-line bg-white px-3.5 py-2.5 transition-colors hover:bg-surface-soft"
                  >
                    <div className="grid size-8 flex-none place-items-center rounded-md bg-surface-soft text-text-tertiary">
                      <FileText size={15} />
                    </div>
                    <button type="button" className="min-w-0 flex-1 bg-transparent text-left" onClick={() => onOpenRecord(record)}>
                      <span className="flex items-center gap-2">
                        <strong className="truncate text-[13px] text-text-primary">{record.analysis.candidate}</strong>
                        <span className="truncate text-[12px] text-text-tertiary">{record.analysis.role}</span>
                      </span>
                      <span className="mt-0.5 block truncate text-[11px] text-text-tertiary">
                        {record.analysis.sourceFile} · {record.analysis.claims.length} 个要点 · 已练习 {completed} 次
                      </span>
                    </button>
                    <button
                      type="button"
                      className="grid size-8 flex-none place-items-center rounded-md text-text-tertiary hover:bg-danger-soft hover:text-danger"
                      onClick={() => onDeleteRecord(record.id)}
                      title="删除本地记录"
                      aria-label={`删除 ${record.analysis.candidate} 的本地记录`}
                    >
                      <Trash2 size={14} />
                    </button>
                    <button
                      type="button"
                      className="grid size-8 flex-none place-items-center rounded-md text-text-tertiary hover:bg-surface-hover hover:text-brand"
                      onClick={() => onOpenRecord(record)}
                      title="继续查看"
                      aria-label={`继续查看 ${record.analysis.candidate} 的简历`}
                    >
                      <ArrowRight size={15} />
                    </button>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between border-t border-line px-5 py-3">
          <span className="text-[12px] text-text-tertiary">{records.length} 份本地备份</span>
          <Button variant="primary" onClick={onNewResume}>
            上传新简历
          </Button>
        </div>
    </Dialog>
  )
}
