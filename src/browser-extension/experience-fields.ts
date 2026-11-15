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

const normalized = (value: string) => value.normalize('NFKC').replace(/[\s:：*＊]/g, '').toLowerCase()
const groupKind = (label: string) => /教育|education/i.test(label) ? 'education' : /工作|实习|employment|work experience/i.test(label) ? 'work' : /项目|project/i.test(label) ? 'project' : undefined
// Match explicit numbers or unique existing facts. Never infer the order of
// multiple anonymous empty groups, overwrite user data or click unknown add buttons.
export function experienceFields(items: WebsiteExperience[], labelFor: (element: Element) => string, visible: (element: Element) => boolean) {
  const fields = new Map<Element, { value?: string; label: string }>()
  const missing: MissingField[] = []
  const groups = [...document.querySelectorAll('fieldset,[role="group"]')].map(element => ({ element, label: (element.getAttribute('aria-label') || element.querySelector(':scope > legend')?.textContent || '').trim() })).concat(biliExperienceGroups()).filter((group, index, all) => visible(group.element) && all.findIndex(other => other.element === group.element) === index)
  const seen = new Set<string>()
  for (const { element: group, label } of groups) {
    const kind = groupKind(label)
    if (!kind) continue
    const controls = [...group.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>('input,select,textarea')].filter(element => !groups.some(other => other.element !== group && group.contains(other.element) && other.element.contains(element)))
    const combos = [...new Set([...group.querySelectorAll('[role="combobox"]')].map(customSelect).filter((node): node is HTMLElement => !!node))]
    const entries = items.filter(item => item.kind === kind)
    const values = [...controls.filter(node => visible(node) && node.type !== 'hidden' && !customSelect(node) && fieldHasValue(node)).map(node => ({ key: experienceFieldKey(labelFor(node)), value: node instanceof HTMLSelectElement ? node.selectedOptions[0]?.text ?? node.value : node.value })), ...combos.filter(node => selectedText(node)).map(node => ({ key: experienceFieldKey(labelFor(node)), value: selectedText(node) }))].filter(value => !!value.key)
    const number = label.normalize('NFKC').replace(/[()]/g, '').match(/(?:第\s*)?(\d+)\s*(?:段|项)?\s*$/)?.[1]
    const anchors = values.filter(value => ['organization', 'title', 'start'].includes(value.key!))
    const matches = number ? [Number(number) - 1] : anchors.length ? entries.flatMap((entry, index) => anchors.every(value => normalized(entry[value.key!]) === normalized(value.value)) ? [index] : []) : entries.length === 1 && groups.filter(other => groupKind(other.label) === kind).length === 1 ? [0] : []
    const index = matches.length === 1 ? matches[0] : -1, item = entries[index]
    const identity = `${kind}:${index + 1}`
    const duplicateNumber = !!number && groups.some(other => other.element !== group && groupKind(other.label) === kind && Number(other.label.normalize('NFKC').replace(/[()]/g, '').match(/(?:第\s*)?(\d+)\s*(?:段|项)?\s*$/)?.[1]) === Number(number))
    const conflict = !!item && values.some(value => normalized(item[value.key!]) !== normalized(value.value))
    const ambiguous = !item || seen.has(identity) || duplicateNumber || conflict
    for (const element of [...controls, ...combos]) {
      const field = labelFor(element)
      const key = experienceFieldKey(field)
      fields.set(element, { value: !ambiguous && key ? item?.[key] : undefined, label: `${label} / ${field}` })
    }
    if (ambiguous) missing.push({ kind: 'manual', label: `${label}（无法唯一匹配或已有内容不同，请对照经历核对）` })
    if (item && !ambiguous) seen.add(identity)
  }
  for (const kind of ['education', 'work', 'project'] as const) {
    const count = items.filter(item => item.kind === kind).length
    const matched = [...seen].filter(key => key.startsWith(kind + ':')).length
    if (count > matched) missing.push({ kind: 'manual', label: `${{ education: '教育', work: '工作 / 实习', project: '项目' }[kind]}经历还有 ${count - matched} 段未匹配，请在官网新增对应分组或从工作台复制` })
  }
  return { fields, missing }
}
