'use client'

import { useCallback, useState } from 'react'
import type { SettingsTab } from '@/features/workspace/app-shell-context'

export function useSettingsDialog() {
  const [settingsOpen, setOpen] = useState(false)
  const [settingsTab, setTab] = useState<SettingsTab>('model')
  const onOpenSettings = useCallback((tab: SettingsTab) => { setTab(tab); setOpen(true) }, [])
  const onCloseSettings = useCallback(() => setOpen(false), [])
  return { settingsOpen, settingsTab, onOpenSettings, onCloseSettings }
}
