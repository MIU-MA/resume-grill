import type { ParsedResumeSection } from '@/lib/resume-structure'

type ResumeReviewSidebarProps = {
  sections: ParsedResumeSection[]
  sectionTitles: string[]
  onSectionClick: (index: number) => void
}

export function ResumeReviewSidebar({ sections, sectionTitles, onSectionClick }: ResumeReviewSidebarProps) {
  const visibleSections = sections.map((section, index) => ({ section, index })).filter(({ section }) => sectionTitles.includes(section.title))
  return (
    <aside className="flex min-h-0 flex-1 flex-col" aria-label="文档章节">
      <div className="flex h-16 flex-none items-center justify-between px-5">
        <h2 className="m-0 text-[13px] font-semibold">章节目录</h2>
        <span className="text-[12px] text-text-tertiary">{visibleSections.length}</span>
      </div>
      <nav className="min-h-0 flex-1 overflow-y-auto px-3 pb-4">
        {visibleSections.map(({ section, index }) => (
          <button key={section.title + '-' + index} type="button" onClick={() => onSectionClick(index)} className="flex min-h-11 w-full items-center justify-between gap-3 px-2 text-left text-[13px] hover:bg-surface-hover" title="定位到该章节">
            <span className="min-w-0 truncate text-text-secondary">{section.title || '其他章节'}</span>
            <span className="flex-none text-[11px] text-text-tertiary">{section.lines.length} 行</span>
          </button>
        ))}
      </nav>
    </aside>
  )
}
