<p align="center">
  <img src="public/favicon.svg" width="56" height="56" alt="Resume Grill">
</p>

<h1 align="center">Resume Grill</h1>

本地优先的个人求职工作台。修改简历、整理招聘岗位、准备投递，再按岗位练习面试。

可以从简历开始，也可以直接添加招聘链接。各个功能独立使用，不必走完一套流程。

## 功能

| 功能 | 能帮你做什么 |
| --- | --- |
| 简历修改 | 导入 PDF、DOCX、TXT、Markdown 或粘贴文本，检查内容、结构和表达；对照实际 PDF 预览修改，保存为新的可投递 PDF |
| 岗位整理 | 浏览招聘官网、读取岗位链接，带入公司、岗位、招聘邮箱和职责要求；读取失败时可粘贴正文 |
| 找岗位 | 结合求职目标和已保存的简历，批量读取官网岗位并比较匹配情况；任务可暂停、继续 |
| 邮箱投递 | 复用简历、发件人和模板，集中核对后用 QQ／163 邮箱逐封发送，保留发送记录 |
| 官网填写 | 浏览器扩展复用基本资料和多段教育、实习、工作、项目经历，尝试填写表单和附上简历；最终提交由你完成 |
| 面试准备 | 沿用岗位要求和简历，围绕经历追问，保存回答、复盘和待复习内容 |

模型分析需自备兼容接口和 Key；手动整理名单、读取网页、邮箱发送和扩展填写不依赖模型。项目目前适合个人本机使用或自用部署。

## 界面预览

以下是此前版本的实际截图，使用示例数据；投递页布局已调整，截图尚未更新。

![投递工作台](docs/screenshots/applications.jpg)

<table>
  <tr>
    <td width="50%"><img src="docs/screenshots/home.jpg" alt="简历库与导入"><br>简历库</td>
    <td width="50%"><img src="docs/screenshots/resume-review.jpg" alt="简历检查与修改建议"><br>简历检查</td>
  </tr>
  <tr>
    <td><img src="docs/screenshots/resume-edit.jpg" alt="简历段落修改"><br>对照修改</td>
    <td><img src="docs/screenshots/resume-preview.jpg" alt="早期版本的新稿预览"><br>新稿预览（早期版本）</td>
  </tr>
</table>

更多截图：[面试准备](docs/screenshots/audit.jpg) · [招聘官网](docs/screenshots/career-sites.jpg)

## 本地启动

需要 **Node.js ≥ 22.13，推荐 Node.js 24**（与 CI、容器一致）。在项目目录运行：

```bash
npm ci
npm run dev
```

打开 [localhost:3000](http://localhost:3000)。点击「试用示例简历」可以先体验检查和初始练习内容；连续问答、回答判断和复盘仍需配置模型。也可使用仓库里的[示例材料](examples/README.md)。

需要自动读取招聘页、查找链接或发送邮件时，在另一个终端启动本机执行器：

```bash
npm run mail-agent
```

在投递页的「发件与设置 → 连接本机」填入终端显示的连接码。读取网页无需连接邮箱；发送邮件时再设置 QQ／163 邮箱和 SMTP 授权码。Windows 支持加密记住授权码，重启后恢复。

## 开始使用

### 修改简历

导入后查看检查建议，点击相关段落修改，右侧预览同步更新。点击「保存 PDF 并下载」生成独立的新稿，可继续用作投递附件。

新稿使用单栏排版，**不还原原 PDF 版式，也不会覆盖原文件**。只暂存文字不会更新投递附件；粘贴的文本需先保存为 PDF。暂不支持扫描件 OCR。

### 整理岗位与投递

从侧栏「招聘官网」搜索公司、选择职位，也可在「投递清单」直接粘贴岗位链接。读取后选择具体职位；公司、岗位、邮箱可在清单中直接修改，也可以导入 CSV 或招聘正文。

- **邮件岗位**：选好简历，勾选岗位，点击「预览并发送」。核对收件人、正文和附件后才发送。每批最多 20 封，附件支持 5 MB 以内的 PDF／DOCX／TXT。
- **官网岗位**：勾选后点击「官网批量填写」，核对资料与经历，再交给扩展。需要登录、验证码或特殊控件时手动处理，最终在原站核对并提交。
- **面试准备**：从岗位详情进入，沿用当前岗位要求和附件；练习围绕回答追问，随时结束或之后继续。

「已提交邮箱」只表示邮箱服务接受邮件，不代表招聘方已读。当前网易支持普通 `@163.com` 邮箱；不支持 BOSS 直聘自动投递。

### 安装官网填写扩展

```bash
npm run build:extension
```

在 Chrome／Edge 扩展管理页开启开发者模式，加载 `dist/website-extension`，然后刷新工作台。也可以下载填写窗口提供的扩展包，解压后加载。

工作台桥接目前仅支持 `http://localhost`／`http://127.0.0.1` 的 **3000、3107** 端口。扩展使用当前浏览器登录状态，按批次申请官网权限；填写不需要邮件执行器。任务与资料保存在扩展本机存储，支持暂停、继续和单项重试。

**适配仍在完善：**腾讯、字节、阿里、小红书、B站、美团、京东、百度、快手、网易已检查公开入口或部分前端资源，均未完成登录后实测。Lever 有真实公开 HTML 本地回归；B站使用公开代码重建表单契约。目录收录不等于填写兼容，日期、多级选择、跨域表单等仍可能需要手动处理。

安装、操作和逐站验证范围见[官网填写说明](docs/website-automation.md)与[适配记录](docs/website-adaptation.md)。

## 模型配置

在「模型设置」填写 `Base URL`、`API Key`、`Model`，使用兼容 **OpenAI Chat Completions 协议及 JSON 输出**的服务。测试连接会实际请求模型，可能产生费用。

也可参考 [.env.example](.env.example)，在根目录的 `.env.local` 配置：

```dotenv
OPENAI_BASE_URL=https://your-provider.example/v1
OPENAI_API_KEY=your-api-key
OPENAI_MODEL=your-model-id
```

三个值需完整填写，修改后重启。完整的网页配置优先于服务端配置。网页 Key 保存在当前浏览器，调用时经工作台后端请求模型，因此仍需信任部署服务器。

本机或内网模型需配置服务端白名单，例如：

```dotenv
ALLOWED_LLM_BASE_URLS=http://127.0.0.1:11434
```

按协议、主机、端口匹配，多个来源用逗号分隔；设置后未列出的地址也会被拒绝。远程部署时，`127.0.0.1` 指服务器自身。项目不固定限制模型输出 token，实际仍受模型上下文和服务商限制。

## 数据与部署

简历、修改草稿、练习和投递清单保存在当前浏览器；扩展任务保存在扩展本机存储；邮件队列、附件和记录在项目 `.mail-agent/` 目录。Windows 记住的授权码由当前系统账户加密保存。

模型分析发送所需文本，不上传原简历文件；求职邮件会发送所选附件。数据不自动跨设备同步，清理浏览器站点数据会丢失记录。报告可导出 Markdown、练习可导出 JSON，但不包含所有附件；邮件记录需单独备份 `.mail-agent/`。

构建运行网页：

```bash
npm run build
npm start
```

也可使用 [Dockerfile](Dockerfile) 或 [Compose](docker-compose.yml)，容器只运行网页。公开部署尚无账户和独立额度管理，不建议预置供所有用户回退使用的模型 Key。

线上网页读取招聘页和发送邮件仍需用户自己的本机执行器，并设置 `MAIL_WORKBENCH_ORIGIN` 为网页来源。执行器监听 `127.0.0.1:4318`，线上连接的浏览器兼容性尚未全面验证；扩展桥接仍限上述本地地址。详见[部署后的连接方式](docs/email-applications.md#网页部署后的连接方式)。

## 开发与文档

Next.js / React / TypeScript / Tailwind CSS；PDF.js 与 mammoth 解析文件，IndexedDB 保存浏览器数据，Nodemailer 发送邮件。

路由在 `app/`，业务在 `src/features/`，跨模块流程在 `src/application/`；执行器和扩展分别在 `src/mail-agent/`、`src/browser-extension/`。目录和依赖规则见 [AGENTS.md](AGENTS.md) 与[模块说明](src/features/README.md)。

```bash
npm run check:architecture
npm run lint
npx tsc --noEmit
npm test
npm run build
```

- [邮箱投递：连接、模板、记录与失败处理](docs/email-applications.md)
- [招聘目录：来源与维护](docs/career-directory.md)
- [官网扩展：安装与使用](docs/website-automation.md)
- [官网适配：证据与未验证范围](docs/website-adaptation.md)

运行 `npx tsx scripts/crawl-careers.ts` 可刷新已配置来源的 `data/career-leads/latest.md` 和 `latest.json`；不会提交申请，也不更新人工核对日期。

[MIT License](LICENSE)
