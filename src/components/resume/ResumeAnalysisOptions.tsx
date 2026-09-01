import {
  BarChart3,
  BriefcaseBusiness,
  Check,
  ChevronDown,
  ListChecks,
  Users,
  Wrench,
  type LucideIcon,
} from 'lucide-react'
import {
  ANALYSIS_GOALS,
  type AnalysisGoal,
} from '@/domain/analysis-config'

const GOAL_ICONS: Record<AnalysisGoal, LucideIcon> = {
  overall: ListChecks,
  project: BriefcaseBusiness,
  skills: Wrench,
  achievement: BarChart3,
  leadership: Users,
}

type ResumeAnalysisOptionsProps = {
  analysisGoal: AnalysisGoal
  goalOpen: boolean
  jobDescription: string
  jobDescriptionOpen: boolean
  analyzing: boolean
  onToggleGoal: () => void
  onGoalChange: (goal: AnalysisGoal) => void
  onToggleJobDescription: () => void
  onJobDescriptionChange: (value: string) => void
}

export function ResumeAnalysisOptions({
  analysisGoal,
  goalOpen,
  jobDescription,
  jobDescriptionOpen,
  analyzing,
  onToggleGoal,
  onGoalChange,
  onToggleJobDescription,
  onJobDescriptionChange,
}: ResumeAnalysisOptionsProps) {
  return (
    <>
      <section className="border-t border-line px-5 py-4">
        <button
          type="button"
          onClick={onToggleGoal}
          className="flex w-full items-center justify-between gap-3 text-left"
          aria-expanded={goalOpen}
        >
          <div>
            <h2 className="m-0 text-[14px] font-bold">本次分析目标</h2>
            <p className="mt-1 text-[12px] text-text-tertiary">
              决定优先练习和追问哪类内容。
            </p>
          </div>
          <span className="flex flex-none items-center gap-2 text-[12px] text-text-tertiary">
            {ANALYSIS_GOALS.find((goal) => goal.value === analysisGoal)?.label}
            <ChevronDown
              size={14}
              className={`transition-transform ${goalOpen ? 'rotate-180' : ''}`}
            />
          </span>
        </button>
        {goalOpen && (
          <div
            className="mt-3 grid grid-cols-5 gap-2 max-xl:grid-cols-3 max-md:grid-cols-1"
            role="radiogroup"
            aria-label="分析目标"
          >
            {ANALYSIS_GOALS.map((goal) => {
              const Icon = GOAL_ICONS[goal.value]
              const active = analysisGoal === goal.value
              return (
                <label
                  key={goal.value}
                  className={`min-w-0 cursor-pointer rounded-lg border px-3 py-3 transition-colors ${
                    active
                      ? 'border-brand bg-brand-soft'
                      : 'border-line bg-white hover:border-line-strong'
                  }`}
                >
                  <input
                    type="radio"
                    name="analysis-goal"
                    value={goal.value}
                    checked={active}
                    onChange={() => onGoalChange(goal.value)}
                    className="sr-only"
                  />
                  <span className="flex items-center gap-2 text-[12px] font-bold text-text-primary">
                    <Icon
                      size={14}
                      className={active ? 'text-brand' : 'text-text-tertiary'}
                    />
                    {goal.label}
                    <span
                      className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${
                        active
                          ? 'bg-brand/10 text-brand'
                          : 'bg-surface-soft text-text-tertiary'
                      }`}
                    >
                      约 {goal.claimCount} 条
                    </span>
                    {active && <Check size={13} className="ml-auto text-brand" />}
                  </span>
                  <span className="mt-1.5 block text-[11px] leading-relaxed text-text-tertiary">
                    {goal.description}
                  </span>
                </label>
              )
            })}
          </div>
        )}
      </section>

      <section className="border-t border-line px-5 py-4">
        <button
          type="button"
          onClick={onToggleJobDescription}
          className="flex w-full items-center justify-between gap-3 text-left"
          aria-expanded={jobDescriptionOpen}
        >
          <div>
            <h2 className="m-0 text-[14px] font-bold">
              目标岗位描述{' '}
              <span className="font-normal text-text-tertiary">可选</span>
            </h2>
            <p className="mt-1 text-[12px] text-text-tertiary">
              填写后会增加岗位匹配、简历缺口和针对性追问。
            </p>
          </div>
          <span className="flex flex-none items-center gap-2 text-[12px] text-text-tertiary">
            {jobDescription.trim() && (
              <span className="font-semibold text-brand">
                {jobDescription.trim().length} 字
              </span>
            )}
            <ChevronDown
              size={14}
              className={`transition-transform ${
                jobDescriptionOpen ? 'rotate-180' : ''
              }`}
            />
          </span>
        </button>
        {jobDescriptionOpen && (
          <textarea
            className="mt-3 min-h-[120px] w-full resize-y rounded-lg border border-line-strong bg-white p-4 text-[13px] leading-[1.75] text-text-primary placeholder:text-text-tertiary focus:border-brand focus:shadow-[0_0_0_3px_rgba(37,99,235,0.1)]"
            value={jobDescription}
            onChange={(event) => onJobDescriptionChange(event.target.value)}
            disabled={analyzing}
            placeholder="粘贴目标岗位的职责和任职要求…"
          />
        )}
      </section>
    </>
  )
}
