import { CLAIM_CATEGORY_LABELS, MASTERY_DIMENSION_LABELS, type ResumeAnalysis } from '@/domain/resume-schema'
import { PRIORITY_META } from '@/lib/risk'
import type { InterviewSession } from '@/domain/interview-schema'
import { deriveBlindSpots } from '@/lib/blind-spots'

export function buildReport(analysis: ResumeAnalysis): string {
  const lines = [
    '# 能力测试报告',
    '',
    `候选人：${analysis.candidate} · ${analysis.role}`,
    `来源文件：${analysis.sourceFile}`,
    '',
    analysis.summary,
    '',
  ]
  appendJobMatch(lines, analysis)

  for (const claim of analysis.claims) {
    const prio = PRIORITY_META[claim.testPriority]
    lines.push(
      `## ${claim.title}`,
      '',
      `- 类型：${CLAIM_CATEGORY_LABELS[claim.category]}`,
      `- 核心能力：${claim.capability}`,
      `- 声明内容：${claim.content}`,
      `- 测试优先级：${prio.label}`,
      `- 掌握要点：`,
    )
    claim.masteryPoints.forEach((mp) => {
      lines.push(`  - [${MASTERY_DIMENSION_LABELS[mp.dimension]}] ${mp.point} (${mp.importance})`)
    })
    lines.push('')
  }

  return lines.join('\n')
}

export function buildFullReport(analysis: ResumeAnalysis, sessions: Record<string, InterviewSession[]>, masteredBlindSpotIds: string[] = []): string {
  const lines = [
    '# 简历能力测试与改写报告',
    '',
    `候选人：${analysis.candidate} · ${analysis.role}`,
    `来源文件：${analysis.sourceFile}`,
    '',
    analysis.summary,
    '',
  ]
  appendJobMatch(lines, analysis)
  const masteredSet = new Set(masteredBlindSpotIds)
  const blindSpots = deriveBlindSpots(analysis, sessions)
  if (blindSpots.length > 0) {
    lines.push('## 待补强知识点', '')
    blindSpots.forEach((spot) => {
      lines.push(
        `### ${masteredSet.has(spot.id) ? '已掌握' : '待补强'}：${spot.annotation}`,
        `- 对应声明：${spot.claim.title}`,
        `- 当时问题：${spot.question}`,
        `- 说明：${spot.explanation || '无'}`,
        '',
      )
    })
  }

  for (const claim of analysis.claims) {
    const prio = PRIORITY_META[claim.testPriority]
    const claimSessions = sessions[claim.id] ?? []
    lines.push(
      `## ${claim.title}`,
      '',
      `- 类型：${CLAIM_CATEGORY_LABELS[claim.category]}`,
      `- 核心能力：${claim.capability}`,
      `- 声明内容：${claim.content}`,
      `- 测试优先级：${prio.label}`,
    )
    if (claimSessions.length === 0) {
      lines.push('- 测试状态：未测试')
    } else {
      claimSessions.forEach((session, i) => {
        if (session.status === 'in_progress') {
          lines.push(
            '',
            `### 第 ${i + 1} 版（${session.version}）进行中`,
            `- 已完成交互：${session.rounds.length} 轮`,
            `- 已覆盖要点：${session.rounds.at(-1)?.evaluation.coveredPoints.join('；') || '无'}`,
          )
          return
        }

        if (session.summaryStatus === 'failed') {
          lines.push(
            '',
            `### 第 ${i + 1} 版（${session.version}）测试报告`,
            '- 总结状态：生成失败',
            `- 有效回答轮数：${session.rounds.filter((round) => round.action === 'answer').length}`,
            '- 说明：问答记录已保留，请重新生成总结后再查看掌握度。',
          )
          return
        }

        const s = session.finalResult
        if (!s) {
          lines.push(
            '',
            `### 第 ${i + 1} 版（${session.version}）测试报告`,
            '- 总结状态：正在生成',
            `- 有效回答轮数：${session.rounds.filter((round) => round.action === 'answer').length}`,
          )
          return
        }
        const annotations = session.rounds
          .map((round) => round.annotation?.trim())
          .filter((annotation): annotation is string => Boolean(annotation))
        const skippedQuestions = session.rounds
          .filter((round) => round.action === 'skip')
          .map((round) => round.question)
        const masteryLabel = s.masteryLevel === 'mastered' ? '掌握较好' : s.masteryLevel === 'partial' ? '部分掌握' : '尚未讲清'
        lines.push(
          '',
          `### 第 ${i + 1} 版（${session.version}）测试报告`,
          `- 有效回答轮数：${session.rounds.filter((round) => round.action === 'answer').length}`,
          `- 用户主动跳过（未验证）：${skippedQuestions.join('；') || '无'}`,
          `- 不懂批注：${annotations.join('；') || '无'}`,
          `- 掌握度：${'★'.repeat(s.masteryScore)}${'☆'.repeat(5 - s.masteryScore)}`,
          `- 掌握状态：${masteryLabel}`,
          `- 已讲清：${s.canExplain.join('、') || '无'}`,
          `- 尚未讲清：${s.cannotExplain.join('、') || '无'}`,
          `- 知识缺口：${s.knowledgeGaps.join('；') || '无'}`,
          `- 回答结论：${s.answerSummary || '无'}`,
          `- 下一步行动：${s.nextAction || '无'}`,
          '',
          `- 本次测试声明：${session.claimContent}`,
          '',
          '改写建议：',
          s.rewriteSuggestion || '暂无改写建议',
        )
      })
    }
    lines.push('')
  }

  return lines.join('\n')
}

function appendJobMatch(lines: string[], analysis: ResumeAnalysis) {
  if (!analysis.jobMatch) return
  lines.push('## 岗位匹配', '')
  analysis.jobMatch.requirements.forEach((item) => {
    lines.push(
      `### ${item.match === 'strong' ? '匹配较好' : item.match === 'partial' ? '部分匹配' : '缺少证据'}：${item.requirement}`,
      `- 说明：${item.note}`,
      `- 证据：${item.evidence.join('；') || '无'}`,
      '',
    )
  })
  lines.push(`- 岗位缺口：${analysis.jobMatch.gaps.join('；') || '无'}`, `- 建议优先追问：${analysis.jobMatch.interviewFocus.join('；') || '无'}`, '')
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
  downloadText(`能力测试报告-${analysis.candidate}.md`, buildReport(analysis))
}

export function downloadFullReport(analysis: ResumeAnalysis, sessions: Record<string, InterviewSession[]>, masteredBlindSpotIds: string[] = []) {
  downloadText(`能力测试报告-${analysis.candidate}.md`, buildFullReport(analysis, sessions, masteredBlindSpotIds))
}

export function downloadJsonExport(analysis: ResumeAnalysis, sessions: Record<string, InterviewSession[]>, masteredBlindSpotIds: string[] = []) {
  const payload = {
    exportedAt: new Date().toISOString(),
    version: 1,
    analysis,
    sessions,
    masteredBlindSpotIds,
  }
  const json = JSON.stringify(payload, null, 2)
  const url = URL.createObjectURL(new Blob([json], { type: 'application/json;charset=utf-8' }))
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = `简历数据-${analysis.candidate}.json`
  anchor.style.display = 'none'
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}
