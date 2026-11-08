'use client'

import { useSettingsDialog } from '@/features/settings/hooks/use-settings-dialog'
import { useEffect, useRef, useState } from 'react'
import type { Mode } from '@/application/types'
import type { CareerDiscovery, CareerPage, MailBatch, MailJob } from '@/domain/mail-schema'
import type { JobPreparationIntent, JobPreparationRequest } from '@/domain/job-preparation'
import type { JobAssistantTools } from '@/domain/job-assistant'
import { prepareAssistantDrafts } from '../mail/lib/assistant-drafts'
import { useMailAgent } from './use-mail-agent'
import { useSessionState } from '@/hooks/use-session-state'
import { useUndoQueue } from '@/hooks/use-undo-queue'
import { useConfirmation } from '@/hooks/use-confirmation'
import { useMailDrafts } from '../mail/hooks/use-mail-drafts'
import { createMailPreviewBatch } from '../mail/lib/mail-preview-batch'
import type { AttachmentSource } from '../mail/lib/mail-draft-storage'
import type { ResumeTemplateId } from '@/domain/resume-template'
import { savedDate } from '../mail/lib/mail-presentation'
import { useApplicationTracker } from '../history/hooks/use-application-tracker'
import { prepareQuickMail } from '../mail/lib/quick-mail'
import { applyMailDefaults, type MailDefaults } from '../mail/lib/mail-defaults'
import { captureMailSubmissions } from '../history/lib/application-tracker-storage'
import { saveWebsiteRecord } from '../history/lib/website-record-storage'
import { parseContactList, planContactImports } from '../mail/lib/contact-import'
import { websiteTargets } from '../website/lib/website-automation'
import { careerUrlKey } from '../jobs/lib/pasted-career'
import { applyCareerPage, draftIssues, markWebsiteApplication, preparationAttachment, selectedMailDrafts, updateDraft, validResumeAttachment, websiteLinks, type Draft, type DraftField, type SavedJobPreparation } from '../mail/lib/draft-state'
import { buildApplicationEntries, type ApplicationEntry } from '../history/lib/application-entry'
import type { ManualApplication } from '@/domain/application-record'
import type { ApplicationRecordValues } from '../history/ApplicationRecordDialog'
type Args = {
  mode: 'jobs' | 'applications' | 'careers' | 'application-history'
  onNavigate: (mode: Mode) => void
  onPrepare: (request: JobPreparationRequest, intent: JobPreparationIntent) => Promise<void>
}

/**
 * State and actions for the applications workspace. The view only owns JSX.
 */
export function useMailWorkbench({ mode, onNavigate, onPrepare }: Args) {
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
    setTab: setStoredTab,
    persist,
  } = useMailDrafts(setError, agent.snapshot?.sender)
  const currentDrafts = useRef(drafts)
  currentDrafts.current = drafts
  const tab: 'drafts' | 'history' = mode === 'application-history' ? 'history' : 'drafts'
  const isCareers = mode === 'careers'
  const isJobs = mode === 'jobs'
  const setTab = (value: 'drafts' | 'history') => {
    setStoredTab(value)
    if (value === 'history') onNavigate('application-history')
    else if (mode === 'application-history') onNavigate('applications')
  }
  const [defaultsOpen, setDefaultsOpen] = useState(false)
  const [addOpen, setAddOpen] = useState(false)
  const [inputMode, setInputMode] = useSessionState<'email' | 'contacts' | 'links'>('mail-input', 'email', (value): value is 'email' | 'contacts' | 'links' => typeof value === 'string' && ['email', 'contacts', 'links'].includes(value))
  const [editOpen, setEditOpen] = useState(false)
  const [showDossier, setShowDossier] = useState(false)
  const [recordDialog, setRecordDialog] = useState<{ mode: 'add' | 'edit'; entry?: ApplicationEntry } | null>(null)
  const confirmation = useConfirmation()
  const undo = useUndoQueue()
  const undoable = undo.add
  const [previewPreparation, setPreviewPreparation] = useState<Record<string, SavedJobPreparation>>({})
  const [attachmentOpen, setAttachmentOpen] = useState(false)
  const [focusRequest, setFocusRequest] = useState<{ field: DraftField; time: number } | null>(null)
  const settingsDialog = useSettingsDialog()
  const openSettings = settingsDialog.onOpenSettings
  const [preview, setPreview] = useState<MailBatch | null>(null)
  const [busy, setBusy] = useState(false)
  const [websiteIds, setWebsiteIds] = useState<string[] | null>(null)
  const [websiteChoices, setWebsiteChoices] = useState<Record<string, string>>({})
  const [tailoring, setTailoring] = useState<{ draft: Draft; file: File; source?: AttachmentSource; initialTemplate?: ResumeTemplateId } | null>(null)
  const pendingTailoring = useRef<string | null>(null)
  const pendingPreview = useRef<string[] | null>(null)
  const fileInput = useRef<HTMLInputElement>(null)
  const pendingPreparation = useRef<{ id: string; intent: JobPreparationIntent } | null>(null)
  const snapshot = agent.snapshot
  const tracking = useApplicationTracker(snapshot, setError)
  const jobs = [...new Map([...tracking.tracker.mailJobs, ...(snapshot?.jobs ?? [])].map(job => [job.id, job])).values()]
  const entries = buildApplicationEntries({ jobs, websites: websiteApplications, manuals: tracking.tracker.manualApplications, hiddenJobIds: tracking.tracker.hiddenMailJobIds })
  const selectedEntry = tab === 'history' ? entries.find(entry => entry.id === selectedId) ?? entries[0] ?? null : null
  const selected = tab === 'drafts' ? drafts.find(item => item.id === selectedId) ?? drafts[0] : null
  const pending = jobs.filter(job => job.status === 'queued').length
  const selectedReadyDrafts = selectedMailDrafts(drafts, selectedDraftIds)
  const selectedWebsiteCount = websiteTargets(drafts.filter(draft => selectedDraftIds.includes(draft.id))).length
  const selectedPreparation = selected ? preparationByJob[selected.id] : undefined
  const selectedAttachment = preparationAttachment(selectedPreparation, attachment, attachmentSource)
  const selectedDescription = selected?.jobDescription ?? ''
  const persistWorkspace = (changes: Partial<Parameters<typeof persist>[0]>, commit?: Parameters<typeof persist>[1]) => persist({
    drafts, attachment, attachmentSource, websiteApplications, preparationByJob, defaults, selectedIds: selectedDraftIds, ...changes,
  }, commit)
  const startTailoring = (draft: Draft, pickedFile?: File) => {
    if (!draft.jobDescription?.trim()) { setError('先粘贴这个岗位的 JD。'); return }
    const saved = preparationByJob[draft.id]?.tailoredResume
    const file = pickedFile ?? saved?.sourceFile ?? attachment
    if (!file) { pendingTailoring.current = draft.id; fileInput.current?.click(); return }
    pendingTailoring.current = null
    setEditOpen(false); setTailoring({ draft: { ...draft }, file, source: pickedFile ? undefined : saved?.source ?? attachmentSource, initialTemplate: saved?.template })
  }
  const attachmentLabel = selectedAttachment.file
    ? `${selectedAttachment.saved ? selectedAttachment.use === 'mail' ? '发送附件' : selectedAttachment.use === 'preview' ? '邮件预览时附件' : '准备时附件' : '使用附件'}：${selectedAttachment.file.name}${selectedAttachment.source ? ` · ${savedDate(selectedAttachment.source.updatedAt)} 版本` : ''}`
    : '尚未选择简历，点击检查或准备时可直接选择原文件。'

  useEffect(() => {
    const input = fileInput.current
    const cancel = () => { pendingPreparation.current = null; pendingTailoring.current = null; pendingPreview.current = null }
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
  const assertDraftCapacity = (id: string) => {
    if (!currentDrafts.current.some(item => item.id === id) && currentDrafts.current.length >= 20) throw new Error('待投递清单已满，请先移除条目后重试。')
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
  const prepareJob = async (intent: JobPreparationIntent, pickedFile?: File) => {
    if (!selected || !selectedDescription.trim()) return
    const file = pickedFile ?? selectedAttachment.file
    if (!file) { pendingPreparation.current = { id: selected.id, intent }; fileInput.current?.click(); return }
    pendingPreparation.current = null
    const request: JobPreparationRequest = {
      job: { id: selected.id, company: selected.company, role: selected.role, sourceUrl: selected.sourceUrl, jobDescription: selectedDescription.trim() },
      attachment: file, attachmentSource: pickedFile ? undefined : selectedAttachment.source,
    }
    const nextPreparation = { ...preparationByJob, [selected.id]: { ...preparationByJob[selected.id], jobDescription: request.job.jobDescription, attachment: request.attachment, attachmentSource: request.attachmentSource, attachmentUse: selectedAttachment.use } }
    await persistWorkspace({ attachment: pickedFile ?? attachment, attachmentSource: pickedFile ? undefined : attachmentSource, preparationByJob: nextPreparation })
    setPreparationByJob(nextPreparation)
    await onPrepare(request, intent)
  }
  const addDraft = () => {
    if (drafts.length >= 20) { setError('每批最多 20 封，请先发送或移除当前草稿'); return }
    const draft: Draft = { id: crypto.randomUUID(), company: '', role: defaults.role, sourceUrl: '', recipient: '', subject: '', body: '', sourceConfirmed: false, automatic: true }
    setDrafts(items => [...items, draft]); setSelectedDraftIds(items => [...items, draft.id]); setSelectedId(draft.id); setTab('drafts'); setFocusRequest({ field: 'recipient', time: Date.now() }); setEditOpen(true); setError('')
  }
  const importContacts = (text: string) => {
    const result = planContactImports(parseContactList(text, defaults.role), drafts, 20 - drafts.length)
    const added: Draft[] = result.items.map(item => ({ ...item, id: crypto.randomUUID(), subject: '', body: '', sourceConfirmed: false, automatic: true }))
    setDrafts(items => [...items, ...applyMailDefaults(added, defaults, snapshot?.sender)])
    setSelectedDraftIds(items => [...items, ...added.map(item => item.id)])
    setTab('drafts'); setEditOpen(false); setError('')
    return `已添加 ${added.length} 个条目${result.duplicates ? `，跳过 ${result.duplicates} 个重复条目` : ''}。`
  }
  const removeDraft = (id: string) => {
    const draft = drafts.find(item => item.id === id)
    const preparation = preparationByJob[id]
    const wasSelected = selectedDraftIds.includes(id)
    if (!draft) return
    undoable('已移除草稿', () => {
      assertDraftCapacity(id)
      setDrafts(items => items.some(item => item.id === id) ? items : [...items, draft])
      if (preparation) setPreparationByJob(items => ({ ...items, [id]: preparation }))
      if (wasSelected) setSelectedDraftIds(items => [...new Set([...items, id])])
    })
    setDrafts(items => items.filter(item => item.id !== id))
    setSelectedDraftIds(items => items.filter(item => item !== id))
    if (selected?.id === id) setEditOpen(false)
    setPreparationByJob(items => { const next = { ...items }; delete next[id]; return next })
  }
  const preparePreview = async (targets = selectedReadyDrafts, currentDrafts = drafts, currentIds = selectedDraftIds, preparedResumes = preparationByJob, pickedFile?: File) => {
    if (!snapshot?.sender) { openSettings('mail'); return }
    if (!attachment && !pickedFile && targets.some(draft => !preparedResumes[draft.id]?.tailoredResume)) { pendingPreview.current = targets.map(draft => draft.id); fileInput.current?.click(); return }
    const previewFile = pickedFile ?? attachment
    const previewSource = pickedFile ? undefined : attachmentSource
    pendingPreview.current = null
    const { batch, captured } = await createMailPreviewBatch(targets, preparedResumes, previewFile, previewSource, snapshot.sender)
    const nextPreparation = { ...preparedResumes, ...captured }
    await persistWorkspace({ drafts: currentDrafts, attachment: previewFile, attachmentSource: previewSource, preparationByJob: nextPreparation, selectedIds: currentIds })
    setPreparationByJob(nextPreparation); setPreviewPreparation(captured); setPreview(batch)
  }
  const previewQuickMail = async (recipient: string, jobDescription = '') => {
    const next = prepareQuickMail(recipient, drafts, defaults, snapshot?.sender, jobDescription)
    const ids = [...new Set([...selectedDraftIds, next.draft.id])]
    await persistWorkspace({ drafts: next.drafts, selectedIds: ids })
    setDrafts(next.drafts); setSelectedDraftIds(ids); setSelectedId(next.draft.id)
    if (jobDescription.trim()) startTailoring(next.draft)
    else await preparePreview([next.draft], next.drafts, ids)
  }
  const jobAction = async (job: MailJob, action: 'retry' | 'cancel' | 'confirm-sent') => {
    if (job.status === 'uncertain' && !await confirmation.confirm({ title: '核对发送结果', message: action === 'confirm-sent' ? '请先检查邮箱发信记录。确认这封邮件已经发出后，工作台会将其标记为已发送。' : '取消本条不会撤回邮件。如需再次投递，请先核实上次发送结果。', confirmLabel: action === 'confirm-sent' ? '确认已经发出' : '取消本条' })) return
    await agent.command('/job', { id: job.id, action })
  }
  const selectItem = (item: Draft) => {
    setSelectedId(item.id)
    const website = websiteLinks(item).length > 0
    const issue = draftIssues(item).find(value => !website || ['company', 'role', 'sourceUrl'].includes(value.field))
    setFocusRequest(issue ? { field: issue.field, time: Date.now() } : null)
  }
  const openDraft = (id: string) => {
    const draft = drafts.find(item => item.id === id)
    if (!draft) return
    selectItem(draft); setShowDossier(false); setEditOpen(true)
  }
  const markApplied = async (draft: Draft, url: string) => {
    const record = markWebsiteApplication(draft, url, Date.now())
    const previousSubmission = tracking.tracker.submissions[draft.id]
    await tracking.capture({ [draft.id]: { jobDescription: draft.jobDescription ?? '', attachment: selectedAttachment.file ?? undefined, at: record.appliedAt, channel: 'website' } })
    setPreparationByJob(items => ({ ...items, [draft.id]: { ...items[draft.id], jobDescription: draft.jobDescription ?? '' } }))
    setWebsiteApplications(items => [...items, record]); setDrafts(items => items.filter(item => item.id !== draft.id))
    undoable('已登记官网申请', async () => { assertDraftCapacity(draft.id); await tracking.restoreSubmission(draft.id, record.appliedAt, previousSubmission); assertDraftCapacity(draft.id); setWebsiteApplications(items => items.filter(item => item.id !== record.id)); setDrafts(items => items.some(item => item.id === draft.id) ? items : [...items, draft]); setTab('drafts'); setSelectedId(draft.id) })
    setTab('history'); setSelectedId(record.id)
  }
  const deleteEntry = async (entry: ApplicationEntry) => {
    if (entry.kind === 'mail') {
      await tracking.hideJob(entry.id)
      undoable('已从投递记录隐藏', () => tracking.unhideJob(entry.id))
    } else if (entry.kind === 'website' && entry.website) {
      const record = entry.website
      setWebsiteApplications(items => items.filter(item => item.id !== entry.id))
      undoable('已删除投递记录', () => setWebsiteApplications(items => items.some(item => item.id === record.id) ? items : [...items, record]))
    } else if (entry.kind === 'manual' && entry.manual) {
      const record = entry.manual
      const progress = tracking.tracker.progress[entry.id]
      await tracking.removeManual(entry.id)
      undoable('已删除投递记录', () => tracking.restoreManual(record, progress))
    }
    if (selectedEntry?.id === entry.id) setSelectedId(null)
  }
  const saveRecord = async (values: ApplicationRecordValues) => {
    const { stage, ...input } = values
    const now = Date.now()
    const editing = recordDialog?.mode === 'edit' ? recordDialog.entry : undefined
    if (editing?.kind === 'website' && editing.website) {
      if (!websiteApplications.some(item => item.id === editing.id)) throw new Error('这条记录已不存在，请关闭后重新打开。')
      const next = websiteApplications.map(item => item.id === editing.id ? {
        ...item,
        company: input.company,
        role: input.role,
        recipient: input.contact,
        sourceUrl: input.sourceUrl,
        appliedAt: input.appliedAt,
      } : item)
      await persistWorkspace({ websiteApplications: next }, store => tracking.commit(() => saveWebsiteRecord(store, editing.id, stage)))
      setWebsiteApplications(next)
    } else if (editing?.kind === 'manual' && editing.manual) {
      const record: ManualApplication = { ...editing.manual, ...input, updatedAt: now }
      await tracking.saveManual(record, stage)
    } else {
      const record: ManualApplication = { id: crypto.randomUUID(), ...input, createdAt: now, updatedAt: now }
      await tracking.saveManual(record, stage)
      setSelectedId(record.id)
    }
    setRecordDialog(null)
    setError('')
  }
  const assistantTools: JobAssistantTools = {
    connected: !!snapshot,
    disabled: busy || !!preview,
    slots: 20 - drafts.length,
    existingJobs: drafts.map(({ sourceUrl, role }) => ({ sourceUrl, role })),
    preferredResumeId: attachmentSource?.id,
    onConnect: () => openSettings('local'),
    onBusy: setBusy,
    discover: (url, keywords) => agent.request<CareerDiscovery>('/discover', { url, ...(keywords?.length ? { keywords } : {}) }),
    read: url => agent.request<CareerPage>('/extract', { url }),
    onImport: async (pages, resume) => {
      if (busy || preview) throw new Error('当前操作尚未完成，请稍后再加入清单。')
      const additions = prepareAssistantDrafts(pages, drafts, defaults, snapshot?.sender)
      if (!additions.length) return
      const file = validResumeAttachment(resume.attachment) ? resume.attachment : null
      const source = file ? { id: resume.id, updatedAt: resume.attachmentUpdatedAt ?? resume.updatedAt } : undefined
      if (drafts.length && attachment && (!source || attachmentSource?.id !== source.id || attachmentSource.updatedAt !== source.updatedAt)) {
        throw new Error('清单中已有使用其他简历的岗位。请先处理当前清单，或使用同一份简历查找。')
      }
      const nextDrafts = [...drafts, ...additions]
      const nextSelected = [...selectedDraftIds, ...additions.map(draft => draft.id)]
      setBusy(true)
      try {
        await persistWorkspace({ drafts: nextDrafts, attachment: file, attachmentSource: source, selectedIds: nextSelected })
        setDrafts(nextDrafts); setSelectedDraftIds(nextSelected); setAttachment(file); setAttachmentSource(source)
        setTab('drafts'); setError('')
      } finally { setBusy(false) }
    },
  }
  const addCareerPage = (result: CareerPage) => {
    const id = crypto.randomUUID()
    const draft: Draft = { id, company: result.company ?? '', role: result.role || defaults.role, sourceUrl: result.url, recipient: result.recommendedEmail ?? '', subject: '', body: '', sourceConfirmed: false, automatic: true, extraction: result, jobDescription: result.jobDescription ?? '' }
    setDrafts(items => items.length >= 20 || items.some(item => { try { return careerUrlKey(item.sourceUrl) === careerUrlKey(result.url) && item.role === draft.role } catch { return false } }) ? items : [...items, draft])
    setSelectedDraftIds(items => [...items, id]); setSelectedId(id); setFocusRequest(null); setError('')
  }
  const returnWebsiteToDrafts = (entry: ApplicationEntry) => {
    const record = entry.website
    if (!record) return
    try { assertDraftCapacity(record.id) } catch (cause) { setError(cause instanceof Error ? cause.message : '无法移回待投递清单。'); return }
    const { channel: _channel, applicationUrl: _url, appliedAt: _at, ...draft } = record
    setWebsiteApplications(items => items.filter(item => item.id !== entry.id))
    setDrafts(items => items.some(item => item.id === draft.id) ? items : [...items, draft])
    setSelectedDraftIds(items => [...new Set([...items, draft.id])])
    setSelectedId(draft.id)
    setTab('drafts')
    setError('')
  }

  const applyTailoring = async (change: Partial<Draft>, saved: SavedJobPreparation) => {
    if (!tailoring) throw new Error('没有正在修改的岗位。')

    const current = drafts.find(draft => draft.id === tailoring.draft.id)
    if (!current || current.jobDescription !== tailoring.draft.jobDescription || current.company !== tailoring.draft.company || current.role !== tailoring.draft.role) throw new Error('岗位内容已变化，请重新生成修改稿。')
    const updated = updateDraft(current, change)
    const nextDrafts = drafts.map(draft => draft.id === current.id ? updated : draft)
    const nextPreparation = { ...preparationByJob, [current.id]: saved }
    const prepared = snapshot?.sender ? await createMailPreviewBatch([updated], nextPreparation, attachment, attachmentSource, snapshot.sender) : null
    const savedPreparation = prepared ? { ...nextPreparation, ...prepared.captured } : nextPreparation
    await persistWorkspace({ drafts: nextDrafts, preparationByJob: savedPreparation })
    setDrafts(nextDrafts); setPreparationByJob(savedPreparation); setSelectedId(current.id)
    if (prepared) { setPreviewPreparation(prepared.captured); setPreview(prepared.batch) }
    setTailoring(null)
  }

  const saveDefaults = async (value: MailDefaults) => {
    const updated = applyMailDefaults(drafts, value, snapshot?.sender)
    await persistWorkspace({ drafts: updated, defaults: value })
    setDefaults(value); setDrafts(updated)
  }

  const sendPreview = async (batch: MailBatch) => {
    const sentPreparation = Object.fromEntries(batch.jobs.map(job => [job.id, { ...previewPreparation[job.id], attachmentUse: 'mail' as const }]))
    const nextPreparation = { ...preparationByJob, ...sentPreparation }
    await persistWorkspace({ preparationByJob: nextPreparation })
    setPreparationByJob(nextPreparation)
    await tracking.capture(captureMailSubmissions(batch, Object.fromEntries(Object.entries(sentPreparation).map(([id, value]) => [id, value.jobDescription ?? ''])), Date.now()))
    await agent.command('/batches', batch)
    setDrafts(items => items.filter(item => !batch.jobs.some(job => job.id === item.id)))
    setPreview(null); setTab('history'); setSelectedId(batch.jobs[0].id); setError('')
  }

  const editPreview = (id: string, change: { subject?: string; body?: string }) => {
    setPreview(current => current ? { ...current, jobs: current.jobs.map(job => job.id === id ? { ...job, ...change } : job) } : null)
    setDrafts(items => items.map(item => item.id === id ? updateDraft(item, change) : item))
  }

  const extractSelected = async () => {
    if (!selected) return
    const id = selected.id; const original = selected.sourceUrl
    setBusy(true); setError('')
    try {
      const result = await agent.request<CareerPage>('/extract', { url: original })
      setDrafts(items => items.map(item => item.id === id && item.sourceUrl === original ? applyCareerPage(item, result) : item))
    } finally { setBusy(false) }
  }

  const chooseFile = (file?: File) => {
    if (file) {
      if (!validResumeAttachment(file)) setError('请选择 5 MB 以内的 PDF、DOCX 或 TXT 简历')
      else {
        setAttachment(file); setAttachmentSource(undefined); setError(''); setAttachmentOpen(false)
        const pending = pendingPreparation.current
        pendingPreparation.current = null
        if (pending && pending.id === selected?.id) void run(() => prepareJob(pending.intent, file))
        const tailorId = pendingTailoring.current
        pendingTailoring.current = null
        const tailorDraft = drafts.find(draft => draft.id === tailorId)
        if (tailorDraft) startTailoring(tailorDraft, file)
        const previewIds = pendingPreview.current
        pendingPreview.current = null
        if (previewIds) void run(() => preparePreview(drafts.filter(draft => previewIds.includes(draft.id)), drafts, selectedDraftIds, preparationByJob, file))
      }
    }

  }

  return {
    agent, error, setError, drafts, setDrafts, defaults, setDefaults, selectedDraftIds,
    setSelectedDraftIds, attachment, setAttachment, attachmentSource, setAttachmentSource,
    libraryAttachments, libraryError, hydrated, preparationByJob, setPreparationByJob,
    setSelectedId, tab, isCareers, isJobs, defaultsOpen, setDefaultsOpen, addOpen,
    setAddOpen, inputMode, setInputMode, editOpen, setEditOpen, showDossier, setShowDossier,
    recordDialog, setRecordDialog, confirmation, undo, attachmentOpen, setAttachmentOpen,
    focusRequest, settingsDialog, openSettings, preview, setPreview, busy, setBusy,
    websiteIds, setWebsiteIds, websiteChoices, setWebsiteChoices, tailoring, setTailoring,
    fileInput, snapshot, tracking, entries, selectedEntry, selected, pending, selectedReadyDrafts,
    selectedWebsiteCount, selectedPreparation, selectedDescription, startTailoring,
    attachmentLabel, run, updateById, update, prepareJob, addDraft, importContacts,
    removeDraft, preparePreview, previewQuickMail, jobAction, openDraft, markApplied,
    deleteEntry, saveRecord, assistantTools, addCareerPage, returnWebsiteToDrafts,
    chooseFile, extractSelected, applyTailoring, saveDefaults, sendPreview, editPreview,
  }
}
