import { describe, expect, it } from 'vitest'
import { buildAnalyzeUserPrompt } from './prompts'

describe('buildAnalyzeUserPrompt', () => {
  it('requires skill coverage when the resume has an explicit skills section', () => {
    const prompt = buildAnalyzeUserPrompt(
      [
        '王五',
        '技术能力',
        '前端：TypeScript、React、Next.js',
        '项目经历',
        '- 负责管理后台开发并完成接口联调。',
      ].join('\n'),
      [{ content: '负责管理后台开发并完成接口联调。', sourceSection: '项目经历' }],
      'overall',
    )

    expect(prompt).toContain('claims 必须保留至少 1 条 category=skill')
  })

  it('does not force a skill claim when no skills section exists', () => {
    const prompt = buildAnalyzeUserPrompt(
      '王五\n工作经历\n- 负责重点客户续约。',
      [{ content: '负责重点客户续约。', sourceSection: '工作经历' }],
      'overall',
    )
    expect(prompt).not.toContain('category=skill')
  })

  it('sends candidates as indexed pool, never rawText', () => {
    const prompt = buildAnalyzeUserPrompt(
      '王五\n项目经历\n- 负责后台开发。\n- 实现报表导出。',
      [{ content: '实现报表导出。', sourceSection: '项目经历' }],
      'project',
    )

    expect(prompt).not.toContain('rawText')
    expect(prompt).toContain('项目深挖')
    expect(prompt).toContain('"analysisGoal":"project"')
    expect(prompt).toContain('"content":"实现报表导出。"')
    expect(prompt).toContain('"index":0')
  })

  it('only sends identity and candidates in the JSON payload', () => {
    const prompt = buildAnalyzeUserPrompt(
      '王五\n工作经历\n- 负责客户续约。',
      [{ content: '负责客户续约。', sourceSection: '工作经历' }],
      'overall',
    )
    const lastLine = prompt.split('\n').at(-1)!
    const parsed = JSON.parse(lastLine)
    expect(Object.keys(parsed).sort()).toEqual(['analysisGoal', 'candidates', 'identity'])
    expect(parsed.candidates).toHaveLength(1)
  })
})
