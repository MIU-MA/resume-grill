import type { AnalysisGoal } from '@/domain/analysis-config'
import { buildStructuredResumeInput } from '@/lib/resume-structure'

const GOAL_INSTRUCTIONS: Record<AnalysisGoal, string> = {
  overall: '全面检查：在项目、技能、成果、职责之间保持覆盖平衡。',
  project: '项目深挖：优先选择项目中的关键决策、复杂问题、个人贡献和技术取舍。',
  skills: '技能深度：优先选择技能声明及其真实使用场景、掌握深度和能力边界。',
  achievement: '成果与数据：优先选择量化成果，检查指标口径、基线、归因和可复现性。',
  leadership: '管理与协作：优先选择主导、统筹、协作、决策和职责边界相关声明。',
}

export const ANALYZE_SYSTEM_PROMPT = `你是一名资深面试官。从候选池中选出最值得追问的 3~4 条能力声明。

你的任务是：这条声明代表候选人需要掌握什么能力？掌握这项能力需要能讲清楚什么？

输出格式（必须严格遵循，超长将导致校验失败）：
{
  "candidate": "姓名",
  "role": "岗位",
  "summary": "一句话，≤40 字",
  "claims": [ ... ]
}

每条 claim 的字段及硬性长度限制：
- candidateIndex: 输入候选池中的整数索引
- category: skill|responsibility|achievement|leadership|metric
- capability: 核心能力，≤20 个汉字
- masteryPoints: 2~4 条。每条 { "point": "≤30 个汉字", "dimension": "context|practice|principle|decision|troubleshooting|boundary", "importance": "high|medium|low" }
  dimension: context=为什么做, practice=具体怎么做, principle=为什么有效, decision=为什么选这个, troubleshooting=遇到过什么问题, boundary=有什么限制
- initialQuestion: 首轮追问，≤60 个汉字，直接问具体行为不要铺垫
- trapPoints: 最多 2 条可能的表面回答模式，每条 ≤20 个汉字（如"只列工具名""无法说明原因"）

不编造、不输出解释、不输出额外字段、不输出 Markdown。
只返回一个 JSON 对象。`

export function buildAnalyzeUserPrompt(rawText: string, candidates: Array<{ content: string; sourceSection: string }>, analysisGoal: AnalysisGoal): string {
  const detected = buildStructuredResumeInput(rawText)
  const hasSkill = detected.claimCandidates.some((c) =>
    /技能|技术|能力|skills?|competenc/i.test(c.sourceSection),
  )

  return [
    '只从以下候选池中选择声明（通过 candidateIndex 引用），不要输出简历原文。',
    GOAL_INSTRUCTIONS[analysisGoal],
    hasSkill && (analysisGoal === 'overall' || analysisGoal === 'skills')
      ? '候选池中存在技能声明，claims 必须保留至少 1 条 category=skill。'
      : '',
    '',
    JSON.stringify({
      analysisGoal,
      identity: detected.identity,
      candidates: candidates.map((c, i) => ({
        index: i,
        content: c.content,
        sourceSection: c.sourceSection,
      })),
    }),
  ].join('\n')
}
