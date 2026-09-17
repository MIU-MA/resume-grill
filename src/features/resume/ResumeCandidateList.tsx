import { Combine, Target, Trash2 } from 'lucide-react'
import type { ParsedResumeSection } from '@/lib/resume-structure'
import type { ReviewCandidate } from '@/features/resume/resume-review-types'

type ResumeCandidateListProps = {
  groupedCandidates: Array<[string, ReviewCandidate[]]>
  candidates: ReviewCandidate[]
  sections: ParsedResumeSection[]
  editingId: string | null
  analyzing: boolean
  onSetEditing: (id: string | null) => void
  onUpdate: (id: string, patch: Partial<ReviewCandidate>) => void
  onMergeWithNext: (id: string) => void
  onDelete: (id: string) => void
}

export function ResumeCandidateList({
  groupedCandidates,
  candidates,
  sections,
  editingId,
  analyzing,
  onSetEditing,
  onUpdate,
  onMergeWithNext,
  onDelete,
}: ResumeCandidateListProps) {
  return (
    <section>
      {groupedCandidates.length === 0 ? (
        <div className="px-6 py-16 text-center">
          <Target size={24} className="mx-auto mb-3 text-text-tertiary" />
          <p className="m-0 text-[14px] font-semibold">
            没有识别到可练习的内容
          </p>
          <p className="mt-2 text-[12px] text-text-tertiary">
            切换到原始文本检查章节标题和列表内容。
          </p>
        </div>
      ) : (
        groupedCandidates.map(([section, items]) => (
          <div key={section} className="border-b border-line last:border-b-0">
            <div
              id={`resume-section-${sections.findIndex(
                (item) => item.title === section,
              )}`}
              className="flex scroll-mt-20 items-center justify-between bg-surface-soft px-5 py-2.5"
            >
              <h2 className="m-0 text-[12px] font-bold text-text-secondary">
                {section}
              </h2>
              <span className="text-[11px] text-text-tertiary">
                {items.length} 条
              </span>
            </div>
            {items.map((candidate) => {
              const index = candidates.findIndex(
                (item) => item.id === candidate.id,
              )
              const canMerge =
                candidates[index + 1]?.sourceSection === candidate.sourceSection

              return (
                <div
                  key={candidate.id}
                  className={`flex items-start gap-2 border-t border-line px-4 py-2.5 first:border-t-0 sm:gap-3 sm:px-6 ${
                    candidate.enabled ? '' : 'bg-surface-soft opacity-65'
                  }`}
                >
                  <label className="mt-2 grid size-5 flex-none place-items-center">
                    <input
                      type="checkbox"
                      checked={candidate.enabled}
                      disabled={analyzing}
                      onChange={(event) =>
                        onUpdate(candidate.id, {
                          enabled: event.target.checked,
                        })
                      }
                      className="size-4 accent-brand"
                      aria-label={`保留要点：${candidate.content}`}
                    />
                  </label>
                  {editingId === candidate.id ? (
                    <textarea
                      autoFocus
                      value={candidate.content}
                      onChange={(event) =>
                        onUpdate(candidate.id, { content: event.target.value })
                      }
                      onBlur={() => onSetEditing(null)}
                      disabled={analyzing}
                      rows={Math.max(
                        2,
                        Math.ceil(candidate.content.length / 48),
                      )}
                      className="min-h-[58px] min-w-0 flex-1 resize-y rounded-lg border border-brand bg-white px-3 py-2 text-[13px] leading-relaxed text-text-primary focus:border-brand focus:shadow-[0_0_0_3px_rgba(37,99,235,0.1)]"
                      aria-label={`${section}要点内容`}
                    />
                  ) : (
                    <button
                      type="button"
                      onClick={() => onSetEditing(candidate.id)}
                      disabled={analyzing}
                      className="min-h-10 min-w-0 flex-1 cursor-pointer border border-transparent px-2 py-2 text-left text-[13px] leading-[1.75] text-text-primary transition-colors hover:border-line hover:bg-surface-soft disabled:cursor-default disabled:opacity-60"
                      aria-label={`编辑要点：${candidate.content}`}
                    >
                      {candidate.content.trim() || (
                        <span className="text-text-tertiary">
                          点击编辑要点…
                        </span>
                      )}
                    </button>
                  )}
                  <div className="flex flex-none flex-col items-center gap-1 pt-1 sm:flex-row">
                    <button
                      type="button"
                      disabled={!canMerge || analyzing}
                      onClick={() => onMergeWithNext(candidate.id)}
                      className="grid size-8 place-items-center rounded-lg bg-transparent text-text-tertiary hover:bg-brand-soft hover:text-brand disabled:cursor-not-allowed disabled:opacity-30"
                      title="与下一条合并"
                      aria-label="与下一条合并"
                    >
                      <Combine size={15} />
                    </button>
                    <button
                      type="button"
                      disabled={analyzing}
                      onClick={() => onDelete(candidate.id)}
                      className="grid size-8 place-items-center rounded-lg bg-transparent text-text-tertiary hover:bg-danger-soft hover:text-danger"
                      title="删除要点"
                      aria-label="删除要点"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        ))
      )}
    </section>
  )
}
