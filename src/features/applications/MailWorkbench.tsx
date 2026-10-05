'use client'

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { get, set } from 'idb-keyval'
import { ArrowLeft, ExternalLink, Mail, Paperclip, Pause, Play, Plus, Settings, Trash2, X } from 'lucide-react'
import type { Mode } from '@/application/types'
import { WorkbenchFrame } from '@/components/layout/WorkbenchFrame'
import { Button } from '@/components/ui/Button'
import { WorkspaceSidebar, type SidebarBadges } from '@/features/workspace/WorkspaceSidebar'
import { batchSchema, sourceUrlSchema, MAIL_STATUS_LABELS, type CareerDiscovery, type CareerPage, type MailBatch, type MailJob } from '@/domain/mail-schema'
import { listResumeAttachments } from '@/lib/resume-library'
import type { JobPreparationIntent, JobPreparationRequest } from '@/lib/job-preparation'
import { useSidebarCollapsed } from '@/hooks/use-sidebar-collapsed'
import { useMailAgent } from './use-mail-agent'
import { MailSettings } from './MailSettings'
import { MailPreview } from './MailPreview'
import { LinkImporter } from './LinkImporter'
import { ContactImporter } from './ContactImporter'
import { DraftTable } from './DraftTable'
import { MailDefaultsDialog } from './MailDefaultsDialog'
import { applyMailDefaults, initialMailDefaults, restoreMailDefaults, renderMailTemplate, senderDefaults, type MailDefaults } from './mail-defaults'
import { parseContactList, planContactImports } from './contact-import'
import { DraftEditor } from './DraftEditor'
import { JobPreparationPanel } from './JobPreparationPanel'
import { careerUrlKey, supplementCareerDraft } from './pasted-career'
import { applyCareerPage, draftIssues, draftPayload, markWebsiteApplication, preparationAttachment, selectedMailDrafts, updateDraft, validResumeAttachment, websiteLinks, type Draft, type DraftField, type SavedJobPreparation, type WebsiteApplication } from './draft-state'

type AttachmentSource = { id: string; updatedAt: number }
type LibraryAttachment = Awaited<ReturnType<typeof listResumeAttachments>>[number]
type DraftStore = { drafts: Draft[]; attachment: File | null; attachmentSource?: AttachmentSource; websiteApplications?: WebsiteApplication[]; preparationByJob?: Record<string, SavedJobPreparation>; defaults?: MailDefaults; selectedIds?: string[] }
const STORAGE_KEY = 'mail-workbench:drafts:v1'
const VIEW_KEY = 'mail-workbench:view'
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
  return sourceUrlSchema.safeParse(value).success ? value : undefined
}

export function MailWorkbench({ badges, onNavigate, onHome, onPrepare }: { badges: SidebarBadges; onNavigate: (mode: Mode) => void; onHome: () => void; onPrepare: (request: JobPreparationRequest, intent: JobPreparationIntent) => Promise<void> }) {
  const agent = useMailAgent()
  const [drafts, setDrafts] = useState<Draft[]>([])
  const [defaults, setDefaults] = useState<MailDefaults>(initialMailDefaults)
  const [defaultsOpen, setDefaultsOpen] = useState(false)
  const [selectedDraftIds, setSelectedDraftIds] = useState<string[]>([])
  const [inputMode, setInputMode] = useState<'contacts' | 'links'>('contacts')
  const [editOpen, setEditOpen] = useState(false)
  const [attachment, setAttachment] = useState<File | null>(null)
  const [attachmentSource, setAttachmentSource] = useState<AttachmentSource>()
  const [libraryAttachments, setLibraryAttachments] = useState<LibraryAttachment[]>([])
  const [libraryError, setLibraryError] = useState(false)
  const [websiteApplications, setWebsiteApplications] = useState<WebsiteApplication[]>([])
  const [preparationByJob, setPreparationByJob] = useState<Record<string, SavedJobPreparation>>({})
  const [previewPreparation, setPreviewPreparation] = useState<Record<string, SavedJobPreparation>>({})
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
  const pendingPreparation = useRef<{ id: string; intent: JobPreparationIntent } | null>(null)
  const writes = useRef<Promise<void>>(Promise.resolve())
  const persist = useCallback((store: DraftStore) => {
    const write = writes.current.catch(() => undefined).then(() => set(STORAGE_KEY, store))
    writes.current = write
    return write
  }, [])
  const snapshot = agent.snapshot
  const jobs = snapshot?.jobs ?? []
  const history = [...jobs, ...websiteApplications].sort((a, b) => (isWebsite(b) ? b.appliedAt : b.updatedAt) - (isWebsite(a) ? a.appliedAt : a.updatedAt))
  const selected = tab === 'drafts' ? drafts.find(item => item.id === selectedId) ?? drafts[0] : history.find(item => item.id === selectedId) ?? history[0]
  const pending = jobs.filter(job => job.status === 'queued').length
  const selectedReadyDrafts = selectedMailDrafts(drafts, selectedDraftIds)
  const selectedPreparation = selected && tab === 'history' ? preparationByJob[selected.id] : undefined
  const selectedAttachment = preparationAttachment(selectedPreparation, attachment, attachmentSource)
  const selectedDescription = selected ? (tab === 'history' ? selectedPreparation?.jobDescription : undefined) ?? (!isJob(selected) ? selected.jobDescription : '') ?? '' : ''
  const attachmentLabel = selectedAttachment.file
    ? `${selectedAttachment.saved ? selectedAttachment.use === 'mail' ? '发送附件' : selectedAttachment.use === 'preview' ? '邮件预览时附件' : '准备时附件' : tab === 'history' ? '使用当前附件' : '使用附件'}：${selectedAttachment.file.name}${selectedAttachment.source ? ` · ${savedDate(selectedAttachment.source.updatedAt)} 版本` : ''}`
    : '尚未选择简历，点击检查或准备时可直接选择原文件。'

  useEffect(() => {
    const input = fileInput.current
    const cancel = () => { pendingPreparation.current = null }
    input?.addEventListener('cancel', cancel)
    return () => input?.removeEventListener('cancel', cancel)
  }, [])

  useEffect(() => {
    if (hydrated) setDrafts(current => applyMailDefaults(current, defaults, snapshot?.sender))
  }, [snapshot?.sender, drafts, defaults, hydrated])

  useEffect(() => {
    setSelectedDraftIds(current => current.some(id => !drafts.some(draft => draft.id === id)) ? current.filter(id => drafts.some(draft => draft.id === id)) : current)
  }, [drafts])

  useEffect(() => {
    let active = true
    void Promise.allSettled([get<DraftStore>(STORAGE_KEY), listResumeAttachments()]).then(([savedResult, libraryResult]) => {
      if (!active) return
      if (savedResult.status === 'rejected') { setError('无法读取浏览器中的投递草稿，请检查浏览器存储权限后刷新。'); return }
      const saved = savedResult.value
      try {
        const view = JSON.parse(window.sessionStorage.getItem(VIEW_KEY) ?? 'null')
        if (view?.tab === 'drafts' || view?.tab === 'history') setTab(view.tab)
        if (typeof view?.selectedId === 'string') setSelectedId(view.selectedId)
      } catch { /* Selection is optional; drafts remain in IndexedDB. */ }
      const library = libraryResult.status === 'fulfilled' ? libraryResult.value.filter(item => validResumeAttachment(item.file)) : []
      setLibraryError(libraryResult.status === 'rejected')
      setLibraryAttachments(library)
      if (saved) {
        setDrafts(saved.drafts); setWebsiteApplications(saved.websiteApplications ?? []); setPreparationByJob(saved.preparationByJob ?? {})
        setDefaults(restoreMailDefaults(saved.defaults))
        setSelectedDraftIds(saved.selectedIds ?? saved.drafts.map(draft => draft.id))
      }
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
    if (hydrated) void persist({ drafts, attachment, attachmentSource, websiteApplications, preparationByJob, defaults, selectedIds: selectedDraftIds }).catch(() => setError('草稿未能保存到浏览器，刷新前请备份填写内容。'))
  }, [drafts, attachment, attachmentSource, websiteApplications, preparationByJob, defaults, selectedDraftIds, hydrated, persist])
  useEffect(() => {
    if (!hydrated) return
    try { window.sessionStorage.setItem(VIEW_KEY, JSON.stringify({ tab, selectedId })) } catch { /* Optional view state. */ }
  }, [hydrated, tab, selectedId])
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
  const updateById = (id: string, change: Partial<Draft>) => {
    const target = drafts.find(draft => draft.id === id)
    if (!target || tab !== 'drafts') return
    setDrafts(items => items.map(item => item.id === id ? updateDraft(item, change) : item))
    if (change.sourceUrl !== undefined && change.sourceUrl !== target.sourceUrl) {
      setPreparationByJob(items => { const next = { ...items }; delete next[id]; return next })
    } else if (change.jobDescription !== undefined) {
      setPreparationByJob(items => items[id] ? { ...items, [id]: { ...items[id], jobDescription: change.jobDescription! } } : items)
    }
  }
  const update = (change: Partial<Draft>) => { if (selected) updateById(selected.id, change) }
  const updateHistoryDescription = (jobDescription: string) => {
    if (!selected) return
    setPreparationByJob(items => ({ ...items, [selected.id]: { ...items[selected.id], jobDescription } }))
    if (isWebsite(selected)) setWebsiteApplications(items => items.map(item => item.id === selected.id ? { ...item, jobDescription, jobDescriptionEdited: true } : item))
  }
  const prepareJob = async (intent: JobPreparationIntent, pickedFile?: File) => {
    if (!selected || !selectedDescription.trim()) return
    const file = pickedFile ?? selectedAttachment.file
    if (!file) { pendingPreparation.current = { id: selected.id, intent }; fileInput.current?.click(); return }
    pendingPreparation.current = null
    const request: JobPreparationRequest = {
      job: { id: selected.id, company: selected.company, role: selected.role, sourceUrl: selected.sourceUrl, jobDescription: selectedDescription.trim() },
      attachment: file, attachmentSource: pickedFile ? undefined : selectedAttachment.source,
    }
    const nextPreparation = { ...preparationByJob, [selected.id]: { jobDescription: request.job.jobDescription, attachment: request.attachment, attachmentSource: request.attachmentSource, attachmentUse: selectedAttachment.use } }
    await persist({ drafts, attachment: pickedFile ?? attachment, attachmentSource: pickedFile ? undefined : attachmentSource, websiteApplications, preparationByJob: nextPreparation, defaults, selectedIds: selectedDraftIds })
    setPreparationByJob(nextPreparation)
    await onPrepare(request, intent)
  }
  const addDraft = () => {
    if (drafts.length >= 20) { setError('每批最多 20 封，请先发送或移除当前草稿'); return }
    const draft: Draft = { id: crypto.randomUUID(), company: '', role: defaults.role, sourceUrl: '', recipient: '', subject: '', body: '', sourceConfirmed: false, automatic: true }
    setDrafts(items => [...items, draft]); setSelectedDraftIds(items => [...items, draft.id]); setSelectedId(draft.id); setTab('drafts'); setFocusRequest({ field: 'company', time: Date.now() }); setEditOpen(true); setError('')
  }
  const importContacts = (text: string) => {
    const result = planContactImports(parseContactList(text, defaults.role), drafts, 20 - drafts.length)
    const added: Draft[] = result.items.map(item => ({ ...item, id: crypto.randomUUID(), subject: '', body: '', sourceConfirmed: false, automatic: true }))
    setDrafts(items => [...items, ...applyMailDefaults(added, defaults, snapshot?.sender)])
    setSelectedDraftIds(items => [...items, ...added.map(item => item.id)])
    setTab('drafts'); setEditOpen(false); setError('')
    return `已添加 ${added.length} 个岗位${result.duplicates ? `，跳过 ${result.duplicates} 个重复条目` : ''}。缺项可直接在表格补充。`
  }
  const removeDraft = (id: string) => {
    setDrafts(items => items.filter(item => item.id !== id))
    if (selected?.id === id) setEditOpen(false)
    setPreparationByJob(items => { const next = { ...items }; delete next[id]; return next })
  }
  const preparePreview = async () => {
    if (!snapshot?.sender) { setSettingsOpen('sender'); return }
    if (!attachment) { fileInput.current?.click(); throw new Error('请选择这批投递要附上的简历原文件') }
    const prepared = selectedReadyDrafts.map(draftPayload)
    const parsed = batchSchema.safeParse({ id: crypto.randomUUID(), sender: snapshot.sender, jobs: prepared, attachment: { name: attachment.name, base64: await encodeAttachment(attachment) } })
    if (!parsed.success) {
      const index = parsed.error.issues.find(issue => issue.path[0] === 'jobs')?.path[1]
      if (typeof index === 'number') setSelectedId(selectedReadyDrafts[index]?.id ?? null)
      const target = typeof index === 'number' ? selectedReadyDrafts[index] : undefined
      const missing = target ? [['公司', target.company], ['岗位', target.role], ['招聘邮箱', target.recipient], ['主题', target.subject], ['正文', target.body]].filter(([, value]) => !value.trim()).map(([label]) => label).join('、') : ''
      throw new Error(`请检查${typeof index === 'number' ? `第 ${index + 1} 个岗位` : '投递内容'}${missing ? `，还缺：${missing}` : '的邮箱、官网链接或附件格式'}。`)
    }
    const captured = Object.fromEntries(selectedReadyDrafts.map(draft => [draft.id, { jobDescription: draft.jobDescription ?? '', attachment, attachmentSource, attachmentUse: 'preview' as const }]))
    const nextPreparation = { ...preparationByJob, ...captured }
    await persist({ drafts, attachment, attachmentSource, websiteApplications, preparationByJob: nextPreparation, defaults, selectedIds: selectedDraftIds })
    setPreparationByJob(nextPreparation); setPreviewPreparation(captured); setPreview(parsed.data)
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
  const openDraft = (id: string) => {
    const draft = drafts.find(item => item.id === id)
    if (!draft) return
    selectItem(draft); setEditOpen(true)
  }
  const markApplied = (draft: Draft, url: string) => {
    const record = markWebsiteApplication(draft, url, Date.now())
    setPreparationByJob(items => ({ ...items, [draft.id]: { ...items[draft.id], jobDescription: draft.jobDescription ?? '' } }))
    setWebsiteApplications(items => [...items, record]); setDrafts(items => items.filter(item => item.id !== draft.id))
    setTab('history'); setSelectedId(record.id)
  }

  const draftEditor = selected && tab === 'drafts' ? <DraftEditor key={selected.id} draft={selected as Draft} sender={snapshot?.sender ?? (defaults.sender.name ? defaults.sender : null)} template={renderMailTemplate(defaults, selected as Draft, snapshot?.sender)} connected={!!snapshot} busy={busy} focusRequest={focusRequest} attachmentLabel={attachmentLabel} onPrepare={intent => void run(() => prepareJob(intent))} onUpdate={update} onConnect={() => setSettingsOpen('agent')} onRemove={() => removeDraft(selected.id)} onApplied={url => markApplied(selected as Draft, url)} onSupplement={page => {
            const id = selected.id
            setDrafts(items => items.map(item => item.id === id ? supplementCareerDraft(item, page) : item))
          }} onExtract={async () => {
            const id = selected.id; const original = selected.sourceUrl
            setBusy(true); setError('')
            try {
              const result = await agent.request<CareerPage>('/extract', { url: original })
              setDrafts(items => items.map(item => item.id === id && item.sourceUrl === original ? applyCareerPage(item, result) : item))
            } finally { setBusy(false) }
          }} /> : null

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
            else {
              setAttachment(file); setAttachmentSource(undefined); setError(''); setAttachmentOpen(false)
              const pending = pendingPreparation.current
              pendingPreparation.current = null
              if (pending && pending.id === selected?.id) void run(() => prepareJob(pending.intent, file))
            }
          }
          event.target.value = ''
        }} />
        <button className="flex min-w-0 max-w-full items-center gap-1.5 text-[12px] text-text-secondary hover:text-text-primary" disabled={!hydrated || !!preview} title={attachment ? '更换本地简历附件' : '选择本地简历附件'} onClick={() => fileInput.current?.click()}><Paperclip size={14} className="shrink-0" /><span className="truncate" title={attachment?.name}>{attachment?.name ?? '选择简历附件'}</span><span className="shrink-0 text-text-tertiary">{attachmentSource ? `· ${savedDate(attachmentSource.updatedAt)} 版本` : attachment ? '· 更换' : ''}</span></button>
        <button className="text-[11px] text-text-tertiary hover:text-text-primary" disabled={!hydrated || !!preview} aria-expanded={attachmentOpen} onClick={() => setAttachmentOpen(value => !value)}>{attachmentOpen ? '收起简历库' : '从简历库选择'}</button>
        <button className="flex items-center gap-1.5 text-[12px] text-text-secondary hover:text-text-primary" onClick={() => setSettingsOpen('sender')}><Mail size={14} />{snapshot?.sender?.address ?? '设置发件邮箱'}</button>
        <button className="flex items-center gap-1 text-[11px] text-text-tertiary hover:text-text-primary" onClick={() => setSettingsOpen('agent')}><Settings size={12} />{snapshot ? '执行器已连接' : '连接执行器'}</button>
        <button type="button" className="flex items-center gap-1 text-[12px] text-text-secondary" disabled={!hydrated || !!preview} onClick={() => setDefaultsOpen(true)}><Settings size={13} />投递设置</button>
        <Button className="ml-auto h-8 px-3 text-[12px]" disabled={tab !== 'drafts' || !selectedReadyDrafts.length || busy || snapshot?.running || pending > 0 || !!snapshot?.fatalError} onClick={() => void run(preparePreview)}>预览并发送 {selectedReadyDrafts.length ? `(${selectedReadyDrafts.length})` : ''}</Button>
      </div>
      {attachmentOpen && <section className="flex-none border-b border-line px-5 py-4 text-[12px]" aria-label="选择投递简历">
        <div className="mb-3 flex items-center gap-3"><strong className="text-[13px] font-medium">简历库中的原文件</strong>{attachment && <Button variant="ghost" className="ml-auto h-7 px-2 text-[12px]" disabled={!!preview} onClick={() => { setAttachment(null); setAttachmentSource(undefined) }}><Trash2 size={12} />移除附件</Button>}</div>
        {libraryAttachments.length ? <div className="max-h-40 divide-y divide-line overflow-y-auto border-y border-line">{libraryAttachments.map(item => <button key={item.id} className={`flex w-full items-center justify-between gap-3 px-2 py-2.5 text-left hover:bg-surface-soft ${attachmentSource?.id === item.id ? 'bg-brand-soft' : ''}`} disabled={!!preview} onClick={() => { setAttachment(item.file); setAttachmentSource({ id: item.id, updatedAt: item.updatedAt }); setAttachmentOpen(false); setError('') }}><span className="min-w-0 truncate">{item.file.name}{item.current ? ' · 当前简历' : ''}</span><span className="shrink-0 text-text-tertiary">{savedDate(item.updatedAt)} 导入 · {Math.ceil(item.file.size / 1024)} KB</span></button>)}</div> : <p className="my-2 text-text-secondary">简历库暂无可用原文件，可直接选择本地简历。</p>}
        {libraryError && <p role="alert" className="mt-2 text-danger">简历库读取失败，可重新打开页面或直接选择本地文件。</p>}
        <p className="mb-0 mt-3 text-[11px] leading-relaxed text-text-tertiary">支持 5 MB 以内的 PDF、DOCX、TXT。修改提取的文字不会更改附件；发送前请核对原文件版本。</p>
      </section>}
      {(error || agent.connectionError || snapshot?.fatalError) && <div role="alert" className="flex-none border-b border-line bg-danger-soft px-5 py-2 text-[12px] leading-relaxed text-danger">{error || agent.connectionError || snapshot?.fatalError}</div>}
      <div className="flex h-11 flex-none items-center border-b border-line px-4">
        {(['drafts', 'history'] as const).map(value => <button key={value} className={`h-full border-b-2 px-2 text-[12px] ${tab === value ? 'border-brand font-semibold' : 'border-transparent text-text-tertiary'}`} onClick={() => { setTab(value); setSelectedId(null); setFocusRequest(null); setEditOpen(false); setError('') }}>{value === 'drafts' ? `待投递 ${drafts.length}` : `投递记录 ${history.length}`}</button>)}
        {tab === 'drafts' && <button className="ml-auto flex items-center gap-1 px-2 py-2 text-[12px] text-text-secondary hover:bg-surface-hover" disabled={!hydrated || busy || !!preview} onClick={addDraft}><Plus size={13} />补录</button>}
      </div>
      {tab === 'drafts' && hydrated && <div className="flex-none">
        <div className="flex items-center gap-4 px-5 pt-3 text-[12px]">
          <button type="button" aria-pressed={inputMode === 'contacts'} disabled={busy} className={inputMode === 'contacts' ? 'font-semibold text-text-primary' : 'text-text-tertiary'} onClick={() => setInputMode('contacts')}>名单 / 招聘正文</button>
          <button type="button" aria-pressed={inputMode === 'links'} disabled={busy} className={inputMode === 'links' ? 'font-semibold text-text-primary' : 'text-text-tertiary'} onClick={() => setInputMode('links')}>官网链接</button>
          {!defaults.sender.name && !snapshot?.sender?.name && <button type="button" className="ml-auto text-accent underline" onClick={() => setDefaultsOpen(true)}>设置发件人，自动填好邮件</button>}
        </div>
        <div hidden={inputMode !== 'contacts'}><ContactImporter disabled={busy || !!preview} slots={20 - drafts.length} onImport={importContacts} /></div>
        <div hidden={inputMode !== 'links'}><LinkImporter onBusy={setBusy} existingUrls={drafts.map(draft => draft.sourceUrl)} slots={20 - drafts.length} connected={!!snapshot} onConnect={() => setSettingsOpen('agent')} read={url => agent.request<CareerPage>('/extract', { url })} discover={url => agent.request<CareerDiscovery>('/discover', { url })} onImported={result => {
          const id = crypto.randomUUID()
          const draft: Draft = { id, company: result.company ?? '', role: result.role || defaults.role, sourceUrl: result.url, recipient: result.recommendedEmail ?? '', subject: '', body: '', sourceConfirmed: false, automatic: true, extraction: result, jobDescription: result.jobDescription ?? '' }
          setDrafts(items => items.length >= 20 || items.some(item => { try { return careerUrlKey(item.sourceUrl) === careerUrlKey(result.url) } catch { return false } }) ? items : [...items, draft])
          setSelectedDraftIds(items => [...items, id]); setTab('drafts'); setFocusRequest(null); setError('')
        }} /></div>
      </div>}
      {tab === 'drafts' ? <DraftTable drafts={drafts} selectedIds={selectedDraftIds} disabled={!hydrated || busy || !!preview} onSelection={setSelectedDraftIds} onUpdate={updateById} onOpen={openDraft} onRemove={removeDraft} onAdd={addDraft} /> : <div className="mail-work-area min-h-0 flex-1">
        <section className="mail-list flex min-h-0 min-w-0 flex-col border-r border-line" aria-label="投递记录">
          {(pending > 0 || snapshot?.running) && <div className="flex flex-wrap items-center gap-2 border-b border-line bg-surface-soft px-3 py-2 text-[12px]">
            <span className="mr-auto">{snapshot?.running ? (snapshot.paused ? '完成当前邮件后暂停' : '正在发送') : `待继续 ${pending} 封`}</span>
            <Button variant="secondary" className="h-7 px-2 text-[12px]" disabled={busy || !snapshot?.sender || !!snapshot?.fatalError} onClick={() => void run(() => agent.command(snapshot?.running ? '/pause' : '/resume'))}>{snapshot?.running ? <Pause size={12} /> : <Play size={12} />}{snapshot?.running ? '暂停' : '继续发送'}</Button>
          </div>}
          <div className="min-h-0 flex-1 overflow-y-auto">
            {history.map(item => <button key={item.id} className={`block w-full border-b border-line px-4 py-3 text-left ${selected?.id === item.id ? 'border-l-2 border-l-brand bg-brand-soft' : 'border-l-2 border-l-transparent hover:bg-surface-soft'}`} onClick={() => selectItem(item)}>
              <span className="flex items-baseline gap-2"><strong className="min-w-0 flex-1 truncate text-[13px] font-semibold">{item.company}</strong><span className="workbench-status whitespace-nowrap text-[11px]" data-tone={isWebsite(item) ? 'success' : MAIL_STATUS_TONES[item.status]}>{isWebsite(item) ? '官网已投 · 手动' : MAIL_STATUS_LABELS[item.status]}</span></span>
              <span className="mt-1 block truncate text-[12px] text-text-secondary">{item.role}</span>
              <span className="mt-1 block truncate text-[11px] text-text-tertiary">{isWebsite(item) ? `${savedDate(item.appliedAt)} 标记` : item.recipient}</span>
            </button>)}
            {!history.length && <p className="px-4 py-6 text-[12px] leading-[1.8] text-text-tertiary">{snapshot ? '邮件和官网申请的记录会显示在这里。' : '官网申请记录保存在浏览器，邮件记录需连接执行器后读取。'}</p>}
          </div>
          <div className="border-t border-line px-4 py-2 text-[11px] text-text-tertiary">邮件记录在执行器 · 官网记录在浏览器</div>
        </section>
        <section className="min-h-0 min-w-0 overflow-y-auto" aria-label="投递详情">
          {!selected ? <div className="px-6 py-9 text-[13px] text-text-secondary">发送邮件或登记官网申请后，可以在这里查看记录。</div> : isWebsite(selected) ? <article className="mx-auto max-w-[860px] p-5 text-[13px] sm:p-6">
            <h2 className="m-0 text-[17px] font-semibold">{selected.company} / {selected.role}</h2>
            <p className="text-[12px] text-text-secondary"><span className="workbench-status" data-tone="success">官网已投</span> · {savedDate(selected.appliedAt)} 手动标记</p>
            <JobPreparationPanel key={selected.id} jobDescription={selectedDescription} attachmentLabel={attachmentLabel} busy={busy} onChange={updateHistoryDescription} onPrepare={intent => void run(() => prepareJob(intent))} />
            <p className="border-y border-line py-4 leading-relaxed text-text-secondary">这条记录表示你已在官网完成申请。工作台没有发送邮件，也没有读取官网的申请结果。</p>
            <a href={safeLink(selected.applicationUrl)} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-accent underline">查看官网申请页面<ExternalLink size={13} /></a>
            <div className="mt-6"><Button variant="secondary" disabled={drafts.length >= 20} onClick={() => {
              const { channel: _channel, applicationUrl: _url, appliedAt: _at, ...draft } = selected
              setWebsiteApplications(items => items.filter(item => item.id !== selected.id)); setDrafts(items => [...items, draft]); setSelectedDraftIds(items => [...items, draft.id]); setTab('drafts'); setSelectedId(draft.id); setFocusRequest(null)
            }}>撤销标记，移回待投递</Button></div>
          </article> : <JobDetails job={selected as MailJob} disabled={busy || !!snapshot?.running} onAction={action => void run(() => jobAction(selected as MailJob, action))} preparation={<JobPreparationPanel key={selected.id} jobDescription={selectedDescription} attachmentLabel={attachmentLabel} busy={busy} onChange={updateHistoryDescription} onPrepare={intent => void run(() => prepareJob(intent))} />} />}
        </section>
      </div>}
    </main>
    {editOpen && tab === 'drafts' && selected && <DraftDialog disabled={busy} onClose={() => setEditOpen(false)}>{draftEditor}</DraftDialog>}
    {settingsOpen && <MailSettings agent={agent} purpose={settingsOpen} rememberedSender={defaults.sender} onVerified={sender => setDefaults(current => senderDefaults(current, sender))} onClose={() => setSettingsOpen(null)} />}
    {defaultsOpen && <MailDefaultsDialog defaults={defaults} attachmentName={attachment?.name} attachmentId={attachmentSource?.id} attachments={libraryAttachments} onChooseFile={() => fileInput.current?.click()} onChooseAttachment={id => {
      const chosen = libraryAttachments.find(item => item.id === id)
      if (chosen) { setAttachment(chosen.file); setAttachmentSource({ id: chosen.id, updatedAt: chosen.updatedAt }) }
    }} onClose={() => setDefaultsOpen(false)} onSave={async value => {
      const updated = applyMailDefaults(drafts, value, snapshot?.sender)
      await persist({ drafts: updated, attachment, attachmentSource, websiteApplications, preparationByJob, defaults: value, selectedIds: selectedDraftIds })
      setDefaults(value); setDrafts(updated)
    }} />}
    {preview && <MailPreview batch={preview} skippedCount={drafts.length - preview.jobs.length} onClose={() => setPreview(null)} onSend={async batch => {
      const sentPreparation = Object.fromEntries(batch.jobs.map(job => [job.id, { ...previewPreparation[job.id], attachmentUse: 'mail' as const }]))
      const nextPreparation = { ...preparationByJob, ...sentPreparation }
      await persist({ drafts, attachment, attachmentSource, websiteApplications, preparationByJob: nextPreparation, defaults, selectedIds: selectedDraftIds })
      setPreparationByJob(nextPreparation)
      await agent.command('/batches', batch)
      setDrafts(items => items.filter(item => !batch.jobs.some(job => job.id === item.id)))
      setPreview(null); setTab('history'); setSelectedId(batch.jobs[0].id); setError('')
    }} />}
  </WorkbenchFrame>
}

function JobDetails({ job, disabled, onAction, preparation }: { job: MailJob; disabled: boolean; onAction: (action: 'retry' | 'cancel' | 'confirm-sent') => void; preparation: ReactNode }) {
  return <article className="mx-auto max-w-[860px] p-5 text-[13px] sm:p-6">
    <div className="flex flex-wrap items-baseline gap-3"><h2 className="m-0 text-[17px] font-semibold">{job.company} / {job.role}</h2><span className="workbench-status text-[12px]" data-tone={MAIL_STATUS_TONES[job.status]}>{MAIL_STATUS_LABELS[job.status]}</span></div>
    <p className="mb-5 text-[12px] leading-relaxed text-text-tertiary">{job.detail ?? '按清单顺序发送。'}<br />更新于 {new Date(job.updatedAt).toLocaleString('zh-CN')}</p>
    {preparation}
    <dl className="mail-record grid grid-cols-[60px_minmax(0,1fr)] gap-x-3 gap-y-3 border-y border-line py-4 text-[12px]">
      <dt>发件人</dt><dd>{job.sender.name} &lt;{job.sender.address}&gt;</dd><dt>收件人</dt><dd>{job.recipient}</dd>
      <dt>来源链接</dt><dd>{job.sourceUrl ? <a href={safeLink(job.sourceUrl)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 underline">{job.sourceUrl}<ExternalLink size={12} className="shrink-0" /></a> : '名单导入，未提供链接'}</dd>
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


function DraftDialog({ children, disabled, onClose }: { children: ReactNode; disabled: boolean; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => { ref.current?.showModal() }, [])
  return <dialog ref={ref} aria-label="查看与编辑投递邮件" onCancel={event => { if (disabled) event.preventDefault(); else onClose() }} className="mail-dialog resume-workbench w-[940px] max-w-[calc(100vw-24px)] border border-line-strong bg-surface p-0 text-text-primary backdrop:bg-black/30">
    <header className="flex items-center justify-between border-b border-line px-5 py-3"><span className="text-[13px] font-medium">邮件与岗位详情 · 修改自动保存</span><Button variant="ghost" className="size-8 p-0" disabled={disabled} aria-label="关闭邮件详情" onClick={onClose}><X size={16} /></Button></header>
    {children}
  </dialog>
}
