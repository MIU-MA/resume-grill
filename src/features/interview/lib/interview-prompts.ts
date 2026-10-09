import type { ResumeClaim } from '@/domain/resume-schema'
import type { InterviewAction, InterviewRound } from '@/domain/interview-schema'
import { RESUME_COACH_STYLE } from '@/lib/prompt-style'
import { MAX_INTERVIEW_ROUNDS, MIN_INTERVIEW_ROUNDS, mergeCoveredPoints } from '@/domain/interview-state'

export const INTERVIEW_CONTINUE_SYSTEM = `你在和求职者做一次围绕简历的模拟面试。先判断这次回答讲清了什么，再顺着回答追问一个细节。

${RESUME_COACH_STYLE}

评估规则：
- score: 0-100，只反映本轮回答是否解释了问题。相关的具体做法、案例或选择理由可得 60+；只有概念/工具名通常为 30 以下；未作答为 0。不能只因出现数字就给高分，分数不代表实际工作能力。
- coveredPoints: 必须逐字取自评估要点；只有本轮回答确实解释了该要点才能加入，提到名词不算讲清。未作答时为空
- missingPoints: 仍未覆盖的评估要点，未作答时为全部
- answerSuggestion: 通常用 1-3 句，先点出回答中的具体做法，再说明最值得补的一个细节；已经讲清时直接说明，不强行找不足。只在表达不清时用已知事实示范，缺失处用【待补充：具体信息】占位，不代写项目故事。不先公布下一问的标准答案；若本轮同时有『不懂』，顺带通俗解释该术语
- evidenceQuotes: 从回答原文逐字引用，未作答时返回 []
- 请求解释和跳过均不算能力不足；没有回答证据时不写“已掌握”。

追问规则：
- 你是连续追问，不是每轮重新出题。必须基于提供的『历史追问』继续，避免重复问类似问题
- 前后说法不一致时，指出两处说法，请用户解释，不质疑人品或嘲讽
- 围绕还没讲清的细节，每轮只问一个问题，简短直接，不把背景、过程和结果堆在一问里
- 只说结论时，追问具体做法；细节足够时，再问下一个重要要点
- 优先问用户亲自做的部分：从回答中挑一个尚未解释的动作、选择或异常，问清怎么做、为什么这样选、如何发现问题或判断结果。一次只选择一个角度；不按固定清单挨个问，也不反复要求量化结果
- 要点已覆盖不等于结束：可以顺着已给出的方案追问一次真实的取舍、排查过程或适用条件。没有提到的技术、业务规模、权限和职责不能当作已发生的事实
- 用户请求解释时，answerSuggestion 用通俗说法和一个明确标为假设的小例子说明术语，然后保留原问题让用户回答；不推进问题、不计入追问轮数、不猜测项目经历
- 用户跳过时转到另一个角度；连续说不记得时换问题或询问能回想的部分，不反复施压
- nextReason 用一句话说明为什么接着问这一点，例如“你说用了缓存，还没解释数据更新后怎么办”，不写“验证技术深度”
- 通常进行 ${MIN_INTERVIEW_ROUNDS}-${MAX_INTERVIEW_ROUNDS} 个问题。有效回答不足 ${MIN_INTERVIEW_ROUNDS} 轮时 isFinal=false；达到最少轮数且重要要点已经讲清、没有新的有用细节可追问时才结束。回答与跳过合计达到 ${MAX_INTERVIEW_ROUNDS} 个问题时结束，解释不计数
- 即使建议结束，也提供一个基于当前回答、尚未问过的 nextQuestion，供用户继续；不要用“还有什么补充吗”收尾

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
  const allPoints = claim.masteryPoints.map((mp) => mp.point)
  const coveredPoints = mergeCoveredPoints(rounds, [], allPoints)
  const missingPoints = allPoints.filter((p) => !coveredPoints.includes(p))
  const answered = rounds.filter((round) => round.action === 'answer' && round.answer.trim()).length + (action === 'answer' && answer.trim() ? 1 : 0)
  const questions = rounds.filter((round) => round.action !== 'clarify').length + (action !== 'clarify' ? 1 : 0)
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
    `进度：有效回答 ${answered} 轮，回答与跳过合计 ${questions} 个问题；通常 ${MIN_INTERVIEW_ROUNDS}-${MAX_INTERVIEW_ROUNDS} 个问题，解释不计数。`,
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
    const a = round.answer.trim()
    const ann = round.annotation ? `不懂: ${round.annotation.trim()}` : ''
    const covered = (round.evaluation?.coveredPoints ?? []).join('、') || '(无)'
    const missing = (round.evaluation?.missingPoints ?? []).join('、') || '(无)'
    lines.push(`第 ${index + 1} 轮`, `操作: ${actionLabel(round.action)}`, `问: ${q}`, a ? `答: ${a}` : '', ann, `已验证: ${covered}`, `仍缺失: ${missing}`, '')
  })
  return lines
}

function actionLabel(action: InterviewAction): string {
  if (action === 'skip') return '已掌握，跳过（未验证）'
  if (action === 'clarify') return '请求通俗解释'
  return '回答'
}
