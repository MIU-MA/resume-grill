'use client'
import { useRef, useState } from 'react'
import { Button } from '@/components/ui/Button'
import { bossRequest, parseBossConnection, rememberBossConnection, type BossConnection, type BossStatus } from './lib/boss-client'

export function BossBrowserConnection({ connection, status, busy, onConnection, onStatus, onCommand }: { connection: BossConnection | null; status: BossStatus | null; busy: boolean; onConnection: (value: BossConnection) => void; onStatus: (value: BossStatus | null) => void; onCommand: (action: () => Promise<void>) => Promise<void> }) {
  const [link, setLink] = useState('')
  const [pending, setPending] = useState(false)
  const lock = useRef(false)
  const browserName = status?.backend === 'ego' ? 'ego' : 'Chrome'
  const phase = status?.phase
  const chromeConnected = status?.browserConnected ?? ['selecting', 'opening', 'preparing', 'connected', 'closed'].includes(phase ?? '')
  const waiting = phase === 'awaiting-permission' || phase === 'preparing' || phase === 'opening'
  const disabled = busy || pending || waiting
  const label = !connection ? '尚未连接本机执行器' : status?.ready ? 'BOSS 页面已连接' : phase === 'awaiting-permission' ? `等待 ${browserName} 授权` : phase === 'opening' ? '正在打开 BOSS 招聘页' : phase === 'preparing' ? '正在读取所选页面' : chromeConnected ? phase === 'closed' ? `${browserName} 已连接 · 所选页面已关闭` : `${browserName} 已连接 · 选择 BOSS 页面` : phase === 'error' ? `${browserName} 连接未完成` : status ? `尚未连接 ${browserName}` : '正在读取本机执行器状态'
  const command = async (path: string, body: unknown = {}) => {
    if (!connection || lock.current) return
    lock.current = true; setPending(true)
    try { await onCommand(async () => { await bossRequest(connection, path, body); onStatus(await bossRequest<BossStatus>(connection, '/status')) }) }
    finally { lock.current = false; setPending(false) }
  }
  return <section className="border border-line p-4" aria-label="浏览器连接">
    <div className="flex flex-wrap items-center gap-3"><strong className="text-label" role="status">{label}</strong>
      {connection && status && !chromeConnected && <Button variant="secondary" disabled={disabled} onClick={() => void command('/connect')}>{pending || phase === 'awaiting-permission' ? '等待连接完成' : phase === 'error' ? `重试连接 ${browserName}` : `连接 ${browserName}`}</Button>}
      {chromeConnected && <><Button variant="secondary" disabled={disabled} onClick={() => void command('/refresh-tabs')}>刷新页面列表</Button>{!status?.ready && <Button variant="secondary" disabled={disabled} onClick={() => void command('/open-boss')}>打开 BOSS 官网</Button>}<Button variant="link" disabled={disabled} onClick={() => void command('/disconnect')}>断开 {browserName}</Button></>}
    </div>
    {phase === 'awaiting-permission' && status?.backend !== 'ego' && <p className="mt-3 text-body text-text-secondary">请在 Chrome 的“允许远程调试”弹窗中手动点允许。开启调试后，每次建立连接仍需要浏览器授权；这里会等待，不会反复发起请求。</p>}
    {chromeConnected && phase === 'selecting' && <div className="mt-3 space-y-2">{status?.tabs.length ? status.tabs.map(tab => <Button key={tab.id} variant="secondary" disabled={disabled} onClick={() => void command('/select', { id: tab.id })}>{tab.title || 'BOSS 页面'}</Button>) : <p className="text-body text-text-secondary">当前没有 BOSS 页面。点击“打开 BOSS 官网”即可，无需手动输入网址或重新连接。</p>}</div>}
    {chromeConnected && phase === 'closed' && <p className="mt-3 text-body text-text-secondary">所选页面已关闭。点击刷新页面列表后，可重新选择已有 BOSS 页面。</p>}
    <details className="mt-3 text-label" open={!connection || phase === 'error'}><summary className="cursor-pointer text-text-secondary">连接设置</summary><p className="my-3 text-body">本机服务：<code>npm run boss:ego</code>（ego 独立空间）或 <code>npm run boss:preview</code>（Chrome）。打开终端输出的工作台链接。{status?.backend === 'ego' ? 'ego 会在独立任务空间打开 BOSS；首次登录请在 ego 完成。' : status && <>Chrome 需要在 <code>chrome://inspect/#remote-debugging</code> 开启远程调试并手动授权。</>}</p><div className="flex gap-2"><input aria-label="本机连接链接" type="password" autoComplete="off" value={link} className="min-w-0 flex-1 border border-line bg-surface px-3 py-2 text-body" placeholder="粘贴本次服务输出的工作台链接" onChange={event => setLink(event.target.value)} /><Button variant="secondary" disabled={disabled || !link} onClick={() => void onCommand(async () => { const value = parseBossConnection(link); rememberBossConnection(value); onConnection(value); onStatus(null); setLink('') })}>连接本机</Button></div></details>
  </section>
}
