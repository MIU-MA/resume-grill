'use client'

import { useEffect, useRef, useState } from 'react'
import { Settings } from 'lucide-react'
import { ModelSettings } from '@/components/ModelSettings'

type SettingsPopoverProps = {
  envConfigured: boolean
  clientConfigured: boolean
  onClientChanged: () => void
  /** 紧凑模式：按钮更小，用于顶栏 */
  compact?: boolean
  /** 浮层对齐：right（默认，靠右弹出）/ left */
  align?: 'right' | 'left'
  /** 受控模式：外部控制开闭 */
  open?: boolean
  onOpenChange?: (open: boolean) => void
}

// 齿轮按钮 + 浮层 ModelSettings，点击外部关闭。首页和顶栏共用。
export function SettingsPopover({ envConfigured, clientConfigured, onClientChanged, compact, align = 'right', open: controlledOpen, onOpenChange }: SettingsPopoverProps) {
  const [internalOpen, setInternalOpen] = useState(false)
  const open = controlledOpen ?? internalOpen
  const setOpen = (v: boolean) => {
    setInternalOpen(v)
    onOpenChange?.(v)
  }
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={compact
          ? 'grid size-7 place-items-center rounded-lg border border-line-strong bg-white text-text-tertiary hover:bg-surface-hover transition-colors'
          : 'fixed top-4 right-4 z-20 grid size-9 place-items-center rounded-full border border-line bg-white text-text-tertiary hover:bg-surface-hover transition-colors'
        }
        title="模型设置 / API Key"
        aria-label="模型设置"
      >
        <Settings size={compact ? 13 : 16} />
      </button>

      {open && (
        <div className={`absolute top-9 z-30 w-[360px] max-w-[calc(100vw-32px)] ${align === 'right' ? 'right-0' : 'left-0'}`}>
          <ModelSettings
            envConfigured={envConfigured}
            clientConfigured={clientConfigured}
            onClientChanged={() => {
              onClientChanged()
              setOpen(false)
            }}
          />
        </div>
      )}
    </div>
  )
}
