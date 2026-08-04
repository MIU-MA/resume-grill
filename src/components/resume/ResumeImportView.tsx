'use client'

import { useState } from 'react'
import { ArrowRight, FileText, Trash2, Upload } from 'lucide-react'
import { SettingsPopover } from '@/components/settings/SettingsPopover'
import { extractTextFromFile, type ExtractedText } from '@/lib/pdf'
import { Button } from '@/components/ui/Button'
import type { SavedRecord } from '@/lib/storage'

const SAMPLE_RESUME = `酒寄彩叶
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
  savedRecords: SavedRecord[]
  loadingRecords: boolean
  onOpenSaved: (record: SavedRecord) => void
  onDeleteSaved: (id: string) => Promise<void>
}

export function ResumeImportView({ analyzing, error, onExtracted, envConfigured, clientConfigured, onClientChanged, savedRecords, loadingRecords, onOpenSaved, onDeleteSaved }: ResumeUploaderProps) {
  const [tab, setTab] = useState<Tab>('file')
  const [paste, setPaste] = useState('')
  const [fileName, setFileName] = useState<string | null>(null)
  const [parsing, setParsing] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [parseError, setParseError] = useState<string | null>(null)
  const [dragOver, setDragOver] = useState(false)

  const handleFile = async (file?: File) => {
    if (!file) return
    setFileName(file.name)
    setParsing(true)
    setParseError(null)
    try {
      const extracted = await extractTextFromFile(file)
      setFileName(null)
      onExtracted(extracted, file.name)
    } catch (e) {
      setParseError(e instanceof Error ? e.message : '未知错误')
    } finally {
      setParsing(false)
    }
  }

  const handlePaste = () => {
    const text = paste.trim()
    if (text.length > 0) onExtracted({ text, pageCount: 1, charCount: text.length }, '粘贴文本')
  }

  const handleDelete = async (record: SavedRecord) => {
    if (!window.confirm(`确定删除「${record.analysis.candidate}」的本地记录吗？`)) return
    await onDeleteSaved(record.id)
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

      <div className="w-full max-w-[720px]">
        <div className="mx-auto max-w-[480px]">
        {/* Tab */}
        <div className="flex border-b border-border mb-6">
          {(['file', 'paste'] as Tab[]).map((t) => (
            <button key={t} type="button" onClick={() => setTab(t)} className={`px-4 py-2.5 text-[14px] font-medium border-b-2 transition-colors ${tab === t ? 'border-brand text-brand' : 'border-transparent text-text-tertiary hover:text-text-secondary'}`}>{t === 'file' ? '上传文件' : '粘贴文本'}</button>
          ))}
        </div>

        {tab === 'file' ? (
          <>
            <label
              className={`flex min-h-[160px] cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border border-dashed bg-white px-8 py-10 text-center transition-colors ${
                dragOver ? 'border-brand bg-brand-soft' : 'border-border hover:border-brand hover:bg-brand-soft'
              }`}
              onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
              onDragEnter={(e) => { e.preventDefault(); setDragOver(true) }}
              onDragLeave={(e) => { e.preventDefault(); setDragOver(false) }}
              onDrop={(e) => { e.preventDefault(); setDragOver(false); const file = e.dataTransfer.files?.[0]; if (file) handleFile(file) }}
            >
              <input type="file" accept=".pdf,.txt,.md,.docx" hidden onChange={(event) => { const file = event.target.files?.[0]; if (file) handleFile(file) }} />
              <div className="grid size-12 place-items-center rounded-xl bg-surface-soft">
                <Upload size={22} className="text-text-tertiary" />
              </div>
              <div>
                <p className="text-[14px] font-medium text-text-primary">拖拽简历到这里或点击选择文件</p>
                <p className="mt-1 text-text-tertiary text-[13px]">支持 PDF、DOCX、TXT、Markdown · 简历内容仅用于本次分析</p>
              </div>
              {parsing ? (
                <div className="flex flex-col items-center gap-2 text-brand">
                  <div className="size-5 rounded-full border-2 border-brand/30 border-t-brand animate-spin" />
                  <p className="text-[13px]">正在解析文件…</p>
                </div>
              ) : fileName ? (
                <p className="text-brand text-[13px]">已选择：{fileName}</p>
              ) : null}
            </label>

            {parseError && (
              <div className="mt-4 rounded-lg border border-danger/20 bg-danger-soft px-4 py-3 text-[14px] text-danger leading-relaxed">
                解析失败：{parseError}
                <button type="button" className="ml-2 text-brand hover:underline" onClick={() => setParseError(null)}>关闭</button>
              </div>
            )}

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

        {(loadingRecords || savedRecords.length > 0) && (
          <section className="mt-10 border-t border-border pt-7" aria-labelledby="saved-resumes-title">
            <div className="mb-3 flex items-end justify-between gap-4 px-1">
              <div>
                <h2 id="saved-resumes-title" className="text-[15px] font-bold text-text-primary">本地简历</h2>
                <p className="mt-1 text-[12px] text-text-tertiary">分析结果和测试记录仅保存在当前浏览器</p>
              </div>
              {!loadingRecords && <span className="text-[12px] text-text-tertiary">{savedRecords.length} 份</span>}
            </div>

            {loadingRecords ? (
              <div className="flex h-20 items-center justify-center text-[13px] text-text-tertiary">正在读取本地记录…</div>
            ) : (
              <div className="space-y-2">
                {savedRecords.map((record) => {
                  const completed = Object.values(record.sessions).flat().filter((session) => session.status === 'done').length
                  return (
                    <div key={record.id} className="flex items-center gap-3 rounded-lg border border-border bg-white px-4 py-3 shadow-[0_1px_3px_rgba(16,24,40,0.04)]">
                      <div className="grid size-9 flex-none place-items-center rounded-lg bg-surface-soft text-text-tertiary">
                        <FileText size={17} />
                      </div>
                      <button type="button" className="min-w-0 flex-1 bg-transparent text-left" onClick={() => onOpenSaved(record)}>
                        <span className="flex items-center gap-2">
                          <strong className="truncate text-[13px] text-text-primary">{record.analysis.candidate}</strong>
                          <span className="truncate text-[12px] text-text-tertiary">{record.analysis.role}</span>
                        </span>
                        <span className="mt-1 block truncate text-[11px] text-text-tertiary">
                          {record.analysis.sourceFile} · {record.analysis.claims.length} 条声明 · 已完成 {completed} 次测试 · {formatUpdatedAt(record.updatedAt)}
                        </span>
                      </button>
                      <button type="button" className="grid size-8 flex-none place-items-center rounded-lg text-text-tertiary hover:bg-danger-soft hover:text-danger" onClick={() => handleDelete(record)} title="删除本地记录" aria-label={`删除 ${record.analysis.candidate} 的本地记录`}>
                        <Trash2 size={14} />
                      </button>
                      <button type="button" className="grid size-8 flex-none place-items-center rounded-lg text-text-tertiary hover:bg-surface-hover hover:text-brand" onClick={() => onOpenSaved(record)} title="继续查看" aria-label={`继续查看 ${record.analysis.candidate} 的简历`}>
                        <ArrowRight size={15} />
                      </button>
                    </div>
                  )
                })}
              </div>
            )}
          </section>
        )}
      </div>
    </div>
  )
}

function formatUpdatedAt(timestamp: number): string {
  return new Intl.DateTimeFormat('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(timestamp)
}
