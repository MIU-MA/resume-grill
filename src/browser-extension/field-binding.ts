import { formControls, formLabel, type FormField } from './form-dom'

/** Rebind only a unique stable identity after a framework replaces its DOM. */
export function bindFormField(element: FormField): () => FormField | undefined {
  const root = element.getRootNode(), id = element.id, name = element.getAttribute('name'), label = formLabel(element), type = element.type
  const section = (node: Element) => {
    const group = node.closest('fieldset,[role="group"]')
    return group?.getAttribute('aria-label') || group?.querySelector(':scope > legend')?.textContent?.trim() || ''
  }
  const group = section(element)
  return () => {
    if (element.isConnected) return formLabel(element) === label && section(element) === group && element.type === type ? element : undefined
    if (!id && !name) return
    const matches = formControls(document).filter(node => node.getRootNode() === root && node.tagName === element.tagName && node.type === type && (id ? node.id === id : node.getAttribute('name') === name) && formLabel(node) === label && section(node) === group)
    return matches.length === 1 ? matches[0] : undefined
  }
}
