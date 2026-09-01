import type { ReviewedCandidate } from '@/domain/analysis-config'

export type ReviewCandidate = ReviewedCandidate & {
  id: string
  enabled: boolean
}
