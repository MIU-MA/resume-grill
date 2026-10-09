'use client'

import { ExternalLink, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { sourceUrlSchema } from '@/domain/mail-schema'
import { draftIssues, websiteLinks, type Draft } from './draft-state'

export function DraftTable({ drafts, selectedIds, disabled, onSelection, onUpdate, onOpen, onRemove, onAdd }: {
  drafts: Draft[]; selectedIds: string[]; disabled: boolean
  onSelection: (ids: string[]) => void; onUpdate: (id: string, change: Partial<Draft>) => void
  onOpen: (id: string) => void; onRemove: (id: string) => void; onAdd: () => void
}) {
  const checked = new Set(selectedIds)
  const all = drafts.length > 0 && drafts.every(draft => checked.has(draft.id))
  const ready = drafts.filter(draft => !draftIssues(draft).length)
  const needsAttention = drafts.filter(draft => draftIssues(draft).length && !websiteLinks(draft).length)
  if (!drafts.length) return <div className="px-5 py-8 text-[13px]">
    <h2 className="mb-2 mt-0 text-[17px] font-semibold">把要投的岗位放进清单</h2>
    <p className="mb-4 leading-relaxed text-text-secondary">在上方读取官网、选择职位，公司和投递信息会一起带入。也可以粘贴名单或招聘正文。</p>
    <Button variant="secondary" disabled={disabled} onClick={onAdd}>补录一个岗位</Button>
  </div>
  return <section className="flex min-h-0 flex-1 flex-col" aria-label="批量核对投递名单">
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-line px-5 py-2.5 text-[12px]">
      <span>{selectedIds.filter(id => drafts.some(draft => draft.id === id)).length} 个选中 · {ready.length} 个可发送</span>
      {!!needsAttention.length && <span className="workbench-status" data-tone="warning">{needsAttention.length} 个待补充</span>}
      <button type="button" className="text-text-secondary underline disabled:opacity-40" disabled={disabled || !ready.length} onClick={() => onSelection(ready.map(draft => draft.id))}>只选可发送</button>
      <span className="ml-auto text-[11px] text-text-tertiary">缺项直接在表格补充；正文按需打开。</span>
    </div>
    <div className="min-h-0 flex-1 overflow-auto">
      <table className="w-full min-w-[920px] table-fixed border-collapse text-left text-[12px]">
        <thead className="sticky top-0 z-10 bg-surface-soft text-text-secondary"><tr>
          <th className="w-12 border-b border-line px-4 py-3 font-normal"><input type="checkbox" aria-label="选择全部岗位" disabled={disabled} checked={all} ref={node => { if (node) node.indeterminate = !all && drafts.some(draft => checked.has(draft.id)) }} onChange={event => onSelection(event.target.checked ? drafts.map(draft => draft.id) : [])} /></th>
          <th className="w-[20%] border-b border-line px-3 py-3 font-normal">公司</th><th className="w-[20%] border-b border-line px-3 py-3 font-normal">岗位</th><th className="w-[25%] border-b border-line px-3 py-3 font-normal">招聘邮箱</th><th className="border-b border-line px-3 py-3 font-normal">核对情况</th><th className="w-[100px] border-b border-line px-3 py-3 font-normal">邮件 / 详情</th>
        </tr></thead>
        <tbody>{drafts.map(draft => {
          const issues = draftIssues(draft)
          const website = websiteLinks(draft).length > 0
          const candidates = draft.extraction?.url === draft.sourceUrl ? draft.extraction.emails : []
          return <tr key={draft.id} className="border-b border-line hover:bg-surface-soft">
            <td className="px-4 py-3 align-top"><input type="checkbox" aria-label={`选择 ${draft.company || '未填公司'} ${draft.role || '未填岗位'}`} disabled={disabled} checked={checked.has(draft.id)} onChange={event => onSelection(event.target.checked ? [...selectedIds, draft.id] : selectedIds.filter(id => id !== draft.id))} /></td>
            <td className="px-3 py-2 align-top"><input className="mail-input !border-transparent !bg-transparent !px-0 focus:!border-brand" aria-label={`公司 ${draft.id}`} value={draft.company} maxLength={120} disabled={disabled} placeholder="补充公司" onChange={event => onUpdate(draft.id, { company: event.target.value })} /></td>
            <td className="px-3 py-2 align-top"><input className="mail-input !border-transparent !bg-transparent !px-0 focus:!border-brand" aria-label={`岗位 ${draft.id}`} value={draft.role} maxLength={120} disabled={disabled} placeholder="补充岗位" onChange={event => onUpdate(draft.id, { role: event.target.value })} /></td>
            <td className="px-3 py-2 align-top">{website ? <button type="button" disabled={disabled} onClick={() => onOpen(draft.id)} className="flex h-9 items-center gap-1 text-accent underline">官网申请<ExternalLink size={12} /></button> : <>
              <input className="mail-input !border-transparent !bg-transparent !px-0 focus:!border-brand" aria-label={`招聘邮箱 ${draft.id}`} type="email" value={draft.recipient} disabled={disabled} placeholder={candidates.length ? '在下方选择邮箱' : '补充招聘邮箱'} onChange={event => onUpdate(draft.id, { recipient: event.target.value })} />
              {!draft.recipient && !!candidates.length && <select className="mail-input w-full text-[11px]" aria-label={`选择 ${draft.company} ${draft.role} 的官网邮箱`} value="" disabled={disabled} onChange={event => { if (event.target.value) onUpdate(draft.id, { recipient: event.target.value }) }}>
                <option value="">选择页面中的邮箱</option>{candidates.map(candidate => <option key={candidate.email} value={candidate.email}>{candidate.email} · {candidate.context.slice(0, 60)}</option>)}
              </select>}
            </>}</td>
            <td className="px-3 py-3 align-top"><span className="workbench-status leading-relaxed" data-tone={website ? 'info' : issues.length ? 'warning' : 'success'}>{website ? '原站填写' : issues.length ? issues.map(issue => issue.label).join(' · ') : '可发送'}</span>{sourceUrlSchema.safeParse(draft.sourceUrl).success && <a href={draft.sourceUrl} target="_blank" rel="noopener noreferrer" className="mt-1 block truncate text-[11px] text-text-tertiary underline">查看来源</a>}</td>
            <td className="px-3 py-3 align-top"><div className="flex items-center gap-3"><button type="button" disabled={disabled} onClick={() => onOpen(draft.id)} className="text-accent underline">{website ? '打开' : '查看'}</button><button type="button" disabled={disabled} title="移除岗位" aria-label={`移除 ${draft.company || '岗位'}`} className="text-text-tertiary hover:text-danger" onClick={() => onRemove(draft.id)}><Trash2 size={13} /></button></div></td>
          </tr>
        })}</tbody>
      </table>
    </div>
  </section>
}
