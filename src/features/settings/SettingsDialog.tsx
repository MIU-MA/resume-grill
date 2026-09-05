'use client'

import { ModelSettings } from '@/features/settings/ModelSettings'
import { Dialog } from '@/components/ui/Dialog'

type SettingsDialogProps = {
  open: boolean
  onClose: () => void
  envConfigured: boolean
  clientConfigured: boolean
  onClientChanged: () => void
}

export function SettingsDialog({
  open,
  onClose,
  envConfigured,
  clientConfigured,
  onClientChanged,
}: SettingsDialogProps) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      label="模型设置"
      panelClassName="w-[min(360px,calc(100%-32px))]"
    >
      <ModelSettings
        envConfigured={envConfigured}
        clientConfigured={clientConfigured}
        onClientChanged={() => {
          onClientChanged()
          onClose()
        }}
      />
    </Dialog>
  )
}
