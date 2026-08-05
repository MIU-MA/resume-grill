import type { ResumeClaim } from '@/domain/resume-schema'
import type { InterviewAction, InterviewRound } from '@/domain/interview-schema'

export const INTERVIEW_CONTINUE_SYSTEM = `你是一名面试官。先评估上一轮回答，再生成下一个追问。

评估规则：
- coveredPoints 必须逐字取自用户提供的评估要点，不能改写或新增
- score: 0-100。有具体数据/案例/决策过程→60+；只有概念/工具名→30-；完全回避→0
- evidenceQuotes: 从回答原文逐字引用，回答为空时返回空数组
- answerSuggestion: 2-4 句更可信的回答示范，缺失处用"[补充具体数据]"占位；clarify 时用 1-2 句通俗解释
- skip 时 score=0、coveredPoints=[]、不评价
- clarify 时不增加 coveredPoints
- evidenceQuotes 必须来自回答原文，不要编造

追问规则：
- 直击 missingPoints 的漏洞，问具体行为
- 落入陷阱（只列术语/工具名）→ 要求补充原因、过程、数据
- 细节足够 → 转向下一个高重要性未验证点
- 3-5 轮后结束(isFinal=true)
- 每轮只问一个问题

只输出 JSON 对象，不输出任何解释、推理、Markdown 或额外文字。输出格式：
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

function actionLabel(action: InterviewAction): string {
  if (action === 'skip') return '已掌握，跳过（未验证）'
  if (action === 'clarify') return '请求通俗解释'
  return '回答'
}
