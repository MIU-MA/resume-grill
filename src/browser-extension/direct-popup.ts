import { PROFILE_LABELS, profileSchema, type WebsiteProfile } from '../domain/website-automation'
import { MAX_ATTACHMENT_BYTES, sourceUrlSchema } from '../domain/mail-schema'
import type { DirectData, DirectState } from './direct-fill'

export function mountDirectPopup(root: HTMLElement) {
  let data: DirectData = { profile: {}, attachment: null }
  let tab: chrome.tabs.Tab | undefined
  let busy = true
  const fields = new Map<keyof WebsiteProfile, HTMLInputElement>()
  const hint = document.createElement('p'); hint.className = 'detail'; hint.textContent = '资料可留空，只填写你提供的内容。点击填写时保存，下次直接复用。'
  const target = document.createElement('p'); target.className = 'detail'; target.textContent = '正在读取当前页面…'
  const grid = document.createElement('div'); grid.className = 'direct-fields'
  const more = document.createElement('details'); const summary = document.createElement('summary'); summary.textContent = '学校、工作与其他资料'; more.append(summary)
  const moreGrid = document.createElement('div'); moreGrid.className = 'direct-fields'; more.append(moreGrid)
  for (const key of Object.keys(PROFILE_LABELS) as Array<keyof WebsiteProfile>) {
    const label = document.createElement('label'); label.textContent = `${key === 'email' ? '个人邮箱' : PROFILE_LABELS[key]}（选填）`
    const input = document.createElement('input'); input.name = key; input.maxLength = 200; input.disabled = true
    input.type = key === 'email' ? 'email' : key === 'phone' ? 'tel' : 'text'
    input.oninput = () => { data.profile[key] = input.value }
    fields.set(key, input); label.append(input); (['name', 'email', 'phone'].includes(key) ? grid : moreGrid).append(label)
  }
  const fileLabel = document.createElement('label'); fileLabel.textContent = '简历附件（选填）'
  const file = document.createElement('input'); file.type = 'file'; file.accept = '.pdf,.docx,.txt'; file.disabled = true; fileLabel.append(file)
  const attachmentName = document.createElement('span'); attachmentName.className = 'detail'
  const removeFile = document.createElement('button'); removeFile.textContent = '移除附件'; removeFile.type = 'button'
  const attachmentRow = document.createElement('div'); attachmentRow.className = 'actions'; attachmentRow.append(attachmentName, removeFile)
  const status = document.createElement('p'); status.setAttribute('role', 'status'); status.className = 'detail'
  const result = document.createElement('div')
  const fill = document.createElement('button'); fill.textContent = '填写当前页面'; fill.className = 'primary'
  const save = document.createElement('button'); save.textContent = '保存资料'
  const actions = document.createElement('div'); actions.className = 'actions'; actions.append(fill, save)
  root.append(target, hint, grid, more, fileLabel, attachmentRow, actions, status, result)
  function controls() {
    for (const input of fields.values()) input.disabled = busy
    file.disabled = save.disabled = busy; removeFile.disabled = busy; removeFile.hidden = !data.attachment
    fill.disabled = busy || !tab?.url || !sourceUrlSchema.safeParse(tab.url).success
    attachmentName.textContent = data.attachment?.name ?? '未选择附件；仅填资料时不用选。'
  }
  function showRun(state: DirectState) {
    result.replaceChildren()
    if (!state.run) return
    const heading = document.createElement('p'); heading.className = 'detail'; heading.textContent = `上次填写页面：${state.run.url}`; result.append(heading)
    if (state.run.status === 'error') { status.textContent = state.run.error ?? '填写失败'; status.className = 'error'; return }
    if (state.run.status === 'running') { status.textContent = '正在填写，关闭面板后也会继续；重新打开可查看结果。'; return }
    if (!state.run.result) return
    status.className = 'detail'; status.textContent = `已填写 ${state.run.result.filled.length} 项，请在官网核对。`
    const detail = document.createElement('p'); detail.className = 'detail'; detail.textContent = state.run.result.message; result.append(detail)
    for (const missing of state.run.result.missing) {
      const line = document.createElement('p'); line.className = 'detail'
      line.textContent = `${missing.label} — ${missing.kind === 'profile' ? '补充上方资料后再次点击填写' : '请在官网补充或选择'}`
      result.append(line)
    }
  }
  async function request(message: object): Promise<DirectState> {
    const reply = await chrome.runtime.sendMessage(message)
    if (!reply?.ok) throw new Error(reply?.error || '扩展未响应，请重新打开面板。')
    return reply.data ?? { profile: {}, attachment: null }
  }
  function fail(error: unknown) { status.className = 'error'; status.textContent = error instanceof Error ? error.message : '操作失败，请重试。' }
  async function act(shouldFill: boolean) {
    if (busy) return
    const profile = profileSchema.safeParse(data.profile)
    if (!profile.success) { fail(new Error(profile.error.issues[0].message)); return }
    if (shouldFill && !Object.values(profile.data).some(Boolean) && !data.attachment) { fail(new Error('先填写一项个人资料，或选择简历附件。')); return }
    if (shouldFill && (!tab?.url || !sourceUrlSchema.safeParse(tab.url).success)) { fail(new Error('先打开 HTTPS 官网申请表，再打开扩展。')); return }
    busy = true; controls(); status.className = 'detail'; status.textContent = shouldFill ? '正在填写…' : '正在保存…'
    try {
      const payload = { ...data, profile: profile.data }
      // This permission request remains directly on the user's click path.
      if (shouldFill && !await chrome.permissions.request({ origins: [new URL(tab!.url!).origin + '/*'] })) throw new Error('未允许访问当前官网，尚未填写。')
      const state = await request(shouldFill ? { type: 'direct-fill', request: { tabId: tab!.id, url: tab!.url, data: payload } } : { type: 'direct-save', data: payload })
      if (shouldFill) showRun(state)
      else status.textContent = '资料已保存在当前浏览器扩展中。'
    } catch (error) { fail(error) }
    finally { busy = false; controls() }
  }
  fill.onclick = () => { void act(true) }; save.onclick = () => { void act(false) }
  removeFile.onclick = () => { data.attachment = null; controls(); status.textContent = '附件已移除，点击保存资料或填写后生效。' }
  file.onchange = () => {
    const selected = file.files?.[0]; file.value = ''
    if (!selected) return
    if (!selected.size || selected.size > MAX_ATTACHMENT_BYTES || !/\.(pdf|docx|txt)$/i.test(selected.name)) { fail(new Error('附件支持 5 MB 以内的 PDF、DOCX、TXT。')); return }
    busy = true; controls()
    const reader = new FileReader()
    reader.onload = () => { data.attachment = { name: selected.name, base64: String(reader.result).split(',')[1] }; busy = false; controls() }
    reader.onerror = () => { busy = false; controls(); fail(new Error('附件读取失败，请重新选择。')) }
    reader.readAsDataURL(selected)
  }
  controls()
  void Promise.all([request({ type: 'direct-state' }), chrome.tabs.query({ active: true, currentWindow: true })]).then(([state, tabs]) => {
    data = { profile: { ...state.profile }, attachment: state.attachment }; tab = tabs[0]
    for (const [key, input] of fields) input.value = data.profile[key] ?? ''
    target.textContent = tab?.url && sourceUrlSchema.safeParse(tab.url).success ? `当前页面：${new URL(tab.url).hostname}` : '请先打开 HTTPS 官网申请表，再打开扩展。资料可先保存。'
    busy = state.run?.status === 'running'; controls(); showRun(state)
    if (busy) {
      const timer = setInterval(() => { void request({ type: 'direct-state' }).then(next => {
        showRun(next)
        if (next.run?.status !== 'running') { clearInterval(timer); busy = false; controls() }
      }).catch(error => { clearInterval(timer); busy = false; controls(); fail(error) }) }, 1500)
    }
  }).catch(fail)
}
