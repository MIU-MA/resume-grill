'use client'

import { useEffect, useMemo, useRef, useState, useId } from 'react'
import { Button } from '@/components/ui/Button'
import type { BossConnection } from './lib/boss-client'

// The isolated frame receives image bytes, never browser credentials or website HTML.
function bossPreviewDocument(id: string) {
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="referrer" content="no-referrer"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src blob:; style-src 'unsafe-inline'; script-src 'unsafe-inline'"><style>html,body{margin:0;background:#f5f5f4}img{display:block;width:100%;height:auto}p{font:14px sans-serif;padding:16px;color:#666}</style></head><body><p id="empty">等待浏览器画面…</p><img alt="BOSS 官网当前画面"><script>
  let current, pending;
  const image=document.querySelector('img');
  addEventListener('message',event=>{
    if(event.source!==parent||event.data?.id!==${JSON.stringify(id)}||!(event.data.frame instanceof Blob)||event.data.frame.type!=='image/jpeg')return;
    if(pending)URL.revokeObjectURL(pending);
    const next=pending=URL.createObjectURL(event.data.frame);
    image.onload=()=>{if(current)URL.revokeObjectURL(current);current=next;pending=null;document.querySelector('#empty').hidden=true};
    image.src=next;
  });
  </script></body></html>`
}

export function BossLivePreview({ connection, connected }: { connection: BossConnection | null; connected: boolean }) {
  const frame = useRef<HTMLIFrameElement>(null)
  const id = useId()
  const source = useMemo(() => bossPreviewDocument(id), [id])
  const [loaded, setLoaded] = useState(false)
  const [playing, setPlaying] = useState(false)
  const [visible, setVisible] = useState(true)
  const [error, setError] = useState('')
  const [updated, setUpdated] = useState(false)
  const ready = connected && !!connection
  useEffect(() => {
    if (ready) return
    setPlaying(false)
    setLoaded(false)
    setUpdated(false)
    setError('')
  }, [ready])
  useEffect(() => {
    const update = () => setVisible(document.visibilityState !== 'hidden')
    update(); document.addEventListener('visibilitychange', update)
    return () => document.removeEventListener('visibilitychange', update)
  }, [])
  useEffect(() => {
    if (!playing || !connected || !connection || !loaded || !visible) return
    const controller = new AbortController()
    let timer: ReturnType<typeof setTimeout>
    const next = async () => {
      try {
        const response = await fetch(connection.origin + '/live-frame', {
          headers: { Authorization: `Bearer ${connection.token}` }, credentials: 'omit',
          referrerPolicy: 'no-referrer', cache: 'no-store',
          signal: AbortSignal.any([controller.signal, AbortSignal.timeout(20000)]),
        })
        if (!response.ok) {
          const failure = await response.json()
          if (response.status === 409 && failure.code === 'FRAME_SWITCH') {
            if (!controller.signal.aborted) timer = setTimeout(next, 1000)
            return
          }
          throw new Error(failure.error || '画面读取失败')
        }
        if (!response.headers.get('Content-Type')?.startsWith('image/jpeg')) throw new Error('画面格式无效，请更新本机浏览器服务。')
        const blob = await response.blob()
        if (controller.signal.aborted) return
        frame.current?.contentWindow?.postMessage({ id, frame: blob }, '*')
        setUpdated(true); setError('')
        timer = setTimeout(next, 1000)
      } catch (failure) {
        if (controller.signal.aborted) return
        setError(failure instanceof Error ? failure.message : '画面读取失败')
        setPlaying(false)
      }
    }
    void next()
    return () => { controller.abort(); clearTimeout(timer) }
  }, [connection, connected, id, loaded, playing, visible])

  return <section className="border border-line" aria-label="浏览器实时画面">
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-3"><div><h2 className="text-section font-medium">官网画面</h2><p role="status" className="mt-1 text-meta text-text-secondary">{!ready ? '未连接 · 已停止更新' : error ? '更新中断' : playing ? !visible ? '标签页不可见 · 暂停更新' : updated ? '正在更新 · 约每秒一帧' : '正在读取画面…' : updated ? '已暂停 · 显示最后一帧' : '点击开始预览'}</p></div><Button variant="secondary" disabled={!ready} onClick={() => { setError(''); setPlaying(value => !value) }}>{playing ? '暂停画面' : '开始预览'}</Button></div>
    {error && <p role="alert" className="p-3 text-body text-danger">{error}。更新已停止，可点击开始预览重试。</p>}
    <div className="relative h-80 overflow-hidden lg:h-96">{ready
      ? <iframe ref={frame} title="BOSS 官网实时画面（只读）" sandbox="allow-scripts" referrerPolicy="no-referrer" srcDoc={source} className="h-full w-full border-0" onLoad={() => setLoaded(true)} />
      : <div className="absolute inset-0 grid place-items-center bg-surface text-body text-text-secondary">连接 BOSS 页面后可查看画面</div>}</div>
    <p className="border-t border-line px-4 py-2 text-meta text-text-tertiary">当前连接页面的实时画面。暂停预览不会中断连接或后台任务。</p>
  </section>
}
