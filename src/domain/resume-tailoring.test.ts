import { describe, expect, it } from 'vitest'
import { groundedTailoringSchema, tailoredResumeText, tailoringChangeKey, tailoringMail, tailoringSections, type TailoringPlan } from './resume-tailoring'

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
      [{ ...input.changes[0], sectionId: 'section-1', after: '另一所大学' }],
    ]) expect(schema.safeParse({ ...input, changes }).success).toBe(false)
    expect(schema.safeParse({ ...input, company: '猜出来的公司' }).success).toBe(false)
    expect(schema.safeParse({ ...input, sectionOrder: input.sectionOrder.slice(1) }).success).toBe(false)
    expect(schema.safeParse({ ...input, highlights: [{ sectionId: 'missing', lineIndex: 0 }] }).success).toBe(false)
  })
})
