'use client'

import { useState } from 'react'
import { Loader2, RefreshCw, Settings } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { DiagnosisExportButton, DiagnosisToolbar, ResumeDiagnosisReport } from './ResumeDiagnosisReport'
import type { useResumeDiagnosis } from '@/hooks/use-resume-diagnosis'

type Props = {
  diagnosis: ReturnType<typeof useResumeDiagnosis>
  configured: boolean
  demo: boolean
  analyzing: boolean
  jobDescription: string
  onJobDescriptionChange: (value: string) => void
  onConfigure: () => void
}

export function ResumeDiagnosisStep({ diagnosis, configured, demo, analyzing, jobDescription, onJobDescriptionChange, onConfigure }: Props) {
  const [jobOpen, setJobOpen] = useState(false)
  const actions = <>
    <Button className="h-8 px-2.5 text-[12px]" variant="ghost" disabled={analyzing} aria-expanded={jobOpen} onClick={() => setJobOpen(!jobOpen)}>岗位描述{jobDescription.trim() ? ' · 已填写' : ''}</Button>
    {configured || demo ? (
      <Button className="h-8 px-2.5 text-[12px]" variant="ghost" disabled={diagnosis.loading || analyzing} onClick={() => { void diagnosis.generate() }}>
        {diagnosis.loading ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
        {diagnosis.loading ? '检查中' : diagnosis.report || diagnosis.stale ? '重新检查' : '开始检查'}
      </Button>
    ) : <Button className="h-8 px-2.5 text-[12px]" variant="secondary" disabled={analyzing} onClick={onConfigure}><Settings size={14} />配置模型</Button>}
    {diagnosis.loading && <Button className="h-8 px-2.5 text-[12px]" variant="ghost" onClick={diagnosis.cancel}>取消</Button>}
    {diagnosis.report && <DiagnosisExportButton diagnosis={diagnosis.report} />}
  </>
  const notice = <>
    {jobOpen && <label className="block flex-none border-b border-line bg-surface-soft px-4 py-4 text-[12px] text-text-secondary sm:px-6">
      目标岗位描述（可选）
      <textarea className="mt-2 block h-24 w-full resize-none border border-line-strong bg-white p-3 text-[13px] leading-relaxed focus:border-brand focus:outline-brand" value={jobDescription} maxLength={12000} disabled={analyzing} onChange={(event) => onJobDescriptionChange(event.target.value)} placeholder="粘贴岗位要求，填写后重新检查。" />
    </label>}
    {diagnosis.loading && <div role="status" className="flex flex-none items-center gap-2 border-b border-line px-6 py-3 text-[12px] text-text-secondary"><Loader2 size={14} className="animate-spin" />正在检查简历，也可以先去选择练习内容。</div>}
    {diagnosis.error && <p role="alert" className="m-0 flex-none border-b border-line px-6 py-3 text-[12px] leading-relaxed text-danger">{diagnosis.error}</p>}
    {diagnosis.stale && !diagnosis.loading && <p role="status" className="m-0 flex-none border-b border-line px-6 py-3 text-[12px] text-text-secondary">文本已修改，重新检查后显示最新结果。</p>}
  </>

  return (
    <section className="flex h-full min-h-0 flex-col" aria-label="简历检查">
      <DiagnosisToolbar diagnosis={diagnosis.report ?? undefined} actions={actions} />
      {notice}
      {diagnosis.report ? <div className="min-h-0 flex-1"><ResumeDiagnosisReport diagnosis={diagnosis.report} showToolbar={false} /></div>
        : !diagnosis.loading && <div className="min-h-0 flex-1 overflow-y-auto px-6 py-10 text-[14px] leading-relaxed text-text-tertiary">
          {diagnosis.stale ? '旧结果已收起。' : configured || demo ? '暂无检查结果。点击「开始检查」。' : '简历已导入。配置模型后可以检查，也可以先选择练习内容。'}
        </div>}
    </section>
  )
}
