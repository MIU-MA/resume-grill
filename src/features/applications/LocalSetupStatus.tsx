'use client'

import { useEffect, useState } from 'react'
import { isWorkbenchUrl } from '@/domain/website-automation'
import { extensionRequest } from './website-automation'

export function LocalSetupStatus({ connected, connectionError, onConnect }: { connected: boolean; connectionError: string; onConnect: () => void }) {
  const [extension, setExtension] = useState<'checking' | 'connected' | 'missing' | 'unsupported'>('checking')
  const [check, setCheck] = useState(0)
  useEffect(() => {
    let active = true
    const refresh = () => setCheck(value => value + 1)
    window.addEventListener('focus', refresh)
    if (!isWorkbenchUrl(location.href)) setExtension('unsupported')
    else {
      setExtension('checking')
      void extensionRequest('ping').then(() => { if (active) setExtension('connected') }).catch(() => { if (active) setExtension('missing') })
    }
    return () => { active = false; window.removeEventListener('focus', refresh) }
  }, [check])
  const agentLabel = connected ? '已连接' : connectionError ? '连接中断' : '未连接'
  const extensionLabel = { checking: '检测中', connected: '已连接', missing: '未连接', unsupported: '当前地址不支持' }[extension]
  return <details className="border-b border-line px-4 py-3 text-[12px] sm:px-7">
    <summary className="cursor-pointer text-text-secondary">运行状态 <span className="ml-3 text-text-tertiary">执行器{agentLabel} · 扩展{extensionLabel}</span></summary>
    <dl className="mb-0 mt-4 grid gap-3 sm:grid-cols-3">
      <div><dt className="font-medium">网页 · 已打开</dt><dd className="ml-0 mt-1 text-text-secondary">简历和清单保存在当前浏览器。</dd></div>
      <div><dt className="font-medium">本机执行器 · {agentLabel}</dt><dd className="ml-0 mt-1 text-text-secondary">读取官网、发送邮件时使用。<button type="button" className="ml-1 text-accent underline" onClick={onConnect}>{connected ? '连接设置' : '连接本机'}</button></dd></div>
      <div><dt className="font-medium">官网填写扩展 · {extensionLabel}</dt><dd className="ml-0 mt-1 text-text-secondary">{extension === 'unsupported' ? '请使用本机 3000 / 3107 端口。' : '解压扩展包后，在 Chrome / Edge 开发者模式中加载，再刷新本页。'}<div className="mt-2 flex gap-3"><a className="text-accent underline" href="/generated/website-extension.zip" download>下载扩展</a><button type="button" className="underline disabled:opacity-40" disabled={extension === 'checking'} onClick={() => setCheck(value => value + 1)}>重新检测</button></div></dd></div>
    </dl>
    {!connected && <p className="mb-0 mt-4 text-text-secondary">启动网页和执行器：<code>npm run dev:local</code>。将终端连接码填入“连接本机”；只检查简历时无需连接。</p>}
  </details>
}
