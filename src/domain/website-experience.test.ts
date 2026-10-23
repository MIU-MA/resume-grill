import { describe, expect, it } from 'vitest'
import { experiencesSchema, parseWebsiteExperiences } from './website-experience'

describe('简历多段经历提取', () => {
  it('按类别保留顺序和原文，不补造缺少的字段', () => {
    const entries = parseWebsiteExperiences('教育经历\n示例大学 | 计算机 2019.9 - 2023.6\n本科\n实习经历\n甲公司 | 前端实习生 2022.06—2022.09\n- 开发页面\n乙公司 | 前端工程师 2023.07—至今\n- 维护组件库\n项目经历\n编辑器 2024.01—2024.06\n- 处理文档\n技能\nReact / TS')
    expect(entries.map(entry => entry.kind)).toEqual(['education', 'work', 'work', 'project'])
    expect(entries[0]).toMatchObject({ organization: '示例大学', title: '计算机', start: '2019-09', end: '2023-06' })
    expect(entries[2]).toMatchObject({ organization: '乙公司', end: '至今', description: '- 维护组件库' })
    expect(entries[3]).toMatchObject({ title: '', description: '- 处理文档' })
    expect(experiencesSchema.safeParse(entries).success).toBe(true)
  })
  it('不从无时间范围或未知章节猜测经历', () => {
    expect(parseWebsiteExperiences('个人简介\n某公司 2020.01-2022.03\n工作经历\n没有时间的公司')).toEqual([])
  })
})
