import { fillApplication } from './form-filler'
import type { WebsiteAnswer, WebsiteBatch, WebsiteProfile } from '../domain/website-automation'
import { waitForApplicationControls } from './form-ready'

const root = globalThis as typeof globalThis & { __resumeGrillFiller?: boolean }
if (!root.__resumeGrillFiller) {
  root.__resumeGrillFiller = true
  chrome.runtime.onMessage.addListener((message: { type: string; profile: WebsiteProfile; answers: WebsiteAnswer[]; attachment: WebsiteBatch['attachment']; experiences?: WebsiteBatch['experiences']; scope: string }, sender, respond) => {
    if (sender.id !== chrome.runtime.id || sender.tab || message.type !== 'fill-application') return
    void (async () => {
      await waitForApplicationControls()
      return fillApplication(message.profile, message.answers, message.attachment, message.scope, message.experiences)
    })().then(result => respond({ result })).catch(() => respond({ error: '页面未能填写，请检查表单后继续。' }))
    return true
  })
}
