'use client'

import { useState } from 'react'
import { FileText, Loader2, Sparkles, Upload, FileSearch } from 'lucide-react'
import { ModelSettings } from '@/components/ModelSettings'
import { extractTextFromFile, type ExtractedText } from '@/lib/pdf'

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
      // 提取失败：带空文本进入确认页，让用户看到错误并重传
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
    <div className="uploader">
      <div className="uploader-brand">
        <div className="brand-mark"><FileSearch size={20} /></div>
        <div>
          <strong>简历拷打机</strong>
          <span>Resume Drill</span>
        </div>
      </div>

      <div className="uploader-card">
        <div className="uploader-eyebrow">RESUME DRILL</div>
        <h1>找出经不起追问的简历声明</h1>
        <p className="uploader-sub">
          不是根据岗位随机生成八股，而是验证你简历里的每一句成果 / 职责 / 技能声明是否经得起追问。
          简历在浏览器本地解析，不会上传永久存储。
        </p>

        <ModelSettings
          envConfigured={envConfigured}
          clientConfigured={clientConfigured}
          onClientChanged={onClientChanged}
        />

        <div className="uploader-section-label"><Upload size={12} />上传简历</div>
        <label className="dropzone">
          <input
            type="file"
            accept=".pdf,.txt,.md"
            hidden
            onChange={(event) => {
              const file = event.target.files?.[0]
              if (file) handleFile(file).catch(() => undefined)
            }}
          />
          {analyzing ? <Loader2 size={24} className="spin" /> : <Upload size={24} />}
          <strong>{analyzing ? '正在解析与提取声明…' : '点击上传 PDF / 文本简历'}</strong>
          <small>{fileName ?? '支持 .pdf / .txt / .md，.doc 暂不支持'}</small>
        </label>

        <div className="uploader-divider"><span>或粘贴文本</span></div>

        <textarea
          className="paste-area"
          placeholder={SAMPLE_RESUME.slice(0, 80) + '…'}
          value={paste}
          onChange={(event) => setPaste(event.target.value)}
          disabled={analyzing}
        />

        <div className="uploader-actions">
          <button type="button" className="button secondary" disabled={analyzing} onClick={handleSample}>
            <Sparkles size={14} />使用示例简历
          </button>
          <button type="button" className="button primary large" disabled={analyzing || paste.trim().length === 0} onClick={handlePaste}>
            <FileText size={14} />分析粘贴文本
          </button>
        </div>

        {error && <p className="uploader-error">{error}</p>}
      </div>
    </div>
  )
}
