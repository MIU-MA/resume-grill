import { normalizeFieldLabel } from '../domain/website-automation'
import { formInvalid, formVisible } from './form-dom'

const WRAPPERS = '.ant-select,.el-select,.semi-select,.next-select,.arco-select'
const VALUES = '.ant-select-selection-item,.ant-select-selection-selected-value,.el-select__selected-item:not(.is-placeholder),.el-select__tags-text,.semi-select-selection-text,.next-select-single .next-select-values,.arco-select-view-value'
export function customSelect(element: Element): HTMLElement | null {
  if (element instanceof HTMLSelectElement) return null
  return element.closest<HTMLElement>(WRAPPERS) ?? (element.getAttribute('role') === 'combobox' ? element as HTMLElement : null)
}
export function selectControl(wrapper: Element): HTMLElement | null {
  return wrapper.matches('[role="combobox"]') ? wrapper as HTMLElement : wrapper.querySelector<HTMLElement>('[role="combobox"]')
}
export function selectedText(wrapper: Element): string {
  return [...wrapper.querySelectorAll(VALUES)].filter(formVisible).map(node => node.textContent?.trim() ?? '').filter(Boolean).join(' ').trim()
    || wrapper.getAttribute('aria-valuetext')?.trim() || selectControl(wrapper)?.getAttribute('aria-valuetext')?.trim() || ''
}

// Only operate on a single, explicitly linked listbox. Never guess a global
// popup, select the first result, or treat search input text as a selection.
export async function fillCustomSelect(wrapper: HTMLElement, value: string): Promise<boolean> {
  const control = selectControl(wrapper)
  if (!control || wrapper.matches('.ant-select-multiple,.ant-select-enabled.ant-select-multiple,.el-select--multiple,.semi-select-multiple,.next-select-multiple') || wrapper.querySelector('[aria-multiselectable="true"],.ant-select-selection--multiple,.el-select__tags')) return false
  if (wrapper.matches('.ant-select-disabled,.is-disabled,.semi-select-disabled,.next-disabled,.arco-select-view-disabled') || control.getAttribute('aria-disabled') === 'true' || control.matches(':disabled')) return false
  if (selectedText(wrapper)) return !formInvalid(control) && normalizeFieldLabel(selectedText(wrapper)) === normalizeFieldLabel(value)
  const previousExpanded = control.getAttribute('aria-expanded') === 'true'
  if (!previousExpanded) control.click()
  let list: Element | undefined
  for (let attempt = 0; attempt < 6; attempt++) {
    const ids = `${control.getAttribute('aria-controls') ?? ''} ${control.getAttribute('aria-owns') ?? ''}`.trim().split(/\s+/).filter(Boolean)
    const root = control.getRootNode() as Document | ShadowRoot
    const lists = [...new Set(ids)].map(id => root.getElementById(id)).filter((node): node is HTMLElement => !!node && node.getAttribute('role') === 'listbox' && formVisible(node))
    if (lists.length === 1) { list = lists[0]; break }
    await new Promise(resolve => setTimeout(resolve, 80))
  }
  const matches = list && list.getAttribute('aria-multiselectable') !== 'true' ? [...list.querySelectorAll<HTMLElement>('[role="option"]')].filter(option => formVisible(option) && option.getAttribute('aria-disabled') !== 'true' && !option.matches('.ant-select-item-option-disabled,.ant-select-dropdown-menu-item-disabled,.is-disabled') && normalizeFieldLabel(option.getAttribute('aria-label') || option.textContent || '') === normalizeFieldLabel(value)) : []
  if (matches.length !== 1) {
    if (!previousExpanded) control.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', bubbles: true }))
    return false
  }
  matches[0].click()
  await new Promise(resolve => setTimeout(resolve, 120))
  return wrapper.isConnected && !formInvalid(control) && normalizeFieldLabel(selectedText(wrapper)) === normalizeFieldLabel(value)
}
