'use client'

import { useEffect, useRef, useState } from 'react'
import { get, set } from 'idb-keyval'
import { ArrowLeft, ExternalLink, Mail, Paperclip, Pause, Play, Plus, Settings, Trash2 } from 'lucide-react'
import type { Mode } from '@/application/types'
import { WorkbenchFrame } from '@/components/layout/WorkbenchFrame'
import { Button } from '@/components/ui/Button'
import { WorkspaceSidebar, type SidebarBadges } from '@/features/workspace/WorkspaceSidebar'
import { applicationTemplate, batchSchema, mailDraftSchema, MAIL_STATUS_LABELS, type CareerDiscovery, type CareerPage, type MailBatch, type MailJob } from '@/domain/mail-schema'
import { listResumeAttachments } from '@/lib/resume-library'
import { useSidebarCollapsed } from '@/hooks/use-sidebar-collapsed'
import { useMailAgent } from './use-mail-agent'
import { MailSettings } from './MailSettings'
import { MailPreview } from './MailPreview'
import { LinkImporter } from './LinkImporter'
import { DraftEditor } from './DraftEditor'
import { draftIssues, draftPayload, markWebsiteApplication, validResumeAttachment, websiteLinks, type Draft, type DraftField, type WebsiteApplication } from './draft-state'

type AttachmentSource = { id: string; updatedAt: number }
type LibraryAttachment = Awaited<ReturnType<typeof listResumeAttachments>>[number]
type DraftStore = { drafts: Draft[]; attachment: File | null; attachmentSource?: AttachmentSource; websiteApplications?: WebsiteApplication[] }
const STORAGE_KEY = 'mail-workbench:drafts:v1'
const MAIL_STATUS_TONES = {
  queued: 'info', sending: 'info', sent: 'success', failed: 'danger', uncertain: 'danger', cancelled: 'neutral',
} satisfies Record<MailJob['status'], 'info' | 'success' | 'danger' | 'neutral'>
function isJob(value: Draft | MailJob | WebsiteApplication): value is MailJob { return 'status' in value }
function isWebsite(value: Draft | MailJob | WebsiteApplication): value is WebsiteApplication { return 'channel' in value && value.channel === 'website' }
function savedDate(value: number) { return new Date(value).toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }) }

async function encodeAttachment(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(new Error('无法读取简历附件，请重新选择'))
    reader.onload = () => resolve(String(reader.result).split(',')[1])
    reader.readAsDataURL(file)
  })
}
function safeLink(value: string) {
  try { return new URL(value).protocol === 'https:' ? value : undefined } catch { return undefined }
}

export function MailWorkbench({ badges, onNavigate, onHome }: { badges: SidebarBadges; onNavigate: (mode: Mode) => void; onHome: () => void }) {
  const agent = useMailAgent()
  const [drafts, setDrafts] = useState<Draft[]>([])
  const [attachment, setAttachment] = useState<File | null>(null)
  const [attachmentSource, setAttachmentSource] = useState<AttachmentSource>()
  const [libraryAttachments, setLibraryAttachments] = useState<LibraryAttachment[]>([])
  const [libraryError, setLibraryError] = useState(false)
  const [websiteApplications, setWebsiteApplications] = useState<WebsiteApplication[]>([])
  const [attachmentOpen, setAttachmentOpen] = useState(false)
  const [focusRequest, setFocusRequest] = useState<{ field: DraftField; time: number } | null>(null)
  const [hydrated, setHydrated] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [tab, setTab] = useState<'drafts' | 'history'>('drafts')
  const [settingsOpen, setSettingsOpen] = useState<'agent' | 'sender' | null>(null)
  const [collapsed, toggleCollapsed] = useSidebarCollapsed()
  const [preview, setPreview] = useState<MailBatch | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const fileInput = useRef<HTMLInputElement>(null)
  const snapshot = agent.snapshot
  const jobs = snapshot?.jobs ?? []
  const history = [...jobs, ...websiteApplications].sort((a, b) => (isWebsite(b) ? b.appliedAt : b.updatedAt) - (isWebsite(a) ? a.appliedAt : a.updatedAt))
  const selected = tab === 'drafts' ? drafts.find(item => item.id === selectedId) ?? drafts[0] : history.find(item => item.id === selectedId) ?? history[0]
  const pending = jobs.filter(job => job.status === 'queued').length
  const readyDrafts = drafts.filter(draft => mailDraftSchema.safeParse(draftPayload(draft)).success)
  const websiteDrafts = drafts.filter(draft => websiteLinks(draft).length > 0)

  useEffect(() => {
    const name = snapshot?.sender?.name
    if (!name) return
    setDrafts(current => {
      let changed = false
      const next = current.map(draft => {
        if (!draft.automatic || !draft.company || !draft.role) return draft
        const text = applicationTemplate(name, draft.company, draft.role)
        if (text.subject === draft.subject && text.body === draft.body) return draft
        changed = true
        return { ...draft, ...text }
      })
      return changed ? next : current
    })
  }, [snapshot?.sender?.name, drafts])

  useEffect(() => {
    let active = true
    void Promise.allSettled([get<DraftStore>(STORAGE_KEY), listResumeAttachments()]).then(([savedResult, libraryResult]) => {
      if (!active) return
      if (savedResult.status === 'rejected') { setError('无法读取浏览器中的投递草稿，请检查浏览器存储权限后刷新。'); return }
      const saved = savedResult.value
      const library = libraryResult.status === 'fulfilled' ? libraryResult.value.filter(item => validResumeAttachment(item.file)) : []
      setLibraryError(libraryResult.status === 'rejected')
      setLibraryAttachments(library)
      if (saved) { setDrafts(saved.drafts); setWebsiteApplications(saved.websiteApplications ?? []) }
      if (saved?.attachment) {
        if (validResumeAttachment(saved.attachment)) { setAttachment(saved.attachment); setAttachmentSource(saved.attachmentSource) }
        else setError('原先选择的附件无法读取，请重新选择简历原文件。')
      } else {
        const current = library.find(item => item.current)
        if (current) { setAttachment(current.file); setAttachmentSource({ id: current.id, updatedAt: current.updatedAt }) }
      }
      setHydrated(true)
    })
    return () => { active = false }
  }, [])
  useEffect(() => {
    if (hydrated) void set(STORAGE_KEY, { drafts, attachment, attachmentSource, websiteApplications }).catch(() => setError('草稿未能保存到浏览器，刷新前请备份填写内容。'))
  }, [drafts, attachment, attachmentSource, websiteApplications, hydrated])
  useEffect(() => {
    if (!snapshot) return
    const submitted = new Set(snapshot.jobs.map(job => job.id))
    setDrafts(current => current.some(item => submitted.has(item.id)) ? current.filter(item => !submitted.has(item.id)) : current)
  }, [snapshot])

  const run = async (work: () => Promise<unknown>) => {
    setBusy(true); setError('')
    try { await work() } catch (e) { setError(e instanceof Error ? e.message : '操作失败') }
    finally { setBusy(false) }
  }
  const update = (change: Partial<Draft>) => {
    if (!selected || tab !== 'drafts') return
    setDrafts(items => items.map(item => item.id === selected.id ? {
      ...item, ...change,
      ...(('body' in change || 'subject' in change) ? { automatic: false } : {}),
      ...(('recipient' in change || 'sourceUrl' in change) ? { sourceConfirmed: false } : {}),
    } : item))
  }
  const addDraft = () => {
    if (drafts.length >= 20) { setError('每批最多 20 封，请先发送或移除当前草稿'); return }
    const draft: Draft = { id: crypto.randomUUID(), company: '', role: '', sourceUrl: '', recipient: '', subject: '', body: '', sourceConfirmed: false, automatic: true }
    setDrafts(items => [...items, draft]); setSelectedId(draft.id); setTab('drafts'); setFocusRequest({ field: 'company', time: Date.now() }); setError('')
  }
  const preparePreview = async () => {
    if (!snapshot?.sender) { setSettingsOpen('sender'); return }
    if (!attachment) { fileInput.current?.click(); throw new Error('请选择这批投递要附上的简历原文件') }
    const prepared = readyDrafts.map(draftPayload)
    const parsed = batchSchema.safeParse({ id: crypto.randomUUID(), sender: snapshot.sender, jobs: prepared, attachment: { name: attachment.name, base64: await encodeAttachment(attachment) } })
    if (!parsed.success) {
      const index = parsed.error.issues.find(issue => issue.path[0] === 'jobs')?.path[1]
      if (typeof index === 'number') setSelectedId(readyDrafts[index]?.id ?? null)
      const target = typeof index === 'number' ? readyDrafts[index] : undefined
      const missing = target ? [['公司', target.company], ['岗位', target.role], ['招聘邮箱', target.recipient], ['主题', target.subject], ['正文', target.body]].filter(([, value]) => !value.trim()).map(([label]) => label).join('、') : ''
      throw new Error(`请检查${typeof index === 'number' ? `第 ${index + 1} 个岗位` : '投递内容'}${missing ? `，还缺：${missing}` : '的邮箱、官网链接或附件格式'}。`)
    }
    setPreview(parsed.data)
  }
  const jobAction = async (job: MailJob, action: 'retry' | 'cancel' | 'confirm-sent') => {
    if (job.status === 'uncertain' && !window.confirm(action === 'confirm-sent' ? '已核对邮箱发信记录，确认这封邮件已经发出？' : '取消本条不会撤回邮件；如需再次投递，请先核实上次发送结果。继续取消？')) return
    await agent.command('/job', { id: job.id, action })
  }
  const selectItem = (item: Draft | MailJob | WebsiteApplication) => {
    setSelectedId(item.id)
    if (!isJob(item) && !isWebsite(item)) {
      const website = websiteLinks(item).length > 0
      const issue = draftIssues(item).find(value => !website || ['company', 'role', 'sourceUrl'].includes(value.field))
      setFocusRequest(issue ? { field: issue.field, time: Date.now() } : null)
    }
  }
  const markApplied = (draft: Draft, url: string) => {
    const record = markWebsiteApplication(draft, url, Date.now())
    setWebsiteApplications(items => [...items, record]); setDrafts(items => items.filter(item => item.id !== draft.id))
    setTab('history'); setSelectedId(record.id)
  }

  return <WorkbenchFrame className="flex">
    <WorkspaceSidebar mode="applications" collapsed={collapsed} onToggleCollapsed={toggleCollapsed} onNavigate={onNavigate} badges={badges} onOpenHistory={onHome} onOpenSettings={() => setSettingsOpen('sender')} variant="dock" />
    <main className="flex min-w-0 flex-1 flex-col">
      <header className="workspace-section-heading flex h-14 flex-none items-center gap-3 border-b border-line px-4 sm:px-5">
        <Button variant="ghost" className="size-8 p-0 md:hidden" aria-label="返回简历库" onClick={onHome}><ArrowLeft size={17} /></Button>
        <h1 className="m-0 whitespace-nowrap text-[16px] font-semibold">投递清单</h1>
        <span className="ml-auto min-w-0 truncate text-[12px] text-text-tertiary max-sm:hidden">{drafts.length} 个待处理 · {history.length} 条记录</span>
      </header>
      <div className="flex flex-none flex-wrap items-center gap-x-4 gap-y-2 border-b border-line bg-surface-soft px-4 py-2 sm:px-5">
        <input ref={fileInput} hidden type="file" accept=".pdf,.docx,.txt" onChange={event => {
          const file = event.target.files?.[0]
          if (file) {
            if (!validResumeAttachment(file)) setError('请选择 5 MB 以内的 PDF、DOCX 或 TXT 简历')
            else { setAttachment(file); setAttachmentSource(undefined); setError(''); setAttachmentOpen(false) }
          }
          event.target.value = ''
        }} />
        <button className="flex min-w-0 max-w-full items-center gap-1.5 text-[12px] text-text-secondary hover:text-text-primary" disabled={!hydrated || !!preview} title={attachment ? '更换本地简历附件' : '选择本地简历附件'} onClick={() => fileInput.current?.click()}><Paperclip size={14} className="shrink-0" /><span className="truncate" title={attachment?.name}>{attachment?.name ?? '选择简历附件'}</span><span className="shrink-0 text-text-tertiary">{attachmentSource ? `· ${savedDate(attachmentSource.updatedAt)} 版本` : attachment ? '· 更换' : ''}</span></button>
        <button className="text-[11px] text-text-tertiary hover:text-text-primary" disabled={!hydrated || !!preview} aria-expanded={attachmentOpen} onClick={() => setAttachmentOpen(value => !value)}>{attachmentOpen ? '收起简历库' : '从简历库选择'}</button>
        <button className="flex items-center gap-1.5 text-[12px] text-text-secondary hover:text-text-primary" onClick={() => setSettingsOpen('sender')}><Mail size={14} />{snapshot?.sender?.address ?? '设置发件邮箱'}</button>
        <button className="flex items-center gap-1 text-[11px] text-text-tertiary hover:text-text-primary" onClick={() => setSettingsOpen('agent')}><Settings size={12} />{snapshot ? '执行器已连接' : '连接执行器'}</button>
        <Button className="ml-auto h-8 px-3 text-[12px]" disabled={!readyDrafts.length || busy || snapshot?.running || pending > 0 || !!snapshot?.fatalError} onClick={() => void run(preparePreview)}>预览并发送 {readyDrafts.length ? `(${readyDrafts.length})` : ''}</Button>
      </div>
      {attachmentOpen && <section className="flex-none border-b border-line px-5 py-4 text-[12px]" aria-label="选择投递简历">
        <div className="mb-3 flex items-center gap-3"><strong className="text-[13px] font-medium">简历库中的原文件</strong>{attachment && <Button variant="ghost" className="ml-auto h-7 px-2 text-[12px]" disabled={!!preview} onClick={() => { setAttachment(null); setAttachmentSource(undefined) }}><Trash2 size={12} />移除附件</Button>}</div>
        {libraryAttachments.length ? <div className="max-h-40 divide-y divide-line overflow-y-auto border-y border-line">{libraryAttachments.map(item => <button key={item.id} className={`flex w-full items-center justify-between gap-3 px-2 py-2.5 text-left hover:bg-surface-soft ${attachmentSource?.id === item.id ? 'bg-brand-soft' : ''}`} disabled={!!preview} onClick={() => { setAttachment(item.file); setAttachmentSource({ id: item.id, updatedAt: item.updatedAt }); setAttachmentOpen(false); setError('') }}><span className="min-w-0 truncate">{item.file.name}{item.current ? ' · 当前简历' : ''}</span><span className="shrink-0 text-text-tertiary">{savedDate(item.updatedAt)} 导入 · {Math.ceil(item.file.size / 1024)} KB</span></button>)}</div> : <p className="my-2 text-text-secondary">简历库暂无可用原文件，可直接选择本地简历。</p>}
        {libraryError && <p role="alert" className="mt-2 text-danger">简历库读取失败，可重新打开页面或直接选择本地文件。</p>}
        <p className="mb-0 mt-3 text-[11px] leading-relaxed text-text-tertiary">支持 5 MB 以内的 PDF、DOCX、TXT。修改提取的文字不会更改附件；发送前请核对原文件版本。</p>
      </section>}
      {(error || agent.connectionError || snapshot?.fatalError) && <div role="alert" className="flex-none border-b border-line bg-danger-soft px-5 py-2 text-[12px] leading-relaxed text-danger">{error || agent.connectionError || snapshot?.fatalError}</div>}
      <div className="flex-none">{hydrated && <LinkImporter onBusy={setBusy} existingUrls={drafts.map(draft => draft.sourceUrl)} slots={20 - drafts.length} connected={!!snapshot} onConnect={() => setSettingsOpen('agent')} read={url => agent.request<CareerPage>('/extract', { url })} discover={url => agent.request<CareerDiscovery>('/discover', { url })} onImported={result => {
        const id = crypto.randomUUID()
        const draft: Draft = { id, company: result.company ?? '', role: result.role ?? '', sourceUrl: result.url, recipient: result.recommendedEmail ?? '', subject: '', body: '', sourceConfirmed: false, automatic: true, extraction: result }
        setDrafts(items => items.length >= 20 || items.some(item => item.sourceUrl === result.url) ? items : [...items, draft]); setSelectedId(id); setTab('drafts'); setFocusRequest(null); setError('')
      }} />}</div>
      <div className="mail-work-area min-h-0 flex-1">
        <section className="mail-list flex min-h-0 min-w-0 flex-col border-r border-line" aria-label="投递清单">
          <div className="flex h-11 flex-none items-center border-b border-line px-3">
            {(['drafts', 'history'] as const).map(value => <button key={value} className={`h-full border-b-2 px-2 text-[12px] ${tab === value ? 'border-brand font-semibold' : 'border-transparent text-text-tertiary'}`} onClick={() => { setTab(value); setSelectedId(null); setFocusRequest(null); setError('') }}>{value === 'drafts' ? `待投递 ${drafts.length}` : `投递记录 ${history.length}`}</button>)}
            <button className="ml-auto flex items-center gap-1 px-1 py-2 text-[11px] text-text-tertiary hover:bg-surface-hover" disabled={!hydrated || busy} onClick={addDraft} aria-label="手动补录岗位" title="手动补录岗位"><Plus size={13} />补录</button>
          </div>
          {tab === 'history' && (pending > 0 || snapshot?.running) && <div className="flex flex-wrap items-center gap-2 border-b border-line bg-surface-soft px-3 py-2 text-[12px]">
            <span className="mr-auto">{snapshot?.running ? (snapshot.paused ? '完成当前邮件后暂停' : '正在发送') : `待继续 ${pending} 封`}</span>
            <Button variant="secondary" className="h-7 px-2 text-[12px]" disabled={busy || !snapshot?.sender || !!snapshot?.fatalError} onClick={() => void run(() => agent.command(snapshot?.running ? '/pause' : '/resume'))}>{snapshot?.running ? <Pause size={12} /> : <Play size={12} />}{snapshot?.running ? '暂停' : '继续发送'}</Button>
          </div>}
          <div className="min-h-0 flex-1 overflow-y-auto">
            {(tab === 'drafts' ? drafts : history).map((item, index) => {
              const website = !isJob(item) && websiteLinks(item).length > 0
              const issues = !isJob(item) && !isWebsite(item) ? draftIssues(item).filter(issue => !website || ['company', 'role', 'sourceUrl'].includes(issue.field)) : []
              const status = isJob(item) ? MAIL_STATUS_LABELS[item.status] : isWebsite(item) ? '官网已投 · 手动' : website ? '官网申请' : issues.length ? '待补充' : '可发送'
              const tone = isJob(item) ? MAIL_STATUS_TONES[item.status] : isWebsite(item) ? 'success' : website ? 'info' : issues.length ? 'warning' : 'success'
              return <button key={item.id} className={`block w-full border-b border-line px-4 py-3 text-left ${selected?.id === item.id ? 'border-l-2 border-l-brand bg-brand-soft' : 'border-l-2 border-l-transparent hover:bg-surface-soft'}`} onClick={() => selectItem(item)}>
                <span className="flex items-baseline gap-2"><strong className="min-w-0 flex-1 truncate text-[13px] font-semibold">{item.company || `新岗位 ${index + 1}`}</strong><span className="workbench-status whitespace-nowrap text-[11px]" data-tone={tone}>{status}</span></span>
                <span className="mt-1 block truncate text-[12px] text-text-secondary">{item.role || '待填写岗位'}</span>
                <span className="mt-1 block truncate text-[11px] text-text-tertiary">{issues.length ? issues.map(issue => issue.label).join(' · ') : isWebsite(item) ? `${savedDate(item.appliedAt)} 标记` : website ? '打开官网完成申请' : item.recipient}</span>
              </button>
            })}
            {(tab === 'drafts' ? !drafts.length : !history.length) && <div className="px-4 py-6 text-[12px] leading-[1.8] text-text-tertiary">{tab === 'drafts' ? '添加招聘链接，或手动补录一个岗位。' : snapshot ? '邮件和官网申请的记录会显示在这里。' : '官网申请记录保存在浏览器，邮件记录需连接执行器后读取。'}</div>}
          </div>
          <div className="flex-none border-t border-line px-4 py-2 text-[11px] leading-relaxed text-text-tertiary">{tab === 'drafts' ? `${readyDrafts.length} 个可发送 · ${websiteDrafts.length} 个官网申请 · ${drafts.length - readyDrafts.length - websiteDrafts.length} 个待补充` : '邮件记录在执行器 · 官网记录在浏览器'}</div>
        </section>
        <section className="min-h-0 min-w-0 overflow-y-auto" aria-label={tab === 'drafts' ? '编辑投递邮件' : '投递详情'}>
          {!selected ? <div className="mx-auto max-w-[600px] px-6 py-9 sm:px-8">
            <Mail size={22} className="mb-4 text-text-tertiary" />
            <h2 className="mb-2 text-[17px] font-semibold">{tab === 'history' ? '还没有投递记录' : '从一个岗位开始'}</h2>
            <p className="text-[13px] leading-[1.9] text-text-secondary">{tab === 'history' ? '发送邮件或标记已完成的官网申请后，可以在这里查看。' : '添加招聘详情链接，自动整理公司、岗位和投递方式。缺少的信息会在清单中提示。'}</p>
            {tab === 'drafts' && <Button variant="secondary" className="mt-3" disabled={!hydrated || busy} onClick={addDraft}><Plus size={14} />手动添加岗位</Button>}
          </div> : tab === 'drafts' ? <DraftEditor key={selected.id} draft={selected as Draft} sender={snapshot?.sender} connected={!!snapshot} busy={busy} focusRequest={focusRequest} onUpdate={update} onConnect={() => setSettingsOpen('agent')} onRemove={() => setDrafts(items => items.filter(item => item.id !== selected.id))} onApplied={url => markApplied(selected as Draft, url)} onExtract={() => void run(async () => {
            const id = selected.id; const original = selected.sourceUrl
            const result = await agent.request<CareerPage>('/extract', { url: original })
            setDrafts(items => items.map(item => item.id === id && item.sourceUrl === original ? { ...item, sourceUrl: result.url, company: item.company || result.company || '', role: item.role || result.role || '', recipient: item.recipient || result.recommendedEmail || '', extraction: result, automatic: !item.body && !item.subject ? true : item.automatic, sourceConfirmed: false } : item))
          })} /> : isWebsite(selected) ? <article className="mx-auto max-w-[860px] p-5 text-[13px] sm:p-6">
            <h2 className="m-0 text-[17px] font-semibold">{selected.company} / {selected.role}</h2>
            <p className="text-[12px] text-text-secondary"><span className="workbench-status" data-tone="success">官网已投</span> · {savedDate(selected.appliedAt)} 手动标记</p>
            <p className="border-y border-line py-4 leading-relaxed text-text-secondary">这条记录表示你已在官网完成申请。工作台没有发送邮件，也没有读取官网的申请结果。</p>
            <a href={safeLink(selected.applicationUrl)} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-accent underline">查看官网申请页面<ExternalLink size={13} /></a>
            <div className="mt-6"><Button variant="secondary" disabled={drafts.length >= 20} onClick={() => {
              const { channel: _channel, applicationUrl: _url, appliedAt: _at, ...draft } = selected
              setWebsiteApplications(items => items.filter(item => item.id !== selected.id)); setDrafts(items => [...items, draft]); setTab('drafts'); setSelectedId(draft.id); setFocusRequest(null)
            }}>撤销标记，移回待投递</Button></div>
          </article> : <JobDetails job={selected as MailJob} disabled={busy || !!snapshot?.running} onAction={action => void run(() => jobAction(selected as MailJob, action))} />}
        </section>
      </div>
    </main>
    {settingsOpen && <MailSettings agent={agent} purpose={settingsOpen} onClose={() => setSettingsOpen(null)} />}
    {preview && <MailPreview batch={preview} onClose={() => setPreview(null)} onSend={async batch => {
      await agent.command('/batches', batch)
      setDrafts(items => items.filter(item => !batch.jobs.some(job => job.id === item.id)))
      setPreview(null); setTab('history'); setSelectedId(batch.jobs[0].id); setError('')
    }} />}
  </WorkbenchFrame>
}

function JobDetails({ job, disabled, onAction }: { job: MailJob; disabled: boolean; onAction: (action: 'retry' | 'cancel' | 'confirm-sent') => void }) {
  return <article className="mx-auto max-w-[860px] p-5 text-[13px] sm:p-6">
    <div className="flex flex-wrap items-baseline gap-3"><h2 className="m-0 text-[17px] font-semibold">{job.company} / {job.role}</h2><span className="workbench-status text-[12px]" data-tone={MAIL_STATUS_TONES[job.status]}>{MAIL_STATUS_LABELS[job.status]}</span></div>
    <p className="mb-5 text-[12px] leading-relaxed text-text-tertiary">{job.detail ?? '按清单顺序发送。'}<br />更新于 {new Date(job.updatedAt).toLocaleString('zh-CN')}</p>
    <dl className="mail-record grid grid-cols-[60px_minmax(0,1fr)] gap-x-3 gap-y-3 border-y border-line py-4 text-[12px]">
      <dt>发件人</dt><dd>{job.sender.name} &lt;{job.sender.address}&gt;</dd><dt>收件人</dt><dd>{job.recipient}</dd>
      <dt>官网来源</dt><dd><a href={safeLink(job.sourceUrl)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 underline">{job.sourceUrl}<ExternalLink size={12} className="shrink-0" /></a></dd>
      <dt>附件</dt><dd>{job.attachment.name} · {Math.max(1, Math.ceil(job.attachment.size / 1024))} KB</dd>
      <dt>邮件编号</dt><dd className="font-mono text-[11px]">{job.messageId}</dd>
    </dl>
    <h3 className="mb-3 mt-5 text-[14px] font-medium">{job.subject}</h3><div className="whitespace-pre-wrap break-words leading-[1.9] text-text-secondary">{job.body}</div>
    {['queued', 'failed', 'uncertain'].includes(job.status) && <div className="mt-6 flex flex-wrap gap-2 border-t border-line pt-4">
      {job.status === 'failed' && <Button disabled={disabled} variant="secondary" onClick={() => onAction('retry')}>重新加入队列</Button>}
      {job.status === 'uncertain' && <Button disabled={disabled} variant="secondary" onClick={() => onAction('confirm-sent')}>已核对，标记为已发送</Button>}
      <Button disabled={disabled} variant="ghost" onClick={() => onAction('cancel')}>取消本条</Button>
    </div>}
  </article>
}
