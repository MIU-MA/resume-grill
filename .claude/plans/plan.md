# v0.2 实施方案：安全 + 质量 + 完整闭环

确认范围：① 安全 P0 加固 ② 指标重构 + 规则示例重排 + 去技术岗文案 ③ 文本确认页 + IndexedDB 持久化 + 会话报告与改写建议。
**暂缓**：移动端证据抽屉、整体字号打磨（记为延后项）。

---

## 阶段 1：安全 P0

### 1.1 SSRF 防护（白名单 + 阻断私网）
- 新建 `src/lib/url-guard.ts`（服务端专用），导出 `assertAllowedBaseUrl(rawUrl: string): Promise<void>`：
  - protocol 必须为 http/https。
  - 若设了 env `ALLOWED_LLM_BASE_URLS`（逗号分隔 origin），origin 必须命中白名单，否则拒绝。
  - 硬阻断 hostname 为保留段 IP 字面量：127/8、10/8、172.16/12、192.168/16、169.254/16（含元数据 169.254.169.254）、::1、fc00::/7、0.0.0.0。
  - 阻断已知元数据 hostname（`metadata.google.internal` 等）。
  - `node:dns/promises` lookup 解析 hostname，任一解析 IP 落保留段则拒绝（防 DNS 重绑定）。
- `src/providers/openai-compatible.ts`：`llmStructured` 在 fetch 前 `await assertAllowedBaseUrl(resolved.baseUrl)`，违例抛明确中文错误。
- 设置面板 `ms-hint` 与 README 补一句：自建局域网/本机模型需把 origin 加入 `ALLOWED_LLM_BASE_URLS`。

### 1.2 资源限制 + 超时 + 限流
- 新建 `src/lib/server-limits.ts`：常量 `MAX_RAWTEXT=20000`、`MAX_TURNS=12`、`MAX_ANSWER=4000`、`ANALYZE_TIMEOUT=60_000`、`INTERVIEW_TIMEOUT=30_000`；`rateLimit(ip)` 滑动窗口（10 次/分钟/IP，进程内 Map）；`withTimeout(fetchInit, ms)` 返回 AbortSignal。
- `app/api/analyze/route.ts`：rawText 长度上限；入口限流；LLM 调用加超时与 `max_tokens`。
- `app/api/interview/route.ts`：turns 数量/单答案长度上限；入口限流；超时。
- 限流返回 429，超限/超长返回 400/413 并给中文提示。

### 1.3 覆盖要点交集校验（防伪造）
- `app/api/interview/route.ts`（LLM 分支）与 `mockNextQuestion` 返回前清洗：
  - `covered = data.coveredPoints.filter(p => claim.evaluationPoints.includes(p))`
  - `missing = claim.evaluationPoints.filter(p => !covered.includes(p))`
  - 丢弃 evaluationPoints 之外的伪造项，覆盖率自然 ≤100%。
- 新增覆盖清洗断言（并入 mock 测试或新建）。

---

## 阶段 2：指标重构 + 规则重排 + 文案

### 2.1 指标重构（verifiability → askLikelihood + evidenceStrength）
- `src/domain/resume-schema.ts`：`resumeClaimSchema` 移除 `verifiability`，新增 `askLikelihood`(0-100)、`evidenceStrength`(0-100，越高越稳)；保留 `title`/`role`/`quote`/`category`/`evidence`/`evidenceGaps`/`evaluationPoints`/`initialQuestion`。
- `src/lib/risk.ts`：删 `verifiabilityToRisk`，新增 `claimRisk(askLikelihood, evidenceStrength)` —— 综合 = `askLikelihood * (1 - evidenceStrength/100)` 分 high/medium/low；`computeStats` 改为 avgAskLikelihood、avgEvidenceStrength、weakClaimCount、totalGaps。
- `src/lib/prompts.ts`：ANALYZE prompt 输出两指标（附定义）；INTERVIEW prompt 强调 coveredPoints 必须取自 evaluationPoints。
- 受影响组件：`ClaimSidebar`、`AuditView`（summary-strip 指标、risk-badge）、`InsightPanel`（confidence-block 拆为「被追问概率」+「证据完整度」双 meter）。
- `report.ts`：输出新指标，去 verifiability。
- 更新 `report.test.ts`、`mock.test.ts` 字段。

### 2.2 规则示例重排（过滤姓名/职位/公司/日期标题）
- `src/providers/mock.ts`：`splitSentences` 后增 `filterNoise`（剔纯日期段、纯公司+职位行、小标题如「工作经历：」「技能：」、过短/纯姓名行）；声明选择由「取前 6」改为按质量分排序（含数字 +、achievement/scale 关键词 +、长度适中 +）取前 6；`verifiabilityFor` → `metricsFor` 产出 {askLikelihood, evidenceStrength}。
- `mockNextQuestion`：清洗 covered/missing 保证子集。
- 补断言：`XX科技 销售经理 2021` 不再被当作声明。

### 2.3 去技术岗文案
- `InterviewView.tsx:53`：`技术面试官 · 动态追问` → `面试官 · 动态追问`。
- `InsightPanel.tsx:61`：`关联 GitHub 证据` 外链 → 通用信息块「补充证明材料：数据口径/复盘记录/同事或客户证言等」，去 `GitBranch` 与外链。
- `InsightPanel.tsx` interview-tip：`为什么选择 → 如何实现 → 遇到什么异常 → 怎样验证` → `背景与目标 → 你的角色与关键决策 → 主要挑战 → 结果与验证`。
- `ResumeUploader.tsx` sub：`每一句技术 / 成果 / 职责声明` → `每一句成果 / 职责 / 技能声明`。

---

## 阶段 3：文本确认页 + 持久化 + 会话报告与改写

### 3.1 解析文本确认页（ExtractedTextReview）
- `src/lib/pdf.ts`：`extractTextFromFile` 返回 `{ text, pageCount, charCount }`（txt/md pageCount=1）。
- 新建 `src/components/ExtractedTextReview.tsx`：展示可编辑文本 + 页数 + 字符数 + 来源文件名，按钮「确认并分析 / 重新上传」。
- `App.tsx`：上传后先进 review 态，确认后再 `handleAnalyze`。

### 3.2 IndexedDB 持久化
- 新增依赖 `idb-keyval`。
- 新建 `src/lib/storage.ts`：`saveSession`/`loadSession`/`listSessions`/`deleteSession`；record = `{ id, analysis, sessions, updatedAt }`，id 由 candidate+时间戳生成。
- `App.tsx`：分析完成、每轮追问、isFinal 后写盘；landing 提「继续上次」入口。

### 3.3 会话报告与改写建议（SessionReport）
- `src/domain/interview-schema.ts`：新增 `InterviewSession = { claimId, turns, coveredPoints, missingPoints, finalSummary, rewriteSuggestion, status }`。
- 新建 `app/api/summarize/route.ts`：入 `{ claim, turns, covered, missing }` → `{ finalSummary, rewriteSuggestion }`；LLM 走新 schema，回落 `mockSummarize`；同样加超时/限流/SSRF（复用）。
- `src/providers/mock.ts`：`mockSummarize` 规则版（按 category 模板 + 要点覆盖情况产出结论与改写片段）。
- `src/lib/prompts.ts`：`SUMMARIZE_SYSTEM_PROMPT`。
- `App.tsx`：isFinal 调 summarize 存入该 claim 的 session；`Mode` 增 `'report'`。
- 新建 `src/components/SessionReport.tsx`：列各声明会话状态（轮数/覆盖/缺口）+ finalSummary + rewriteSuggestion，顶部汇总。
- `report.ts`：`buildReport` 扩展接受 sessions，导出含面试表现 + 改写建议的完整 markdown。
- `Topbar`：「导出报告」用扩展版；增「会话报告」入口。

---

## 数据结构（对齐你的提案，保留展示字段）
```
ResumeClaim = { quote, title, category, role, askLikelihood, evidenceStrength, evidence, evidenceGaps, initialQuestion, evaluationPoints }
InterviewSession = { claimId, turns, coveredPoints, missingPoints, finalSummary, rewriteSuggestion, status }
```

## 测试与验收
- 更新 `mock.test.ts`、`report.test.ts`（新字段，无 verifiability）；新增覆盖清洗、噪声过滤测试。
- `npm run lint` + `npm test` + `npm run build` 全绿。
- 无 Key 走规则示例端到端跑通：上传 → 确认 → 审计 → 追问 → 会话报告 → 导出含改写建议。

## 不在本轮（延后）
- 移动端证据抽屉（≤860px 改抽屉而非隐藏）、整体字号下限提升。
- 登录、云数据库、岗位匹配、语音面试、复杂评分、Ollama provider、`analysis/[id]` 路由拆分。

## 实施顺序与提交
阶段 1 → 2 → 3，每阶段结束跑 lint/test/build，分阶段提交（不 push）。
