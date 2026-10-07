import { describe, expect, it } from 'vitest'
import { buildHeuristicJobMatch } from './job-match'

describe('job match', () => {
  it('matches requirements to confirmed resume evidence and exposes gaps', () => {
    const result = buildHeuristicJobMatch(
      '岗位职责\n- 负责用户访谈和需求分析。\n- 使用 SQL 分析业务数据。\n- 具备跨团队协作能力。',
      [
        { content: '负责用户访谈和需求分析，推动方案落地。', sourceSection: '工作经历', lineNumber: 4 },
      ],
    )

    expect(result.requirements[0].match).toBe('strong')
    expect(result.requirements.some((item) => item.match === 'gap')).toBe(true)
    expect(result.gaps.length).toBeGreaterThan(0)
  })
})
