import { describe, expect, it } from 'vitest'
import { buildAnalyzeUserPrompt } from './prompts'

describe('buildAnalyzeUserPrompt', () => {
  it('requires skill coverage when the resume has an explicit skills section', () => {
    const prompt = buildAnalyzeUserPrompt([
      '王五',
      '技术能力',
      '前端：TypeScript、React、Next.js',
      '项目经历',
      '- 负责管理后台开发并完成接口联调。',
    ].join('\n'))

    expect(prompt).toContain('最终 claims 必须保留至少 1 条 category=skill')
  })

  it('does not force a skill claim when no skills section exists', () => {
    const prompt = buildAnalyzeUserPrompt('王五\n工作经历\n- 负责重点客户续约。')
    expect(prompt).not.toContain('最终 claims 必须保留至少 1 条 category=skill')
  })

  it('passes the selected goal and treats reviewed candidates as authoritative', () => {
    const prompt = buildAnalyzeUserPrompt(
      '王五\n项目经历\n- 负责后台开发。\n- 实现报表导出。',
      {
        analysisGoal: 'project',
        reviewedCandidates: [{ content: '实现报表导出。', sourceSection: '项目经历', lineNumber: 4 }],
      },
    )

    expect(prompt).toContain('本次目标是项目深挖')
    expect(prompt).toContain('已由用户检查确认，只能从这些候选声明中选择')
    expect(prompt).toContain('"analysisGoal": "project"')
    expect(prompt).toContain('"content": "实现报表导出。"')
  })

  it('includes the optional job description only when provided', () => {
    const prompt = buildAnalyzeUserPrompt('王五\n工作经历\n- 负责客户续约。', {
      jobDescription: '负责客户成功和续约分析',
    })
    expect(prompt).toContain('请在输出中补充 jobMatch')
    expect(prompt).toContain('"jobDescription": "负责客户成功和续约分析"')
  })
})
