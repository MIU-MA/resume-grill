import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { mkdtemp, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, relative, resolve } from 'node:path'
import { createHash } from 'node:crypto'
import { createCanvas } from '@napi-rs/canvas'
import { tsImport } from 'tsx/esm/api'

const { EgoCdpSocket } = await tsImport('../src/browser-agent/ego-cdp-connection.ts', import.meta.url)
const directory = await mkdtemp(join(tmpdir(), 'resume-grill-ego-check-'))
if (!/^resume-grill-ego-check-[^\\/]+$/.test(relative(resolve(tmpdir()), resolve(directory)))) throw new Error('验证临时目录无效')
const image = createCanvas(24, 32).toBuffer('image/png')
const hash = value => createHash('sha256').update(value).digest('hex')
let socket, id = 0, uploads = 0, uploadBytes
const responses = new Map()
const server = createServer(async (req, res) => {
  res.setHeader('Content-Security-Policy', "default-src 'none'; script-src 'unsafe-inline'; img-src 'self'; connect-src 'self'")
  if (req.url === '/upload' && req.method === 'POST') {
    const chunks = []; for await (const chunk of req) chunks.push(chunk)
    uploadBytes = Buffer.concat(chunks); uploads++
    res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify({ code: 0, data: { url: '/image.png' } })); return
  }
  if (req.url === '/image.png') { res.setHeader('Content-Type', 'image/png'); res.end(image); return }
  res.setHeader('Content-Type', 'text/html; charset=utf-8')
  res.end(req.url === '/popup' ? '<title>本机沟通弹窗测试</title><p>仅本机页面</p>' : `<!doctype html><meta charset="utf-8"><title>ego 本机上传验证</title><input type="file" accept="image/png"><a id="popup" href="/popup" target="_blank">打开测试弹窗</a><output></output><script>document.querySelector('input').onchange=async e=>{const file=e.target.files[0];const result=await(await fetch('/upload',{method:'POST',body:file})).json();const image=new Image();image.src=result.data.url;document.body.append(image);document.querySelector('output').textContent='uploaded'};</script>`)
})
const until = async (read, accept) => {
  const end = Date.now() + 15000
  while (Date.now() < end) { const result = await read(); if (accept(result)) return result; await new Promise(resolve => setTimeout(resolve, 150)) }
  throw new Error('ego 页面回执等待超时')
}
try {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  const origin = `http://127.0.0.1:${server.address().port}`
  socket = await EgoCdpSocket.connect()
  socket.addEventListener('message', event => {
    const message = JSON.parse(event.data)
    if (message.method === 'Network.responseReceived' && message.params.response.url === origin + '/upload') responses.set(message.params.requestId, message.params.response)
  })
  const command = (method, params = {}, sessionId) => new Promise((resolve, reject) => {
    const current = ++id, timer = setTimeout(() => { socket.removeEventListener('message', listener); reject(new Error(method + ' 超时')) }, 20000)
    const listener = event => { const data = JSON.parse(event.data); if (data.id !== current) return; clearTimeout(timer); socket.removeEventListener('message', listener); if (data.error) reject(new Error(data.error.message)); else resolve(data.result) }
    socket.addEventListener('message', listener); socket.send(JSON.stringify({ id: current, method, params, sessionId }))
  })
  const target = await command('Target.createTarget', { url: 'about:blank' })
  const { sessionId } = await command('Target.attachToTarget', { targetId: target.targetId })
  await command('Page.enable', {}, sessionId)
  await command('Network.enable', { maxTotalBufferSize: 8 * 1024 * 1024, maxResourceBufferSize: 1024 * 1024, enableDurableMessages: true }, sessionId)
  await command('Page.navigate', { url: origin }, sessionId)
  const input = await command('Runtime.evaluate', { expression: 'document.querySelector("input[type=file]")', returnByValue: false }, sessionId)
  const path = join(directory, 'test-image.png'); await writeFile(path, image)
  await command('DOM.setFileInputFiles', { objectId: input.result.objectId, files: [path] }, sessionId)
  await until(() => command('Runtime.evaluate', { expression: 'document.querySelector("output").textContent', returnByValue: true }, sessionId), value => value.result.value === 'uploaded')
  const requestId = await until(async () => [...responses.keys()][0], Boolean)
  const body = await command('Network.getResponseBody', { requestId }, sessionId)
  assert.equal(JSON.parse(body.base64Encoded ? Buffer.from(body.body, 'base64').toString() : body.body).code, 0)
  assert.equal(uploads, 1); assert.equal(hash(uploadBytes), hash(image))
  console.log('PASS ego 本机图片上传、唯一上传次数、完整字节和 CDP 响应体回执')
  await command('Runtime.evaluate', { expression: 'document.querySelector("#popup").click()', userGesture: true }, sessionId)
  const popup = await until(() => command('Target.getTargets'), result => result.targetInfos.some(item => item.url === origin + '/popup'))
  const info = popup.targetInfos.find(item => item.url === origin + '/popup')
  assert.equal(info.openerId, target.targetId)
  const child = await command('Target.attachToTarget', { targetId: info.targetId })
  assert.equal((await command('Runtime.evaluate', { expression: 'document.title', returnByValue: true }, child.sessionId)).result.value, '本机沟通弹窗测试')
  console.log('PASS ego 真实弹窗来源追踪与自有弹窗接入')
} finally {
  await socket?.close()
  server.closeAllConnections(); await new Promise(resolve => server.close(resolve))
  await rm(directory, { recursive: true, force: true })
}
