'use client'

import { useMemo, useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { useSessionState } from '@/hooks/use-session-state'
import { APPLICATION_STAGES, type ApplicationProgress, type ApplicationStage } from '@/domain/application-progress'
import { applicationEntryChannel, applicationEntryChannelKey, applicationEntryStatus, applicationEntrySearchText, applicationEntryStage, applicationEntryTitle, type ApplicationEntry } from './lib/application-entry'
import { ApplicationEntryDetail } from './ApplicationEntryDetail'
import { savedDay } from '../mail/lib/mail-presentation'
import { ApplicationBoard } from './ApplicationBoard'

type ChannelFilter = 'all' | 'mail' | 'website' | 'referral' | 'other' | 'manual'

export function ApplicationHistoryView({ entries, progress, selectedId, loading = false, disabled = false, onSelect, onAdd, onEdit, onDelete, onSaveProgress, onMailAction, onReturnToDrafts, onPrepare, canPrepare }: {
  onPrepare?: (entry: ApplicationEntry) => void
  canPrepare?: (entry: ApplicationEntry) => boolean
  entries: ApplicationEntry[]
  progress: Record<string, ApplicationProgress>
  selectedId: string | null
  loading?: boolean
  disabled?: boolean
  onSelect: (id: string) => void
  onAdd: () => void
  onEdit: (entry: ApplicationEntry) => void
  onDelete: (entry: ApplicationEntry) => void
  onSaveProgress: (id: string, changes: Partial<Omit<ApplicationProgress, 'events' | 'updatedAt'>>) => Promise<void>
  onMailAction: (entry: ApplicationEntry, action: 'retry' | 'cancel' | 'confirm-sent') => void
  onReturnToDrafts: (entry: ApplicationEntry) => void
}) {
  const [detailOpen, setDetailOpen] = useState(false)
  const [view, setView] = useSessionState<'list' | 'board'>('application-history-view', 'list', (value): value is 'list' | 'board' => value === 'list' || value === 'board')
  const [query, setQuery] = useSessionState('applications-query', '', (value): value is string => typeof value === 'string')
  const [stage, setStage] = useSessionState<ApplicationStage | ''>('applications-stage', '', (value): value is ApplicationStage | '' => value === '' || typeof value === 'string' && value in APPLICATION_STAGES)
  const [channel, setChannel] = useSessionState<ChannelFilter>('applications-channel', 'all', (value): value is ChannelFilter => value === 'all' || value === 'mail' || value === 'website' || ['manual', 'referral', 'other'].includes(String(value)))
  const visible = useMemo(() => {
    const term = query.trim().toLowerCase()
    return entries.filter(entry => {
      if (channel === 'manual' ? entry.kind !== 'manual' : channel !== 'all' && applicationEntryChannelKey(entry) !== channel) return false
      if (stage && applicationEntryStage(entry, progress[entry.id]) !== stage) return false
      return !term || applicationEntrySearchText(entry).includes(term)
    })
  }, [channel, entries, progress, query, stage])
  const selected = visible.find(entry => entry.id === selectedId) ?? visible[0] ?? null
  const filtered = !!query.trim() || !!stage || channel !== 'all'
  if (view === 'board') return <section className="flex min-h-0 flex-1 flex-col"><header className="flex gap-4 border-b border-line bg-white p-3"><strong>投递漏斗</strong><button onClick={() => setView('list')}>返回记录列表</button></header><ApplicationBoard entries={entries} progress={progress} onSelect={id => { onSelect(id); setQuery(''); setStage(''); setChannel('all'); setView('list'); setDetailOpen(true) }} /></section>
  return <section className="flex min-h-0 flex-1 flex-col bg-surface" aria-label="投递记录">
    <div className="flex flex-none flex-wrap items-center gap-2 border-b border-line px-4 py-3 sm:px-5">
      <button className="h-9 px-3 text-label" onClick={() => setView('board')}>看板</button>
      <label className="relative min-w-[180px] flex-1 sm:max-w-[360px]">
        <input className="mail-input h-9 w-full" aria-label="搜索投递记录" placeholder="搜索公司、岗位、邮箱或链接" value={query} onChange={event => setQuery(event.target.value)} />
      </label>
      <select className="mail-input h-9 w-auto min-w-[120px]" aria-label="按进展筛选" value={stage} onChange={event => setStage(event.target.value as ApplicationStage | '')}>
        <option value="">全部进展</option>
        {Object.entries(APPLICATION_STAGES).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
      </select>
      <div className="flex items-center border border-line bg-white p-0.5" role="group" aria-label="按渠道筛选">
        {([['all', '全部'], ['mail', '邮件'], ['website', '官网'], ['referral', '内推'], ['other', '其他']] as const).map(([key, label]) => <button key={key} type="button" aria-pressed={channel === key} className={`h-7 px-2.5 text-label ${channel === key ? 'bg-brand text-white' : 'text-text-secondary hover:bg-surface-hover'}`} onClick={() => setChannel(key)}>{label}</button>)}
      </div>
      <span className="ml-auto text-meta text-text-tertiary">{visible.length} / {entries.length} 条</span>
      <Button className="h-9 px-3 text-label" disabled={disabled || loading} onClick={onAdd}><Plus size={14} />登记投递</Button>
    </div>

    <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)_minmax(360px,440px)] max-[1080px]:block max-[1080px]:overflow-y-auto">
      <div className={`min-h-0 overflow-y-auto max-[1080px]:overflow-visible ${detailOpen && selected ? 'max-[1080px]:hidden' : ''}`}>
        <div className="sticky top-0 z-10 grid grid-cols-[minmax(0,1fr)_86px_104px_116px_36px] items-center gap-2 border-b border-line bg-surface-soft px-4 py-2 text-meta text-text-tertiary max-[760px]:grid-cols-[minmax(0,1fr)_86px_36px]">
          <span>公司 / 岗位</span><span>渠道</span><span className="max-[760px]:hidden">当前状态</span><span className="max-[760px]:hidden">记录时间</span><span aria-hidden="true" />
        </div>
        {loading ? <p className="px-4 py-10 text-body text-text-tertiary">正在读取投递记录…</p> : visible.length === 0 ? <div className="px-4 py-12 text-center">
          <p className="m-0 text-body font-medium">{filtered ? '没有符合筛选的记录' : '还没有投递记录'}</p>
          <p className="mx-auto mt-2 max-w-md text-body leading-relaxed text-text-tertiary">{filtered ? '换一个关键词，或清除筛选。' : '官网直投、内推或没有草稿的投递，可以手动登记在这里。'}</p>
          <div className="mt-4 flex justify-center gap-2">{filtered && <Button variant="secondary" onClick={() => { setQuery(''); setStage(''); setChannel('all') }}>清除筛选</Button>}<Button disabled={disabled || loading} onClick={onAdd}><Plus size={14} />登记投递</Button></div>
        </div> : <div className="divide-y divide-line">
          {visible.map(entry => {
            const status = applicationEntryStatus(entry, progress[entry.id])
            return <div key={entry.id} data-selected={entry.id === selected?.id} className="grid grid-cols-[minmax(0,1fr)_86px_104px_116px_36px] items-center gap-2 border-l-2 border-l-transparent px-4 py-3 data-[selected=true]:border-l-brand data-[selected=true]:bg-brand-soft max-[760px]:grid-cols-[minmax(0,1fr)_86px_36px]">
              <button type="button" className="min-w-0 text-left" aria-expanded={entry.id === selected?.id && detailOpen} onClick={() => { onSelect(entry.id); setDetailOpen(true) }}>
                <strong className="block truncate text-label font-semibold">{entry.company}</strong>
                <span className="mt-0.5 block truncate text-label text-text-secondary">{entry.role || '岗位待补充'}</span>
                <span className="mt-1 block truncate text-meta text-text-tertiary">{entry.contact || entry.sourceUrl || applicationEntryTitle(entry)}</span><span className="mt-1 block text-meta text-text-secondary min-[761px]:hidden">{status.label} · {savedDay(entry.appliedAt)}</span>
              </button>
              <span className="truncate text-label text-text-secondary">{applicationEntryChannel(entry)}</span>
              <span className="max-[760px]:hidden"><span className="workbench-status" data-tone={status.tone}>{status.label}</span></span>
              <span className="text-meta text-text-tertiary max-[760px]:hidden">{savedDay(entry.appliedAt)}</span>
              <button type="button" className="grid size-8 place-items-center justify-self-end text-text-tertiary hover:text-danger" aria-label={`${entry.kind === 'mail' ? '隐藏' : '删除'} ${applicationEntryTitle(entry)}`} disabled={disabled} onClick={event => { event.stopPropagation(); onDelete(entry) }}><Trash2 size={14} /></button>
            </div>
          })}
        </div>}
      </div>

      <aside className={`min-h-0 overflow-y-auto border-l border-line bg-white max-[1080px]:overflow-visible max-[1080px]:border-l-0 ${detailOpen && selected ? '' : 'max-[1080px]:hidden'}`} aria-label="投递详情">
        <div className="border-b border-line px-5 py-3 min-[1081px]:hidden"><Button variant="link" onClick={() => setDetailOpen(false)}>← 返回记录列表</Button></div>
        {selected ? <ApplicationEntryDetail
          entry={selected}
          progress={progress[selected.id]}
          disabled={disabled}
          onEdit={() => onEdit(selected)}
          onPrepare={onPrepare ? () => onPrepare(selected) : undefined}
          canPrepare={canPrepare?.(selected)}
          onDelete={() => onDelete(selected)}
          onSaveProgress={changes => onSaveProgress(selected.id, changes)}
          onMailAction={(_job, action) => onMailAction(selected, action)}
          onReturnToDrafts={selected.kind === 'website' ? () => onReturnToDrafts(selected) : undefined}
        /> : <div className="px-6 py-12 text-center"><p className="m-0 text-body font-medium">选择一条记录查看详情</p><p className="mt-2 text-body text-text-tertiary">可以查看进展、补充备注，或编辑手动登记的投递。</p></div>}
      </aside>
    </div>
  </section>
}
