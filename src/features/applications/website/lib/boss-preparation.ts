import { z } from 'zod'
import { matchesJob, searchKeywords } from '../../../../domain/job-search.ts'

import type { BossJob } from '../../../../domain/boss-search.ts'

export const bossPreparationSchema = z.object({
  readId: z.string().min(1),
  target: z.string().trim().min(1, '请填写岗位方向').max(120),
  resumeText: z.string().trim().min(10, '请提供已有简历中的相关经历').max(30000),
  greetingTemplate: z.string().trim().max(600).optional().default(''),
  selectedUrls: z.array(z.url()).max(30).optional(),
  images: z.array(z.object({
    name: z.string().min(1).max(180), type: z.enum(['image/png', 'image/jpeg']),
    size: z.number().int().positive().max(5 * 1024 * 1024),
    width: z.number().int().positive().max(20000), height: z.number().int().positive().max(20000),
    sha256: z.string().regex(/^[a-f0-9]{64}$/),
  }).strict()).max(3).default([]),
}).strict().refine(value => value.images.reduce((sum, image) => sum + image.size, 0) <= 10 * 1024 * 1024, '简历图片合计不能超过 10 MB')

function resumeEvidence(text: string) {
  const paragraphs: string[] = []
  let current = ''
  const flush = () => { if (current) paragraphs.push(current); current = '' }
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim()
    const bullet = /^[•●·\-*]\s*/.test(line)
    const heading = /^[\p{Script=Han}]{2,12}$/u.test(line)
    if (!line || heading || /@|https?:|1[3-9]\d{9}|[|｜]/.test(line)) { flush(); continue }
    if (bullet || /[。！？!?；;]$/.test(current) || current.length < 24) flush()
    current += (current && /[a-z0-9]$/i.test(current) && /^[a-z0-9]/i.test(line) ? ' ' : '') + line.replace(/^[•●·\-*]\s*/, '')
  }
  flush()
  // Choose a complete sentence; never cut an arbitrary PDF line at 180 characters.
  return paragraphs.flatMap(value => value.match(/[^。！？!?]+[。！？!?]|[^。！？!?]+$/g) ?? [])
    .map(value => value.trim()).filter(value => value.length >= 8 && value.length <= 180 && !/[并及与和的用将对为]$/.test(value))
}

export function prepareBossApplications(jobs: BossJob[], input: z.infer<typeof bossPreparationSchema>) {
  const keywords = searchKeywords(input.target.split(/[，,、;；\n]+/).map(value => value.trim()).filter(Boolean))
  const selected = input.selectedUrls ? new Set(input.selectedUrls) : null
  const softwareTarget = /前端|后端|全栈|frontend|front.end|backend|full.?stack/i.test(input.target) && !/法务|律师|客服|销售|催收/.test(input.target)
  if (selected && [...selected].some(url => !jobs.some(job => job.url === url))) throw new Error('选择的岗位已变化，请重新读取')
  const lines = resumeEvidence(input.resumeText)
  const prepared = [], skipped = []
  for (const job of jobs) {
    if (selected && !selected.has(job.url)) { skipped.push({ url: job.url, title: job.title, reason: '未选择' }); continue }
    if (softwareTarget && /法务|律师|客服|销售|催收|贷后/.test(job.title)) { skipped.push({ url: job.url, title: job.title, reason: '岗位名称属于其他职业方向' }); continue }
    if (!matchesJob(job.title, job.description ?? '', keywords)) { skipped.push({ url: job.url, title: job.title, reason: '岗位方向不匹配' }); continue }
    const terms = [...new Set([...keywords, ...((job.description ?? '').match(/[a-z][a-z0-9+#.-]{1,30}/gi) ?? [])])].map(term => term.toLowerCase())
    const evidence = lines.map(line => ({ line, score: terms.filter(term => line.toLowerCase().includes(term)).length })).filter(item => item.score > 0).sort((a, b) => b.score - a.score)[0]?.line ?? ''
    const quote = evidence ? `${evidence}${/[。！？!?]$/.test(evidence) ? '' : '。'}` : ''
    const template = input.greetingTemplate || `你好，想应聘{岗位}。{经历}${input.images.length ? '简历附在下面，方便聊聊吗？' : '方便聊聊吗？'}`
    const fields: Record<string, string> = { 岗位: job.title, 公司: job.company || '贵公司', 经历: quote }
    const greeting = template.replace(/\{(岗位|公司|经历)\}/g, (_, key: string) => fields[key])
    if (/\{[^{}]+\}/.test(greeting)) throw new Error('招呼语仅支持 {岗位}、{公司}、{经历} 三个占位符')
    prepared.push({
      ...job, greeting, evidence, status: input.images.length ? 'prepared' : 'needs-image',
      checks: [job.descriptionSource === 'detail' ? '已读取并核对岗位详情，建议仍需人工确认' : '仅根据当前页面的岗位信息筛选，完整 JD 仍需核对', ...(!evidence ? ['简历中未找到对应经历，请手动核对招呼语'] : []), ...(!input.images.length ? ['尚未选择简历图片'] : [])],
      steps: [{ type: 'greeting', text: greeting }, ...input.images.map(image => ({ type: 'resume-image', image }))],
    })
  }
  return { mode: 'dry-run' as const, prepared, skipped, images: input.images, sent: 0 }
}
