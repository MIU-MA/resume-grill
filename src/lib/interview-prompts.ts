import type { ResumeClaim } from '@/domain/resume-schema'
import type { InterviewAction, InterviewRound } from '@/domain/interview-schema'

export const ANALYZE_CLAIM_SYSTEM = `你是一名资深结构化面试官。请根据候选人的目标岗位切换到对应的业务语境。你的目标不是考察背诵知识，而是判断候选人是否真实完成过简历中的经历。

分析以下声明，输出需要验证的要点和常见陷阱。

- 验证要点(verifyPoints): 面试中必须确认的具体要素，每条标注重要性(high/medium/low)
- 陷阱(trapPoints): 候选人可能的表面回答——只会说概念、用工具名、没有具体行为——如果回答落入这些模式说明没有真实经历
- level: 该声明涉及的岗位领域标识(如 frontend/backend/产品/销售/运营/管理 等)

严格输出 JSON: { "level": string, "verifyPoints": [{ "point": string, "importance": "high|medium|low" }], "trapPoints": string[] }`

export const INTERVIEW_START_SYSTEM = `你是一名面试官，正在验证候选人简历中的一条声明。

基于声明的验证要点，提出第一个具体的、针对性的问题。问候选人在经历中的具体行为，不问概括性知识。

规则：
1. 问题必须针对声明内容，不是泛泛的"你怎么做X"
2. 优先问过程：当时发现什么问题、怎么确认、做了什么决策
3. 不问脱离经历的知识背诵题
4. 只问一个问题

严格输出 JSON: { "question": string, "intent": string }`

export function buildAnalyzeClaimUser(claim: ResumeClaim): string {
  return JSON.stringify({
    content: claim.content,
    category: claim.category,
    role: claim.role,
    sourceSection: claim.sourceSection,
  }, null, 2)
}

export function buildInterviewStartUser(claim: ResumeClaim, verifyPoints: { point: string; importance: string }[]): string {
  return [
    '声明的原始内容：',
    claim.content,
    `岗位 / 职能：${claim.role}`,
    '',
    '需要验证的要点：',
    verifyPoints.map((v) => `[${v.importance}] ${v.point}`).join('\n'),
  ].join('\n')
}

function actionLabel(action: InterviewAction): string {
  if (action === 'skip') return '已掌握，跳过（未验证）'
  if (action === 'clarify') return '请求通俗解释'
  return '回答'
}

export const EVALUATE_ANSWER_SYSTEM = `你是一名严格的面试评估官。你的唯一职责是根据候选人的回答，客观评估其证据质量。你不是面试官——不会提问，只负责评估。

评估标准（逐条对照）：
- 0-20：完全离题、回避问题、或只说"不知道"
- 20-40：仅提及概念、工具名或流程名，没有任何具体行为描述
- 40-60：描述了大致过程或思路，但缺少具体数据、决策理由或可验证的结果
- 60-80：有具体过程和数据，能说明做了什么决策、为什么这样做
- 80-100：数据+决策+可验证结果链条完整，能清楚说明个人贡献边界

评分要求：
1. evidenceQuotes 必须逐字引用回答中的原文片段，每条对应一个论据
2. coveredPoints 只能从"允许返回的评估要点"中逐字选取，不能改写或新增
3. 如果回答中没有任何原文能支撑某个 coveredPoint，不得将其列入
4. missingPoints 包含所有未覆盖的评估要点
5. 操作类型为 skip 时：score 为 0，coveredPoints 为空，不评价能力
6. 操作类型为 clarify 时：批注不是回答证据，不得增加 coveredPoints
7. answerSuggestion：给出 2-4 句更可信的回答示范，仅使用声明和评估要点中已有的信息，缺失处用"[补充具体数据]"占位；clarify 时用 1-2 句通俗解释

严格输出 JSON: { "score": number, "coveredPoints": string[], "missingPoints": string[], "answerSuggestion": string, "evidenceQuotes": string[] }`

export const GENERATE_FOLLOWUP_SYSTEM = `你是一名面试官。你收到了评估官对上一轮回答的详细评估，现在你的唯一职责是基于评估结果生成下一个追问。

追问规则：
- 直击 missingPoints 里的漏洞，问具体行为而非概念
- 如果评估显示落入陷阱（只有术语/工具名），要求补充原因、过程和数据
- 如果回答已有足够细节，转向下一个高重要性的未验证点
- 如果回答含糊，问澄清问题
- 一般 3-5 轮后结束 (isFinal=true)
- 每轮只问一个问题，不要提示答案
- 如果所有要点已覆盖或回答质量很高，可以提前结束

严格输出 JSON: { "nextReason": string, "isFinal": boolean, "nextQuestion": string }`

export function buildEvaluateAnswerUser(
  claim: ResumeClaim,
  question: string,
  answer: string,
  annotation: string,
  action: InterviewAction,
  rounds: InterviewRound[],
  verifyPoints: { point: string; importance: string }[],
  trapPoints: string[],
): string {
  const history = rounds
    .map((r, i) => `第${i + 1}次交互（${actionLabel(r.action)}）\n问: ${r.question}\n答: ${r.answer || '(未作答)'}\n评估: 得分${r.evaluation.score}, 覆盖[${r.evaluation.coveredPoints.join('、')}], 缺失[${r.evaluation.missingPoints.join('、')}]`)
    .join('\n\n')
  return [
    '声明的原始内容：',
    claim.content,
    `岗位 / 职能：${claim.role}`,
    '',
    '允许返回的评估要点（coveredPoints 必须逐字取自这里）：',
    claim.evaluationPoints.join('\n'),
    '',
    '验证要点：',
    verifyPoints.map((v) => `[${v.importance}] ${v.point}`).join('\n'),
    '',
    '常见陷阱（回答落入这些说明没有真实经历）：',
    trapPoints.join('、'),
    '',
    '本轮信息：',
    `操作类型: ${actionLabel(action)}`,
    `面试官问: ${question}`,
    `候选人答: ${answer || '(未作答)'}`,
    `不懂批注: ${annotation || '(无)'}`,
    '',
    '历史轮次（供参考）：',
    history || '(无)',
  ].join('\n')
}

export function buildGenerateFollowupUser(
  claim: ResumeClaim,
  evaluation: { score: number; coveredPoints: string[]; missingPoints: string[]; evidenceQuotes: string[] },
  verifyPoints: { point: string; importance: string }[],
): string {
  return [
    '声明的原始内容：',
    claim.content,
    `岗位 / 职能：${claim.role}`,
    '',
    '评估官对上一轮回答的判断：',
    `得分: ${evaluation.score}/100`,
    `已覆盖: ${evaluation.coveredPoints.join('、') || '(无)'}`,
    `仍缺失: ${evaluation.missingPoints.join('、') || '(无)'}`,
    `论据原文: ${evaluation.evidenceQuotes.join('；') || '(无)'}`,
    '',
    '验证要点（按重要性排序）：',
    verifyPoints.map((v) => `[${v.importance}] ${v.point}`).join('\n'),
    '',
    '请基于以上评估生成下一个追问。如果缺失点已很少且回答质量高，可以结束 (isFinal=true)。',
  ].join('\n')
}
