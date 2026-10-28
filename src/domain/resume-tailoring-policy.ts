import type { ResumeSectionKind } from './resume-structure'

type Section = { kind: ResumeSectionKind; lines: string[] }
const IDENTITY_LABEL = /(?:姓名|性别|出生|年龄|电话|手机|邮箱|微信|住址|现居|籍贯|政治面貌|婚姻|证件|毕业院校|学历|学位|name|phone|email|address|date of birth)\s*[:：]/i
const NARRATIVE = /开发|熟悉|掌握|擅长|具备|实践|参与|负责|项目|经验|基础|使用|推进|技术栈|求职意向|develop|experience|familiar|proficien|project|built|worked/i

/** Model restrictions apply to individual facts; users may still edit any source line. */
export function modelCanRewriteLine(section: Section, lineIndex: number): boolean {
  const line = section.lines[lineIndex]?.trim()
  if (!line || ['education', 'awards'].includes(section.kind)) return false
  if (section.kind !== 'general') return true
  if (IDENTITY_LABEL.test(line) || /@|https?:\/\/|(?:\+?86[- ]?)?1[3-9]\d{9}/i.test(line)) return false
  return line.length >= 20 && NARRATIVE.test(line)
}

export function preservedIntroductionFacts(before: string, after: string): boolean {
  const compactAfter = after.replace(/\s/g, '')
  const facts = before.match(/(?:19|20)\d{2}\s*届|本科|硕士|博士|学士|大专|在读|应届/g) ?? []
  return facts.every(fact => compactAfter.includes(fact.replace(/\s/g, '')))
}
