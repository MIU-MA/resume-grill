import { describe, expect, it } from 'vitest'
import { bossPreparationSchema, prepareBossApplications, type BossJob } from './boss-preparation'

const jobs: BossJob[] = [
  { title: 'Full Stack Developer', company: '示例公司', salary: '10-15K', url: 'https://www.zhipin.com/job_detail/one.html', description: 'React TypeScript Node.js' },
  { title: '前端开发', company: '示例二', salary: '', url: 'https://www.zhipin.com/job_detail/two.html', description: 'React' },
]
const image = { name: '简历.png', type: 'image/png', size: 1000, width: 1200, height: 1700, sha256: 'a'.repeat(64) }
const input = (extra = {}) => bossPreparationSchema.parse({ readId: 'read-1', target: '全栈', resumeText: '项目经历：使用 React、TypeScript 和 Node.js 实现订单查询。', images: [image], ...extra })

describe('BOSS 投递内容准备', () => {
  it('合并 PDF 排版换行，保留完整语句，不引用半行或截断长句', () => {
    const resumeText = '专业技能\n• AI Agent 开发 熟悉 Prompt 工程与多步 Agent 编排，能控制上下文长度、解析 SSE 增量响应，用 Zod 校验模型输出并\n核对引用来源。\n• TypeScript ' + '很长的描述'.repeat(80) + '。'
    const result = prepareBossApplications([{ ...jobs[0], title: 'AI Agent 开发实习', description: 'TypeScript Agent Zod' }], input({ target: 'Agent', resumeText }))
    expect(result.prepared[0].evidence).toContain('并核对引用来源。')
    expect(result.prepared[0].greeting).not.toContain('并。')
    expect(result.prepared[0].evidence.length).toBeLessThanOrEqual(180)
  })
  it('复用岗位别名筛选，并按招呼语、简历图片的顺序生成预览，不标记已发送', () => {
    const result = prepareBossApplications(jobs, input())
    expect(result.prepared).toHaveLength(1)
    expect(result.prepared[0].evidence).toBe(input().resumeText)
    expect(result.prepared[0].greeting).toContain('Full Stack Developer')
    expect(result.prepared[0].steps.map(step => step.type)).toEqual(['greeting', 'resume-image'])
    expect(result.skipped).toMatchObject([{ title: '前端开发', reason: '岗位方向不匹配' }])
    expect(result.sent).toBe(0)
  })
  it('未找到经历时不编造，无图片时提示补充且不声称已附简历', () => {
    const result = prepareBossApplications(jobs, input({ resumeText: '负责财务月报、费用审核和成本管理。', images: [] }))
    expect(result.prepared[0]).toMatchObject({ evidence: '', status: 'needs-image' })
    expect(result.prepared[0].greeting).not.toContain('简历附在下面')
    expect(result.prepared[0].steps).toHaveLength(1)
  })
  it('支持用户自定义招呼语，拒绝过期岗位及未知占位符', () => {
    expect(prepareBossApplications(jobs, input({ greetingTemplate: '{公司}你好，我想应聘{岗位}。' })).prepared[0].greeting).toBe('示例公司你好，我想应聘Full Stack Developer。')
    expect(() => prepareBossApplications(jobs, input({ selectedUrls: ['https://example.com/job'] }))).toThrow('岗位已变化')
    expect(() => prepareBossApplications(jobs, input({ greetingTemplate: '你好{姓名}' }))).toThrow('占位符')
  })
  it('岗位不限开发方向，严格校验图片元信息', () => {
    const result = prepareBossApplications([{ ...jobs[0], title: 'Data Analyst', description: 'SQL Excel' }], input({ target: '数据分析', resumeText: '使用 SQL 和 Excel 整理业务指标并完成数据分析。' }))
    expect(result.prepared).toHaveLength(1)
    expect(bossPreparationSchema.safeParse({ ...input(), images: [{ ...image, type: 'image/svg+xml' }] }).success).toBe(false)
    expect(bossPreparationSchema.safeParse({ ...input(), images: [{ ...image, sha256: 'invalid' }] }).success).toBe(false)
  })
  it('前端开发方向不把前端法务或律师助理放入草稿，明确查找法务时仍可匹配', () => {
    const list = ['React 前端开发工程师', '前端法务', '律师助理前端'].map((title, index) => ({ ...jobs[0], title, url: `https://www.zhipin.com/job_detail/${index}.html` }))
    const result = prepareBossApplications(list, input({ target: '前端' }))
    expect(result.prepared.map(item => item.title)).toEqual(['React 前端开发工程师'])
    expect(result.skipped).toHaveLength(2)
    expect(prepareBossApplications(list, input({ target: '前端法务' })).prepared.map(item => item.title)).toEqual(['前端法务'])
  })
})
