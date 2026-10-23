import type { WebsiteExperience } from '../domain/website-experience'
import type { MissingField } from '../domain/website-automation'

// Only explicitly numbered, accessible groups are eligible. No positional guess
// across unknown DOM containers and no automatic clicks on "add experience".
export function experienceFields(items: WebsiteExperience[], labelFor: (element: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement) => string, visible: (element: Element) => boolean) {
  const fields = new Map<Element, { value?: string; label: string }>()
  const missing: MissingField[] = []
  const groups = [...document.querySelectorAll('fieldset,[role="group"]')].filter(visible)
  const seen = new Set<string>()
  for (const group of groups) {
    const label = (group.getAttribute('aria-label') || group.querySelector(':scope > legend')?.textContent || '').trim()
    const kind = /教育|education/i.test(label) ? 'education' : /工作|实习|employment|work experience/i.test(label) ? 'work' : /项目|project/i.test(label) ? 'project' : undefined
    if (!kind) continue
    const controls = [...group.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>('input,select,textarea')].filter(element => element.closest('fieldset,[role="group"]') === group)
    const number = label.match(/(?:第\s*)?(\d+)\s*(?:段|项)?\s*$/)?.[1]
    const identity = `${kind}:${number}`
    const item = number ? items.filter(item => item.kind === kind)[Number(number) - 1] : undefined
    const ambiguous = !item || seen.has(identity) || groups.filter(other => (other.getAttribute('aria-label') || other.querySelector(':scope > legend')?.textContent || '').trim() === label).length > 1
    const existing = controls.some(element => element.type !== 'hidden' && element.value.trim())
    for (const element of controls) {
      const field = labelFor(element)
      const key = /学校|院校|公司|单位|项目名称|school|university|company|employer|project name/i.test(field) ? 'organization' : /专业|职位|职务|角色|major|title|role/i.test(field) ? 'title' : /开始|入学|入职|start/i.test(field) ? 'start' : /结束|毕业|离职|end/i.test(field) ? 'end' : /描述|职责|内容|description|responsibilit/i.test(field) ? 'description' : undefined
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
