import { CLAIM_CATEGORY_LABELS, MASTERY_DIMENSION_LABELS, type ResumeAnalysis } from '@/domain/resume-schema'
import { PRIORITY_META } from '@/lib/risk'
import type { InterviewSession } from '@/domain/interview-schema'
import { deriveBlindSpots } from '@/lib/blind-spots'

export function buildReport(analysis: ResumeAnalysis): string {
  const lines = [
    '# 简历要点',
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
      `- 主要考察：${claim.capability}`,
      `- 简历原文：${claim.content}`,
      `- 练习顺序：${prio.label}`,
      `- 面试官会听什么：`,
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
    '# 模拟面试复盘',
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
    lines.push('## 需要复习的内容', '')
    blindSpots.forEach((spot) => {
      lines.push(
        `### ${masteredSet.has(spot.id) ? '已学会' : '待复习'}：${spot.annotation}`,
        `- 对应要点：${spot.claim.title}`,
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
      `- 主要考察：${claim.capability}`,
      `- 简历原文：${claim.content}`,
      `- 练习顺序：${prio.label}`,
    )
    if (claimSessions.length === 0) {
      lines.push('- 练习状态：未练习')
    } else {
      claimSessions.forEach((session, i) => {
        if (session.status === 'in_progress') {
          const lastRound = session.rounds.at(-1)
          const coveredPoints = lastRound?.evaluation?.coveredPoints ?? []
          lines.push(
            '',
            `### 第 ${i + 1} 版（${session.version}）进行中`,
            `- 已完成交互：${session.rounds.length} 轮`,
            `- 已聊到：${coveredPoints.join('；') || '无'}`,
          )
          return
        }

        if (session.summaryStatus === 'failed') {
          lines.push(
            '',
            `### 第 ${i + 1} 次练习（v${session.version}）`,
            '- 总结状态：生成失败',
            `- 有效回答轮数：${session.rounds.filter((round) => round.action === 'answer').length}`,
            '- 说明：问答记录已保留，请重新整理后再查看得分。',
          )
          return
        }

        const s = session.finalResult
        if (!s) {
          lines.push(
            '',
            `### 第 ${i + 1} 次练习（v${session.version}）`,
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
        const masteryLabel = s.masteryLevel === 'mastered' ? '回答扎实' : s.masteryLevel === 'partial' ? '基本答到了' : '还没说清楚'
        lines.push(
          '',
          `### 第 ${i + 1} 次练习（v${session.version}）`,
          `- 有效回答轮数：${session.rounds.filter((round) => round.action === 'answer').length}`,
          `- 跳过的问题：${skippedQuestions.join('；') || '无'}`,
          `- 没听懂：${annotations.join('；') || '无'}`,
          `- 得分：${'★'.repeat(s.masteryScore)}${'☆'.repeat(5 - s.masteryScore)}`,
          `- 本轮表现：${masteryLabel}`,
          `- 答得好的地方：${s.canExplain.join('、') || '无'}`,
          `- 还没说清楚：${s.cannotExplain.join('、') || '无'}`,
          `- 需要复习：${s.knowledgeGaps.join('；') || '无'}`,
          `- 总体表现：${s.answerSummary || '无'}`,
          `- 接下来怎么练：${s.nextAction || '无'}`,
          '',
          `- 本次练习内容：${session.claimContent}`,
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
      `### ${item.match === 'strong' ? '比较匹配' : item.match === 'partial' ? '部分匹配' : '简历没写'}：${item.requirement}`,
      `- 说明：${item.note}`,
      `- 简历内容：${item.evidence.join('；') || '无'}`,
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
  downloadText(`简历要点-${analysis.candidate}.md`, buildReport(analysis))
}

export function downloadFullReport(analysis: ResumeAnalysis, sessions: Record<string, InterviewSession[]>, masteredBlindSpotIds: string[] = []) {
  downloadText(`面试复盘-${analysis.candidate}.md`, buildFullReport(analysis, sessions, masteredBlindSpotIds))
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
