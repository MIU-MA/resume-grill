import type { RefObject } from 'react'
import { BookOpen, Check, RefreshCw } from 'lucide-react'
import type { ResumeAnalysis, ResumeClaim } from '@/domain/resume-schema'
import type { InterviewSession } from '@/domain/interview-schema'
import { Button } from '@/components/ui/Button'
import { deriveBlindSpots } from '@/lib/blind-spots'

type ReportBlindSpotsProps = {
  analysis: ResumeAnalysis
  sessions: Record<string, InterviewSession[]>
  masteredBlindSpotIds: string[]
  sectionRef: RefObject<HTMLElement | null>
  onToggle: (blindSpotId: string) => void
  onRetest: (claim: ResumeClaim) => void
}

export function ReportBlindSpots({
  analysis,
  sessions,
  masteredBlindSpotIds,
  sectionRef,
  onToggle,
  onRetest,
}: ReportBlindSpotsProps) {
  const mastered = new Set(masteredBlindSpotIds)
  const blindSpots = deriveBlindSpots(analysis, sessions).sort(
    (a, b) => Number(mastered.has(a.id)) - Number(mastered.has(b.id)),
  )

  if (blindSpots.length === 0) return null

  const openCount = blindSpots.filter((spot) => !mastered.has(spot.id)).length

  return (
    <section
      ref={sectionRef}
      className="overflow-hidden rounded-lg bg-white shadow-card"
    >
      <div className="flex items-center justify-between gap-4 border-b border-line bg-surface-soft px-5 py-4">
        <div className="flex items-center gap-2.5">
          <BookOpen size={17} className="text-brand" />
          <div>
            <h2 className="m-0 text-[15px] font-bold">需要复习的内容</h2>
            <p className="mt-1 text-[12px] text-text-tertiary">
              这里收集了模拟面试时记下的「没听懂」，也保留了当时的问题。
            </p>
          </div>
        </div>
        <span className="text-[12px] font-semibold text-warning">
          {openCount} 项待复习
        </span>
      </div>
      <div className="divide-y divide-line">
        {blindSpots.map((spot) => {
          const learned = mastered.has(spot.id)
          return (
            <div
              key={spot.id}
              className={`grid grid-cols-[minmax(0,1fr)_auto] gap-5 px-5 py-4 max-[720px]:grid-cols-1 ${
                learned ? 'bg-success-soft/25' : ''
              }`}
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <strong className="text-[13px] text-text-primary">
                    {spot.annotation}
                  </strong>
                  <span className="rounded bg-surface-hover px-2 py-0.5 text-[10px] font-semibold text-text-tertiary">
                    {spot.claim.title}
                  </span>
                  {learned && (
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-success">
                      <Check size={12} />已学会
                    </span>
                  )}
                </div>
                <p className="mt-2 text-[12px] leading-relaxed text-text-tertiary">
                  当时问题：{spot.question}
                </p>
                <p className="mt-1 text-[13px] leading-relaxed text-text-secondary">
                  {spot.explanation || '当时没有留下说明，可以再练一次。'}
                </p>
              </div>
              <div className="flex items-center gap-2 self-center max-[720px]:justify-end">
                <Button
                  variant="ghost"
                  className="text-[12px]"
                  onClick={() => onToggle(spot.id)}
                >
                  <Check size={13} />
                  {learned ? '标为待复习' : '标为已学会'}
                </Button>
                <Button
                  variant="secondary"
                  className="text-[12px]"
                  onClick={() => onRetest(spot.claim)}
                >
                  <RefreshCw size={13} />再练一次
                </Button>
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}
