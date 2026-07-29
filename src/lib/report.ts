import { CLAIM_CATEGORY_LABELS, type ResumeAnalysis } from '@/domain/resume-schema'
import { verifiabilityToRisk } from '@/lib/risk'

export function buildReport(analysis: ResumeAnalysis): string {
  const lines = [
    '# 简历声明风险报告',
    '',
    `候选人：${analysis.candidate} · ${analysis.role}`,
    `来源文件：${analysis.sourceFile}`,
    '',
    analysis.summary,
    '',
  ]

  for (const claim of analysis.claims) {
    const risk = verifiabilityToRisk(claim.verifiability)
    lines.push(
      `## ${claim.title}`,
      '',
      `- 类型：${CLAIM_CATEGORY_LABELS[claim.category]}`,
      `- 简历原文：${claim.quote}`,
      `- 可验证难度：${claim.verifiability}/100（${risk.label}）`,
      `- 证据缺口：${claim.evidenceGaps.join('；') || '无'}`,
      `- 评估要点：${claim.evaluationPoints.join('；')}`,
      '',
    )
  }

  return lines.join('\n')
}

export function downloadReport(analysis: ResumeAnalysis) {
  const content = buildReport(analysis)
  const url = URL.createObjectURL(new Blob([content], { type: 'text/markdown;charset=utf-8' }))
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = `简历声明报告-${analysis.candidate}.md`
  anchor.style.display = 'none'
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}
