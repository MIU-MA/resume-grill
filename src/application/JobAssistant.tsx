'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import type { JobAssistantTools } from '@/domain/job-assistant'
import { SettingsDialog } from '@/features/settings/SettingsDialog'
import { getLlmSettings } from '@/lib/settings'
import { useJobAssistant } from './hooks/use-job-assistant'

const labels = { match: '值得看', review: '待核对', skip: '暂不匹配' }
const tones = { match: 'success', review: 'warning', skip: 'neutral' }
const checkLabels = { supported: '有相关经历', fits_goal: '符合意向', missing: '简历未体现', conflict: '条件不符', unknown: '信息不足' }

export function JobAssistant({ tools, envConfigured }: { tools: JobAssistantTools; envConfigured: boolean }) {
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [clientConfigured, setClientConfigured] = useState(false)
  const assistant = useJobAssistant(tools, envConfigured, () => { setClientConfigured(!!getLlmSettings()); setSettingsOpen(true) })
  const [selected, setSelected] = useState<string[]>([])
  const [filter, setFilter] = useState<'all' | 'match' | 'review' | 'skip'>('all')
  const [importing, setImporting] = useState(false)
  const [importMessage, setImportMessage] = useState('')
  const { task, running, hydrated } = assistant
  const alreadyAdded = (url: string, role: string) => tools.existingJobs.some(job => job.sourceUrl === url && job.role === role)
  const chosen = task?.jobs.filter(job => selected.includes(job.id) && job.assessment && !alreadyAdded(job.page.url, job.page.role)) ?? []
  const locked = running || importing || tools.disabled
  const jobs = task?.jobs.filter(job => filter === 'all' || job.assessment?.verdict === filter) ?? []
  return <section className="border-b border-line bg-surface px-5 py-4" aria-label="求职助手">
    <label className="mail-label">这次想找什么工作？<textarea className="mail-input min-h-20 resize-y leading-relaxed" maxLength={2000} disabled={locked || !hydrated} value={assistant.goal} onChange={event => assistant.setGoal(event.target.value)} onBlur={() => void assistant.saveGoal()} placeholder="例如：杭州的前端实习，主要用 React，优先中小公司。也可以在这里附上招聘官网链接。" /></label>
    <div className="mt-3 flex flex-wrap items-center gap-3">
      <label className="flex min-w-0 flex-1 items-center gap-2 text-[12px] text-text-secondary">使用简历<select aria-label="求职助手使用的简历" className="mail-input min-w-0 flex-1" value={assistant.resumeId} disabled={locked || !hydrated} onChange={event => assistant.setResumeId(event.target.value)}><option value="" disabled>选择简历</option>{assistant.documents.map(doc => <option key={doc.id} value={doc.id}>{doc.sourceFile}</option>)}</select></label>
      {running ? <Button variant="secondary" disabled={assistant.pausing} onClick={assistant.pause}>{assistant.pausing ? '当前步骤结束后暂停' : '暂停'}</Button> : <>
        <Button disabled={locked || !hydrated || !assistant.goal.trim() || !assistant.resumeId} onClick={() => { setSelected([]); setImportMessage(''); void assistant.execute('new') }}>开始查找</Button>
        {task?.status === 'paused' && <Button variant="secondary" disabled={locked} onClick={() => void assistant.execute('resume')}>继续上次任务</Button>}
      </>}
      <button className="text-[12px] text-text-secondary underline" onClick={() => { setClientConfigured(!!getLlmSettings()); setSettingsOpen(true) }}>模型设置</button>
    </div>
    <p className="mb-0 mt-2 text-[11px] leading-relaxed text-text-tertiary">从收录的官网和你提供的链接查找，每次最多读取 8 个来源、整理 30 个岗位。会将所选简历文字和岗位要求发送给配置的模型，可能产生调用费用。条件和最近一次任务保存在本机浏览器。</p>
    {hydrated && !assistant.documents.length && <p className="text-[12px] text-warning">先到简历库导入一份简历，就可以开始。</p>}
    {assistant.error && <p role="alert" className="text-[12px] text-danger">{assistant.error}</p>}
    {task && <div className="mt-4 border-t border-line pt-3">
      <p role="status" className="m-0 text-[12px] text-text-secondary">{task.message || '任务已保存，可以继续。'}</p>
      <p className="mb-2 mt-1 text-[11px] text-text-tertiary">本次目标：{task.goal} · 简历：{task.resume.name}（{new Date(task.resume.updatedAt).toLocaleString('zh-CN')} 保存）</p>
      {!!task.sources.length && <details className="text-[12px] text-text-secondary"><summary className="cursor-pointer">查看查找范围 · {task.sources.filter(source => source.status !== 'pending').length}/{task.sources.length} 个官网已处理</summary><div className="mt-2 space-y-1">{task.sources.map(source => <div key={source.url}><a href={source.url} target="_blank" rel="noopener noreferrer" className="underline">{source.company}</a><span className="ml-2">{source.status === 'done' ? '已读取' : source.status === 'failed' ? source.error : '待读取'}</span></div>)}</div></details>}
      {!running && task.sources.some(source => source.status === 'failed') && task.jobs.length < 30 && <button className="mt-2 text-[12px] text-accent underline" disabled={locked} onClick={() => void assistant.execute('retry')}>重试未读到的官网</button>}
      {!!task.jobs.length && <>
        <div className="my-3 flex flex-wrap items-center gap-3 text-[12px]">
          <select aria-label="筛选匹配结果" className="mail-input" value={filter} onChange={event => setFilter(event.target.value as typeof filter)}><option value="all">全部岗位（{task.jobs.length}）</option>{(['match', 'review', 'skip'] as const).map(value => <option key={value} value={value}>{labels[value]}（{task.jobs.filter(job => job.assessment?.verdict === value).length}）</option>)}</select>
          <span className="text-text-tertiary">已选 {chosen.length} 个 · 清单还能添加 {tools.slots} 个</span>
          <Button className="ml-auto h-8 px-3 text-[12px]" loading={importing} disabled={locked || !chosen.length || chosen.length > tools.slots} onClick={() => {
            setImporting(true); assistant.setError(''); setImportMessage('')
            void tools.onImport(chosen.map(job => job.page), task.resume).then(() => { setSelected([]); setImportMessage('已加入下方投递清单；设置好发件人后自动填好邮件。') }).catch(cause => assistant.setError(cause instanceof Error ? cause.message : '加入清单失败，请重试。')).finally(() => setImporting(false))
          }}>加入清单并准备邮件</Button>
        </div>
        <div className="divide-y divide-line border border-line" aria-label="求职匹配结果">
          {jobs.map(job => {
            const added = alreadyAdded(job.page.url, job.page.role)
            return <article key={job.id} className="p-3 text-[12px]">
              <div className="flex items-start gap-2"><input type="checkbox" className="mt-1" aria-label={`选择 ${job.page.company} ${job.page.role}`} checked={added || selected.includes(job.id)} disabled={locked || added || !job.assessment} onChange={event => setSelected(current => event.target.checked ? [...current, job.id] : current.filter(id => id !== job.id))} /><div className="min-w-0 flex-1"><a className="font-medium underline" href={job.page.url} target="_blank" rel="noopener noreferrer">{job.page.company || '公司待核对'} · {job.page.role}</a><p className="mb-0 mt-1 leading-relaxed text-text-secondary">{job.assessment?.summary ?? '等待对照简历核对'}</p></div><span className="workbench-status shrink-0" data-tone={added ? 'success' : job.assessment ? tones[job.assessment.verdict] : 'neutral'}>{added ? '已加入' : job.assessment ? labels[job.assessment.verdict] : '待分析'}</span></div>
              {job.assessment && <details className="ml-5 mt-2"><summary className="cursor-pointer text-text-tertiary">查看判断依据</summary>{job.assessment.checks.map((check, index) => <div key={index} className="mt-2 border-l-2 border-line pl-3 leading-relaxed"><strong className="font-medium">{check.requirement} · {checkLabels[check.status]}</strong>{check.jobQuote && <p className="my-1 text-text-secondary">招聘原文：{check.jobQuote}</p>}{check.resumeQuote && <p className="my-1 text-text-secondary">简历原文：{check.resumeQuote}</p>}</div>)}</details>}
            </article>
          })}
          {!jobs.length && <p className="p-3 text-[12px] text-text-tertiary">没有这类结果。</p>}
        </div>
      </>}
      {importMessage && <p role="status" className="mb-0 text-[12px] text-success">{importMessage}</p>}
    </div>}
    <SettingsDialog open={settingsOpen} onClose={() => setSettingsOpen(false)} envConfigured={envConfigured} clientConfigured={clientConfigured} onClientChanged={() => setClientConfigured(!!getLlmSettings())} />
  </section>
}
