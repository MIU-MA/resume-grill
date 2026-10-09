'use client'

import { useEffect, useRef, useState } from 'react'
import { ArrowLeft, ExternalLink, Mail, Paperclip, Pause, Play, Plus, Settings } from 'lucide-react'
import type { Mode } from '@/application/types'
import { WorkbenchFrame } from '@/components/layout/WorkbenchFrame'
import { Button } from '@/components/ui/Button'
import { WorkspaceSidebar, type SidebarBadges } from '@/features/workspace/WorkspaceSidebar'
import { batchSchema, MAIL_STATUS_LABELS, type CareerDiscovery, type CareerPage, type MailBatch, type MailJob } from '@/domain/mail-schema'
import type { JobPreparationIntent, JobPreparationRequest } from '@/domain/job-preparation'
import { useSidebarCollapsed } from '@/features/workspace/hooks/use-sidebar-collapsed'
import { useMailAgent } from './hooks/use-mail-agent'
import { useMailDrafts } from './hooks/use-mail-drafts'
import { encodeAttachment } from './mail-attachment'
import { MAIL_STATUS_TONES, isJob, isWebsite, savedDate, safeLink } from './mail-presentation'
import { MailJobDetails } from './MailJobDetails'
import { DraftDialog } from './DraftDialog'
import { ResumeAttachmentPicker } from './ResumeAttachmentPicker'
import { MailSettings } from './MailSettings'
import { MailPreview } from './MailPreview'
import { LinkImporter } from './LinkImporter'
import { ContactImporter } from './ContactImporter'
import { DraftTable } from './DraftTable'
import { MailDefaultsDialog } from './MailDefaultsDialog'
import { applyMailDefaults, renderMailTemplate, senderDefaults } from './mail-defaults'
import { parseContactList, planContactImports } from './contact-import'
import { DraftEditor } from './DraftEditor'
import { JobPreparationPanel } from './JobPreparationPanel'
import { careerUrlKey, supplementCareerDraft } from './pasted-career'
import { applyCareerPage, draftIssues, draftPayload, markWebsiteApplication, preparationAttachment, selectedMailDrafts, updateDraft, validResumeAttachment, websiteLinks, type Draft, type DraftField, type SavedJobPreparation, type WebsiteApplication } from './draft-state'

export function MailWorkbench({ badges, onNavigate, onHome, onPrepare }: { badges: SidebarBadges; onNavigate: (mode: Mode) => void; onHome: () => void; onPrepare: (request: JobPreparationRequest, intent: JobPreparationIntent) => Promise<void> }) {
  const agent = useMailAgent()
  const [error, setError] = useState('')
  const {
    drafts, setDrafts,
    defaults, setDefaults,
    selectedDraftIds, setSelectedDraftIds,
    attachment, setAttachment,
    attachmentSource, setAttachmentSource,
    libraryAttachments, libraryError, hydrated,
    websiteApplications, setWebsiteApplications,
    preparationByJob, setPreparationByJob,
    selectedId, setSelectedId,
    tab, setTab,
    persist,
  } = useMailDrafts(setError, agent.snapshot?.sender)
  const [defaultsOpen, setDefaultsOpen] = useState(false)
  const [inputMode, setInputMode] = useState<'contacts' | 'links'>('contacts')
  const [editOpen, setEditOpen] = useState(false)
  const [previewPreparation, setPreviewPreparation] = useState<Record<string, SavedJobPreparation>>({})
  const [attachmentOpen, setAttachmentOpen] = useState(false)
  const [focusRequest, setFocusRequest] = useState<{ field: DraftField; time: number } | null>(null)
  const [settingsOpen, setSettingsOpen] = useState<'agent' | 'sender' | null>(null)
  const [collapsed, toggleCollapsed] = useSidebarCollapsed()
  const [preview, setPreview] = useState<MailBatch | null>(null)
  const [busy, setBusy] = useState(false)
  const fileInput = useRef<HTMLInputElement>(null)
  const pendingPreparation = useRef<{ id: string; intent: JobPreparationIntent } | null>(null)
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
    if (!snapshot) return
    const submitted = new Set(snapshot.jobs.map(job => job.id))
    setDrafts(current => current.some(item => submitted.has(item.id)) ? current.filter(item => !submitted.has(item.id)) : current)
  }, [snapshot, setDrafts])

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
        <button className="flex items-center gap-1 text-[11px] text-text-tertiary hover:text-text-primary" onClick={() => setSettingsOpen('agent')}><Settings size={12} />{snapshot ? '本机已连接' : '连接本机'}</button>
        <button type="button" className="flex items-center gap-1 text-[12px] text-text-secondary" disabled={!hydrated || !!preview} onClick={() => setDefaultsOpen(true)}><Settings size={13} />投递设置</button>
        <Button className="ml-auto h-8 px-3 text-[12px]" disabled={tab !== 'drafts' || !selectedReadyDrafts.length || busy || snapshot?.running || pending > 0 || !!snapshot?.fatalError} onClick={() => void run(preparePreview)}>预览并发送 {selectedReadyDrafts.length ? `(${selectedReadyDrafts.length})` : ''}</Button>
      </div>
      {attachmentOpen && <ResumeAttachmentPicker attachment={attachment} attachmentSource={attachmentSource} libraryAttachments={libraryAttachments} libraryError={libraryError} disabled={!!preview} onRemove={() => { setAttachment(null); setAttachmentSource(undefined) }} onChoose={item => { setAttachment(item.file); setAttachmentSource({ id: item.id, updatedAt: item.updatedAt }); setAttachmentOpen(false); setError('') }} />}
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
          </article> : <MailJobDetails job={selected as MailJob} disabled={busy || !!snapshot?.running} onAction={action => void run(() => jobAction(selected as MailJob, action))} preparation={<JobPreparationPanel key={selected.id} jobDescription={selectedDescription} attachmentLabel={attachmentLabel} busy={busy} onChange={updateHistoryDescription} onPrepare={intent => void run(() => prepareJob(intent))} />} />}
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
