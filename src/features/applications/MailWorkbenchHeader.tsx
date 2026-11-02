'use client'

import { Pause, Play } from 'lucide-react'
import { Button } from '@/components/ui/Button'

/** One title row for the job list, AI search, applications and history routes. */
export function MailWorkbenchHeader({ isJobs, isCareers, tab, connected, connectionError, running, paused, pending, draftsCount, entriesCount, busy, fatalError, senderReady, onOpenStatus, onQueue }: {
  isJobs: boolean
  isCareers: boolean
  tab: 'drafts' | 'history'
  connected: boolean
  connectionError: string
  running: boolean
  paused: boolean
  pending: number
  draftsCount: number
  entriesCount: number
  busy: boolean
  fatalError?: string
  senderReady: boolean
  onOpenStatus: () => void
  onQueue: () => void
}) {
  const title = isJobs ? '职位清单' : isCareers ? 'AI 找岗位' : tab === 'history' ? '投递记录' : '投递清单'
  return <>
    <h1 className="m-0 whitespace-nowrap text-title font-semibold">{title}</h1>
    <button type="button" className="flex items-center gap-1.5 text-meta text-text-secondary hover:text-text-primary" onClick={onOpenStatus} title="查看运行状态与连接设置"><i className={`size-2 rounded-full ${connected ? connectionError ? 'bg-warning' : 'bg-success' : 'bg-line-strong'}`} />{connected ? connectionError ? '连接中断' : '已连接' : '未连接'}</button>
    {!isJobs && !isCareers && tab === 'history' && (pending > 0 || running) && <div className="flex items-center gap-2 text-meta text-text-secondary">
      <span className="max-sm:hidden">{running ? (paused ? '完成当前邮件后暂停' : '正在发送') : `待继续 ${pending} 封`}</span>
      <Button variant="secondary" className="h-7 px-2 text-label" disabled={busy || !senderReady || !!fatalError} onClick={onQueue}>{running ? <Pause size={12} /> : <Play size={12} />}{running ? '暂停' : '继续发送'}</Button>
    </div>}
    {!isJobs && !isCareers && <span className="ml-auto min-w-0 truncate text-meta text-text-tertiary max-sm:hidden">{tab === 'history' ? `${entriesCount} 条记录` : `${draftsCount} 个待投递 · ${entriesCount} 条记录`}</span>}
  </>
}
