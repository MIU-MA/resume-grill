import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { createConnection } from 'node:net'

export function parseChromeDebugEndpoint(text: string) {
  const [port, path] = text.trim().split(/\r?\n/)
  if (!/^\d+$/.test(port) || +port < 1 || +port > 65535 || !/^\/devtools\/browser\/[\w-]+$/.test(path)) throw new Error('Chrome 调试地址无效，请在 chrome://inspect/#remote-debugging 重新开启调试。')
  return `ws://127.0.0.1:${port}${path}`
}
export async function chromeDebugEndpoint() {
  if (!process.env.LOCALAPPDATA) throw new Error('请用 --attach=ws://127.0.0.1:端口/devtools/browser/... 指定本机 Chrome 调试地址。')
  const file = resolve(process.env.LOCALAPPDATA, 'Google/Chrome/User Data/DevToolsActivePort')
  const address = parseChromeDebugEndpoint(await readFile(file, 'utf8').catch(() => { throw new Error('Chrome 尚未开放调试连接。请在已登录 BOSS 的 Chrome 打开 chrome://inspect/#remote-debugging，启用后重试。') }))
  const url = new URL(address)
  const reachable = await new Promise<boolean>(done => {
    const socket = createConnection({ host: '127.0.0.1', port: +url.port })
    const finish = (value: boolean) => { socket.destroy(); done(value) }
    socket.setTimeout(1500)
    socket.once('connect', () => finish(true)); socket.once('error', () => finish(false)); socket.once('timeout', () => finish(false))
  })
  if (!reachable) throw new Error('Chrome 留下的调试地址已失效。请在当前 Chrome 的 chrome://inspect/#remote-debugging 重新开启调试，再点击连接；无需重新登录 BOSS。')
  return address
}

/** Keep the handshake alive for manual browser approval; reject early close and release listeners. */
export async function connectChromeSocket(address: URL, make: (url: URL) => WebSocket = url => new WebSocket(url), timeout = 180000) {
  const socket = make(address)
  await new Promise<void>((resolve, reject) => {
    let settled = false
    const finish = (error?: Error) => {
      if (settled) return
      settled = true; clearTimeout(timer)
      socket.removeEventListener('open', opened); socket.removeEventListener('error', failed); socket.removeEventListener('close', closed)
      if (error) { if (socket.readyState < WebSocket.CLOSING) socket.close(); reject(error) } else resolve()
    }
    const opened = () => finish()
    const failed = () => finish(new Error('Chrome 未接受调试连接。请检查浏览器的授权弹窗；若未允许或调试入口已失效，请在 chrome://inspect/#remote-debugging 确认后手动重试。'))
    const closed = () => finish(new Error('Chrome 在授权完成前关闭了连接。请手动允许调试；若其他调试工具正在连接，先结束对应连接后重试。'))
    const timer = setTimeout(() => finish(new Error('等待 Chrome 授权超时。请在浏览器完成允许操作，然后手动重试；不会自动反复连接。')), timeout)
    socket.addEventListener('open', opened, { once: true }); socket.addEventListener('error', failed, { once: true }); socket.addEventListener('close', closed, { once: true })
  })
  return socket
}
