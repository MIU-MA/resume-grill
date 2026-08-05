import type { ResumeClaim } from '@/domain/resume-schema'
import type { InterviewAction, InterviewRound } from '@/domain/interview-schema'

export const INTERVIEW_CONTINUE_SYSTEM = `你是一名面试官。请先评估候选人对上一问的回答，再基于评估结果生成下一个追问。

评估阶段：
- 回答能证明什么(coveredPoints)，仍然缺失什么(missingPoints)
- coveredPoints 只能逐字引用用户提供的"允许返回的评估要点"，不能改写或新增
- score: 0-100。有具体数据/案例/决策过程 → 60+；只有概念/工具名/空洞描述 → 30-；完全回避/乱答 → 0
- evidenceQuotes: 逐字引用回答中的原文片段，每条对应一个论据。如果回答为空则返回空数组
- answerSuggestion: 2-4 句更可信的回答示范。只能使用声明和评估要点中已有的信息；缺失处用"[补充具体数据]"占位；clarify 时用 1-2 句通俗解释
- 操作类型为 skip 时：score 为 0，coveredPoints 为空，不评价能力
- 操作类型为 clarify 时：批注不是回答证据，不得增加 coveredPoints；answerSuggestion 用通俗语言解释术语
- evidenceQuotes 必须来自候选人的回答原文，不要编造

追问阶段：
- 直击 missingPoints 里的漏洞，问具体行为而非概念
- 如果回答落入常见陷阱（只列术语/工具名），要求补充原因、过程和数据
- 如果回答已有足够细节，转向下一个未验证的高重要性验证点
- 一般 3-5 轮后结束(isFinal=true)
- 每轮只问一个问题，不要提示答案

严格输出 JSON:
{ "evaluation": { "score": number, "coveredPoints": string[], "missingPoints": string[], "answerSuggestion": string, "evidenceQuotes": string[] }, "nextReason": string, "isFinal": boolean, "nextQuestion": string }`

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
