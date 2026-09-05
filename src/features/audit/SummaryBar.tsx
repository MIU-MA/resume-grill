import type { ResumeClaim, TestPriority } from '@/domain/resume-schema'
import {
  averageMasteryPct,
  priorityCount,
  WEAK_SCORE_THRESHOLD,
  type ClaimProgress,
} from '@/lib/risk'

type Props = {
  claims: ResumeClaim[]
  progress: Record<string, ClaimProgress>
  overrides: Record<string, TestPriority>
}

export function SummaryBar({ claims, progress, overrides }: Props) {
  const tested = Object.values(progress).filter(
    (item) => item.status === 'done',
  ).length
  const weak = Object.values(progress).filter(
    (item) =>
      item.latestScore !== null &&
      item.latestScore <= WEAK_SCORE_THRESHOLD,
  ).length
  const average = averageMasteryPct(progress)
  const pointCount = claims.reduce(
    (total, claim) => total + claim.masteryPoints.length,
    0,
  )

  return (
    <div className="flex h-11 flex-none items-center gap-3 overflow-x-auto border-b border-line bg-white px-3 text-[12px] text-text-secondary sm:px-4 md:px-5">
      <span className="whitespace-nowrap">
        <i className="mr-1 inline-block size-1.5 rounded-full bg-danger" />
        重点 {priorityCount(claims, overrides, 'high')}
      </span>
      <Separator />
      <span className="whitespace-nowrap">考察项 {pointCount}</span>
      <Separator />
      <span className="whitespace-nowrap">
        已练习 {tested}/{claims.length}
      </span>
      <Separator />
      <span className="whitespace-nowrap">
        平均得分 {average === null ? '--' : `${average}%`}
      </span>
      <Separator />
      <span className="whitespace-nowrap">
        <i className="mr-1 inline-block size-1.5 rounded-full bg-warning" />
        需加强 {weak}
      </span>
    </div>
  )
}

function Separator() {
  return <span className="h-3 w-px flex-none bg-line" aria-hidden="true" />
}
