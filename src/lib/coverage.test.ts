import { describe, it, expect } from 'vitest'
import { sanitizeCoverage } from './coverage'

const points = ['说明基线', '区分个人贡献', '说明统计口径']

describe('sanitizeCoverage', () => {
  it('丢弃不属于允许要点的伪造项', () => {
    const { covered, missing } = sanitizeCoverage(['说明基线', '伪造要点', '编造的'], points)
    expect(covered).toEqual(['说明基线'])
    expect(missing).toEqual(['区分个人贡献', '说明统计口径'])
  })

  it('去重：重复项只计一次', () => {
    const { covered } = sanitizeCoverage(['说明基线', '说明基线', '说明基线'], points)
    expect(covered).toEqual(['说明基线'])
  })

  it('覆盖不可能超过 100%：全部命中时 missing 为空', () => {
    const { covered, missing } = sanitizeCoverage([...points, '多余伪造'], points)
    expect(covered).toHaveLength(3)
    expect(missing).toHaveLength(0)
  })

  it('空覆盖时 missing 即全部要点', () => {
    const { covered, missing } = sanitizeCoverage([], points)
    expect(covered).toHaveLength(0)
    expect(missing).toEqual(points)
  })
})
