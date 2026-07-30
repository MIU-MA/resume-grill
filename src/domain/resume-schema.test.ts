import { describe, expect, it } from 'vitest'
import { createClaimId } from './resume-schema'

const claim = {
  content: '负责客户续约流程并将续约率提升 12%',
  sourceSection: '工作经历',
}

describe('createClaimId', () => {
  it('returns the same ID for the same claim position', () => {
    expect(createClaimId(claim, 0)).toBe(createClaimId(claim, 0))
  })

  it('keeps duplicate statements at different positions distinct', () => {
    expect(createClaimId(claim, 0)).not.toBe(createClaimId(claim, 1))
  })
})
