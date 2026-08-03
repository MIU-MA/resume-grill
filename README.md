# Resume Grill

> 从简历中的具体表述出发，提前演练面试追问。

Resume Grill 用来检查简历内容是否经得起追问。它不提供通用八股题库，而是从简历中提取项目、职责、技能和成果等表述，生成与原文相关的问题，再根据多轮回答整理证据缺口和待补强内容。


当前版本面向个人在本机运行，暂未提供线上部署方案。

## 功能概览

- 支持 PDF、TXT、Markdown 和直接粘贴文本。
- 在浏览器中解析 PDF，并允许用户检查和修改提取结果。
- 识别个人信息、教育、工作、实习、项目、技能、奖项等简历章节。
- 从职责、技能、成果、数据和管理协作等内容中生成可追问的陈述。
- 分析前可以删除、合并、修改和选择候选陈述，并设置本次分析重点。
- 可选填岗位描述，用于检查岗位要求是否有对应的简历证据。
- 每次围绕一条陈述进行 3 至 5 轮追问，覆盖点按回答累计计算。
- 对无法理解的问题添加“不懂批注”，请求模型改用更通俗的表达；此类澄清不计入回答轮数和证据覆盖。
- 在报告中查看已确认事实、证据缺口、改写建议和待补强盲区。
- 支持标记盲区为已掌握，并基于原陈述创建新的测试版本。
- 支持导出 Markdown 报告。

未配置模型时，应用仍可以提供基于规则的简历分析预览。连续追问、回答判断和复盘需要一个可用的 OpenAI Chat Completions 兼容接口。

## 界面预览

简历确认页用于检查 PDF 或文本的解析结果，并选择本次分析要保留的陈述。

![resume-review](./docs/screenshots/resume-review.png)

面试追问页面会同时展示容易被继续追问的原因、当前问题、已有证据和后续考察方向。

![面试追问页面](./docs/screenshots/interview.png)

分析报告页汇总测试结果、证据完整度、证据缺口和待补强盲区。

![分析报告页](./docs/screenshots/report.png)

## 本地运行

需要 Node.js 20.9 或更高版本。

```bash
npm install
npm run dev
```

然后打开 [http://localhost:3000](http://localhost:3000)。

提交代码前可以运行：

```bash
npm run lint
npm test
npm run build
```

仓库提供了一套示例，可用于体验完整流程：

- [示例简历](./examples/sample-resume.txt)
- [示例岗位描述](./examples/sample-job-description.txt)
- [示例材料说明](./examples/README.md)
- [发布前验收清单](./examples/evaluation-checklist.md)

## 本地模型配置

项目使用 OpenAI Chat Completions 兼容接口，提供环境变量和浏览器设置两种本地配置方式。

### 环境变量配置

复制 `.env.example` 为 `.env.local`：

```bash
OPENAI_BASE_URL=https://api.openai.com/v1
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4o-mini
```

API Key 只由本机运行的 Next.js Route Handler 读取，不会发送到前端。

### 浏览器配置

点击页面右上角的模型设置，填写 `Base URL`、`API Key` 和 `Model`。配置保存在当前站点的 `localStorage` 中。请求先发送到同源 Next.js 接口，再由服务端转发给模型服务商。

浏览器配置适合个人在本机使用。它不适合直接用于不受信任的公开网站。

Ollama 等本地或自建模型通常使用本机、局域网地址。项目默认拦截这类地址以降低 SSRF 风险。确实需要访问时，可以在服务端配置白名单：

```bash
ALLOWED_LLM_BASE_URLS=http://127.0.0.1:11434
```

多个地址使用逗号分隔。

## 数据流与隐私

PDF 文件由 PDF.js 在浏览器中解析，原始文件不会上传至应用服务器。用户确认后的简历文本会提交到同源 API；配置模型后，简历文本、岗位描述和面试回答将发送至所选模型服务商。

分析结果、面试记录、批注和掌握状态保存在当前浏览器的 IndexedDB 中。浏览器模式下的模型配置保存在 `localStorage` 中。项目不建立云端用户档案，但模型服务商可能按照自身政策记录或保留请求。

## 参与贡献

项目已配置 Bug 和功能建议模板，并通过 GitHub Actions 执行 CI 检查。项目采用 [MIT License](./LICENSE)。
