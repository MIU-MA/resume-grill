'use client'

import type { ReactNode } from 'react'
import { Paperclip, Plus } from 'lucide-react'
import type { Mode } from '@/application/types'
import { UndoNotice } from '@/components/ui/UndoNotice'
import { Button } from '@/components/ui/Button'
import type { SidebarBadges } from '@/features/workspace/WorkspaceSidebar'
import { AppShell } from '@/features/workspace/AppShell'
import type { CareerDiscovery, CareerPage } from '@/domain/mail-schema'
import type { JobPreparationIntent, JobPreparationRequest } from '@/domain/job-preparation'
import type { JobAssistantTools } from '@/domain/job-assistant'
import { useMailWorkbench } from './hooks/use-mail-workbench'
import { JobResumeDialog } from './jobs/JobResumeDialog'
import { tailoringIsCurrent } from './jobs/lib/job-resume-tailoring'
import { DraftDialog } from './mail/DraftDialog'
import { ResumeAttachmentPicker } from './mail/ResumeAttachmentPicker'
import type { SavedRecord } from '@/lib/storage'
import { savedDate } from './mail/lib/mail-presentation'
import { JobDossier } from './jobs/JobDossier'
import { MailPreview } from './mail/MailPreview'
import { AddJobsDrawer } from './AddJobsDrawer'
import { MailWorkbenchHeader } from './MailWorkbenchHeader'
import { DraftTable } from './mail/DraftTable'
import { MailDefaultsDialog } from './mail/MailDefaultsDialog'
import { renderMailTemplate, senderDefaults } from './mail/lib/mail-defaults'
import { DraftEditor } from './mail/DraftEditor'
import { JobPreparationPanel } from './jobs/JobPreparationPanel'
import { WebsiteAutofillDialog } from './website/WebsiteAutofillDialog'
import { supplementCareerDraft } from './jobs/lib/pasted-career'
import type { Draft } from './mail/lib/draft-state'
import { ApplicationHistoryView } from './history/ApplicationHistoryView'
import { ApplicationRecordDialog, type ApplicationRecordValues } from './history/ApplicationRecordDialog'
import { CareerJobsView } from './jobs/CareerJobsView'
export function MailWorkbench({ mode = 'applications', badges, onNavigate, onHome, onPrepare, onOpenRecord, renderAssistant }: { mode?: 'jobs' | 'applications' | 'careers' | 'application-history'; badges: SidebarBadges; onNavigate: (mode: Mode) => void; onHome: () => void; onPrepare: (request: JobPreparationRequest, intent: JobPreparationIntent) => Promise<void>; onOpenRecord?: (record: SavedRecord) => void; renderAssistant?: (tools: JobAssistantTools) => ReactNode }) {
  const {
    agent, error, setError, drafts, setDrafts, defaults, setDefaults, selectedDraftIds, setSelectedDraftIds,
    attachment, setAttachment, attachmentSource, setAttachmentSource, libraryAttachments, libraryError, hydrated,
    preparationByJob, setPreparationByJob, setSelectedId,
    tab, isCareers, isJobs, defaultsOpen, setDefaultsOpen, addOpen, setAddOpen,
    inputMode, setInputMode, editOpen, setEditOpen, showDossier, setShowDossier, recordDialog, setRecordDialog,
    confirmation, undo, attachmentOpen, setAttachmentOpen,
    focusRequest, settingsDialog, openSettings,
    preview, setPreview, busy, setBusy, websiteIds, setWebsiteIds, websiteChoices, setWebsiteChoices,
    tailoring, setTailoring, fileInput, snapshot, tracking, entries,
    selectedEntry, selected, pending, selectedReadyDrafts, selectedWebsiteCount, selectedPreparation,
    selectedDescription, startTailoring, attachmentLabel, run, updateById, update,
    prepareJob, addDraft, importContacts, removeDraft, preparePreview, previewQuickMail, jobAction,
    openDraft, markApplied, deleteEntry, saveRecord, assistantTools, addCareerPage, returnWebsiteToDrafts,
    chooseFile, extractSelected, applyTailoring, saveDefaults, sendPreview, editPreview, prepareEntry, canPrepareEntry,
  } = useMailWorkbench({ mode, onNavigate, onPrepare })
  const draftEditor = selected && tab === 'drafts' ? <DraftEditor key={selected.id} draft={selected as Draft} sender={snapshot?.sender ?? (defaults.sender.name ? defaults.sender : null)} template={renderMailTemplate(defaults, selected as Draft, snapshot?.sender)} connected={!!snapshot} busy={busy} focusRequest={focusRequest} attachmentLabel={attachmentLabel}
    onTailor={() => startTailoring(selected as Draft)} tailoredStatus={preparationByJob[selected.id]?.tailoredResume ? tailoringIsCurrent(selected as Draft, preparationByJob[selected.id]) ? 'current' : 'outdated' : undefined}
    onOriginalResume={() => setPreparationByJob(items => ({ ...items, [selected.id]: { ...items[selected.id], tailoredResume: undefined, attachment: undefined, attachmentSource: undefined } }))}
    onWebsiteAutomation={url => { setWebsiteChoices(url ? { [selected.id]: url } : {}); setWebsiteIds([selected.id]); setEditOpen(false) }} onPrepare={intent => void run(() => prepareJob(intent))} onUpdate={update} onConnect={() => openSettings('local')} onRemove={() => removeDraft(selected.id)} onApplied={url => void run(() => markApplied(selected as Draft, url))} onSupplement={page => {
            const id = selected.id
            setDrafts(items => items.map(item => item.id === id ? supplementCareerDraft(item, page) : item))
          }} onExtract={extractSelected} /> : null

  const previewBlocker = snapshot?.fatalError || (snapshot?.running || pending > 0 ? '当前发送队列尚未结束。' : !selectedReadyDrafts.length ? '先勾选信息完整的邮件。' : !snapshot?.sender ? '先连接发件邮箱。' : !attachment && selectedReadyDrafts.some(draft => !preparationByJob[draft.id]?.tailoredResume) ? '选择简历附件后会自动继续核对。' : '')
  const dialogEntry = recordDialog?.entry
  const dialogInitial: ApplicationRecordValues | undefined = dialogEntry ? {
    company: dialogEntry.company,
    role: dialogEntry.role,
    channel: dialogEntry.kind === 'website' ? 'website' : dialogEntry.manual?.channel ?? 'other',
    appliedAt: dialogEntry.appliedAt,
    sourceUrl: dialogEntry.sourceUrl,
    contact: dialogEntry.contact,
    note: dialogEntry.manual?.note ?? '',
    stage: tracking.tracker.progress[dialogEntry.id]?.stage ?? 'awaiting',
  } : undefined
  return <AppShell
    mode={mode}
    badges={badges}
    onNavigate={onNavigate}
    onOpenHistory={onHome}
    {...settingsDialog}
    settings={{ agent, rememberedSender: defaults.sender, onVerified: sender => setDefaults(current => senderDefaults(current, sender)) }}
    header={<MailWorkbenchHeader
      isJobs={isJobs}
      isCareers={isCareers}
      tab={tab}
      connected={!!snapshot}
      connectionError={agent.connectionError}
      running={!!snapshot?.running}
      paused={!!snapshot?.paused}
      pending={pending}
      draftsCount={drafts.length}
      entriesCount={entries.length}
      busy={busy}
      fatalError={snapshot?.fatalError}
      senderReady={!!snapshot?.sender}
      onOpenStatus={() => openSettings('local')}
      onQueue={() => void run(() => agent.command(snapshot?.running ? '/pause' : '/resume'))}
    />}
  >
    {confirmation.dialog}
    <UndoNotice queue={undo} />
    <div className="mail-workbench flex min-h-0 flex-1 flex-col" data-view={mode}>
      <div className="mail-toolbar" hidden={isJobs || isCareers || tab === 'history'}>
        <input ref={fileInput} hidden type="file" accept=".pdf,.docx,.txt" onChange={event => {
          chooseFile(event.target.files?.[0])
          event.target.value = ''
        }} />
        <div className="mail-toolbar-resources">
        <button className="mail-attachment flex min-w-0 max-w-full items-center gap-1.5 text-label text-text-secondary hover:text-text-primary" disabled={!hydrated || !!preview} title={attachment ? '更换本地简历附件' : '选择本地简历附件'} onClick={() => fileInput.current?.click()}><Paperclip size={14} className="shrink-0" /><span className="truncate" title={attachment?.name}>{attachment?.name ?? '选择简历附件'}</span><span className="shrink-0 text-text-tertiary">{attachmentSource ? `· ${savedDate(attachmentSource.updatedAt)} 版本` : attachment ? '· 更换' : ''}</span></button>
        <button className="text-label text-text-tertiary hover:text-text-primary" disabled={!hydrated || !!preview} aria-expanded={attachmentOpen} onClick={() => setAttachmentOpen(value => !value)}>{attachmentOpen ? '收起简历库' : '从简历库选择'}</button>
        <span className="text-meta text-text-tertiary">{snapshot?.sender?.address ?? '未设置发件邮箱'}</span>
        <Button variant="link" className="text-label" onClick={() => openSettings('mail')}>设置</Button>
        <Button variant="link" className="text-label text-text-secondary" disabled={!hydrated || !!preview} onClick={() => setDefaultsOpen(true)}>邮件模板</Button>

        </div>
        <div className="mail-toolbar-actions">
        {previewBlocker && <span className="self-center text-meta text-text-secondary" role="status">{previewBlocker}</span>}
        <Button variant="secondary" className="h-8 px-3 text-label" disabled={!hydrated || busy || !!preview} onClick={() => setAddOpen(true)}><Plus size={13} />添加岗位</Button>
        <Button variant="secondary" className="h-8 px-3 text-label" disabled={!hydrated || busy || !!preview} onClick={() => { setWebsiteChoices({}); setWebsiteIds(selectedDraftIds) }}>官网批量填写{selectedWebsiteCount ? ` (${selectedWebsiteCount})` : ''}</Button>
        <Button className="h-8 px-3 text-label" disabled={tab !== 'drafts' || !selectedReadyDrafts.length || busy || snapshot?.running || pending > 0 || !!snapshot?.fatalError} onClick={() => void run(preparePreview)}>预览并发送 {selectedReadyDrafts.length ? `(${selectedReadyDrafts.length})` : ''}</Button>
        </div>
      </div>
      {tab === 'drafts' && !isJobs && !isCareers && attachmentOpen && <ResumeAttachmentPicker attachment={attachment} attachmentSource={attachmentSource} libraryAttachments={libraryAttachments} libraryError={libraryError} disabled={!!preview} onRemove={() => { setAttachment(null); setAttachmentSource(undefined) }} onChoose={item => { setAttachment(item.file); setAttachmentSource({ id: item.id, updatedAt: item.updatedAt }); setAttachmentOpen(false); setError('') }} />}
      {(error || agent.connectionError || snapshot?.fatalError || agent.readerWarning) && <div role="alert" className="flex-none border-b border-line bg-danger-soft px-5 py-2 text-body leading-relaxed text-danger">{error || agent.connectionError || snapshot?.fatalError || agent.readerWarning}</div>}
      <AddJobsDrawer
        open={hydrated && !isJobs && !isCareers && tab === 'drafts' && addOpen}
        onClose={() => setAddOpen(false)}
        mode={inputMode}
        onModeChange={setInputMode}
        connected={!!snapshot}
        busy={busy}
        preview={preview}
        hydrated={hydrated}
        drafts={drafts}
        defaults={defaults}
        snapshot={snapshot}
        pending={pending}
        onConnect={() => openSettings('local')}
        onBusy={setBusy}
        onPreview={(recipient, jobDescription) => void run(() => previewQuickMail(recipient, jobDescription))}
        onImportContacts={importContacts}
        onRead={url => agent.request<CareerPage>('/extract', { url })}
        onImported={addCareerPage}
        onOpenDefaults={() => setDefaultsOpen(true)}
      />      {isJobs ? <CareerJobsView
        connected={!!snapshot}
        existingJobs={drafts.map(({ sourceUrl, role }) => ({ sourceUrl, role }))}
        slots={20 - drafts.length}
        discover={url => agent.request<CareerDiscovery>('/discover', { url })}
        read={url => agent.request<CareerPage>('/extract', { url })}
        onConnect={() => openSettings('local')}
        onBusy={setBusy}
        onError={() => undefined}
        onImported={addCareerPage}
        onOpenApplications={() => onNavigate('applications')}
      /> : isCareers ? <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-5">{renderAssistant?.(assistantTools) ?? <p className="text-body text-text-secondary">AI 找岗位暂不可用。</p>}</div> : tab === 'drafts' ? <DraftTable
        drafts={drafts}
        selectedIds={selectedDraftIds}
        disabled={!hydrated || busy || !!preview}
        resumeLabels={Object.fromEntries(drafts.filter(draft => preparationByJob[draft.id]?.tailoredResume).map(draft => [draft.id, { name: preparationByJob[draft.id].attachment?.name ?? '岗位版附件无法读取', outdated: !tailoringIsCurrent(draft, preparationByJob[draft.id]) }]))}
        onSelection={setSelectedDraftIds}
        onUpdate={updateById}
        onOpen={openDraft}
        onDetails={id => { openDraft(id); setShowDossier(true) }}
        onRemove={removeDraft}
        onAdd={addDraft}
      /> : <ApplicationHistoryView
        entries={entries}
        progress={tracking.tracker.progress}
        selectedId={selectedEntry?.id ?? null}
        loading={!tracking.loaded}
        disabled={busy}
        onSelect={setSelectedId}
        onAdd={() => setRecordDialog({ mode: 'add' })}
        onEdit={entry => setRecordDialog({ mode: 'edit', entry })}
        onDelete={entry => { void deleteEntry(entry).catch(cause => setError(cause instanceof Error ? cause.message : '删除记录失败，请重试。')) }}
        onSaveProgress={(id, changes) => tracking.saveProgress(id, changes)}
        onMailAction={(entry, action) => { if (entry.mail) void run(() => jobAction(entry.mail!, action)) }}
        onReturnToDrafts={returnWebsiteToDrafts}
        onPrepare={entry => void run(() => prepareEntry(entry))}
        canPrepare={canPrepareEntry}
      />}
    </div>
    {editOpen && tab === 'drafts' && selected && <DraftDialog disabled={busy} onClose={() => setEditOpen(false)}><nav className="flex gap-4 border-b border-line px-5 py-3 text-meta" aria-label="岗位详情切换"><button onClick={() => setShowDossier(false)} className={!showDossier ? 'font-semibold underline' : 'text-text-secondary'}>编辑投递</button><button onClick={() => setShowDossier(true)} className={showDossier ? 'font-semibold underline' : 'text-text-secondary'}>岗位资料</button></nav>{showDossier ? <JobDossier key={selected.id} id={selected.id} title={[selected.company, selected.role].filter(Boolean).join(' / ') || selected.recipient || '待投递岗位'} sourceUrl={selected.sourceUrl} deliveryStatus="draft" preparation={selectedPreparation} submission={tracking.tracker.submissions[selected.id]} progress={tracking.tracker.progress[selected.id]} disabled={busy || !tracking.loaded} onSave={change => tracking.saveProgress(selected.id, change)} onOpenRecord={onOpenRecord} jobRequirements={<JobPreparationPanel jobDescription={selectedDescription} attachmentLabel={attachmentLabel} busy={busy} onChange={jobDescription => update({ jobDescription })} onPrepare={intent => void run(() => prepareJob(intent))} />} delivery={<p className="text-text-secondary">这个岗位还在待投递清单，可在“编辑投递”中核对附件和内容。</p>} /> : draftEditor}</DraftDialog>}
    {tailoring && <JobResumeDialog {...tailoring} person={snapshot?.sender?.name ?? defaults.sender.name} onClose={() => setTailoring(null)} onApply={applyTailoring} />}
    {websiteIds && <WebsiteAutofillDialog drafts={drafts.filter(draft => websiteIds.includes(draft.id))} initialUrls={websiteChoices} attachment={attachment} resumeId={attachmentSource?.id} sender={snapshot?.sender ?? defaults.sender} onClose={() => setWebsiteIds(null)} />}
    {defaultsOpen && <MailDefaultsDialog defaults={defaults} attachmentName={attachment?.name} attachmentId={attachmentSource?.id} attachments={libraryAttachments} onChooseFile={() => fileInput.current?.click()} onChooseAttachment={id => {
      const chosen = libraryAttachments.find(item => item.id === id)
      if (chosen) { setAttachment(chosen.file); setAttachmentSource({ id: chosen.id, updatedAt: chosen.updatedAt }) }
    }} onClose={() => setDefaultsOpen(false)} onSave={saveDefaults} />}
    {preview && <MailPreview batch={preview} onEdit={editPreview} skippedCount={drafts.length - preview.jobs.length} onClose={() => setPreview(null)} onSend={sendPreview} />}
    {recordDialog && <ApplicationRecordDialog
      mode={recordDialog.mode}
      initial={dialogInitial}
      allowNote={recordDialog.entry?.kind !== 'website'}
      lockChannel={recordDialog.entry?.kind === 'website'}
      onClose={() => setRecordDialog(null)}
      onSave={saveRecord}
    />}
  </AppShell>
}
