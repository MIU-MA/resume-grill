import { describe, expect, it } from 'vitest'
import { diffRewrite } from '@/lib/rewrite-diff'

describe('diffRewrite', () => {
  it('逐字相同整句标为 same', () => {
    const result = diffRewrite('负责核心编辑器前端架构', '负责核心编辑器前端架构')
    expect(result.original[0].kind).toBe('same')
    expect(result.suggestion[0].kind).toBe('same')
  })

  it('新增整句标为 added，其余保持 same', () => {
    const result = diffRewrite(
      '首屏渲染耗时由 2s 降至 0.8s。设计插件化注册表。',
      '首屏渲染耗时由 2s 降至 0.8s。设计插件化注册表。新增单元测试覆盖。',
    )
    expect(result.suggestion.map((s) => s.kind)).toEqual(['same', 'same', 'added'])
  })

  it('删除整句在原文侧标为 removed，建议侧不出现', () => {
    const result = diffRewrite(
      '引入虚拟滚动处理 10 万订单。接入 Redis 缓存。',
      '引入虚拟滚动处理 10 万订单。',
    )
    expect(result.original.map((s) => s.kind)).toEqual(['same', 'removed'])
    expect(result.suggestion.length).toBe(1)
  })

  it('改动过的句子（数字/措辞变化）标为 changed', () => {
    const result = diffRewrite(
      '构建产物体积减少 42%。',
      '构建产物体积减少约 50%。',
    )
    expect(result.original[0].kind).toBe('changed')
    expect(result.suggestion[0].kind).toBe('changed')
  })

  it('空输入返回空数组', () => {
    expect(diffRewrite('', '')).toEqual({ original: [], suggestion: [] })
  })
})