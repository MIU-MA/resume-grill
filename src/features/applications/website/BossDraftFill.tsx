'use client'
import { useEffect, useState, useRef } from 'react'
import { Button } from '@/components/ui/Button'
import type { BossDraftPreview, BossDraftResult } from '@/domain/boss-draft'
import { bossRequest, type BossConnection } from './lib/boss-client'
export function BossDraftFill({ connection, connected, disabled, company, title, url, text, onBusy, browserName = 'Chrome' }: { connection: BossConnection | null; connected: boolean; disabled: boolean; company: string; title: string; url: string; text: string; browserName?: string; onBusy: (busy: boolean) => void }) {
  const version = useRef(0)
  const [open, setOpen] = useState(false)
  const [preview, setPreview] = useState<BossDraftPreview | null>(null)
  const [confirmed, setConfirmed] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)
  const [working, setWorking] = useState(false)
  useEffect(() => { const current = ++version.current; setPreview(null); setConfirmed(false); setDone(false); setError(''); return () => { version.current = current + 1 } }, [text, url, connection, connected])
  useEffect(() => {
    if (!preview) return
    const timer = setTimeout(() => { setPreview(null); setConfirmed(false); setError('会话核对已过期，请重新检查输入框。') }, Math.max(0, preview.expiresAt - Date.now()))
    return () => clearTimeout(timer)
  }, [preview])
  const perform = async (action: () => Promise<void>) => {
    if (!connection || working) return
    setWorking(true); onBusy(true); setError('')
    try { await action() } catch (failure) { setPreview(null); setConfirmed(false); setError(failure instanceof Error ? failure.message : '填写失败') }
    finally { setWorking(false); onBusy(false) }
  }
  const inactive = disabled || working || !connected || !connection
  return <div className="mt-3 border-t border-line pt-3">
    <Button variant="secondary" disabled={inactive || !text.trim() || !company || !title} onClick={() => { setPreview(null); setConfirmed(false); setOpen(value => !value) }}>填入已有会话</Button>
    {open && <section className="mt-3 space-y-3 text-body" aria-label={`${title}会话填写`}>
      <p className="text-text-secondary">在 {browserName} 手动选好已有会话。这里只填招呼语，不点击沟通、发送或上传。</p>
      <Button variant="link" disabled={inactive} onClick={() => void perform(async () => { if (!connection) return; setPreview(null); setConfirmed(false); await bossRequest(connection, '/open-existing-chats', {}) })}>打开已有沟通</Button>
      <Button variant="secondary" disabled={inactive} onClick={() => void perform(async () => { if (!connection) return; const current = version.current; const result = await bossRequest<BossDraftPreview>(connection, '/draft-preview', { company, title, url, text }); if (current !== version.current) return; setPreview(result); setConfirmed(false); setDone(false) })}>检查当前输入框</Button>
      {preview && <><p>待填写岗位：<strong>{preview.company} · {preview.title}</strong></p><p className="text-label text-text-secondary">{preview.state.conversation ? `${browserName} 当前会话：${preview.state.conversation}` : `未自动识别会话名称，请在 ${browserName} 人工核对收件人。`}</p><label className="flex items-start gap-2"><input type="checkbox" checked={confirmed} disabled={inactive} onChange={event => setConfirmed(event.target.checked)} /><span>我已确认 {browserName} 当前会话对应上面的公司和岗位，只填写草稿。</span></label><Button disabled={inactive || !confirmed} onClick={() => void perform(async () => { if (!connection) return; const result = await bossRequest<BossDraftResult>(connection, '/fill-draft', { id: preview.id, confirmed: true }); setPreview(null); setConfirmed(false); if (!result.written) throw new Error(`文字未能稳定保留，请到 ${browserName} 检查。`); setDone(true) })}>填写到 {browserName}，不发送</Button></>}
      {done && <p role="status">已填入 {browserName} 并读回核对，尚未发送。请在 {browserName} 检查后自行决定是否发送。</p>}
      {error && <p role="alert" className="text-danger">{error}</p>}
    </section>}
  </div>
}
