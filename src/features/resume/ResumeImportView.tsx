'use client'

import { useRef, useState } from 'react'
import Link from 'next/link'
import { ArrowRight, FileText, Loader2, Settings, Trash2, Upload } from 'lucide-react'
import { SettingsDialog } from '@/features/settings/SettingsDialog'
import { WorkbenchFrame } from '@/components/layout/WorkbenchFrame'
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

type ResumeImportViewProps = {
  analyzing: boolean
  error: string | null
  onExtracted: (extracted: ExtractedText, sourceFile: string, demo?: boolean) => void
  envConfigured: boolean
  clientConfigured: boolean
  onClientChanged: () => void
  savedRecords: SavedRecord[]
  loadingRecords: boolean
  onOpenSaved: (record: SavedRecord) => void
  onDeleteSaved: (id: string) => Promise<void>
}

export function ResumeImportView({ analyzing, error, onExtracted, envConfigured, clientConfigured, onClientChanged, savedRecords, loadingRecords, onOpenSaved, onDeleteSaved }: ResumeImportViewProps) {
  const [tab, setTab] = useState<Tab>('file')
  const [paste, setPaste] = useState('')
  const [fileName, setFileName] = useState<string | null>(null)
  const [parsing, setParsing] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [parseError, setParseError] = useState<string | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const fileInput = useRef<HTMLInputElement>(null)

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
    <WorkbenchFrame className="workbench-library flex flex-col">
      <header className="flex h-14 flex-none items-center gap-3 border-b border-line px-5 sm:px-7">
        <img src="/favicon.svg" alt="" className="size-6" />
        <strong className="text-[14px] font-semibold">Resume Grill</strong>
        <span className="ml-2 border-l border-line pl-5 text-[12px] text-text-tertiary max-sm:hidden">求职工作台</span>
        <Link href="/applications" className="ml-auto border border-line px-3 py-1.5 text-[12px] hover:bg-surface-soft">邮箱投递</Link>
        <Button variant="ghost" className="h-8 px-2 text-[12px]" onClick={() => setSettingsOpen(true)}><Settings size={15} />模型设置</Button>
      </header>

      <div className="library-body grid min-h-0 w-full">
        <section className="order-2 min-w-0 px-5 py-6 sm:p-7 min-[900px]:order-1" aria-labelledby="saved-resumes-title">
          <div className="mb-6">
            <div className="flex items-baseline gap-3">
              <h1 id="saved-resumes-title" className="m-0 text-[24px] font-semibold tracking-tight">简历库</h1>
              <span className="text-[13px] text-text-tertiary">{savedRecords.length} 份</span>
            </div>
            <p className="mb-0 mt-2 text-[14px] leading-relaxed text-text-secondary">检查简历里的问题，练习面试时怎么回答。</p>
          </div>

          <div className="border-y border-line">
            <div className="flex items-center justify-between bg-surface-soft px-3 py-2.5 text-[12px] text-text-tertiary">
              <span>简历 / 最近更新</span><span>操作</span>
            </div>
            {loadingRecords ? <p className="px-3 py-7 text-[13px] text-text-tertiary">正在读取本地记录…</p>
              : savedRecords.length === 0 ? <div className="px-3 py-8">
                <p className="m-0 text-[14px] font-medium">还没有保存的简历</p>
                <p className="mb-0 mt-2 text-[13px] leading-relaxed text-text-tertiary">导入简历、生成练习清单后，就可以在这里继续。</p>
              </div> : <div className="max-h-[340px] divide-y divide-line overflow-y-auto">
                {savedRecords.map((record) => {
                  const completed = Object.values(record.sessions).flat().filter((session) => session.status === 'done').length
                  return <div key={record.id} className="flex items-center gap-3 px-3 py-4 hover:bg-surface-soft">
                    <FileText size={19} className="flex-none text-text-tertiary max-sm:hidden" />
                    <button type="button" className="min-w-0 flex-1 text-left" onClick={() => onOpenSaved(record)}>
                      <span className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                        <strong className="text-[14px] font-semibold">{record.analysis.candidate}</strong>
                        <span className="text-[12px] text-text-secondary">{record.analysis.role}</span>
                      </span>
                      <span className="mt-2 block truncate text-[12px] text-text-tertiary">{record.analysis.sourceFile} · {formatUpdatedAt(record.updatedAt)}</span>
                      <span className="mt-1 block text-[12px] text-text-tertiary">{record.analysis.claims.length} 个要点 · 已练习 {completed} 次</span>
                    </button>
                    <button type="button" className="grid size-8 flex-none place-items-center text-text-tertiary hover:bg-danger-soft hover:text-danger" onClick={() => handleDelete(record)} title="删除本地记录" aria-label={'删除 ' + record.analysis.candidate + ' 的本地记录'}><Trash2 size={14} /></button>
                    <button type="button" className="grid size-8 flex-none place-items-center text-text-secondary hover:bg-surface-hover" onClick={() => onOpenSaved(record)} title="继续查看" aria-label={'继续查看 ' + record.analysis.candidate + ' 的简历'}><ArrowRight size={16} /></button>
                  </div>
                })}
              </div>}
          </div>

          <Link href="/applications" className="mt-6 flex items-center gap-4 border-y border-line bg-surface-soft px-4 py-4 hover:bg-surface-hover">
            <div className="min-w-0 flex-1"><strong className="text-[14px] font-medium">去投递简历</strong><p className="mb-0 mt-1 text-[12px] leading-relaxed text-text-secondary">粘贴官网招聘链接，批量整理邮件并发送。</p></div>
            <ArrowRight size={17} className="shrink-0 text-text-secondary" />
          </Link>
        </section>

        <section className="order-1 min-w-0 border-b border-line bg-surface-soft px-5 py-6 sm:p-7 min-[900px]:order-2 min-[900px]:border-b-0 min-[900px]:border-l" aria-label="导入简历">
          <h2 className="m-0 text-[18px] font-semibold">导入简历</h2>
          <p className="mb-5 mt-2 text-[13px] text-text-tertiary">选择文件，或直接粘贴文本。</p>
          <div className="mb-4 flex border-b border-line" role="tablist" aria-label="导入方式">
            {(['file', 'paste'] as Tab[]).map((t) => <button key={t} type="button" role="tab" aria-selected={tab === t} onClick={() => setTab(t)} className={['border-b-2 px-3 py-2.5 text-[13px] font-medium', tab === t ? 'border-brand text-text-primary' : 'border-transparent text-text-tertiary hover:text-text-secondary'].join(' ')}>{t === 'file' ? '上传文件' : '粘贴文本'}</button>)}
          </div>

          {tab === 'file' ? <div
            className={['flex min-h-[180px] flex-col items-center justify-center gap-4 border border-dashed bg-white px-4 py-6 text-center', dragOver ? 'border-brand bg-brand-soft' : 'border-line-strong'].join(' ')}
            onDragOver={(event) => { event.preventDefault(); setDragOver(true) }}
            onDragEnter={(event) => { event.preventDefault(); setDragOver(true) }}
            onDragLeave={(event) => { event.preventDefault(); setDragOver(false) }}
            onDrop={(event) => { event.preventDefault(); setDragOver(false); if (!parsing && !analyzing) { const file = event.dataTransfer.files?.[0]; if (file) void handleFile(file) } }}
          >
            <input ref={fileInput} type="file" accept=".pdf,.txt,.md,.docx" hidden disabled={parsing || analyzing} onChange={(event) => { const file = event.target.files?.[0]; if (file) void handleFile(file) }} />
            {parsing ? <Loader2 size={24} className="animate-spin text-brand" /> : <Upload size={24} className="text-text-tertiary" />}
            <p className="m-0 text-[14px]">{parsing ? '正在解析文件…' : '拖拽文件到这里'}</p>
            <Button variant="secondary" className="h-8 text-[12px]" disabled={parsing || analyzing} onClick={() => fileInput.current?.click()}>选择文件</Button>
            <span className="text-[11px] text-text-tertiary">PDF / DOCX / TXT / Markdown</span>
            {fileName && !parsing && <span className="max-w-full truncate text-[12px] text-text-tertiary">{fileName}</span>}
          </div> : <>
            <textarea aria-label="粘贴简历文本" className="block h-[180px] w-full resize-y border border-line-strong bg-white p-4 text-[14px] leading-[1.8] focus:border-brand" placeholder="直接粘贴简历文本…" value={paste} onChange={(event) => setPaste(event.target.value)} disabled={analyzing} />
            <Button variant="primary" className="mt-3 w-full" disabled={analyzing || paste.trim().length === 0} onClick={handlePaste}>导入文本<ArrowRight size={14} /></Button>
          </>}

          {parseError && <p role="alert" className="mt-3 text-[13px] leading-relaxed text-danger">解析失败：{parseError}<button type="button" className="ml-2 underline" onClick={() => setParseError(null)}>关闭</button></p>}
          {error && <p role="alert" className="mt-3 text-[13px] leading-relaxed text-danger">{error}</p>}
          <Button variant="ghost" className="mt-4 w-full text-[13px]" disabled={parsing || analyzing} onClick={() => onExtracted({ text: SAMPLE_RESUME, pageCount: 1, charCount: SAMPLE_RESUME.length }, '示例简历.txt', true)}><FileText size={14} />试用示例简历</Button>
          <p className="mb-0 mt-5 border-t border-line pt-4 text-[12px] leading-[1.8] text-text-tertiary">文件在本地读取。配置模型后，导入会自动检查简历，全文将经本站发送给所选模型服务商，可能产生调用费用。</p>
        </section>
      </div>
      <footer className="flex flex-none flex-wrap items-center justify-between gap-2 border-t border-line px-5 py-3 text-[12px] text-text-tertiary sm:px-7">
        <span>简历和练习记录保存在当前浏览器</span>
        <button type="button" onClick={() => setSettingsOpen(true)} className="text-text-secondary hover:text-brand">{clientConfigured || envConfigured ? '模型已配置' : '配置模型'}<span aria-hidden="true"> ↗</span></button>
      </footer>
      <SettingsDialog open={settingsOpen} onClose={() => setSettingsOpen(false)} envConfigured={envConfigured} clientConfigured={clientConfigured} onClientChanged={onClientChanged} />
    </WorkbenchFrame>
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
