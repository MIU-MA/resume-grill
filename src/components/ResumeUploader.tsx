'use client'

import { useState } from 'react'
import { FileText, Upload } from 'lucide-react'
import { SettingsPopover } from '@/components/SettingsPopover'
import { extractTextFromFile, type ExtractedText } from '@/lib/pdf'
import { Button } from '@/components/Button'

const SAMPLE_RESUME = `xxx
全栈工程师 | 4 年 Web 开发经验

项目经历：

AI 网页生成平台 2023.06 - 2024.03
- 负责核心编辑器前端架构，基于 React 18 + Zustand 重构状态管理，首屏渲染从 2.1s 降至 0.8s
- 实现 SSE 流式输出方案，支持长文本逐字渲染与中断重连，用户等待时长缩短 60%
- 设计插件化组件注册表，30+ 可拖拽组件按需加载，构建产物体积减少 42%
- 搭建 Node.js 中间层 BFF，聚合 3 个后端服务，接口响应从 800ms 降至 120ms

电商后台管理系统 2022.01 - 2023.05
- 从零搭建 Vue 3 + TypeScript 订单管理模块，覆盖 SKU、库存、物流追踪 6 个功能域
- 引入虚拟滚动方案处理 10 万+订单列表，滚动帧率从 18fps 提升到 55fps
- 设计 RBAC 权限模型，6 种角色细粒度控制到按钮级别，通过安全审计
- 写单元测试 200+，行覆盖率从 38% 提升到 82%

内部 DevOps 平台 2021.04 - 2021.12
- 开发 CI/CD 流水线可视化面板，集成 Jenkins API，部署状态实时推送
- 优化 Docker 镜像分层策略，镜像体积缩减 55%，构建时间从 4 分钟降到 1.5 分钟

技能：
- 前端：TypeScript、React、Vue 3、Next.js、Tailwind
- 后端：Node.js、Go、PostgreSQL、Redis
- 工程化：Docker、Jenkins、GitHub Actions、Monorepo`

type Tab = 'file' | 'paste'

type ResumeUploaderProps = {
  analyzing: boolean
  error: string | null
  onExtracted: (extracted: ExtractedText, sourceFile: string) => void
  envConfigured: boolean
  clientConfigured: boolean
  onClientChanged: () => void
}

export function ResumeUploader({ analyzing, error, onExtracted, envConfigured, clientConfigured, onClientChanged }: ResumeUploaderProps) {
  const [tab, setTab] = useState<Tab>('file')
  const [paste, setPaste] = useState('')
  const [fileName, setFileName] = useState<string | null>(null)
  const [parsing, setParsing] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)

  const handleFile = async (file?: File) => {
    if (!file) return
    setFileName(file.name)
    setParsing(true)
    try {
      const extracted = await extractTextFromFile(file)
      onExtracted(extracted, file.name)
    } catch (e) {
      onExtracted({ text: `解析失败: ${e instanceof Error ? e.message : '未知错误'}`, pageCount: 0, charCount: 0 }, file.name)
    } finally {
      setParsing(false)
    }
  }

  const handlePaste = () => {
    const text = paste.trim()
    if (text.length > 0) onExtracted({ text, pageCount: 1, charCount: text.length }, '粘贴文本')
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-5 py-10">
      <SettingsPopover envConfigured={envConfigured} clientConfigured={clientConfigured} onClientChanged={onClientChanged} open={settingsOpen} onOpenChange={setSettingsOpen} />

      <div className="mb-10 text-center">
        <h1 className="text-[28px] font-bold tracking-tight text-text-primary leading-[1.2] mb-3">找出简历里最容易被问穿的那句话</h1>
        <p className="text-text-secondary text-[15px] leading-relaxed max-w-[520px] mx-auto">
          上传简历，由 AI 面试官检查每一条经历中的证据、可信度和可能的追问方向。
        </p>
      </div>

      <div className="w-full max-w-[480px]">
        {/* Tab */}
        <div className="flex border-b border-border mb-6">
          {(['file', 'paste'] as Tab[]).map((t) => (
            <button key={t} type="button" onClick={() => setTab(t)} className={`px-4 py-2.5 text-[14px] font-medium border-b-2 transition-colors ${tab === t ? 'border-brand text-brand' : 'border-transparent text-text-tertiary hover:text-text-secondary'}`}>{t === 'file' ? '上传文件' : '粘贴文本'}</button>
          ))}
        </div>

        {tab === 'file' ? (
          <>
            <label className="flex min-h-[160px] cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border bg-white px-8 py-10 text-center transition-colors hover:border-brand hover:bg-brand-soft">
              <input type="file" accept=".pdf,.txt,.md" hidden onChange={(event) => { const file = event.target.files?.[0]; if (file) handleFile(file) }} />
              <div className="grid size-12 place-items-center rounded-xl bg-surface-soft">
                <Upload size={22} className="text-text-tertiary" />
              </div>
              <div>
                <p className="text-[14px] font-medium text-text-primary">拖拽简历到这里或点击选择文件</p>
                <p className="mt-1 text-text-tertiary text-[13px]">支持 PDF、TXT、Markdown · 简历内容仅用于本次分析</p>
              </div>
              {parsing ? (
                <div className="flex flex-col items-center gap-2 text-brand">
                  <div className="size-5 rounded-full border-2 border-brand/30 border-t-brand animate-spin" />
                  <p className="text-[13px]">正在解析 PDF…</p>
                </div>
              ) : fileName ? (
                <p className="text-brand text-[13px]">已选择：{fileName}</p>
              ) : null}
            </label>

            <div className="mt-5 text-center">
              <Button variant="ghost" className="text-text-tertiary text-[13px]" onClick={() => onExtracted({ text: SAMPLE_RESUME, pageCount: 1, charCount: SAMPLE_RESUME.length }, '示例简历.txt')}>
                <FileText size={14} />使用示例简历体验
              </Button>
            </div>
          </>
        ) : (
          <>
            <textarea
              className="w-full min-h-[200px] resize-y rounded-xl border border-border-strong bg-white p-4 text-[14px] leading-relaxed text-text-primary placeholder:text-text-tertiary focus:border-[#60a5fa] focus:shadow-[0_0_0_3px_rgba(37,99,235,0.1)]"
              placeholder="直接粘贴简历文本…"
              value={paste}
              onChange={(event) => setPaste(event.target.value)}
              disabled={analyzing}
            />
            <div className="mt-5">
              <Button variant="primary" size="large" className="w-full" disabled={analyzing || paste.trim().length === 0} onClick={handlePaste}>
                开始分析
              </Button>
            </div>
          </>
        )}

        {error && <p className="mt-4 rounded-lg border border-danger/20 bg-danger-soft px-4 py-3 text-[14px] text-danger leading-relaxed">{error}</p>}

        <p className="mt-8 text-center text-text-tertiary text-[13px]">
          当前：OpenAI Compatible API · <button type="button" className="text-brand hover:underline" onClick={() => setSettingsOpen(true)}>配置模型</button>
        </p>
      </div>
    </div>
  )
}
