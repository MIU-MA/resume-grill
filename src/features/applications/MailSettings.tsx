'use client'

import { useEffect, useRef, useState } from 'react'
import { X } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import type { MailAgent } from './use-mail-agent'
import { inferSmtpProvider, smtpConfigSchema, SMTP_PRESETS, type MailSender, type SmtpConfig } from '@/domain/mail-schema'

export function MailSettings({ agent, purpose = 'sender', rememberedSender, onVerified, onClose }: { agent: MailAgent; purpose?: 'agent' | 'sender'; rememberedSender?: Pick<SmtpConfig, 'provider' | 'address' | 'name'>; onVerified?: (sender: MailSender) => void; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null)
  const [connection, setConnection] = useState(agent.token)
  const [provider, setProvider] = useState<SmtpConfig['provider']>(inferSmtpProvider(agent.snapshot?.sender?.address ?? rememberedSender?.address ?? '') ?? rememberedSender?.provider ?? 'qq')
  const [address, setAddress] = useState(agent.snapshot?.sender?.address ?? rememberedSender?.address ?? '')
  const [name, setName] = useState(agent.snapshot?.sender?.name ?? rememberedSender?.name ?? '')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  useEffect(() => { dialog.current?.showModal() }, [])
  const run = async (work: () => Promise<unknown>) => {
    setBusy(true); setError('')
    try { await work() } catch (e) { setError(e instanceof Error ? e.message : '连接失败') }
    finally { setBusy(false) }
  }
  return <dialog ref={dialog} onCancel={event => { if (busy) event.preventDefault(); else onClose() }} className="mail-dialog resume-workbench w-[620px] max-w-[calc(100vw-24px)] border border-line-strong bg-surface p-0 text-text-primary backdrop:bg-black/30">
    <header className="flex items-center justify-between border-b border-line px-5 py-4"><h2 className="m-0 text-[16px] font-semibold">{purpose === 'agent' ? '连接本机执行器' : '发件邮箱'}</h2><Button variant="ghost" disabled={busy} onClick={onClose} aria-label="关闭设置" className="size-8 p-0"><X size={17} /></Button></header>
    <div className="space-y-5 p-5 text-[13px]">
      <details open={!agent.snapshot || purpose === 'agent'}>
        <summary className="cursor-pointer text-[13px] font-semibold">{agent.snapshot ? '执行器已连接 · 管理连接' : '连接执行器'}</summary>
        <p className="mb-3 text-text-secondary">在项目目录打开终端，运行下面的命令。{purpose === 'agent' ? '读取网页时保持终端开启，无需填写邮箱。' : '发送期间保持终端开启。'}</p>
        <code className="block border border-line bg-surface-soft px-3 py-2.5 select-all">npm run mail-agent</code>
        <div className="mt-3 flex items-end gap-2"><label className="mail-label min-w-0 flex-1">终端中的连接码<input className="mail-input font-mono" type="password" autoComplete="off" value={connection} onChange={e => setConnection(e.target.value)} /></label><Button variant="secondary" loading={busy} disabled={!connection.trim()} onClick={() => void run(async () => { await agent.connect(connection); if (purpose === 'agent') onClose() })}>{agent.snapshot ? '重新连接' : '连接执行器'}</Button></div>
        {agent.snapshot && <p className="mb-0 mt-2 text-success" role="status">已连接本机执行器</p>}
        {agent.token && <button className="mt-2 text-[12px] text-text-tertiary underline" disabled={busy} onClick={() => { agent.forgetConnection(); setConnection('') }}>忘记此页面的连接码</button>}
      </details>
      {purpose === 'sender' && <section className="border-t border-line pt-4">
        <h3 className="mb-3 mt-0 text-[13px] font-semibold">设置发件邮箱</h3>
        <div className="grid grid-cols-[120px_minmax(0,1fr)] gap-3">
          <label className="mail-label">邮箱类型<select className="mail-input" value={provider} onChange={e => setProvider(e.target.value as SmtpConfig['provider'])}>{Object.entries(SMTP_PRESETS).map(([key, preset]) => <option key={key} value={key}>{preset.label}</option>)}</select></label>
          <label className="mail-label">发件邮箱<input type="email" className="mail-input" placeholder={provider === 'qq' ? '你的邮箱@qq.com' : '你的邮箱@163.com'} autoComplete="off" value={address} onChange={e => {
            const value = e.target.value
            setAddress(value)
            const detected = inferSmtpProvider(value)
            if (detected) setProvider(detected)
          }} /></label>
          <label className="mail-label">发件人姓名<input className="mail-input" maxLength={80} value={name} onChange={e => setName(e.target.value)} /></label>
          <label className="mail-label">邮箱授权码<input type="password" autoComplete="off" className="mail-input" value={password} onChange={e => setPassword(e.target.value)} /></label>
        </div>
        <p className="my-3 text-[12px] leading-relaxed text-text-tertiary">输入邮箱后自动识别类型。{provider === '163' ? '网易 163：在邮箱设置的 POP3/SMTP/IMAP 中开启 SMTP，填写客户端授权码。' : 'QQ 邮箱：先在邮箱设置中开启 SMTP，并生成授权码。'}授权码只留在本机执行器内存，重启后需重新填写。</p>
        <div className="flex flex-wrap items-center gap-3">
          <Button loading={busy} disabled={!agent.snapshot || !!agent.snapshot.running || !address || !name || !password} onClick={() => void run(async () => {
            const config = smtpConfigSchema.safeParse({ provider, address: address.trim(), name, authorizationCode: password })
            if (!config.success) throw new Error(config.error.issues[0].message)
            const result = await agent.command('/configure', config.data)
            if (result.sender) onVerified?.(result.sender)
            setPassword(''); onClose()
          })}>验证并连接邮箱</Button>
          <a href={provider === 'qq' ? 'https://help.mail.qq.com/detail/106/985' : 'https://help.mail.163.com/'} target="_blank" rel="noreferrer" className="text-[12px] text-text-secondary underline">授权码帮助</a>
          {agent.snapshot?.sender && <Button variant="ghost" disabled={busy || agent.snapshot.running} onClick={() => void run(() => agent.command('/disconnect'))}>断开邮箱</Button>}
        </div>
      </section>}
      {error && <p role="alert" className="mb-0 border-l-2 border-danger bg-danger-soft p-3 text-danger">{error}</p>}
    </div>
  </dialog>
}
