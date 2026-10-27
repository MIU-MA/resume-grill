'use client'

import { useEffect, useState } from 'react'
import { isWorkbenchUrl } from '@/domain/website-automation'
import { extensionRequest } from './website-automation'

export function LocalSetupStatus({ connected, connectionError, onConnect }: { connected: boolean; connectionError: string; onConnect: () => void }) {
  const [extension, setExtension] = useState<'checking' | 'connected' | 'missing' | 'unsupported'>('checking')
  const [check, setCheck] = useState(0)
  const [extensionError, setExtensionError] = useState('')
  useEffect(() => {
    let active = true
    const refresh = () => setCheck(value => value + 1)
    const ready = (event: MessageEvent) => {
      if (event.source === window && event.origin === location.origin && event.data?.channel === 'resume-grill.website.ready' && event.data.url === location.href) refresh()
    }
    window.addEventListener('focus', refresh)
    window.addEventListener('message', ready)
    if (!isWorkbenchUrl(location.href)) setExtension('unsupported')
    else {
      setExtension('checking')
      setExtensionError('')
      void extensionRequest('ping').then(() => { if (active) setExtension('connected') }).catch(error => { if (active) { setExtension('missing'); setExtensionError(error instanceof Error ? error.message : '扩展连接失败，请刷新工作台后重试。') } })
    }
    return () => { active = false; window.removeEventListener('focus', refresh); window.removeEventListener('message', ready) }
  }, [check])
  const agentLabel = connected ? '已连接' : connectionError ? '连接中断' : '未连接'
  const extensionLabel = { checking: '检测中', connected: '已连接', missing: '未连接', unsupported: '当前地址不支持' }[extension]
  return <details className="border-b border-line px-4 py-3 text-[12px] sm:px-7">
    <summary className="cursor-pointer text-text-secondary">运行状态 <span className="ml-3 text-text-tertiary">执行器{agentLabel} · 扩展{extensionLabel}</span></summary>
    <dl className="mb-0 mt-4 grid gap-3 sm:grid-cols-3">
      <div><dt className="font-medium">网页 · 已打开</dt><dd className="ml-0 mt-1 text-text-secondary">简历和清单保存在当前浏览器。</dd></div>
      <div><dt className="font-medium">本机执行器 · {agentLabel}</dt><dd className="ml-0 mt-1 text-text-secondary">读取官网、发送邮件时使用。<button type="button" className="ml-1 text-accent underline" onClick={onConnect}>{connected ? '连接设置' : '连接本机'}</button></dd></div>
      <div><dt className="font-medium">官网填写扩展 · {extensionLabel}</dt><dd className="ml-0 mt-1 text-text-secondary">{extension === 'unsupported' ? '请使用 HTTP localhost / 127.0.0.1 的 3000 / 3107 端口。' : extensionError || (extension === 'connected' ? '已能接收官网填写任务。' : '正在检查网页与扩展通信。')}<div className="mt-2 flex gap-3"><a className="text-accent underline" href="/generated/website-extension.zip" download>下载扩展</a><button type="button" className="underline disabled:opacity-40" disabled={extension === 'checking'} onClick={() => setCheck(value => value + 1)}>重新检测</button>{extension === 'missing' && <button type="button" className="underline" onClick={() => window.location.reload()}>刷新工作台</button>}</div></dd></div>
    </dl>
    {!connected && <p className="mb-0 mt-4 text-text-secondary">启动网页和执行器：<code>npm run dev:local</code>。将终端连接码填入“连接本机”；只检查简历时无需连接。</p>}
  </details>
}
