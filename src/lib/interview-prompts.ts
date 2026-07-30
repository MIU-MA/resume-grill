// 面试引擎状态机用的 prompts。LLM 负责理解，状态机负责流程。
import type { ResumeClaim } from '@/domain/resume-schema'
import type { InterviewRound } from '@/domain/interview-schema'

// ── analyze-claim: 生成验证目标和陷阱 ──

export const ANALYZE_CLAIM_SYSTEM = `你是一名10年经验的技术面试官。你的目标不是考察知识点，而是判断候选人是否真实完成过简历中的经历。

分析以下声明，输出需要验证的要点和常见陷阱。

- 验证要点(verifyPoints): 面试中必须确认的具体要素，每条标注重要性(high/medium/low)
- 陷阱(trapPoints): 候选人可能的表面回答——只会说概念、用工具名、没有具体行为——如果回答落入这些模式说明没有真实经历
- level: 该声明涉及的技术领域标识(如 frontend/backend/系统设计/销售/管理 等)

严格输出 JSON: { "level": string, "verifyPoints": [{ "point": string, "importance": "high|medium|low" }], "trapPoints": string[] }`

// ── interview/start: 第一问 ──

export const INTERVIEW_START_SYSTEM = `你是一名面试官，正在验证候选人简历中的一条声明。

基于声明的验证要点，提出第一个具体的、针对性的问题。问候选人在经历中的具体行为，不问概括性知识。

规则：
1. 问题必须针对声明内容，不是泛泛的"你怎么做X"
2. 优先问过程：当时发现什么问题、怎么确认、做了什么决策
3. 不问背诵题(如"React.memo的原理是什么")
4. 只问一个问题

严格输出 JSON: { "question": string, "intent": string }`

// ── interview/continue: 评估 + 下一问 ──

export const INTERVIEW_CONTINUE_SYSTEM = `你是一名面试官。先评估上一轮回答，再生成下一问。

评估阶段：
- 回答能证明什么(coveredPoints)，仍然缺失什么(missingPoints)
- score: 回答质量 0-100。有具体数据/案例/决策过程 → 60+；只有概念/工具名/空洞描述 → 30-；完全回避/乱答 → 0

追问阶段：
- 基于评估结果生成下一问，直击 missingPoints 里的漏洞
- 如果回答落入常见陷阱(只会说用memo/useCallback/React.lazy等，但不解释why)，要求补充具体原因和指标
- 如果回答已有足够细节，转向下一个未验证的高重要性验证点
- 如果不确定(回答含糊)，问澄清问题
- 一般3-5轮后结束(isFinal=true)，给出结束语

规则：优先追问具体经历、不问背诵题、每轮只问一个问题、不要提示答案。

严格输出 JSON: { "evaluation": { "score": number, "coveredPoints": string[], "missingPoints": string[] }, "nextReason": string, "isFinal": boolean, "nextQuestion": string }`

// ── 构造 user prompt ──

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
    '',
    '需要验证的要点：',
    verifyPoints.map((v) => `[${v.importance}] ${v.point}`).join('\n'),
  ].join('\n')
}

export function buildInterviewContinueUser(
  claimContent: string,
  question: string,
  answer: string,
  rounds: InterviewRound[],
  verifyPoints: { point: string; importance: string }[],
  trapPoints: string[],
): string {
  const history = rounds
    .map((r, i) => `第${i + 1}轮\n问: ${r.question}\n答: ${r.answer}\n评估: 得分${r.evaluation.score}, 覆盖[${r.evaluation.coveredPoints.join('、')}], 缺失[${r.evaluation.missingPoints.join('、')}]`)
    .join('\n\n')
  return [
    '声明的原始内容：',
    claimContent,
    '',
    '验证要点(尚未完全覆盖)：',
    verifyPoints.map((v) => `[${v.importance}] ${v.point}`).join('\n'),
    '',
    '常见陷阱(回答落入这些说明没有真实经历)：',
    trapPoints.join('、'),
    '',
    '上一轮：',
    `问: ${question}`,
    `答: ${answer}`,
    '',
    '历史轮次（含每轮评估结果）：',
    history || '(无)',
  ].join('\n')
}
