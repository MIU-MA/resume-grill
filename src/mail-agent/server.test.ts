import { afterEach, describe, expect, it } from 'vitest'
import { createServer, get as httpGet } from 'node:http'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve, sep } from 'node:path'
import { MailQueue } from './queue'
import { allowedOrigins, createAgentHandler } from './server'

const directories: string[] = []
afterEach(() => {
  for (const dir of directories.splice(0)) {
    if (!resolve(dir).startsWith(resolve(tmpdir()) + sep + 'mail-server-test-')) throw new Error('Unsafe test cleanup path')
    rmSync(dir, { recursive: true, force: true })
  }
})
describe('local mail agent HTTP boundary', () => {
  it('requires exact origin, host, and pairing token for reads and writes', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'mail-server-test-')); directories.push(dir)
    const queue = new MailQueue(dir)
    const options = { token: 'unit-test-pairing-token', origins: allowedOrigins(), queue: () => queue, port: 0 }
    const server = createServer(createAgentHandler(options))
    await new Promise<void>(done => server.listen(0, '127.0.0.1', done))
    const address = server.address(); if (!address || typeof address === 'string') throw new Error('No test port')
    options.port = address.port
    const url = `http://127.0.0.1:${address.port}`
    const headers = { Origin: 'http://127.0.0.1:3107', Authorization: 'Bearer unit-test-pairing-token' }
    try {
      expect((await fetch(url + '/status')).status).toBe(403)
      expect((await fetch(url + '/status', { headers: { ...headers, Origin: 'https://evil.example.com' } })).status).toBe(403)
      const reboundStatus = await new Promise<number | undefined>((done, reject) => {
        httpGet(url + '/status', { headers: { ...headers, Host: `evil.example.com:${address.port}` } }, response => {
          response.resume(); done(response.statusCode)
        }).on('error', reject)
      })
      expect(reboundStatus).toBe(403)
      expect((await fetch(url + '/status', { headers: { ...headers, Authorization: 'Bearer wrong' } })).status).toBe(401)
      const status = await fetch(url + '/status', { headers })
      expect(status.status).toBe(200)
      expect(status.headers.get('Access-Control-Allow-Origin')).toBe(headers.Origin)
      expect(await status.json()).toMatchObject({ jobs: [], sender: null })
      const preflight = await fetch(url + '/status', { method: 'OPTIONS', headers: { Origin: headers.Origin } })
      expect(preflight.status).toBe(204)
      expect(preflight.headers.get('Access-Control-Allow-Private-Network')).toBe('true')
      const malformed = await fetch(url + '/batches', { method: 'POST', headers: { ...headers, 'Content-Type': 'application/json' }, body: '{}' })
      expect(malformed.status).toBe(400)
      expect(queue.snapshot().jobs).toHaveLength(0)
    } finally { await new Promise<void>(done => server.close(() => done())) }
  })
  it('only accepts explicit HTTPS deployment origins without paths or wildcards', () => {
    expect(allowedOrigins('https://jobs.example.com').has('https://jobs.example.com')).toBe(true)
    expect(() => allowedOrigins('http://jobs.example.com')).toThrow()
    expect(() => allowedOrigins('https://jobs.example.com/')).toThrow()
    expect(() => allowedOrigins('*')).toThrow()
  })
})
