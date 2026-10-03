import { describe, expect, it } from 'vitest'
import { findRevisionTargets, mapRevisionTarget, replaceRevisionTarget } from './resume-revision'

describe('resume revision anchoring', () => {
  it('starts from the complete original paragraph, allowing extraction whitespace', () => {
    const text = '项目经历\n负责 React 页面，完成表单和权限模块。\n其他经历'
    expect(findRevisionTargets(text, 'React页 面')).toEqual([{ start: 5, end: 28, line: 2, text: '负责 React 页面，完成表单和权限模块。\n' }])
  })
  it('keeps duplicate quotations separate instead of picking the first', () => {
    expect(findRevisionTargets('项目一\n负责页面开发。\n项目二\n负责页面开发。', '负责页面开发').map((item) => item.line)).toEqual([2, 4])
    expect(findRevisionTargets('负责页面开发。', '提升 50%')).toEqual([])
    expect(findRevisionTargets('负责页面开发。', '')).toEqual([])
  })
  it('maps a later edit after an earlier paragraph changes length, then supports undo', () => {
    const base = '姓名\n项目一原文\n分隔\n项目二原文\n技能'
    const first = findRevisionTargets(base, '项目一原文')[0]
    const second = findRevisionTargets(base, '项目二原文')[0]
    const draft = replaceRevisionTarget(base, first, '项目一补充真实细节\n')
    const mapped = mapRevisionTarget(base, draft, second)!
    const next = replaceRevisionTarget(draft, mapped, '项目二改写\n')
    expect(next).toBe('姓名\n项目一补充真实细节\n分隔\n项目二改写\n技能')
    expect(replaceRevisionTarget(next, mapRevisionTarget(base, next, second)!, second.text)).toBe(draft)
  })
  it('refuses an ambiguous paragraph inside a combined rewrite', () => {
    const base = '姓名\n原段一\n原段二\n技能'
    expect(mapRevisionTarget(base, '姓名\n合并后的经历\n技能', findRevisionTargets(base, '原段二')[0])).toBeNull()
  })
  it('retains the exact range on unchanged text and supports deletion', () => {
    const base = '姓名\n经历\n技能'
    const target = findRevisionTargets(base, '经历')[0]
    expect(mapRevisionTarget(base, base, target)).toEqual({ start: target.start, end: target.end })
    const draft = replaceRevisionTarget(base, target, '')
    expect(replaceRevisionTarget(draft, mapRevisionTarget(base, draft, target)!, target.text)).toBe(base)
  })
})
