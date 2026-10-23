import type { MissingField } from '../domain/website-automation'

// Selectors checked against Pigment's public Lever application, 2026-10-23.
// Require both the exact host and form signature; never apply to lookalike hosts.
export function leverForm(): HTMLFormElement | null {
  if (!['jobs.lever.co', 'jobs.eu.lever.co'].includes(location.hostname)) return null
  return document.querySelector<HTMLFormElement>('form#application-form')
}

export function leverLabel(element: Element): string | undefined {
  const form = leverForm()
  if (!form?.contains(element)) return
  return element.closest('.application-question')?.querySelector('.application-label')?.textContent?.replace(/[✱*＊]/g, '').trim() || undefined
}

export function leverRequired(element: Element): boolean {
  return !!leverForm()?.contains(element) && !!element.closest('.application-question')?.querySelector('.application-label .required, .required-field')
}

export function leverLocation(element: Element): boolean {
  return !!leverForm()?.contains(element) && element.matches('input[name="location"]')
    && !!element.parentElement?.querySelector('input[name="selectedLocation"]')
}

export function leverMissing(visible: (element: Element) => boolean): MissingField[] {
  const form = leverForm()
  if (!form) return []
  const missing: MissingField[] = []
  for (const question of form.querySelectorAll('.application-question.custom-question')) {
    if (!visible(question) || !question.querySelector('.required-field, .application-label .required')) continue
    const choices = [...question.querySelectorAll<HTMLInputElement>('input[type="radio"],input[type="checkbox"]')]
    if (choices.length && !choices.some(input => input.checked)) missing.push({
      label: `${leverLabel(choices[0]) || '必答选择题'}（请在官网选择）`, kind: 'manual',
    })
  }
  return missing
}

export function leverUploadConfirmed(): boolean {
  const value = leverForm()?.querySelector<HTMLInputElement>('input[name="resumeStorageId"]')?.value
  return !!value?.trim()
}
