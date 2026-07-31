import { describe, expect, it } from 'vitest'
import { parseModelJson } from './openai-compatible'

describe('parseModelJson', () => {
  it('parses a plain JSON response', () => {
    expect(parseModelJson('{"candidate":"张三","claims":[]}')).toEqual({ candidate: '张三', claims: [] })
  })

  it('parses JSON wrapped in a markdown code block', () => {
    expect(parseModelJson('```json\n{"candidate":"张三"}\n```')).toEqual({ candidate: '张三' })
  })

  it('extracts a balanced JSON object from model prose', () => {
    expect(parseModelJson('分析完成，结果如下：\n{"summary":"包含 { 字符也不会中断"}\n以上。')).toEqual({
      summary: '包含 { 字符也不会中断',
    })
  })

  it('rejects truncated JSON', () => {
    expect(() => parseModelJson('{"candidate":"张三","claims":[')).toThrow()
  })
})
