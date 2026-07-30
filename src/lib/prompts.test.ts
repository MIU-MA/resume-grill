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
})
