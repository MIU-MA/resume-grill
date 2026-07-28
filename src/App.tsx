import { useMemo, useRef, useState } from 'react'
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  BarChart3,
  BookOpenCheck,
  Check,
  ChevronDown,
  CircleHelp,
  Code2,
  Download,
  FileSearch,
  FileText,
  Flame,
  GitBranch,
  Loader2,
  MessageSquareText,
  RefreshCw,
  ShieldAlert,
  Sparkles,
  Target,
  Upload,
  X,
} from 'lucide-react'
import './App.css'

type Risk = 'high' | 'medium' | 'low'

type Question = {
  level: number
  tag: string
  question: string
  intent: string
  keywords: string[]
  answerPoints: string[]
}

type Claim = {
  id: string
  category: string
  title: string
  quote: string
  risk: Risk
  riskScore: number
  confidence: number
  reason: string
  evidence: string[]
  gaps: string[]
  questions: Question[]
}

const claims: Claim[] = [
  {
    id: 'sse',
    category: 'AI 流式交互',
    title: 'SSE 分块解析与异常兜底',
    quote: '完成 SSE 流式解析、消息增量渲染、Markdown 展示、历史记录持久化、自动滚动与异常兜底。',
    risk: 'high',
    riskScore: 88,
    confidence: 72,
    reason: '描述覆盖多个关键环节，但没有说明半包处理、代理缓冲、取消读取和重连策略，容易被连续深挖。',
    evidence: ['项目中存在 use-stream.ts', '使用 AbortController 主动中断', '定义 phase/token/done/error 事件'],
    gaps: ['缺少半包与粘包测试', '未说明代理缓冲处理', '没有量化流式首字延迟'],
    questions: [
      {
        level: 1,
        tag: '基础判断',
        question: '为什么这个场景选择 SSE，而不是 WebSocket 或普通 HTTP 请求？',
        intent: '验证是否理解协议选择，而不只是会调用接口。',
        keywords: ['单向', 'HTTP', '自动重连', '流式', 'WebSocket'],
        answerPoints: ['SSE 适合服务端到客户端的单向持续推送', '基于 HTTP，部署与代理兼容成本较低', 'WebSocket 更适合双向高频通信', '普通 HTTP 无法自然表达持续增量结果'],
      },
      {
        level: 2,
        tag: '实现细节',
        question: '一个 JSON 事件被拆在两个 chunk 中，你的解析器怎样避免 JSON.parse 失败？',
        intent: '检查是否真正处理过 ReadableStream 边界。',
        keywords: ['buffer', '缓冲', '分隔符', 'TextDecoder', '残留'],
        answerPoints: ['使用持久 buffer 累积 TextDecoder 输出', '按事件分隔符切分完整块', '保留最后一个不完整块等待下一次读取', '只对完整 data 字段执行 JSON.parse'],
      },
      {
        level: 3,
        tag: '异常恢复',
        question: '模型流输出到一半断开时，页面状态、已生成内容和重试入口怎么处理？',
        intent: '判断异常兜底是否只是展示一个 toast。',
        keywords: ['保留', '状态', '重试', '幂等', '错误'],
        answerPoints: ['保留已经接收的内容而不是清空', '将 streaming 状态可靠复位', '区分用户取消、网络错误和服务端错误', '重试时避免重复保存版本或重复追加内容'],
      },
      {
        level: 4,
        tag: '工程排障',
        question: '本地流式正常，上线后变成一次性返回，你会按什么顺序排查？',
        intent: '验证是否具备真实部署排障能力。',
        keywords: ['代理', '缓冲', '压缩', 'header', 'Nginx'],
        answerPoints: ['先确认服务端是否逐块 flush', '检查 Content-Type 与 Cache-Control', '排查 Nginx/CDN 的响应缓冲', '检查压缩是否导致数据聚合', '使用 curl 直接绕过前端定位链路'],
      },
      {
        level: 5,
        tag: '边界设计',
        question: 'AbortController 触发后，reader、React 状态和后续请求之间可能出现什么竞态？',
        intent: '考察取消逻辑和组件生命周期意识。',
        keywords: ['reader', '竞态', 'signal', 'cleanup', '请求标识'],
        answerPoints: ['旧请求可能在新请求后写入状态', '需要请求标识或序列号过滤过期更新', '取消后释放 reader 并在 finally 中复位状态', '组件卸载时主动 abort，避免状态更新'],
      },
    ],
  },
  {
    id: 'iframe',
    category: '前端安全',
    title: 'sandbox iframe 安全预览',
    quote: '使用 sandbox iframe + srcDoc 隔离执行生成页面，支持多设备预览、缩放与新窗口打开。',
    risk: 'high',
    riskScore: 84,
    confidence: 68,
    reason: '“安全预览”是强声明，面试官通常会追问 sandbox 权限组合、CSP、postMessage 与网络隔离。',
    evidence: ['iframe 使用 sandbox 属性', '通过 srcDoc 注入单文件 HTML', '预览与宿主页面分离'],
    gaps: ['未展示 CSP 策略', '缺少 postMessage 来源校验', '没有网络请求限制说明'],
    questions: [
      {
        level: 1,
        tag: '属性理解',
        question: 'sandbox="allow-scripts" 允许什么，又限制了什么？',
        intent: '确认不是只知道添加 sandbox 字符串。',
        keywords: ['脚本', '同源', '表单', '弹窗', '导航'],
        answerPoints: ['允许 iframe 内脚本执行', '默认仍使用独立 opaque origin', '表单提交、弹窗、顶层导航仍受限制', '权限应按能力逐项最小化开放'],
      },
      {
        level: 2,
        tag: '危险组合',
        question: '为什么 allow-scripts 与 allow-same-origin 同时使用需要特别谨慎？',
        intent: '验证对 iframe 隔离逃逸风险的理解。',
        keywords: ['同源', '移除', 'sandbox', 'DOM', '逃逸'],
        answerPoints: ['同源内容可能获得访问宿主能力', '脚本可能操作 iframe 元素并削弱 sandbox', '不可信内容应保持 opaque origin', '需要配合独立域名与 CSP'],
      },
      {
        level: 3,
        tag: '通信安全',
        question: '如果需要从 iframe 收集运行错误，postMessage 应该怎样设计？',
        intent: '检查跨上下文通信的安全边界。',
        keywords: ['origin', 'source', 'schema', 'channel', '校验'],
        answerPoints: ['校验 event.source 是否为目标 iframe', '使用随机 channel/token 关联会话', '对消息结构做 schema 校验', '限制允许的消息类型和数据大小'],
      },
    ],
  },
  {
    id: 'frameworks',
    category: '能力边界',
    title: '同时熟悉 Vue、React 与 Next.js',
    quote: '具备 Vue 3 / React / Next.js / TypeScript 项目实践，能够独立完成中后台、内容型网站和 AI 流式交互产品。',
    risk: 'high',
    riskScore: 91,
    confidence: 64,
    reason: '范围较宽但证据分布不均，容易被分别询问响应式原理、React 渲染机制与 Next.js 服务端边界。',
    evidence: ['Vue 3 官网与 CMS 项目', 'Next.js 个人 AI 项目', 'TypeScript 在多个项目中使用'],
    gaps: ['React 项目深度描述不足', '缺少性能优化指标', '没有框架选型对比案例'],
    questions: [
      {
        level: 1,
        tag: '框架对比',
        question: 'Vue 3 与 React 在状态更新和依赖追踪上的核心差异是什么？',
        intent: '确认多框架经验不是停留在 API 使用层。',
        keywords: ['响应式', '依赖追踪', '不可变', '渲染', 'Proxy'],
        answerPoints: ['Vue 通过响应式系统自动追踪依赖', 'React 通常通过状态更新触发组件重新执行', 'React 更依赖不可变更新与引用比较', '两者优化手段和心智模型不同'],
      },
      {
        level: 2,
        tag: '选型决策',
        question: '协会官网为什么使用 Vue + Vite SSG，而个人项目选择 Next.js？',
        intent: '验证框架选择是否基于业务约束。',
        keywords: ['SSG', 'SEO', '团队', '服务端', '路由'],
        answerPoints: ['官网公开内容适合静态生成与 CDN', '团队已有 Vue 技术栈降低维护成本', 'Next.js Route Handler 便于承载 AI 服务端请求', '选择应结合部署、数据更新频率与团队经验'],
      },
    ],
  },
  {
    id: 'seo',
    category: '内容工程',
    title: 'Vite SSG 改善 SEO 与首屏直出',
    quote: '使用 Vite SSG 静态生成公开页面，配合 i18n 完成中英文内容展示，改善 SEO 可索引性与首屏直出体验。',
    risk: 'medium',
    riskScore: 73,
    confidence: 76,
    reason: '技术方案合理，但“改善”缺少 Lighthouse、索引覆盖率或首屏指标等可验证结果。',
    evidence: ['公开路由采用静态生成', '支持中英文内容', '页面能够首屏输出 HTML'],
    gaps: ['缺少改造前后指标', '未说明动态内容更新策略'],
    questions: [
      {
        level: 1,
        tag: '方案原理',
        question: 'SSG 相比纯 CSR 为什么更有利于 SEO 和首屏展示？',
        intent: '检查是否理解静态生成带来的实际变化。',
        keywords: ['HTML', '爬虫', '首屏', '构建', '静态'],
        answerPoints: ['构建阶段直接产出完整 HTML', '爬虫无需等待客户端脚本执行', '首屏内容更早可见', '代价是内容更新通常需要重新构建'],
      },
      {
        level: 2,
        tag: '结果验证',
        question: '你会用哪些指标证明 SEO 和首屏体验真的改善了？',
        intent: '识别“做了技术方案”等同于“取得结果”的表达问题。',
        keywords: ['LCP', '索引', 'Lighthouse', 'TTFB', 'Search Console'],
        answerPoints: ['对比 Lighthouse 与 Core Web Vitals', '观察 LCP、FCP 和可交互时间', '检查搜索引擎索引覆盖率', '保留改造前后的相同网络环境数据'],
      },
    ],
  },
  {
    id: 'cms',
    category: '工程协作',
    title: 'CMS 内容生产链路与请求封装',
    quote: '按文章、图片和音乐资源拆分请求模块，统一认证失效、错误提示与上传异常处理。',
    risk: 'medium',
    riskScore: 66,
    confidence: 82,
    reason: '业务背景和模块边界清晰，风险主要集中在认证刷新、上传失败恢复和错误分层。',
    evidence: ['真实上线 CMS', '文章与媒体资源模块拆分', '统一处理认证与上传异常'],
    gaps: ['缺少请求重试策略', '没有错误码分层示例'],
    questions: [
      {
        level: 1,
        tag: '模块设计',
        question: '为什么按资源拆分请求模块，而不是把所有接口放在一个 request.ts？',
        intent: '验证模块化是否有明确边界。',
        keywords: ['领域', '内聚', '类型', '维护', '依赖'],
        answerPoints: ['按业务领域提高内聚性', '避免单文件持续膨胀', '便于定义资源级类型与错误处理', '共享认证和基础请求能力仍放在底层'],
      },
      {
        level: 2,
        tag: '认证异常',
        question: '多个请求同时收到 401 时，如何避免重复刷新 Token？',
        intent: '进一步检查并发请求与认证状态处理。',
        keywords: ['锁', '队列', 'Promise', '重放', '刷新'],
        answerPoints: ['使用共享 refresh Promise 或互斥锁', '刷新期间挂起其他失败请求', '刷新成功后统一重放', '刷新失败则清理凭证并跳转登录'],
      },
    ],
  },
  {
    id: 'algorithm',
    category: '算法与竞赛',
    title: '蓝桥杯国二与 CCPC 铜牌',
    quote: '获蓝桥杯全国二等奖、CCPC 广西邀请赛铜牌，具备数据结构与算法基础。',
    risk: 'low',
    riskScore: 42,
    confidence: 88,
    reason: '奖项本身是强证据，面试风险主要来自基础算法熟练度是否随时间下降。',
    evidence: ['蓝桥杯 C++ 组全国二等奖', 'CCPC 广西邀请赛铜牌', '专业排名前 14%'],
    gaps: ['缺少近期算法练习记录'],
    questions: [
      {
        level: 1,
        tag: '基础算法',
        question: '请说明 Dijkstra 的适用条件、复杂度以及为什么不能处理负权边。',
        intent: '验证竞赛经历对应的基础知识保留程度。',
        keywords: ['负权', '贪心', '优先队列', '复杂度', '最短路'],
        answerPoints: ['适用于边权非负的单源最短路', '优先队列实现复杂度通常为 O((V+E)logV)', '依赖已确定最短距离不会再变小的贪心性质', '负权会破坏这一性质'],
      },
    ],
  },
]

const riskMeta: Record<Risk, { label: string; color: string }> = {
  high: { label: '高风险', color: 'red' },
  medium: { label: '需准备', color: 'amber' },
  low: { label: '较稳固', color: 'green' },
}

function downloadReport() {
  const content = [
    '# 简历技术风险报告',
    '',
    '候选人：蒋滔 · 前端开发工程师',
    '',
    ...claims.flatMap((claim) => [
      `## ${claim.title}`,
      '',
      `- 风险分：${claim.riskScore}/100`,
      `- 判断：${claim.reason}`,
      `- 证据缺口：${claim.gaps.join('；')}`,
      '',
    ]),
  ].join('\n')
  const url = URL.createObjectURL(new Blob([content], { type: 'text/markdown;charset=utf-8' }))
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = 'resume-risk-report.md'
  anchor.style.display = 'none'
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}

function App() {
  const [selectedId, setSelectedId] = useState('sse')
  const [expandedLevel, setExpandedLevel] = useState(2)
  const [mode, setMode] = useState<'audit' | 'interview'>('audit')
  const [questionIndex, setQuestionIndex] = useState(0)
  const [answer, setAnswer] = useState('')
  const [result, setResult] = useState<{ score: number; matched: string[]; missing: string[] } | null>(null)
  const [showPoints, setShowPoints] = useState(false)
  const [analyzing, setAnalyzing] = useState(false)
  const [toast, setToast] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  const selected = claims.find((claim) => claim.id === selectedId) ?? claims[0]
  const currentQuestion = selected.questions[Math.min(questionIndex, selected.questions.length - 1)]
  const highRiskCount = claims.filter((claim) => claim.risk === 'high').length
  const avgRisk = Math.round(claims.reduce((total, claim) => total + claim.riskScore, 0) / claims.length)

  const distribution = useMemo(() => ({
    protocol: 86,
    security: 78,
    framework: 74,
    evidence: 58,
  }), [])

  const selectClaim = (id: string) => {
    setSelectedId(id)
    setExpandedLevel(1)
    setQuestionIndex(0)
    setResult(null)
    setAnswer('')
    setShowPoints(false)
    setMode('audit')
  }

  const startInterview = () => {
    setQuestionIndex(0)
    setAnswer('')
    setResult(null)
    setShowPoints(false)
    setMode('interview')
    window.scrollTo({ top: 0, left: 0 })
  }

  const evaluateAnswer = () => {
    const normalized = answer.toLowerCase()
    const matchedKeywords = currentQuestion.keywords.filter((keyword) => normalized.includes(keyword.toLowerCase()))
    const ratio = matchedKeywords.length / currentQuestion.keywords.length
    const score = answer.trim().length < 20 ? Math.round(20 + ratio * 35) : Math.min(96, Math.round(46 + ratio * 50))
    const matchedCount = Math.max(1, Math.round(ratio * currentQuestion.answerPoints.length))
    setResult({
      score,
      matched: currentQuestion.answerPoints.slice(0, matchedCount),
      missing: currentQuestion.answerPoints.slice(matchedCount),
    })
  }

  const nextQuestion = () => {
    if (questionIndex < selected.questions.length - 1) {
      setQuestionIndex((index) => index + 1)
      setAnswer('')
      setResult(null)
      setShowPoints(false)
      window.scrollTo({ top: 0, left: 0 })
    } else {
      setMode('audit')
      window.scrollTo({ top: 0, left: 0 })
      setToast('本轮追问已完成，建议优先补齐未命中的回答要点。')
      window.setTimeout(() => setToast(''), 3200)
    }
  }

  const runAnalysis = () => {
    setAnalyzing(true)
    window.setTimeout(() => {
      setAnalyzing(false)
      setSelectedId('frameworks')
      setExpandedLevel(1)
      setToast('重新分析完成：发现 6 条技术声明，其中 3 条容易被深挖。')
      window.setTimeout(() => setToast(''), 3200)
    }, 1300)
  }

  const handleFile = (file?: File) => {
    if (!file) return
    setAnalyzing(true)
    window.setTimeout(() => {
      setAnalyzing(false)
      setToast(`Demo 已载入「${file.name}」，当前展示规则引擎的示例分析结果。`)
      window.setTimeout(() => setToast(''), 3600)
    }, 1200)
  }

  return (
    <div className="app-shell">
      {toast && (
        <div className="toast" role="status">
          <Check size={15} />
          <span>{toast}</span>
          <button type="button" onClick={() => setToast('')} aria-label="关闭提示"><X size={14} /></button>
        </div>
      )}

      <header className="topbar">
        <div className="brand-block">
          <div className="brand-mark"><Target size={18} /></div>
          <div>
            <strong>简历拷打机</strong>
            <span>Resume Drill</span>
          </div>
        </div>
        <div className="topbar-context">
          <FileText size={14} />
          <span>蒋滔-前端开发工程师简历.pdf</span>
          <span className="analysis-state"><i /> 分析完成</span>
        </div>
        <div className="topbar-actions">
          <input ref={fileInputRef} type="file" accept=".pdf,.doc,.docx,.txt,.md" hidden onChange={(event) => handleFile(event.target.files?.[0])} />
          <button type="button" className="button secondary" onClick={() => fileInputRef.current?.click()}><Upload size={14} />替换简历</button>
          <button type="button" className="icon-button" title="重新分析" onClick={runAnalysis} disabled={analyzing}>{analyzing ? <Loader2 size={15} className="spin" /> : <RefreshCw size={15} />}</button>
          <button type="button" className="button primary" onClick={downloadReport}><Download size={14} />导出报告</button>
        </div>
      </header>

      <div className="workspace">
        <aside className="claim-sidebar">
          <div className="candidate">
            <div className="candidate-avatar">JT</div>
            <div>
              <strong>蒋滔</strong>
              <span>前端开发工程师 · 2028 届</span>
            </div>
          </div>

          <div className="sidebar-heading">
            <span>技术声明</span>
            <b>{claims.length}</b>
          </div>
          <div className="claim-list">
            {claims.map((claim) => (
              <button key={claim.id} type="button" className={`claim-item ${selected.id === claim.id ? 'active' : ''}`} onClick={() => selectClaim(claim.id)}>
                <span className={`risk-dot ${riskMeta[claim.risk].color}`} />
                <span className="claim-item-copy">
                  <small>{claim.category}</small>
                  <strong>{claim.title}</strong>
                </span>
                <span className={`claim-score ${riskMeta[claim.risk].color}`}>{claim.riskScore}</span>
              </button>
            ))}
          </div>

          <div className="sidebar-foot">
            <ShieldAlert size={15} />
            <p><strong>评分不是能力结论</strong><br />它表示这句话在面试中被继续追问的概率。</p>
          </div>
        </aside>

        {mode === 'audit' ? (
          <main className="audit-main">
            <section className="summary-strip">
              <div><span>综合风险</span><strong className="metric-danger">{avgRisk}</strong><small>/ 100</small></div>
              <div><span>技术声明</span><strong>{claims.length}</strong><small>条</small></div>
              <div><span>高风险声明</span><strong>{highRiskCount}</strong><small>条</small></div>
              <div><span>待补证据</span><strong>4</strong><small>处</small></div>
            </section>

            {analyzing ? (
              <div className="analysis-loading">
                <div className="scan-document">
                  <FileSearch size={30} />
                  <span className="scan-line" />
                </div>
                <h2>正在拆解技术声明</h2>
                <p>识别技术名词、成果表述、证据强度与可能的追问入口…</p>
              </div>
            ) : (
              <>
                <section className="claim-header">
                  <div className="eyebrow"><Code2 size={13} />{selected.category}</div>
                  <div className="claim-title-row">
                    <div>
                      <h1>{selected.title}</h1>
                      <p>{selected.reason}</p>
                    </div>
                    <div className={`risk-badge ${riskMeta[selected.risk].color}`}>
                      <Flame size={14} />{riskMeta[selected.risk].label} · {selected.riskScore}
                    </div>
                  </div>
                  <blockquote>
                    <span>简历原文</span>
                    “{selected.quote}”
                  </blockquote>
                </section>

                <section className="question-section">
                  <div className="section-title">
                    <div>
                      <h2>递进追问路径</h2>
                      <p>问题会沿着你的回答继续深入，而不是随机抽取八股。</p>
                    </div>
                    <span>{selected.questions.length} 层追问</span>
                  </div>
                  <div className="question-ladder">
                    {selected.questions.map((question) => {
                      const expanded = expandedLevel === question.level
                      return (
                        <article key={question.level} className={`question-row ${expanded ? 'expanded' : ''}`}>
                          <button type="button" onClick={() => setExpandedLevel(expanded ? 0 : question.level)}>
                            <span className="level-index">{question.level}</span>
                            <span className="question-copy"><small>{question.tag}</small><strong>{question.question}</strong></span>
                            <ChevronDown size={16} className={expanded ? 'rotate' : ''} />
                          </button>
                          {expanded && (
                            <div className="question-detail">
                              <div><CircleHelp size={14} /><p><span>考察意图</span>{question.intent}</p></div>
                              <div><BookOpenCheck size={14} /><p><span>回答应覆盖</span>{question.answerPoints.join('；')}</p></div>
                            </div>
                          )}
                        </article>
                      )
                    })}
                  </div>
                </section>

                <button type="button" className="start-interview mobile-start-interview" onClick={startInterview}>
                  <span><MessageSquareText size={16} /><b>开始模拟拷打</b></span>
                  <small>从第 1 层开始，回答后继续追问</small>
                  <ArrowRight size={16} />
                </button>
              </>
            )}
          </main>
        ) : (
          <main className="interview-main">
            <div className="interview-topline">
              <button type="button" onClick={() => setMode('audit')}><ArrowLeft size={15} />返回风险报告</button>
              <span>模拟追问 · {questionIndex + 1} / {selected.questions.length}</span>
            </div>
            <div className="progress-track"><span style={{ width: `${((questionIndex + 1) / selected.questions.length) * 100}%` }} /></div>

            <div className="interview-stage">
              <div className="interviewer-label"><MessageSquareText size={14} />技术面试官 · {currentQuestion.tag}</div>
              <h1>{currentQuestion.question}</h1>
              <p className="interview-intent">这道题在验证：{currentQuestion.intent}</p>

              <label className="answer-box">
                <span>你的回答</span>
                <textarea value={answer} onChange={(event) => setAnswer(event.target.value)} disabled={Boolean(result)} placeholder="按真实面试的方式回答。先说结论，再结合项目说明取舍和实现细节…" />
                <small>{answer.length} 字</small>
              </label>

              {!result ? (
                <div className="answer-actions">
                  <button type="button" className="button secondary" onClick={() => setShowPoints((value) => !value)}><CircleHelp size={14} />{showPoints ? '隐藏提示' : '查看提示'}</button>
                  <button type="button" className="button primary large" disabled={answer.trim().length < 8} onClick={evaluateAnswer}>提交回答<ArrowRight size={15} /></button>
                </div>
              ) : (
                <div className="answer-actions end">
                  <span>本题分析完成</span>
                  <button type="button" className="button primary large" onClick={nextQuestion}>{questionIndex < selected.questions.length - 1 ? '继续追问' : '完成本轮'}<ArrowRight size={15} /></button>
                </div>
              )}

              {showPoints && !result && (
                <div className="hint-panel"><Sparkles size={15} /><div><strong>回答提示</strong><p>{currentQuestion.keywords.join('、')}</p></div></div>
              )}

              {result && (
                <section className="evaluation">
                  <div className="evaluation-score"><strong>{result.score}</strong><span>/ 100</span><small>{result.score >= 80 ? '回答稳固' : result.score >= 60 ? '基本覆盖' : '需要补强'}</small></div>
                  <div className="evaluation-points">
                    <h3>回答命中</h3>
                    {result.matched.map((point) => <p className="matched" key={point}><Check size={13} />{point}</p>)}
                    {result.missing.length > 0 && <h3>建议补充</h3>}
                    {result.missing.map((point) => <p className="missing" key={point}><AlertTriangle size={13} />{point}</p>)}
                  </div>
                </section>
              )}
            </div>
          </main>
        )}

        <aside className="insight-panel">
          <div className="insight-heading"><BarChart3 size={15} /><strong>{mode === 'audit' ? '风险依据' : '本轮状态'}</strong></div>
          {mode === 'audit' ? (
            <>
              <section className="confidence-block">
                <span>证据可信度</span>
                <div className="confidence-value"><strong>{selected.confidence}%</strong><small>基于简历文本</small></div>
                <div className="meter"><i style={{ width: `${selected.confidence}%` }} /></div>
              </section>

              <section className="evidence-section">
                <h3><Check size={13} />已有证据</h3>
                {selected.evidence.map((item) => <p key={item}>{item}</p>)}
              </section>

              <section className="evidence-section gaps">
                <h3><AlertTriangle size={13} />容易被追问</h3>
                {selected.gaps.map((item) => <p key={item}>{item}</p>)}
              </section>

              <section className="risk-bars">
                <h3>风险构成</h3>
                {Object.entries(distribution).map(([key, value]) => (
                  <div key={key}>
                    <span>{key === 'protocol' ? '原理深度' : key === 'security' ? '边界场景' : key === 'framework' ? '表达范围' : '项目证据'}</span>
                    <div><i style={{ width: `${selected.id === 'algorithm' ? Math.max(32, value - 35) : value}%` }} /></div>
                    <b>{selected.id === 'algorithm' ? Math.max(32, value - 35) : value}</b>
                  </div>
                ))}
              </section>

              <button type="button" className="start-interview" onClick={startInterview}>
                <span><MessageSquareText size={16} /><b>开始模拟拷打</b></span>
                <small>从第 1 层开始，回答后继续追问</small>
                <ArrowRight size={16} />
              </button>

              <a className="repo-link" href="https://github.com/MIU-MA" target="_blank" rel="noreferrer"><GitBranch size={14} />关联 GitHub 证据 <ArrowRight size={13} /></a>
            </>
          ) : (
            <>
              <section className="interview-status">
                <span className="status-orbit"><MessageSquareText size={19} /></span>
                <strong>{selected.title}</strong>
                <p>当前正在进行第 {currentQuestion.level} 层追问</p>
              </section>
              <section className="evidence-section">
                <h3><Target size={13} />面试官关注点</h3>
                <p>{currentQuestion.intent}</p>
              </section>
              <section className="keyword-section">
                <h3>关键概念</h3>
                <div>{currentQuestion.keywords.map((keyword) => <span key={keyword}>{keyword}</span>)}</div>
              </section>
              <section className="interview-tip">
                <strong>回答建议</strong>
                <p>不要只解释概念。按“为什么选择 → 如何实现 → 遇到什么异常 → 怎样验证”的顺序回答。</p>
              </section>
            </>
          )}
        </aside>
      </div>
    </div>
  )
}

export default App
