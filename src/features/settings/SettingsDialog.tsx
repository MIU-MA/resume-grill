'use client'

import { useState } from 'react'
import { ModelSettings } from './ModelSettings'
import { Dialog } from '@/components/ui/Dialog'
import { Button } from '@/components/ui/Button'
import { useConfirmation } from '@/hooks/use-confirmation'
import { MailSettings } from '@/features/settings/MailSettings'
import { useMailAgent, type MailAgent } from '@/features/applications/hooks/use-mail-agent'
import { useLlmStatus } from './hooks/use-llm-status'
import type { MailSender, SmtpConfig } from '@/domain/mail-schema'

type SettingsDialogProps = {
  open: boolean; onClose: () => void
  envConfigured?: boolean; clientConfigured?: boolean; onClientChanged?: () => void
  initialTab?: 'model' | 'mail' | 'local'
  agent?: MailAgent
  rememberedSender?: Pick<SmtpConfig, 'provider' | 'address' | 'name'>
  onVerified?: (sender: MailSender) => void
}
export function SettingsDialog(props: SettingsDialogProps) {
  return props.open ? <SettingsContent {...props} /> : null
}
function SettingsContent(props: SettingsDialogProps) {
  return props.agent ? <SettingsPanel {...props} agent={props.agent} /> : <SettingsWithAgent {...props} />
}
function SettingsWithAgent(props: SettingsDialogProps) {
  const agent = useMailAgent()
  return <SettingsPanel {...props} agent={agent} />
}
function SettingsPanel(props: SettingsDialogProps & { agent: MailAgent }) {
  const [tab, setTab] = useState(props.initialTab ?? 'model')
  const [modelDirty, setModelDirty] = useState(false)
  const [mailDirty, setMailDirty] = useState(false)
  const [modelBusy, setModelBusy] = useState(false)
  const [mailBusy, setMailBusy] = useState(false)
  const confirmation = useConfirmation()
  const status = useLlmStatus()
  const agent = props.agent
  const close = async () => {
    if (modelBusy || mailBusy) return
    if ((modelDirty || mailDirty) && !await confirmation.confirm({ title: '放弃未保存的设置？', message: '当前输入尚未保存。继续关闭会丢弃这些修改。', confirmLabel: '放弃修改并关闭' })) return
    props.onClose()
  }
  return <><Dialog open onClose={() => void close()} label="设置" panelClassName="w-[min(620px,calc(100%-24px))] max-h-[calc(100dvh-32px)] overflow-y-auto border border-line bg-white">
    <header className="flex items-center justify-between border-b border-line px-5 py-3"><h2 className="m-0 text-section font-semibold">设置</h2><Button variant="ghost" onClick={() => void close()}>关闭</Button></header>
    <nav role="tablist" aria-label="设置分类" className="flex gap-5 border-b border-line px-5">{([{ value: 'model', label: '模型' }, { value: 'mail', label: '邮箱' }, { value: 'local', label: '本机' }] as const).map(item => <button key={item.value} role="tab" aria-selected={tab === item.value} className={`border-b-2 py-3 text-label ${tab === item.value ? 'border-brand font-semibold' : 'border-transparent text-text-secondary'}`} onClick={() => setTab(item.value)}>{item.label}</button>)}</nav>
    <div hidden={tab !== 'model'} role="tabpanel" aria-label="模型"><ModelSettings envConfigured={props.envConfigured ?? status.envConfigured} clientConfigured={props.clientConfigured ?? status.clientConfigured} onDirtyChange={setModelDirty} onBusyChange={setModelBusy} onClientChanged={() => { status.refresh(); props.onClientChanged?.() }} /></div>
    <div hidden={tab === 'model'} role="tabpanel" aria-label={tab === 'local' ? '本机' : '邮箱'}><MailSettings embedded agent={agent} purpose={tab === 'local' ? 'agent' : 'sender'} rememberedSender={props.rememberedSender} onVerified={props.onVerified} onDirtyChange={setMailDirty} onBusyChange={setMailBusy} onClose={() => void close()} /></div>
  </Dialog>{confirmation.dialog}</>
}
