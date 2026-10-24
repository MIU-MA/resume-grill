import { normalizeFieldLabel, sensitiveField, type FormResult, type MissingField, type ProfileKey, type WebsiteAnswer, type WebsiteBatch, type WebsiteProfile } from '../domain/website-automation'
import { leverForm, leverLocation, leverMissing, leverUploadConfirmed } from './lever-adapter'
import { experienceFields } from './experience-fields'
import type { WebsiteExperience } from '../domain/website-experience'
import { fieldHasValue as hasValue, formControls as controls, formLabel as labelFor, formVisible as visible, formRequired as required, formInvalid, type FormField as Field } from './form-dom'
import { customSelect, fillCustomSelect, selectControl, selectedText } from './custom-select'
import { biliUploadState, domesticSite } from './domestic-sites'

export function profileKey(label: string, autocomplete = ''): ProfileKey | undefined {
  if (sensitiveField(label)) return
  // Related fields are not interchangeable: school city is not the school,
  // company description is not a company name, and degree type is not degree.
  if (/学校.*城市|院校.*城市|学校.*地址|公司.*(?:地址|描述|行业|网址)|专业.*(?:排名|成绩)|学历.*类型|学位.*类型|school.*(?:city|address)|company.*(?:address|description|website)/i.test(label)) return
  const hints: Partial<Record<string, ProfileKey>> = { name: 'name', email: 'email', tel: 'phone', 'tel-national': 'phone', 'address-level2': 'city', organization: 'company', 'organization-title': 'jobTitle' }
  if (hints[autocomplete]) return hints[autocomplete]
  const patterns: Array<[ProfileKey, RegExp]> = [
    ['educationStart', /入学|教育.*开始|education.?start/i], ['educationEnd', /毕业时间|毕业日期|预计毕业|graduation|education.?end/i],
    ['workStart', /入职|工作.*开始|employment.?start/i], ['workEnd', /离职|工作.*结束|employment.?end/i],
    ['github', /github/i], ['portfolio', /作品集|个人网站|portfolio|personal.?website/i],
    ['school', /毕业院校|所在院校|学校|school|university|college/i], ['major', /专业|major|field.?of.?study/i], ['degree', /学历|学位|degree|education.?level/i],
    ['email', /邮箱|电子邮件|e.?mail/i], ['phone', /手机号|联系电话|联系方式.*电话|手机|移动电话|phone|mobile|telephone/i],
    ['city', /所在城市|现居|当前城市|current.?city|city.?of.?residence/i],
    ['company', /最近.*公司|当前.*公司|工作单位|current.?company|employer/i], ['jobTitle', /最近.*职位|当前.*职位|职务|current.?title|job.?title/i],
    ['name', /^(?:姓名|名字|中文姓名|真实姓名|候选人姓名|申请人姓名|name|full.?name|candidate.?name)(?:[\s*：:]|$)/i],
  ]
  return patterns.find(([, pattern]) => pattern.test(label))?.[0]
}
function setValue(element: Field, value: string) {
  const prototype = element instanceof HTMLSelectElement ? HTMLSelectElement.prototype : element instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype
  Object.getOwnPropertyDescriptor(prototype, 'value')!.set!.call(element, value)
  element.dispatchEvent(new Event('input', { bubbles: true, composed: true }))
  element.dispatchEvent(new Event('change', { bubbles: true, composed: true }))
  element.dispatchEvent(new FocusEvent('blur', { composed: true }))
  element.dispatchEvent(new FocusEvent('focusout', { bubbles: true, composed: true }))
}
function selectValue(element: Field, value: string) {
  if (!(element instanceof HTMLSelectElement)) return value
  if (element.multiple) return null
  const options = [...element.options].filter(option => !option.disabled && option.value)
  const match = options.filter(option => [option.value, option.text].some(text => normalizeFieldLabel(text) === normalizeFieldLabel(value)))
  return match.length === 1 ? match[0].value : null
}
function dateValue(element: Field, value: string) {
  if (!(element instanceof HTMLInputElement)) return value
  if (element.type === 'month') return /^\d{4}-\d{2}$/.test(value) ? value : null
  if (element.type === 'date') return /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null
  return value
}
function fileAccepted(element: HTMLInputElement, name: string) {
  const suffix = name.slice(name.lastIndexOf('.')).toLowerCase()
  const mime = suffix === '.pdf' ? 'application/pdf' : suffix === '.docx' ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' : 'text/plain'
  const accepted = element.accept.toLowerCase().split(',').map(value => value.trim()).filter(Boolean)
  return !accepted.length || accepted.some(value => value === suffix || value === mime || value === '*/*' || (value === 'application/*' && mime.startsWith('application/')))
}

export async function fillApplication(profile: WebsiteProfile, answers: WebsiteAnswer[], attachment: WebsiteBatch['attachment'], scope = '', experiences: WebsiteExperience[] = []): Promise<FormResult> {
  const fields = controls(document)
  const editable = fields.filter(element => !element.matches(':disabled') && !(element instanceof HTMLInputElement && element.readOnly) && !(element instanceof HTMLTextAreaElement && element.readOnly) && visible(element))
  const missing: MissingField[] = []
  const filled: string[] = []
  const addMissing = (item: MissingField) => { if (!missing.some(old => old.label === item.label && old.kind === item.kind)) missing.push(item) }
  // Passwords are never read or written; verification values are only checked
  // for presence after user input, never filled, persisted or sent in reports.
  const heading = document.title + ' ' + (document.querySelector('h1,h2,[role="heading"]')?.textContent ?? '')
  if (/登录|注册|sign\s*in|log\s*in|sign\s*up/i.test(heading) || editable.some(element => element instanceof HTMLInputElement && element.type === 'password')) return { filled, uploaded: false, missing: [{ label: '请先在官网登录，再点击继续填写', kind: 'manual' }], message: '需要登录。登录完成后回扩展继续。' }
  const captchaAnswered = [...document.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>('[name="g-recaptcha-response"],[name="h-captcha-response"]')].some(element => !!element.value.trim())
  if (editable.some(element => /验证|短信|动态码|captcha|verification|one.?time|\botp\b/i.test(labelFor(element) + ' ' + element.autocomplete) && !element.value.trim()) || (!captchaAnswered && [...document.querySelectorAll('iframe[src]')].some(frame => visible(frame) && /captcha|recaptcha|hcaptcha/i.test(frame.getAttribute('src') ?? '')))) {
    addMissing({ label: '请在官网处理验证码，再点击继续填写', kind: 'manual' })
  }
  const textFields = editable.filter(element => !(element instanceof HTMLInputElement) || !['hidden', 'password', 'file', 'submit', 'button', 'reset', 'checkbox', 'radio', 'image'].includes(element.type))
  const descriptors = textFields.map(element => ({ element, label: labelFor(element), key: profileKey(labelFor(element), element.autocomplete) }))
  const experiencePlan = experienceFields(experiences, labelFor, visible)
  experiencePlan.missing.forEach(addMissing)
  const changed: Array<{ element: Field; label: string; expected: string }> = []
  for (const { element, label, key } of descriptors) {
    if (customSelect(element)) continue
    const experience = experiencePlan.fields.get(element)
    if (experience && !experience.value) {
      if (required(element) && !hasValue(element)) addMissing({ label: `${experience.label}（请对照经历填写）`, kind: 'manual' })
      continue
    }
    if (leverLocation(element)) {
      const selected = element.parentElement?.querySelector<HTMLInputElement>('input[name="selectedLocation"]')?.value
      if (!selected || selected === 'null' || selected === 'undefined') addMissing({ label: 'Current location（请在官网搜索并选择城市）', kind: 'manual' })
      continue
    }
    if (!label || sensitiveField(label + ' ' + element.autocomplete)) continue
    if (hasValue(element)) {
      if (formInvalid(element)) addMissing({ label: `${label}（已有内容未通过页面校验）`, kind: 'manual' })
      continue
    }
    const repeated = key && ['school', 'major', 'degree', 'company', 'jobTitle', 'educationStart', 'educationEnd', 'workStart', 'workEnd'].includes(key) && descriptors.filter(item => item.key === key).length > 1
    if (repeated && !experience) { addMissing({ label: `${label}（多段经历，请在页面中填写）`, kind: 'manual' }); continue }
    const answer = answers.find(answer => answer.origin === location.origin && answer.scope === scope && normalizeFieldLabel(answer.label) === normalizeFieldLabel(label))
    const value = experience ? experience.value : key ? profile[key] : answer?.value
    if (!value) { if (required(element)) addMissing({ key, label, kind: key ? 'profile' : 'answer' }); continue }
    const formatted = dateValue(element, value)
    const target = formatted === null ? null : selectValue(element, formatted)
    if (target === null || element.closest('.ant-picker,.ant-calendar-picker,.el-date-editor,.semi-datepicker,.next-date-picker,.arco-picker') || ('maxLength' in element && element.maxLength > 0 && target.length > element.maxLength)) {
      addMissing({ label: `${label}（请在页面中选择或填写）`, kind: 'manual' }); continue
    }
    setValue(element, target)
    changed.push({ element, label: experience?.label ?? label, expected: target })
  }
  const combos = [...new Set([...document.querySelectorAll('[role="combobox"]'), ...fields].map(customSelect).filter((element): element is HTMLElement => !!element))].filter(visible)
  for (const wrapper of combos) {
    const control = selectControl(wrapper)
    const label = labelFor(control ?? wrapper)
    if (!label || sensitiveField(label) || control?.getAttribute('aria-disabled') === 'true' || control?.matches(':disabled') || wrapper.closest('fieldset:disabled')) continue
    if (!control) { if (required(wrapper)) addMissing({ label: `${label}（请在官网选择）`, kind: 'manual' }); continue }
    const key = profileKey(label)
    const input = wrapper.querySelector<Field>('input,textarea')
    const experience = experiencePlan.fields.get(wrapper) ?? (input && experiencePlan.fields.get(input))
    const duplicate = key && [...descriptors.filter(item => !wrapper.contains(item.element)).map(item => item.key), ...combos.filter(item => item !== wrapper).map(item => profileKey(labelFor(selectControl(item) ?? item)))].includes(key)
    const answer = answers.find(answer => answer.origin === location.origin && answer.scope === scope && normalizeFieldLabel(answer.label) === normalizeFieldLabel(label))
    const value = experience ? experience.value : duplicate ? undefined : key ? profile[key] : answer?.value
    if (selectedText(wrapper)) {
      if (formInvalid(control)) addMissing({ label: `${label}（已有选项未通过页面校验）`, kind: 'manual' })
      continue
    }
    if (value && await fillCustomSelect(wrapper, value)) filled.push(experience?.label ?? label)
    else if (value || required(control)) addMissing({ label: `${label}（请在官网选择）`, kind: 'manual' })
  }
  let uploaded = false
  const uploadInputs = fields.filter((element): element is HTMLInputElement => element instanceof HTMLInputElement && element.type === 'file' && !element.matches(':disabled') && (!element.parentElement || visible(element.parentElement))
    && /简历|resume|\bcv\b/i.test(labelFor(element)) && !/cover.?letter|求职信|证件|照片|成绩单/i.test(labelFor(element)))
  for (const input of uploadInputs) {
    const label = labelFor(input) || '简历附件'
    if (input.files?.length || biliUploadState(input) === 'confirmed' || (leverForm()?.contains(input) && leverUploadConfirmed())) { uploaded = true; continue }
    if (!fileAccepted(input, attachment.name)) { addMissing({ label: `${label}（附件格式不支持）`, kind: 'upload' }); continue }
    try {
      const bytes = Uint8Array.from(atob(attachment.base64), character => character.charCodeAt(0))
      const suffix = attachment.name.split('.').at(-1)?.toLowerCase()
      const type = suffix === 'pdf' ? 'application/pdf' : suffix === 'docx' ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' : 'text/plain'
      const transfer = new DataTransfer()
      transfer.items.add(new File([bytes], attachment.name, { type }))
      input.files = transfer.files
      input.dispatchEvent(new Event('change', { bubbles: true, composed: true }))
      input.dispatchEvent(new Event('input', { bubbles: true, composed: true }))
      uploaded ||= !!input.files?.length
      if (!input.files?.length) addMissing({ label: `${label}（请手动上传）`, kind: 'upload' })
    } catch { addMissing({ label: `${label}（请手动上传）`, kind: 'upload' }) }
  }
  await new Promise(resolve => setTimeout(resolve, 120))
  if (leverForm()) {
    // Binding FileList is not proof that Lever's asynchronous /parseResume succeeded.
    uploaded = leverUploadConfirmed()
    if (uploadInputs.length && !uploaded) addMissing({ label: '简历尚未取得官网上传确认，请检查上传提示，完成后继续', kind: 'upload' })
    leverMissing(visible).forEach(addMissing)
  } else if (domesticSite(location.hostname) && uploadInputs.length) {
    // For domestic sites, FileList alone cannot establish server acceptance.
    uploaded = uploadInputs.every(input => biliUploadState(input) === 'confirmed')
    if (!uploaded) addMissing({ label: '简历上传结果尚未确认，请在官网检查上传或解析提示', kind: 'upload' })
  }
  for (const change of changed) {
    if (change.element.isConnected && change.element.value === change.expected && !formInvalid(change.element)) filled.push(change.label)
    else addMissing({ label: `${change.label}（页面未接受填写，请手动核对）`, kind: 'manual' })
  }
  for (const element of editable) {
    if (element instanceof HTMLInputElement && required(element) && ['checkbox', 'radio'].includes(element.type) && !element.checked) {
      if (leverForm()?.contains(element) && element.closest('.custom-question')) continue
      if (element.type === 'radio' && element.name && editable.some(other => other instanceof HTMLInputElement && other.type === 'radio' && other.name === element.name && other.checked)) continue
      addMissing({ label: labelFor(element) || '页面必选项', kind: 'manual' })
    }
    if (sensitiveField(labelFor(element)) && required(element) && !element.value.trim()) addMissing({ label: `${labelFor(element)}（请在官网填写）`, kind: 'manual' })
    if (element instanceof HTMLInputElement && element.type === 'file' && required(element) && !element.files?.length && !uploadInputs.includes(element)) addMissing({ label: labelFor(element) || '其他必传附件', kind: 'upload' })
  }
  for (const element of fields) {
    if ((element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) && element.readOnly && element.type !== 'hidden' && !element.matches(':disabled') && visible(element) && required(element) && !customSelect(element) && !hasValue(element)) addMissing({ label: `${labelFor(element) || '页面必填项'}（请在官网选择或补全）`, kind: 'manual' })
  }
  if (!descriptors.some(item => item.key) && !combos.some(item => profileKey(labelFor(selectControl(item) ?? item))) && !uploadInputs.length && !textFields.some(element => required(element) && element.closest('form'))) addMissing({ label: '未找到可填写的申请表，请打开具体表单后继续', kind: 'manual' })
  if ([...document.querySelectorAll('[role="combobox"][aria-required="true"],[role="listbox"][aria-required="true"]')].some(element => visible(element) && !combos.some(wrapper => wrapper.contains(element) && selectedText(wrapper)))) addMissing({ label: '页面含必填的自定义选项，请在官网选择', kind: 'manual' })
  const site = domesticSite(location.hostname)
  const adapter = leverForm() ? 'Lever 基础字段适配 · ' : site ? `${site.name} · 共用控件规则（实站待验证） · ` : '通用规则 · '
  return { filled, uploaded, missing, message: adapter + (missing.length ? `已填写 ${filled.length} 项，另有 ${missing.length} 项需要处理。` : `已填写 ${filled.length} 项${uploaded ? '，已附简历' : ''}，请核对后在官网提交。`) }
}
