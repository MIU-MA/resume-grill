import type { WebsiteExperience } from '../domain/website-experience'
import type { MissingField } from '../domain/website-automation'
import { biliExperienceGroups } from './domestic-sites'
import { fieldHasValue } from './form-dom'
import { customSelect, selectedText } from './custom-select'

export function experienceFieldKey(label: string): 'organization' | 'title' | 'start' | 'end' | 'description' | undefined {
  const field = label.replace(/[\s:：*＊]/g, '').toLowerCase()
  const patterns = {
    description: /^(?:(?:工作|实习|项目|公司)?(?:描述|职责|内容)|description|responsibilities|(?:work|project|company)description)$/,
    organization: /^(?:学校(?:名称)?|院校(?:名称)?|毕业院校|公司(?:名称)?|单位(?:名称)?|项目名称|school(?:name)?|university|company(?:name)?|employer|projectname)$/,
    title: /^(?:专业(?:名称)?|职位(?:名称)?|职务|岗位(?:名称)?|角色|项目(?:角色|职务)|major|title|jobtitle|role)$/,
    start: /^(?:开始(?:时间|日期)?|入学(?:时间|日期)?|入职(?:时间|日期)?|start(?:date)?)$/,
    end: /^(?:结束(?:时间|日期)?|毕业(?:时间|日期)?|离职(?:时间|日期)?|end(?:date)?)$/,
  }
  return (Object.keys(patterns) as Array<keyof typeof patterns>).find(key => patterns[key].test(field))
}

// Only explicitly numbered, accessible groups are eligible. No positional guess
// across unknown DOM containers and no automatic clicks on "add experience".
export function experienceFields(items: WebsiteExperience[], labelFor: (element: Element) => string, visible: (element: Element) => boolean) {
  const fields = new Map<Element, { value?: string; label: string }>()
  const missing: MissingField[] = []
  const groups = [...document.querySelectorAll('fieldset,[role="group"]')].map(element => ({ element, label: (element.getAttribute('aria-label') || element.querySelector(':scope > legend')?.textContent || '').trim() })).concat(biliExperienceGroups()).filter(group => visible(group.element))
  const seen = new Set<string>()
  for (const { element: group, label } of groups) {
    const kind = /教育|education/i.test(label) ? 'education' : /工作|实习|employment|work experience/i.test(label) ? 'work' : /项目|project/i.test(label) ? 'project' : undefined
    if (!kind) continue
    const controls = [...group.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>('input,select,textarea')].filter(element => !groups.some(other => other.element !== group && group.contains(other.element) && other.element.contains(element)))
    const combos = [...new Set([...group.querySelectorAll('[role="combobox"]')].map(customSelect).filter((node): node is HTMLElement => !!node))]
    const number = label.match(/(?:第\s*)?(\d+)\s*(?:段|项)?\s*$/)?.[1]
    const identity = `${kind}:${number}`
    const item = number ? items.filter(item => item.kind === kind)[Number(number) - 1] : undefined
    const ambiguous = !item || seen.has(identity) || groups.filter(other => other.label === label).length > 1
    const existing = controls.some(element => visible(element) && element.type !== 'hidden' && !customSelect(element) && fieldHasValue(element)) || combos.some(element => !!selectedText(element))
    for (const element of [...controls, ...combos]) {
      const field = labelFor(element)
      const key = experienceFieldKey(field)
      fields.set(element, { value: !ambiguous && !existing && key ? item?.[key] : undefined, label: `${label} / ${field}` })
    }
    if (ambiguous || existing) missing.push({ kind: 'manual', label: `${label}（分组不明确或已有内容，请对照经历核对）` })
    if (item && !ambiguous) seen.add(identity)
  }
  for (const kind of ['education', 'work', 'project'] as const) {
    const count = items.filter(item => item.kind === kind).length
    const matched = [...seen].filter(key => key.startsWith(kind + ':')).length
    if (count > matched) missing.push({ kind: 'manual', label: `${{ education: '教育', work: '工作 / 实习', project: '项目' }[kind]}经历还有 ${count - matched} 段未匹配，请在官网新增对应分组或从工作台复制` })
  }
  return { fields, missing }
}
