'use client'

import { useState } from 'react'
import { FileText, Loader2, Sparkles, Upload, FileSearch } from 'lucide-react'
import { ModelSettings } from '@/components/ModelSettings'
import { extractTextFromFile, type ExtractedText } from '@/lib/pdf'
import { Button } from '@/components/Button'

const SAMPLE_RESUME = `张明
高级销售经理 | 5 年 B2B 销售经验

工作经历：
XX科技 销售经理 2021-2023
- 负责华东区大客户开发与维护，带领 8 人销售团队
- 季度销售额提升 30%，年签约金额突破 2000 万
- 主导会员系统改版项目，推动客户续约率从 65% 提升到 82%
- 优化销售跟进流程，平均成单周期缩短 15 天

YY集团 销售代表 2019-2021
- 参与重点行业客户拓展，累计开发新客户 120 家
- 获年度最佳新人奖

技能：熟练使用 CRM 系统与数据分析工具，具备跨部门协作能力`

type ResumeUploaderProps = {
  analyzing: boolean
  error: string | null
  onExtracted: (extracted: ExtractedText, sourceFile: string) => void
  envConfigured: boolean
  clientConfigured: boolean
  onClientChanged: () => void
}

export function ResumeUploader({ analyzing, error, onExtracted, envConfigured, clientConfigured, onClientChanged }: ResumeUploaderProps) {
  const [paste, setPaste] = useState('')
  const [fileName, setFileName] = useState<string | null>(null)

  const handleFile = async (file?: File) => {
    if (!file) return
    setFileName(file.name)
    try {
      const extracted = await extractTextFromFile(file)
      onExtracted(extracted, file.name)
    } catch (e) {
      onExtracted({ text: '', pageCount: 0, charCount: 0 }, file.name)
      throw e
    }
  }

  const handlePaste = () => {
    const text = paste.trim()
    if (text.length > 0) onExtracted({ text, pageCount: 1, charCount: text.length }, '粘贴文本')
  }

  const handleSample = () => {
    onExtracted({ text: SAMPLE_RESUME, pageCount: 1, charCount: SAMPLE_RESUME.length }, '示例简历.txt')
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-canvas px-5 py-10">
      <div className="mb-6 flex items-center gap-[10px]">
        <div className="grid size-[30px] place-items-center rounded-[5px] text-white bg-[#1b2328]"><FileSearch size={20} /></div>
        <div>
          <strong className="text-[15px] leading-[1.3]">简历拷打机</strong>
          <span className="block text-faint text-[9px] uppercase">Resume Drill</span>
        </div>
      </div>

      <div className="w-full max-w-[540px] rounded-[4px] border border-line border-t-[3px] border-t-brand bg-surface px-7 pt-7 pb-[26px] shadow-[0_1px_0_var(--color-line),0_8px_24px_rgba(27,40,34,.04)]">
        <div className="mb-[6px] text-brand text-[9px] font-750 tracking-[0.08em]">RESUME DRILL</div>
        <h1 className="m-0 mb-[7px] text-[17px] font-bold leading-[1.4] text-[#182025]">找出经不起追问的简历声明</h1>
        <p className="m-0 mb-5 text-muted text-[11px] leading-[1.65]">
          不是根据岗位随机生成八股，而是验证你简历里的每一句成果 / 职责 / 技能声明是否经得起追问。
          简历在浏览器本地解析，不会上传永久存储。
        </p>

        <ModelSettings
          envConfigured={envConfigured}
          clientConfigured={clientConfigured}
          onClientChanged={onClientChanged}
        />

        <div className="mt-1 mb-2 flex items-center gap-[5px] text-muted text-[9px] font-700 uppercase"><Upload size={12} className="text-faint" />上传简历</div>
        <label className="flex min-h-[132px] cursor-pointer flex-col items-center justify-center gap-[7px] rounded-[4px] border border-dashed border-line-strong bg-[#fafbfb] px-5 py-[22px] text-center transition-[border-color,background,color] duration-[160ms] hover:border-brand hover:bg-brand-soft hover:[&_svg]:text-brand">
          <input
            type="file"
            accept=".pdf,.txt,.md"
            hidden
            onChange={(event) => {
              const file = event.target.files?.[0]
              if (file) handleFile(file).catch(() => undefined)
            }}
          />
          {analyzing ? <Loader2 size={24} className="animate-spin text-faint" /> : <Upload size={24} className="text-faint transition-colors duration-[160ms]" />}
          <strong className="text-[12px] font-650 text-[#30373c]">{analyzing ? '正在解析与提取声明…' : '点击上传 PDF / 文本简历'}</strong>
          <small className="text-faint text-[9px]">{fileName ?? '支持 .pdf / .txt / .md，.doc 暂不支持'}</small>
        </label>

        <div className="my-4 flex items-center gap-3 text-faint text-[9px] before:flex-1 before:h-px before:bg-line after:flex-1 after:h-px after:bg-line"><span>或粘贴文本</span></div>

        <textarea
          className="w-full min-h-[104px] resize-y rounded-[4px] border border-line-strong bg-white p-[11px] text-[11px] leading-[1.7] text-[#283136] focus:border-brand focus:outline-2 focus:outline-brand focus:outline-offset-[-1px]"
          placeholder={SAMPLE_RESUME.slice(0, 80) + '…'}
          value={paste}
          onChange={(event) => setPaste(event.target.value)}
          disabled={analyzing}
        />

        <div className="mt-4 flex items-center justify-end gap-[9px]">
          <Button variant="secondary" disabled={analyzing} onClick={handleSample}>
            <Sparkles size={14} />使用示例简历
          </Button>
          <Button variant="primary" size="large" disabled={analyzing || paste.trim().length === 0} onClick={handlePaste}>
            <FileText size={14} />分析粘贴文本
          </Button>
        </div>

        {error && <p className="mt-[14px] rounded-[0_3px_3px_0] border-l-[3px] border-red bg-red-soft px-3 py-[9px] text-[10px] leading-[1.55] text-[#a13232]">{error}</p>}
      </div>
    </div>
  )
}
