import { ChevronDown, Layers3, Settings } from 'lucide-react'
import { ModelSettings } from '@/components/settings/ModelSettings'
import type {
  ParsedResumeSection,
  ResumeSectionKind,
} from '@/lib/resume-structure'

const SECTION_LABELS: Record<ResumeSectionKind, string> = {
  general: '个人概况',
  profile: '个人总结',
  education: '教育经历',
  work: '工作经历',
  internship: '实习经历',
  project: '项目经历',
  skills: '技能能力',
  awards: '奖项证书',
  selfReview: '自我评价',
  custom: '其他章节',
}

type ResumeReviewSidebarProps = {
  sections: ParsedResumeSection[]
  experienceSectionCount: number
  skillClaimCount: number
  candidateCount: number
  settingsOpen: boolean
  envConfigured: boolean
  clientConfigured: boolean
  onToggleSettings: () => void
  onClientChanged: () => void
  onSectionClick: (index: number) => void
}

export function ResumeReviewSidebar({
  sections,
  experienceSectionCount,
  skillClaimCount,
  candidateCount,
  settingsOpen,
  envConfigured,
  clientConfigured,
  onToggleSettings,
  onClientChanged,
  onSectionClick,
}: ResumeReviewSidebarProps) {
  return (
    <aside className="self-start rounded-lg border border-line bg-white px-5 py-5 shadow-card lg:sticky lg:top-5">
      <div className="mb-4 flex items-center gap-2">
        <Layers3 size={16} className="text-brand" />
        <h2 className="m-0 text-[14px] font-bold">解析概况</h2>
      </div>
      <div className="grid grid-cols-2 gap-x-4 gap-y-4 border-b border-line pb-5">
        <DiagnosticStat label="章节" value={sections.length} />
        <DiagnosticStat label="经历章节" value={experienceSectionCount} />
        <DiagnosticStat label="技能要点" value={skillClaimCount} />
        <DiagnosticStat label="可练习内容" value={candidateCount} />
      </div>

      <div className="pt-4">
        <div className="mb-2 text-[11px] font-semibold text-text-tertiary">
          识别到的章节
        </div>
        <div className="space-y-1">
          {sections.map((section, index) => (
            <button
              key={`${section.title}-${index}`}
              type="button"
              onClick={() => onSectionClick(index)}
              className="flex w-full items-center justify-between gap-3 rounded-md py-1.5 text-[12px] transition-colors hover:bg-surface-soft hover:px-1"
              title="点击定位到该章节"
            >
              <span className="min-w-0 truncate text-text-secondary">
                {section.title || SECTION_LABELS[section.kind]}
              </span>
              <span className="flex-none text-[11px] text-text-tertiary">
                {section.lines.length} 行
              </span>
            </button>
          ))}
        </div>
      </div>

      <div className="mt-5 border-t border-line pt-4">
        <button
          type="button"
          onClick={onToggleSettings}
          className="flex w-full items-center justify-between gap-2 text-left"
          aria-expanded={settingsOpen}
        >
          <span className="flex min-w-0 flex-wrap items-center gap-1.5">
            <Settings size={14} className="flex-none text-text-tertiary" />
            <span className="text-[13px] font-bold">模型配置</span>
          </span>
          <ChevronDown
            size={14}
            className={`flex-none text-text-tertiary transition-transform ${
              settingsOpen ? 'rotate-180' : ''
            }`}
          />
        </button>
        {!envConfigured && !clientConfigured && (
          <p className="m-0 mt-1.5 text-[11px] font-semibold text-warning">
            未配置 · 真实简历分析需先配置
          </p>
        )}
        {(envConfigured || clientConfigured) && !settingsOpen && (
          <p className="m-0 mt-1.5 text-[11px] font-semibold text-success">
            模型已连接 · 点击展开查看配置
          </p>
        )}
        {settingsOpen && (
          <div className="mt-3">
            <ModelSettings
              envConfigured={envConfigured}
              clientConfigured={clientConfigured}
              onClientChanged={onClientChanged}
            />
          </div>
        )}
      </div>
    </aside>
  )
}

function DiagnosticStat({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="text-[20px] font-bold text-text-primary">{value}</div>
      <div className="mt-1 text-[11px] text-text-tertiary">{label}</div>
    </div>
  )
}
