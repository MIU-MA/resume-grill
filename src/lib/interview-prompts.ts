import type { ResumeClaim } from '@/domain/resume-schema'
import type { InterviewAction, InterviewRound } from '@/domain/interview-schema'

export const INTERVIEW_CONTINUE_SYSTEM = `你是一名面试官。先评估，再生成追问。

评估规则：
- score: 0-100。具体数据/案例/决策→60+；概念/工具名→30-；完全回避/未作答→0
- coveredPoints: 必须逐字取自评估要点，未作答时为空
- missingPoints: 仍未覆盖的评估要点，未作答时为全部
- answerSuggestion: 2-4 句更可信的回答示范，缺失处用"[补充具体数据]"占位；若本轮同时有『不懂』，在示范中顺带通俗解释该术语；clarify 时以通俗解释为主
- evidenceQuotes: 从回答原文逐字引用，未作答时返回 []

追问规则：
- 你是连续追问，不是每轮重新出题。必须基于提供的『历史追问』继续，避免重复问类似问题
- 对比前后回答，发现矛盾或回避时深入追问
- 直击缺失漏洞，每轮一问
- 落入陷阱 → 追问原因/过程/数据
- 细节足够 → 转向下一个高重要性未验证点
- 3-5 轮后 isFinal=true

只输出 JSON，不要解释、不要 Markdown。格式严格按照：
{"evaluation":{"score":0,"coveredPoints":[],"missingPoints":[],"answerSuggestion":"","evidenceQuotes":[]},"nextReason":"","isFinal":false,"nextQuestion":""}`

export function buildInterviewContinueUser(
  claim: ResumeClaim,
  question: string,
  answer: string,
  annotation: string,
  action: InterviewAction,
  rounds: InterviewRound[],
  verifyPoints: { point: string; importance: string }[],
  trapPoints: string[],
): string {
  const coveredPoints = rounds.at(-1)?.evaluation.coveredPoints ?? []
  const allPoints = claim.masteryPoints.map((mp) => mp.point)
  const missingPoints = allPoints.filter((p) => !coveredPoints.includes(p))
  return [
    `声明：${claim.content}`,
    `核心能力：${claim.capability}`,
    `岗位：${claim.role}`,
    '',
    '允许返回的评估要点（coveredPoints 必须逐字取自这里）：',
    allPoints.join('\n'),
    '',
    '掌握维度参考（优先追问 context/practice/principle/decision 等高重要性维度）：',
    verifyPoints.map((v) => `[${v.importance}] ${v.point}`).join('\n'),
    '',
    '常见陷阱：',
    trapPoints.join('、'),
    '',
    ...buildConversationHistory(rounds),
    `第 ${rounds.length + 1} 轮`,
    `操作: ${actionLabel(action)}`,
    `问: ${question}`,
    `答: ${answer || '(未作答)'}`,
    `不懂: ${annotation || '(无)'}`,
    '',
    '当前已覆盖：',
    coveredPoints.join('、') || '(无)',
    '当前仍缺失：',
    missingPoints.join('、') || '(无)',
  ].join('\n')
}

function buildConversationHistory(rounds: InterviewRound[]): string[] {
  if (rounds.length === 0) return []
  const lines: string[] = ['', '历史追问：', '']
  rounds.forEach((round, index) => {
    const q = round.question || '(无问题)'
    const a = truncateAnswer(round.answer)
    const ann = round.annotation ? `不懂: ${truncateAnswer(round.annotation)}` : ''
    const covered = (round.evaluation?.coveredPoints ?? []).join('、') || '(无)'
    const missing = (round.evaluation?.missingPoints ?? []).join('、') || '(无)'
    lines.push(`第 ${index + 1} 轮`, `问: ${q}`, a ? `答: ${a}` : '', ann, `已验证: ${covered}`, `仍缺失: ${missing}`, '')
  })
  return lines
}

const MAX_HISTORY_TEXT = 400

/** 截断超长回答，避免历史占用过多 token */
function truncateAnswer(value: string): string {
  if (!value) return ''
  const normalized = value.replace(/\s+/g, ' ').trim()
  return normalized.length > MAX_HISTORY_TEXT
    ? `${normalized.slice(0, MAX_HISTORY_TEXT)}…（截断）`
    : normalized
}

function actionLabel(action: InterviewAction): string {
  if (action === 'skip') return '已掌握，跳过（未验证）'
  if (action === 'clarify') return '请求通俗解释'
  return '回答'
}
