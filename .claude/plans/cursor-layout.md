# Cursor 风格页面结构改造

## 策略
- 保持当前 Mode (`audit`/`interview`/`report`) 逻辑，不引入 Next.js 路由
- 三栏 workspace 改为两栏（主体 + insight panel），左 ClaimSidebar 消失
- ResumeClaim schema 加 `sourceSection`，分析页按段分组
- 拷打页改为聊天气泡风格

## 改动清单

### Schema & Prompts
- `resume-schema.ts`：`resumeClaimSchema` 增 `sourceSection: z.string()`（如 "工作经历"/"项目经验"/"技能"）
- `prompts.ts`：ANALYZE prompt 指示 LLM 输出 `sourceSection`
- `mock.ts`：`mockAnalyze` 分配 `sourceSection`（从附近标题推断，或按首句关键词推断，最简直接用 role 或空字符串）

### 首页 (upload) — 不改/微调
- 去掉 ModelSettings 在首页的显眼位置，改为顶部右上角设置齿轮图标（toggle 弹 ModalSettings）
- 主卡片精简：Resume Grill logo → "上传你的简历" heading → 拖拽区 → "或" → 粘贴 → "开始压力测试" 大按钮
- 保留 `ModelSettings` 但不内嵌在卡片内，改为顶部小入口
- `ExtractedTextReview` 保持类似、去掉模型设置显露

### 分析页 (audit) — 重构 AuditView + Topbar + 去 ClaimSidebar

#### Topbar 重建
替换 `ClaimSidebar` 左栏为精简顶部：
- 左：候选人姓名 + 岗位
- 右：LLM 模式芯片 + 替换简历 + 导出报告 + 会话报告 + 重新分析
- 顶栏下方贴一行风险摘要条：`🔥 {n} 条高风险  ⚠️ {n} 条需补充证据  {n} 条较稳固`（用 computeStats）

#### 主体内容 (AuditView 重建)
- 声明列表按 `sourceSection` 分组（同段内的声明一组）
- 每组：段标题（如 "工作经历"）+ 分割线 + 声明卡片列表
- 每张声明卡片：左侧风险颜色条 / risk-dot，右侧「类型标签 · 角色」，标题，追问概率数，→ 箭头
- 点击选中的声明展开详情（quote 原文、evidence、evidenceGaps、evaluationPoints、首轮追问预览），"开始模拟拷打" 按钮
- 底部："查看会话报告" 入口

### 拷打页 (interview) — 聊天气泡风格

#### 主体内容 (InterviewView 重建)
- 顶部：返回按钮 + 声明标题 + 进度条
- 聊天区：
  - 系统消息（居中灰色）："开始追问：{quote}"
  - 面试官气泡（左对齐，浅灰）：当前问题
  - 用户气泡（右对齐，品牌色）：回答内容
  - 历史对话用气泡串联
  - AI 反馈气泡（左对齐，弱色）：isFinal 时的总结
- 底栏：输入框 + 提交按钮（或改进为 Enter 提交）
- 覆盖进展：聊天流顶部或底部一个紧凑的进度条

#### InsightPanel 重建（右侧保留）
- 当前状态：声明标题、第 X 轮
- 覆盖要点 tag 列表
- 建议补充列表
- 提示面板

### 报告页 (report)
- 保持 SessionReport 组件不变，适配新的两栏布局即可

### 响应式
- >860：两栏（主体 + insight panel）
- ≤860：单栏，insight 收起为底部抽屉或标签页
- ≤620：全宽单栏

## 执行顺序
1. schema + prompt + mock 加 sourceSection
2. 首页精简（ResumeUploader 去 ModelSettings 内嵌，改卡片风格）
3. 分析页（Topbar 重建 + AuditView 重建 + 去 ClaimSidebar）
4. 删 ClaimSidebar、改 workspace grid 为两栏
5. 拷打页聊天气泡
6. InsightPanel 适配两栏
7. SessionReport 适配
8. 更新测试、lint、build

## 不碰
- 业务逻辑（handleAnalyze / submitAnswer / finalizeSession / storage / report）
- API 路由
- gen/lib 工具函数
- 类型定义除 sourceSection 外
