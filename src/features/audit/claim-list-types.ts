export type ClaimFilter = 'all' | 'high' | 'untested' | 'weak'

export const CLAIM_FILTERS: Array<{ value: ClaimFilter; label: string }> = [
  { value: 'all', label: '全部' },
  { value: 'high', label: '重点' },
  { value: 'untested', label: '未练习' },
  { value: 'weak', label: '需加强' },
]
