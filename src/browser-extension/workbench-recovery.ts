import { isWorkbenchUrl } from '../domain/website-automation'

/** Reloading an unpacked extension does not rerun static scripts in open tabs. */
export async function reconnectOpenWorkbenches() {
  const tabs = await chrome.tabs.query({})
  return Promise.allSettled(tabs.filter(tab => tab.id !== undefined && tab.url && isWorkbenchUrl(tab.url)).map(async tab => {
    const origins = [`http://${new URL(tab.url!).hostname}/*`]
    if (!await chrome.permissions.contains({ origins })) return
    await chrome.scripting.executeScript({ target: { tabId: tab.id!, frameIds: [0] }, files: ['bridge.js'] })
  }))
}
