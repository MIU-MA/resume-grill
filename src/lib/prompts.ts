import type { AnalysisGoal, ReviewedCandidate } from '@/domain/analysis-config'
import { buildStructuredResumeInput, parseResumeStructure } from '@/lib/resume-structure'

const GOAL_INSTRUCTIONS: Record<AnalysisGoal, string> = {
  overall: '全面检查：在项目、技能、成果、职责之间保持覆盖平衡。',
  project: '项目深挖：优先选择项目中的关键决策、复杂问题、个人贡献和技术取舍。',
  skills: '技能真实性：优先选择技能声明及其真实使用场景、掌握深度和能力边界。',
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
- masteryPoints: 3~4 条。每条 { "point": "≤40 个汉字", "dimension": "context|practice|principle|decision|troubleshooting|boundary", "importance": "high|medium|low" }
  dimension: context=为什么做, practice=具体怎么做, principle=为什么有效, decision=为什么选这个, troubleshooting=遇到过什么问题, boundary=有什么限制
- initialQuestion: 首轮追问，≤60 个汉字，直接问具体行为不要铺垫

不编造、不输出解释、不输出额外字段、不输出 Markdown。
只返回一个 JSON 对象。`

export function buildAnalyzeUserPrompt(
  rawText: string,
  options: { analysisGoal?: AnalysisGoal; reviewedCandidates?: ReviewedCandidate[] } = {},
): string {
  const analysisGoal = options.analysisGoal ?? 'overall'

  if (options.reviewedCandidates) {
    const identity = detectIdentity(rawText)
    return [
      '以下候选池已由用户确认，只能从中选择，用 candidateIndex 引用。',
      GOAL_INSTRUCTIONS[analysisGoal],
      '',
      JSON.stringify({
        analysisGoal,
        identity,
        candidates: options.reviewedCandidates.map((c, i) => ({
          index: i,
          content: c.content,
          sourceSection: c.sourceSection,
        })),
      }),
    ].join('\n')
  }

  const detected = buildStructuredResumeInput(rawText)
  const hasSkill = detected.claimCandidates.some((c) =>
    /技能|技术|能力|skills?|competenc/i.test(c.sourceSection),
  )

  return [
    '请根据原始文本与结构化提示识别候选人，选择最值得追问的能力声明。',
    'structuredHint 是本地启发式结果，可能因 PDF 排版不完整；需结合 rawText 判断。',
    GOAL_INSTRUCTIONS[analysisGoal],
    hasSkill && (analysisGoal === 'overall' || analysisGoal === 'skills')
      ? '本简历存在技能/技术声明，claims 必须保留至少 1 条 category=skill。'
      : '',
    '',
    JSON.stringify({
      rawText,
      analysisGoal,
      structuredHint: detected,
    }),
  ].join('\n')
}

function detectIdentity(rawText: string): string[] {
  const CONTACT = /@|(?:电话|手机|邮箱|微信|地址|现居|籍贯|性别|年龄|出生|政治面貌|婚姻|期望薪资)\s*[：:]|https?:\/\//i
  return parseResumeStructure(rawText)
    .filter((s) => s.kind === 'general')
    .flatMap((s) => s.lines.map((l) => l.text))
    .filter((line) => !CONTACT.test(line))
    .slice(0, 6)
}
