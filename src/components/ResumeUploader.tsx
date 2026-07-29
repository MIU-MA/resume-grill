'use client'

import { useState } from 'react'
import { FileText, Loader2, Upload, FileSearch, Settings } from 'lucide-react'
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
  const [showSettings, setShowSettings] = useState(false)

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

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-canvas px-5 py-10">
      {/* 设置入口 — 右上角浮动齿轮 */}
      <button
        type="button"
        onClick={() => setShowSettings((v) => !v)}
        className="fixed top-4 right-4 z-20 grid size-9 place-items-center rounded-full border border-line bg-white text-muted hover:bg-[#f0f3f5] transition-colors"
        aria-label="模型设置"
      >
        <Settings size={16} />
      </button>

      {/* 模型设置浮层 */}
      {showSettings && (
        <div className="fixed top-14 right-4 z-30 w-[380px] max-w-[calc(100vw-40px)]">
          <ModelSettings
            envConfigured={envConfigured}
            clientConfigured={clientConfigured}
            onClientChanged={() => {
              onClientChanged()
              setShowSettings(false)
            }}
          />
        </div>
      )}

      <div className="mb-8 flex flex-col items-center gap-4">
        <div className="grid size-11 place-items-center rounded-xl text-white bg-[#1b2328]"><FileSearch size={22} /></div>
        <div className="text-center">
          <strong className="block text-[22px] font-bold tracking-tight text-[#182025] leading-[1.2]">上传你的简历</strong>
          <span className="mt-1 block text-muted text-xs">Resume Grill — 找出经不起追问的声明</span>
        </div>
      </div>

      <div className="w-full max-w-[480px]">
        <label className="flex min-h-[128px] cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-line-strong bg-white px-6 py-6 text-center transition-[border-color,background,color] duration-[160ms] hover:border-brand hover:bg-brand-soft hover:[&_svg]:text-brand">
          <input
            type="file"
            accept=".pdf,.txt,.md"
            hidden
            onChange={(event) => {
              const file = event.target.files?.[0]
              if (file) handleFile(file).catch(() => undefined)
            }}
          />
          {analyzing ? <Loader2 size={22} className="animate-spin text-faint" /> : <Upload size={22} className="text-faint transition-colors duration-[160ms]" />}
          <strong className="text-[13px] font-650 text-[#30373c]">{analyzing ? '解析中…' : '点击上传 PDF / 文本简历'}</strong>
          <small className="text-faint text-[10px]">{fileName ?? '支持 .pdf / .txt / .md'}</small>
        </label>

        <div className="my-5 flex items-center gap-3 text-faint text-[10px] before:flex-1 before:h-px before:bg-line after:flex-1 after:h-px after:bg-line">或</div>

        <textarea
          className="w-full min-h-[120px] resize-y rounded-lg border border-line-strong bg-white p-3 text-xs leading-relaxed text-[#283136] placeholder:text-faint focus:border-brand focus:outline-brand"
          placeholder={SAMPLE_RESUME.slice(0, 80) + '…'}
          value={paste}
          onChange={(event) => setPaste(event.target.value)}
          disabled={analyzing}
        />

        <div className="mt-5 flex flex-col items-center gap-3">
          <Button variant="primary" size="large" className="w-full h-11 text-sm" disabled={analyzing || paste.trim().length === 0} onClick={handlePaste}>
            开始压力测试
          </Button>
          <button
            type="button"
            className="bg-transparent text-muted text-[10px] hover:text-ink transition-colors"
            disabled={analyzing}
            onClick={() => onExtracted({ text: SAMPLE_RESUME, pageCount: 1, charCount: SAMPLE_RESUME.length }, '示例简历.txt')}
          >
            <FileText size={11} className="inline mr-1" />使用示例简历
          </button>
        </div>

        {error && <p className="mt-4 rounded-[0_4px_4px_0] border-l-[3px] border-red bg-red-soft px-3 py-[9px] text-[11px] leading-[1.55] text-[#a13232]">{error}</p>}
      </div>
    </div>
  )
}
