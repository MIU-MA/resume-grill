import { describe, expect, it } from 'vitest'
import { groundedTailoringSchema, usableTailoringSchema, tailoredOriginalResumeText, tailoredResumeText, tailoringChangeKey, tailoringMail, tailoringSections, type TailoringPlan } from './resume-tailoring'

export const resume = '林同学\n邮箱：lin@example.com\n教育经历\n示例大学 2020-2024 本科\n项目经历\n- 使用 React 开发订单页面，参与接口联调\n- 使用 CSS 调整移动端样式\n专业技能\nReact、CSS'
export const jd = '示例公司\n前端工程师\n负责订单页面开发和接口联调，熟悉 React。'
export function plan(): TailoringPlan {
  return { company: '示例公司', role: '前端工程师', sectionOrder: ['section-0', 'section-1', 'section-3', 'section-2'], changes: [{ sectionId: 'section-2', lineIndex: 0, after: '- 使用 React 开发订单页面，完成本人参与的接口联调', requirement: '订单页面开发和接口联调', reason: '将页面开发与联调写在一起，保留参与范围。' }], highlights: [{ sectionId: 'section-2', lineIndex: 0 }], gaps: [] }
}
describe('岗位版简历', () => {
  it('修改可逐段撤回，章节可恢复原顺序，原简历内容不被删除', () => {
    const sections = tailoringSections(resume); const input = plan(); const key = tailoringChangeKey(input.changes[0])
    expect(groundedTailoringSchema(resume, jd).parse(input)).toEqual(input)
    const changed = tailoredResumeText(sections, input, new Set([key]))
    expect(changed).toContain(input.changes[0].after)
    expect(changed).toContain('示例大学 2020-2024 本科')
    expect(changed.indexOf('专业技能')).toBeLessThan(changed.indexOf('项目经历'))
    const reverted = tailoredResumeText(sections, input, new Set(), {}, true)
    expect(reverted).toContain(sections[2].lines[0])
    expect(reverted.indexOf('项目经历')).toBeLessThan(reverted.indexOf('专业技能'))
    expect(sections[2].lines[0]).toContain('参与接口联调')
  })
  it('邮件只引用最终采用的版本，不引用已撤回的修改', () => {
    const sections = tailoringSections(resume); const input = plan(); const key = tailoringChangeKey(input.changes[0])
    expect(tailoringMail(sections, input, new Set(), {}, '林同学').body).toContain(sections[2].lines[0].slice(2))
    expect(tailoringMail(sections, input, new Set(), {}, '林同学').body).not.toContain('本人参与')
    expect(tailoringMail(sections, input, new Set([key]), { [key]: '- 使用 React 开发订单页面' }, '林同学').body).toContain('使用 React 开发订单页面\n')
  })
  it('拒绝无效位置、重复改写、章节丢失、虚构要求和新增技术或数字', () => {
    const schema = groundedTailoringSchema(resume, jd)
    const input = plan()
    for (const changes of [
      [{ ...input.changes[0], lineIndex: 99 }], [input.changes[0], input.changes[0]],
      [{ ...input.changes[0], requirement: '精通分布式架构' }],
      [{ ...input.changes[0], after: '- 使用 Vue 开发订单页面' }],
      [{ ...input.changes[0], after: '- 使用 React 提升 50% 性能' }],
      [{ ...input.changes[0], after: '- 主导 React 订单页面开发' }],
      [{ ...input.changes[0], sectionId: 'section-1', after: '另一所大学' }],
    ]) expect(schema.safeParse({ ...input, changes }).success).toBe(false)
    expect(schema.safeParse({ ...input, company: '猜出来的公司' }).success).toBe(false)
    expect(schema.safeParse({ ...input, sectionOrder: input.sectionOrder.slice(1) }).success).toBe(false)
    expect(schema.safeParse({ ...input, highlights: [{ sectionId: 'missing', lineIndex: 0 }] }).success).toBe(false)
  })
  it('原文件模式只替换确认过的原句，保留原章节、空行、缩进和未修改内容', () => {
    const raw = '林同学\r\n\r\n项目经历\r\n  - 使用 React 开发订单页面，参与接口联调\r\n\r\n专业技能\r\nReact、CSS'
    const sections = tailoringSections(raw)
    const input: TailoringPlan = { ...plan(), sectionOrder: sections.map(section => section.id).reverse(), changes: [{ ...plan().changes[0], sectionId: 'section-1' }] }
    expect(tailoredOriginalResumeText(raw, sections, input, new Set())).toBe(raw)
    expect(tailoredOriginalResumeText(raw, sections, input, new Set(['section-1:0']))).toBe(raw.replace('- 使用 React 开发订单页面，参与接口联调', input.changes[0].after))
  })
  it('合并过的换行段落仍只修改上传原文对应范围，相同文字不串到其他经历', () => {
    const raw = '林同学\n项目经历\n- 使用 React 开发订单页面\n参与接口联调。\n\n工作经历\n- 使用 React 开发订单页面\n参与接口联调。'
    const sections = tailoringSections(raw)
    const input: TailoringPlan = { company: '', role: '', sectionOrder: sections.map(section => section.id), changes: [{ sectionId: 'section-2', lineIndex: 0, after: '- 使用 React 开发页面。', reason: '缩短表达', requirement: '负责页面开发' }], highlights: [], gaps: [] }
    expect(tailoredOriginalResumeText(raw, sections, input, new Set(['section-2:0']))).toBe('林同学\n项目经历\n- 使用 React 开发订单页面\n参与接口联调。\n\n工作经历\n- 使用 React 开发页面。')
  })
  it('个人概况内的技术简介可改写，姓名、联系方式和学历事实仍受保护', () => {
    const intro = '2028 届本科生，以 Vue 3 / TypeScript 为主，具备 React / Next.js 项目实践；有 C++ 竞赛基础，独立推进 AI 辅助开发项目的需求、调试与验证，曾担任社团干部。'
    const raw = `林同学\n电话：13800000000\n邮箱：lin@example.com\n${intro}\n教育经历\n示例大学 本科\n项目经历\n使用 React 开发页面。`
    const sections = tailoringSections(raw)
    const change = { sectionId: 'section-0', lineIndex: 3, after: intro.replace('，曾担任社团干部', ''), requirement: '前端开发', reason: '缩短与前端无关的介绍。' }
    const input = { company: '', role: '前端开发', sectionOrder: sections.map(section => section.id), changes: [change], highlights: [], gaps: [] }
    expect(groundedTailoringSchema(raw, '前端开发').parse(input).changes).toEqual([change])
    expect(groundedTailoringSchema(raw, '前端开发').safeParse({ ...input, changes: [{ ...change, after: change.after.replace('2028 届本科生，', '') }] }).success).toBe(false)
  })
  it('忽略单条不合格建议并保留有效建议，重新校验时不会丢失提示', () => {
    const input = plan()
    const data = { ...input, changes: [{ ...input.changes[0], sectionId: 'section-0', lineIndex: 0, after: '另一个名字' }, input.changes[0], { ...input.changes[0], lineIndex: 1, after: '使用 Vue 开发页面' }] }
    const schema = usableTailoringSchema(resume, jd)
    const filtered = schema.parse(data)
    expect(filtered.changes).toEqual([input.changes[0]])
    expect(filtered.notices).toHaveLength(2)
    expect(schema.parse(filtered)).toEqual(filtered)
    expect(resume).toContain('林同学')
  })
  it('手工修改不依赖 AI 建议，也不受模型身份保护限制，邮件使用最终文字', () => {
    const sections = tailoringSections(resume), input = { ...plan(), changes: [], highlights: [{ sectionId: 'section-2', lineIndex: 1 }] }
    const edits = { 'section-0:0': '更正后的姓名', 'section-1:0': '用户核对后的学校与学历', 'section-2:1': '使用 CSS 完成移动端适配' }
    const original = tailoredOriginalResumeText(resume, sections, input, new Set(), edits)
    const reflowed = tailoredResumeText(sections, input, new Set(), edits, true)
    for (const text of [original, reflowed]) for (const value of Object.values(edits)) expect(text).toContain(value)
    expect(tailoringMail(sections, input, new Set(), edits, '林同学').body).toContain('使用 CSS 完成移动端适配')
  })
})
