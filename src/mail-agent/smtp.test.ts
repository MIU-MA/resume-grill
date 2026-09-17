import { describe, expect, it } from 'vitest'
import { createServer } from 'node:net'
import nodemailer from 'nodemailer'
import { randomUUID } from 'node:crypto'
import { buildMailMessage, classifySmtpError } from './smtp'
import type { MailJob } from '../domain/mail-schema'

describe('SMTP message delivery', () => {
  it('submits a real MIME message and attachment to a loopback-only fake SMTP server', async () => {
    const commands: string[] = []
    let rawMessage = ''
    const server = createServer(socket => {
      socket.write('220 localhost test SMTP\r\n')
      let pending = ''; let dataMode = false
      socket.on('data', bytes => {
        pending += bytes.toString()
        while (pending.includes('\r\n')) {
          const index = pending.indexOf('\r\n'); const line = pending.slice(0, index); pending = pending.slice(index + 2)
          if (dataMode) {
            if (line === '.') { dataMode = false; socket.write('250 2.0.0 Accepted for test only\r\n') }
            else rawMessage += line + '\r\n'
          } else {
            commands.push(line)
            if (/^EHLO/.test(line)) socket.write('250-localhost\r\n250 SIZE 10000000\r\n')
            else if (line === 'DATA') { dataMode = true; socket.write('354 Send test message\r\n') }
            else if (line === 'QUIT') socket.end('221 Bye\r\n')
            else socket.write('250 OK\r\n')
          }
        }
      })
    })
    await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
    const address = server.address(); if (!address || typeof address === 'string') throw new Error('No test port')
    const transport = nodemailer.createTransport({ host: '127.0.0.1', port: address.port, secure: false, ignoreTLS: true })
    const job: MailJob = {
      id: randomUUID(), batchId: randomUUID(), sender: { name: '测试求职者', address: 'candidate@example.com' },
      company: '测试公司', role: '前端', sourceUrl: 'https://example.com/careers', recipient: 'recruiting@example.com',
      subject: '应聘前端-测试人', body: '您好，附件是我的简历。', sourceConfirmed: true,
      status: 'sending', messageId: '<test-message@resume-grill.local>',
      attachment: { hash: 'unused', name: 'resume.txt', size: 17 }, createdAt: 1, updatedAt: 1,
    }
    try {
      const result = await transport.sendMail(buildMailMessage(job, Buffer.from('TEST RESUME ONLY')))
      expect(result.accepted).toEqual(['recruiting@example.com'])
      expect(commands.filter(command => command.startsWith('RCPT TO'))).toEqual(['RCPT TO:<recruiting@example.com>'])
      expect(rawMessage).toContain('Content-Disposition: attachment; filename=resume.txt')
      expect(rawMessage).toContain(Buffer.from('TEST RESUME ONLY').toString('base64'))
      expect(rawMessage).toContain('Message-ID: <test-message@resume-grill.local>')
      expect(rawMessage).not.toContain('Bcc:')
    } finally {
      transport.close()
      await new Promise<void>(resolve => server.close(() => resolve()))
    }
  })
  it('distinguishes pre-submit and post-DATA connection failures without exposing SMTP responses', () => {
    expect(classifySmtpError({ command: 'CONN', code: 'ETIMEDOUT' }).status).toBe('failed')
    expect(classifySmtpError({ command: 'DATA', code: 'ETIMEDOUT' }).status).toBe('uncertain')
    expect(classifySmtpError({ code: 'EAUTH', response: 'SECRET' }).detail).not.toContain('SECRET')
  })
})
