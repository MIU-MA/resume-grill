import { CLAIM_CATEGORY_LABELS, type ResumeAnalysis } from '@/domain/resume-schema'
import type { InterviewSession } from '@/domain/interview-schema'
import { claimRisk } from '@/lib/risk'

// 基础报告：仅声明风险，不含面试表现。
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
    const risk = claimRisk(claim.askLikelihood, claim.evidenceStrength)
    lines.push(
      `## ${claim.title}`,
      '',
      `- 类型：${CLAIM_CATEGORY_LABELS[claim.category]}`,
      `- 简历原文：${claim.quote}`,
      `- 被追问概率：${claim.askLikelihood}/100`,
      `- 证据完整度：${claim.evidenceStrength}/100（${risk.label}）`,
      `- 证据缺口：${claim.evidenceGaps.join('；') || '无'}`,
      `- 评估要点：${claim.evaluationPoints.join('；')}`,
      '',
    )
  }

  return lines.join('\n')
}

// 完整报告：在声明风险之上叠加面试表现与改写建议。
export function buildFullReport(analysis: ResumeAnalysis, sessions: Record<string, InterviewSession>): string {
  const lines = [
    '# 简历追问与改写报告',
    '',
    `候选人：${analysis.candidate} · ${analysis.role}`,
    `来源文件：${analysis.sourceFile}`,
    '',
    analysis.summary,
    '',
  ]

  for (const claim of analysis.claims) {
    const risk = claimRisk(claim.askLikelihood, claim.evidenceStrength)
    const session = sessions[claim.quote]
    lines.push(
      `## ${claim.title}`,
      '',
      `- 类型：${CLAIM_CATEGORY_LABELS[claim.category]}`,
      `- 简历原文：${claim.quote}`,
      `- 被追问概率：${claim.askLikelihood}/100`,
      `- 证据完整度：${claim.evidenceStrength}/100（${risk.label}）`,
    )
    if (session) {
      lines.push(
        `- 面试状态：${session.status === 'done' ? '已完成' : '进行中'}`,
        `- 追问轮数：${session.turns.length}`,
        `- 覆盖要点：${session.coveredPoints.join('、') || '无'}`,
        `- 仍缺失：${session.missingPoints.join('、') || '无'}`,
        '',
        '### 结论',
        session.finalSummary || '（暂无）',
        '',
        '### 改写建议',
        session.rewriteSuggestion || '（暂无）',
      )
    } else {
      lines.push('- 面试状态：未追问')
    }
    lines.push('')
  }

  return lines.join('\n')
}

export function downloadText(filename: string, content: string) {
  const url = URL.createObjectURL(new Blob([content], { type: 'text/markdown;charset=utf-8' }))
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.style.display = 'none'
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export function downloadReport(analysis: ResumeAnalysis) {
  downloadText(`简历声明报告-${analysis.candidate}.md`, buildReport(analysis))
}

export function downloadFullReport(analysis: ResumeAnalysis, sessions: Record<string, InterviewSession>) {
  downloadText(`简历追问报告-${analysis.candidate}.md`, buildFullReport(analysis, sessions))
}
