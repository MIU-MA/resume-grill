import { formControls, formLabel, formRequired, formVisible } from './form-dom'
import { profileKey } from './form-filler'

// SPA headers often expose a job-search box before the application mounts.
// Wait for candidate fields, a login control, or a required form field instead.
export function hasApplicationControls(): boolean {
  return formControls(document).some(element => {
    if (element instanceof HTMLInputElement && element.type === 'file') return /简历|resume|\bcv\b/i.test(formLabel(element))
    if (!formVisible(element) || element.getAttribute('type') === 'hidden') return false
    return element.getAttribute('type') === 'password' || !!profileKey(formLabel(element), element.autocomplete) || formRequired(element) && !!element.closest('form')
  }) || [...document.querySelectorAll('[role="combobox"]')].some(element => formVisible(element) && !!profileKey(formLabel(element)))
}
export async function waitForApplicationControls(): Promise<void> {
  for (let attempt = 0; attempt < 8 && !hasApplicationControls(); attempt++) await new Promise(resolve => setTimeout(resolve, 500))
}
