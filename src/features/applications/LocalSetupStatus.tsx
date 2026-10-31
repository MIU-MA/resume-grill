'use client'

import { useEffect, useState } from 'react'
import { isWorkbenchUrl } from '@/domain/website-automation'
import { extensionRequest } from './website-automation'
import { extensionConnectionReport, type ExtensionConnectionProgress } from './website-extension-connection'

export function LocalSetupStatus({ connected, connectionError, onConnect }: { connected: boolean; connectionError: string; onConnect: () => void }) {
  const [extension, setExtension] = useState<'checking' | 'connected' | 'missing' | 'unsupported'>('checking')
  const [check, setCheck] = useState(0)
  const [extensionError, setExtensionError] = useState('')
  const [extensionVersion, setExtensionVersion] = useState('')
  const [trace, setTrace] = useState<ExtensionConnectionProgress[]>([])
  const [copyResult, setCopyResult] = useState('')
  const [address, setAddress] = useState('')
  useEffect(() => {
    let active = true
    const controller = new AbortController()
    setAddress(`${location.origin}${location.pathname}`)
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
      setExtensionVersion('')
      setTrace([]); setCopyResult('')
      void extensionRequest<{ extensionVersion?: string }>('ping', undefined, { signal: controller.signal, onProgress: progress => {
        if (!active) return
        setTrace(current => current.at(-1)?.detail === progress.detail ? current : [...current.slice(-11), progress])
        if (progress.extensionVersion) setExtensionVersion(progress.extensionVersion)
      } }).then(result => { if (active) { setExtension('connected'); setExtensionVersion(result?.extensionVersion ?? '') } }).catch(error => { if (active) { setExtension('missing'); setExtensionError(error instanceof Error ? error.message : '扩展连接失败，请刷新工作台后重试。') } })
    }
    return () => { active = false; controller.abort(); window.removeEventListener('focus', refresh); window.removeEventListener('message', ready) }
  }, [check])
  const agentLabel = connected ? '已连接' : connectionError ? '连接中断' : '未连接'
  const extensionLabel = { checking: '检测中', connected: '已连接', missing: '未连接', unsupported: '当前地址不支持' }[extension]
  return <details open={extension === 'missing' || undefined} className="border-b border-line px-4 py-3 text-[12px] sm:px-7">
    <summary className="cursor-pointer text-text-secondary">运行状态 <span className="ml-3 text-text-tertiary">执行器{agentLabel} · 扩展{extensionLabel}</span></summary>
    <dl className="mb-0 mt-4 grid gap-3 sm:grid-cols-3">
      <div><dt className="font-medium">网页 · 已打开</dt><dd className="ml-0 mt-1 text-text-secondary">简历和清单保存在当前浏览器。</dd></div>
      <div><dt className="font-medium">本机执行器 · {agentLabel}</dt><dd className="ml-0 mt-1 text-text-secondary">读取官网、发送邮件时使用。<button type="button" className="ml-1 text-accent underline" onClick={onConnect}>{connected ? '连接设置' : '连接本机'}</button></dd></div>
      <div><dt className="font-medium">官网填写扩展 · {extensionLabel}{extensionVersion && ` · v${extensionVersion}`}</dt><dd className="ml-0 mt-1 text-text-secondary">
        <span role={extension === 'missing' ? 'alert' : 'status'}>{extension === 'unsupported' ? '请使用 HTTP localhost / 127.0.0.1 的 3000 / 3107 端口。' : extensionError || (extension === 'connected' ? '已能接收官网填写任务。' : '正在检查网页与扩展通信。')}</span>
        {!!trace.length && <ol aria-label="扩展连接检查" className="my-2 space-y-1 pl-4">{trace.filter(item => item.step !== 'error').map((item, index) => <li key={index}>{item.detail}</li>)}</ol>}
        <div className="mt-2 flex flex-wrap gap-3"><a className="text-accent underline" href="/generated/website-extension.zip" download>下载扩展</a><button type="button" className="underline disabled:opacity-40" disabled={extension === 'checking'} onClick={() => setCheck(value => value + 1)}>重新检测</button>{extension === 'missing' && <button type="button" className="underline" onClick={() => window.location.reload()}>刷新工作台</button>}
          {!!trace.length && <button type="button" className="underline" onClick={() => {
            const report = extensionConnectionReport(address, trace)
            if (!navigator.clipboard) { setCopyResult('无法自动复制，请选中下方信息复制。'); return }
            void navigator.clipboard.writeText(report).then(() => setCopyResult('已复制诊断信息。')).catch(() => setCopyResult('无法自动复制，请选中下方信息复制。'))
          }}>复制诊断信息</button>}
        </div>
        {copyResult && <p role="status" className="my-2">{copyResult}</p>}
        {copyResult.startsWith('无法') && <textarea readOnly aria-label="扩展连接诊断信息" className="mt-2 h-40 w-full border border-line p-2" value={extensionConnectionReport(address, trace)} />}
      </dd></div>
    </dl>
    {!connected && <p className="mb-0 mt-4 text-text-secondary">启动网页和执行器：<code>npm run dev:local</code>。将终端连接码填入“连接本机”；只检查简历时无需连接。</p>}
  </details>
}
