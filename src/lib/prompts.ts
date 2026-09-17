import { goalClaimCount, type AnalysisGoal } from '@/domain/analysis-config'
import { buildStructuredResumeInput } from '@/lib/resume-structure'
import { RESUME_COACH_STYLE } from '@/lib/prompt-style'

const GOAL_INSTRUCTIONS: Record<AnalysisGoal, string> = {
  overall: '都练一遍：项目、技能、成果和工作职责都选一些。',
  project: '项目深挖：围绕项目练习怎么做、为什么这么选、自己负责了哪部分。',
  skills: '技术技能：练习讲清在哪用过、做了什么、遇到过什么问题。',
  achievement: '成果与数据：练习讲清数字怎么算、前后怎么比较、自己做了哪些改动。',
  leadership: '管理与协作：练习讲清怎么分工、哪些事由自己决定、分歧怎么处理。',
}

export const ANALYZE_SYSTEM_PROMPT = `你在帮求职者准备面试。从用户选中的简历内容里挑出值得练习的经历或技能，为每条准备一个开场问题，以及回答时需要讲清的细节。具体条数由用户指令中的目标数量决定。

${RESUME_COACH_STYLE}

问题紧扣这条原文，一次只问一个问题。不要列通用题库，不假设用户用过原文未提及的工具。准备要点要具体，例如“这次重构改了哪些状态”，不要写“具备扎实的工程化能力”。trapPoints 只列回答时容易漏讲的细节，不预判用户不懂或经历不实。

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
- capability: 这次练习的主题，≤30 个汉字，例如“状态管理重构”，不要堆叠“能力”词组
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
    `本次分析目标需要输出 ${goalClaimCount(analysisGoal)} 条声明（claims.length 必须等于该数量）。`,
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
