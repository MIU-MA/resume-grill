// 简历解析提示词（/api/analyze 使用）
// 面试引擎提示词见 interview-prompts.ts
import { buildStructuredResumeInput } from '@/lib/resume-structure'
import type { AnalysisGoal, ReviewedCandidate } from '@/domain/analysis-config'

const GOAL_INSTRUCTIONS: Record<AnalysisGoal, string> = {
  overall: '本次目标是全面检查：在项目、技能、成果、职责之间保持覆盖平衡。',
  project: '本次目标是项目深挖：优先选择项目中的关键决策、复杂问题、个人贡献和技术取舍。',
  skills: '本次目标是技能真实性：优先选择技能声明及其真实使用场景、掌握深度和能力边界。',
  achievement: '本次目标是成果与数据：优先选择量化成果，检查指标口径、基线、归因和可复现性。',
  leadership: '本次目标是管理与协作：优先选择主导、统筹、协作、决策和职责边界相关声明。',
}

export const ANALYZE_SYSTEM_PROMPT = `你是一名资深简历面试官。任务：把一段简历文本拆解成「可验证声明」，用于后续模拟面试追问。

可验证声明 = 简历中能被追问、需要候选人举证的具体表述，分五类：
- skill 技能声明：简历在技能、技术能力或技术栈章节中明确列出的工具、技术或专业能力
- responsibility 责任声明：负责、主导、参与某项工作
- achievement 成果声明：提升转化率、降低成本、缩短周期
- leadership 管理声明：带团队、建体系、定流程、做决策
- metric 数据声明：人数、金额、规模、增长率等带量纲的表述

只提取值得追问的声明，通常 4-6 条，不要编造简历中没有的内容。全面检查时要兼顾章节覆盖，不要让同一项目占满全部结果；选择专项分析目标时则优先服从该目标。调用方会提供本地识别的 claimCandidates：未经过用户确认时它只是优先参考，候选池不完整可从 rawText 恢复；经过用户确认时它是唯一允许使用的候选池，且可能包含用户修正后的文字。

以下内容绝对不能作为声明：
- 姓名、性别、年龄、电话、邮箱、地址、籍贯、照片等个人信息
- 求职意向、期望薪资、目标岗位和“X年工作经验”等个人概况
- 纯公司名、学校名、项目名、职位名、部门名、日期范围或章节标题
- 散落在个人信息、教育或证书区域中的技术名词；明确位于技能/技术能力/技术栈章节的内容可以作为 skill 声明

声明必须包含候选人的具体职责、行动、决策、技能使用场景或可验证成果。默认情况下 content 必须是简历原文中的连续片段；候选池经过用户确认时，content 必须逐字使用其中的候选内容。

每条声明字段：
- content：简历原文片段，尽量逐字
- title：不超过 14 字的短标题
- category：skill | responsibility | achievement | leadership | metric 之一
- role：该声明对应的岗位或职能
- sourceSection：该声明出自简历的哪一段标题
- exaggerationRisk：可信风险 high|medium|low
- interviewRisk：面试风险 high|medium|low
- evidenceGap：证据缺失，2-4 条
- evidence：简历中已提供的具体证据，必须引用明确的数字、范围、对象或场景；不要输出“简历中已提及”“已给出量化数据”等空泛描述，没有具体证据时返回空数组
- initialQuestion：首轮追问。必须是针对该声明内容的具体问题，不要问通用八股
- evaluationPoints：回答应覆盖的要点 3-5 条

整体输出字段：
- candidate：候选人姓名
- role：识别出的岗位
- summary：一句话总结
- claims：声明数组
- jobMatch：仅当提供招聘描述时输出，包含 requirements、gaps、interviewFocus

严格输出单个 JSON 对象：
{ "candidate": string, "role": string, "summary": string, "claims": [ { "content": string, "title": string, "category": "skill|responsibility|achievement|leadership|metric", "role": string, "sourceSection": string, "exaggerationRisk": "high|medium|low", "interviewRisk": "high|medium|low", "evidenceGap": string[], "evidence": string[], "initialQuestion": string, "evaluationPoints": string[] } ], "jobMatch": { "requirements": [{ "requirement": string, "match": "strong|partial|gap", "evidence": string[], "note": string }], "gaps": string[], "interviewFocus": string[] } }`

export function buildAnalyzeUserPrompt(
  rawText: string,
  options: { analysisGoal?: AnalysisGoal; reviewedCandidates?: ReviewedCandidate[]; jobDescription?: string } = {},
): string {
  const analysisGoal = options.analysisGoal ?? 'overall'
  const detected = buildStructuredResumeInput(rawText)
  const structuredHint = options.reviewedCandidates
    ? { ...detected, claimCandidates: options.reviewedCandidates }
    : detected
  const hasSkillClaims = structuredHint.claimCandidates.some((candidate) => /技能|技术|能力|skills?|competenc/i.test(candidate.sourceSection))
  return [
    '请根据以下原始文本与结构化提示识别候选人和岗位，选择最值得压力测试的声明。',
    options.reviewedCandidates
      ? 'structuredHint.claimCandidates 已由用户检查确认，只能从这些候选声明中选择，不要恢复已被用户删除的声明；content 必须逐字使用候选内容，即使它是用户修正后的文字。'
      : 'structuredHint 是本地启发式结果，可能因 PDF 排版丢失而不完整；你需要结合 rawText 判断。',
    GOAL_INSTRUCTIONS[analysisGoal],
    'sourceFile、分析目标和声明 ID 由调用方回填。',
    options.jobDescription?.trim()
      ? '已提供招聘描述：请在输出中补充 jobMatch，逐条判断岗位要求与简历证据的匹配程度；不要把岗位要求当成候选人已经具备的事实。'
      : '',
    hasSkillClaims && (analysisGoal === 'overall' || analysisGoal === 'skills')
      ? '本份简历存在明确的技能/技术能力声明，最终 claims 必须保留至少 1 条 category=skill 的原文声明。'
      : '',
    '',
    JSON.stringify({ rawText, analysisGoal, jobDescription: options.jobDescription?.trim() || undefined, structuredHint }, null, 2),
  ].join('\n')
}
