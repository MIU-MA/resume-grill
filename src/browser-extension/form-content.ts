import { fillApplication } from './form-filler'
import type { WebsiteAnswer, WebsiteBatch, WebsiteProfile } from '../domain/website-automation'

const root = globalThis as typeof globalThis & { __resumeGrillFiller?: boolean }
if (!root.__resumeGrillFiller) {
  root.__resumeGrillFiller = true
  chrome.runtime.onMessage.addListener((message: { type: string; profile: WebsiteProfile; answers: WebsiteAnswer[]; attachment: WebsiteBatch['attachment']; scope: string }, sender, respond) => {
    if (sender.id !== chrome.runtime.id || sender.tab || message.type !== 'fill-application') return
    void (async () => {
      for (let attempt = 0; attempt < 8 && !document.querySelector('input:not([type="hidden"]),select,textarea'); attempt++) await new Promise(resolve => setTimeout(resolve, 500))
      return fillApplication(message.profile, message.answers, message.attachment, message.scope)
    })().then(result => respond({ result })).catch(() => respond({ error: '页面未能填写，请检查表单后继续。' }))
    return true
  })
}
