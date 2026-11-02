'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import type { Mode } from '@/application/types'
import type { SidebarBadges } from './WorkspaceSidebar'
import { AppShell, type SettingsTab } from './AppShell'

/** Entering practice without an active resume should explain itself, not bounce to upload. */
export function NoResumeWorkspace({ mode, badges, onNavigate, onHome }: {
  mode: Mode
  badges: SidebarBadges
  onNavigate: (mode: Mode) => void
  onHome: () => void
}) {
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [settingsTab, setSettingsTab] = useState<SettingsTab>('model')
  const openSettings = (tab: SettingsTab) => { setSettingsTab(tab); setSettingsOpen(true) }
  return <AppShell
    mode={mode}
    badges={badges}
    onNavigate={onNavigate}
    onOpenHistory={onHome}
    settingsOpen={settingsOpen}
    settingsTab={settingsTab}
    onOpenSettings={openSettings}
    onCloseSettings={() => setSettingsOpen(false)}
    header={<h1 className="m-0 text-title font-semibold">{mode === 'knowledge' ? '待复习' : '面试练习'}</h1>}
  >
    <div className="grid h-full place-items-center overflow-y-auto px-6 py-12">
      <div className="max-w-md text-center">
        <h2 className="m-0 text-title font-semibold">先选一份简历开始练习</h2>
        <p className="mt-3 text-body leading-relaxed text-text-secondary">{mode === 'knowledge' ? '待复习的问题来自练习记录。先打开一份简历，再开始练习。' : '面试准备、模拟面试和复盘都围绕一份简历展开。导入或打开简历后，这里会显示练习内容。'}</p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <Button onClick={onHome}>打开简历库</Button>
          <Button variant="secondary" onClick={() => onNavigate('applications')}>先看投递清单</Button>
        </div>
      </div>
    </div>
  </AppShell>
}
