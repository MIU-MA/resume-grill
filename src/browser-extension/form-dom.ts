import { leverLabel, leverRequired } from './lever-adapter'
import { biliUploadLabel } from './domestic-sites'

export type FormField = HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
const ROWS = '.ant-form-item,.el-form-item,.semi-form-field,.next-form-item,.arco-form-item'
const LABELS = '.ant-form-item-label,.el-form-item__label,.semi-form-field-label,.next-form-item-label,.arco-form-item-label'

function labelText(element: Element) {
  const clone = element.cloneNode(true) as Element
  clone.querySelectorAll('input,select,textarea,button,[role="combobox"],[role="tooltip"],.ant-select,.el-select,.semi-select,.next-select,.arco-select,.ant-form-item-explain,.ant-form-explain').forEach(node => node.remove())
  return clone.textContent?.replace(/\s+/g, ' ').trim() ?? ''
}

export function formLabel(element: Element): string {
  const adapted = leverLabel(element) || biliUploadLabel(element)
  if (adapted) return adapted
  const root = element.getRootNode() as Document | ShadowRoot
  const ids = (element.getAttribute('aria-labelledby') ?? '').split(/\s+/).filter(Boolean)
  const linked = ids.map(id => root.getElementById(id)).filter((node): node is HTMLElement => !!node).map(labelText).join(' ')
  const native = [...((element as FormField).labels ?? [])].map(labelText).join(' ')
  const row = element.closest(ROWS)
  const rowLabel = row && [...row.querySelectorAll(LABELS)].find(label => label.closest(ROWS) === row)
  // A placeholder or selected option must not change the field's identity.
  return (element.getAttribute('aria-label') || linked || native || (rowLabel && labelText(rowLabel)) || element.getAttribute('placeholder') || `${element.getAttribute('name') ?? ''} ${element.id}`).trim().slice(0, 200)
}

export function formVisible(element: Element): boolean {
  if (element.closest('[hidden],[inert],[aria-hidden="true"]')) return false
  for (let node: Element | null = element; node; node = node.parentElement) {
    const style = getComputedStyle(node)
    if (style.display === 'none' || style.visibility === 'hidden') return false
    if (node instanceof HTMLDetailsElement && !node.open && !node.querySelector(':scope > summary')?.contains(element)) return false
  }
  return true
}

export function formRequired(element: Element): boolean {
  const row = element.closest(ROWS)
  const marker = row && [...row.querySelectorAll('.ant-form-item-required,.semi-form-field-label-required,.next-form-item-required,.arco-form-item-symbol')].some(node => node.closest(ROWS) === row)
  return !!(element as FormField).required || element.getAttribute('aria-required') === 'true' || /[*＊]/.test(formLabel(element)) || leverRequired(element) || !!marker || !!row?.classList.contains('is-required')
}

export function formInvalid(element: Element): boolean {
  return element.getAttribute('aria-invalid') === 'true' || (element instanceof HTMLInputElement || element instanceof HTMLSelectElement || element instanceof HTMLTextAreaElement) && !element.validity.valid
    || !!element.closest('.ant-form-item-has-error,.ant-form-item.has-error,.el-form-item.is-error,.semi-form-field-error,.next-form-item.has-error,.arco-form-item-status-error')
}

export function fieldHasValue(element: FormField): boolean {
  if (element instanceof HTMLSelectElement && !element.multiple) {
    const selected = element.options[element.selectedIndex]
    if (selected && (selected.disabled || /^(?:请选择|please\s+select|select\b|choose\b|-{2,})/i.test(selected.text.trim()))) return false
  }
  if (element instanceof HTMLInputElement && ['checkbox', 'radio'].includes(element.type)) return element.checked
  return !!element.value.trim()
}

export function formControls(root: Document | ShadowRoot): FormField[] {
  return [...root.querySelectorAll<FormField>('input,select,textarea'), ...[...root.querySelectorAll('*')].flatMap(element => element.shadowRoot ? formControls(element.shadowRoot) : [])].slice(0, 300)
}
