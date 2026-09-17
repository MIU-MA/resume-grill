import nodemailer from 'nodemailer'
import { SMTP_PRESETS, type SmtpConfig, type MailJob } from '../domain/mail-schema.ts'

export function createSmtpTransport(config: SmtpConfig) {
  return nodemailer.createTransport({
    host: SMTP_PRESETS[config.provider].host,
    port: 465,
    secure: true,
    auth: { user: config.address, pass: config.authorizationCode },
    tls: { rejectUnauthorized: true, minVersion: 'TLSv1.2' },
    connectionTimeout: 15000,
    greetingTimeout: 15000,
    socketTimeout: 60000,
    disableFileAccess: true,
    disableUrlAccess: true,
    logger: false,
    debug: false,
  })
}

export function buildMailMessage(job: MailJob, content: Buffer) {
  const extension = job.attachment.name.split('.').pop()?.toLowerCase()
  const types: Record<string, string> = {
    pdf: 'application/pdf', docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', txt: 'text/plain',
  }
  return {
    from: { name: job.sender.name, address: job.sender.address },
    to: [{ address: job.recipient, name: '' }],
    envelope: { from: job.sender.address, to: [job.recipient] },
    subject: job.subject,
    text: job.body,
    messageId: job.messageId,
    attachments: [{ filename: job.attachment.name, content, contentType: types[extension ?? ''] }],
    disableFileAccess: true,
    disableUrlAccess: true,
  }
}

export async function sendApplication(config: SmtpConfig, job: MailJob, content: Buffer) {
  const transport = createSmtpTransport(config)
  try {
    const result = await transport.sendMail(buildMailMessage(job, content))
    if (!result.accepted.map(value => value.toLowerCase()).includes(job.recipient)) {
      throw Object.assign(new Error('Recipient rejected'), { responseCode: 550 })
    }
  } finally { transport.close() }
}

// A lost final DATA acknowledgement might mean the mail was accepted. Never retry it automatically.
export function classifySmtpError(error: unknown): { status: 'failed' | 'uncertain'; detail: string } {
  const e = error as { code?: string; responseCode?: number; command?: string }
  if (e.code === 'EAUTH') return { status: 'failed', detail: '邮箱登录失败，请检查 SMTP 服务和授权码，重新连接邮箱后再重试。' }
  if ((e.responseCode ?? 0) >= 400) return { status: 'failed', detail: `邮箱服务拒绝发送（SMTP ${e.responseCode}）。请检查地址、附件或邮箱发信限制后手动重试。` }
  if (['CONN', 'EHLO', 'HELO', 'AUTH', 'MAIL FROM', 'RCPT TO', 'STARTTLS'].some(command => e.command?.startsWith(command))) {
    return { status: 'failed', detail: '在提交邮件前连接失败。请检查网络或邮箱设置后手动重试。' }
  }
  return { status: 'uncertain', detail: '未收到明确发送结果。请在邮箱中核对发信记录或联系邮箱服务商；本条不会自动重发。' }
}
