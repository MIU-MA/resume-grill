# ego 与 BOSS 验证记录

2026-11-17，ego(lite) 0.6.3.14，ego-browser v2.2.1。入口：`npm run boss:ego`。

## 已修复并接入

- 工作台服务通过 ego 自有 Node/CDP 接口创建独立任务空间，复用原有岗位采集、JD 核对、批次准备、发送队列及回执代码；不再只是用 CLI 手动运行几个项目函数。
- 图片选择器只匹配纯图片控件，排除同时接受 PDF、Word、PPT 的附件入口；多个纯图片控件时仍拒绝猜测。
- 真实会话支持 `.friend-content.selected`；身份绑定具体 DOM 列表项及其身份信息，同名会话、替换或切换列表项会失效，聊天摘要变化不影响身份。不会仅凭姓名放行。
- 支持真实本人消息样式 `.message-item.item-myself`，正文核验排除气泡外的时间和已读状态。
- PDF 排版换行合并为完整语句后选择引用，不按半行或固定字符数截断。无法取得适合长度的语句时提示人工核对。
- 修复搜索跳转时清空岗位快照引起的异常；读取完成后再保存快照。搜索保留 URL 中已选城市，未指定时默认全国。
- ego 沟通新页追踪真实 opener，仅接入自有岗位页产生的弹窗。用户接管后停止命令，断开时保留用户控制的空间。

## 真实 BOSS 项目服务验证

测试通过本机 HTTP 服务执行，没有替换官网数据：

| 操作 | 结果 |
| --- | --- |
| 连接已登录的 ego，搜索 Agent 实习 | 读到 15 个真实岗位 |
| 仅选择上海一念千身科技、汕头正腾两家非大厂 | 两家 JD 身份与正文核对通过 |
| 使用本机原简历准备内容 | 两条招呼语为完整语句，无「并。」残句 |
| 批次预览与简历图片哈希 | 通过；未授权确认被拒绝，无发送日志 |
| 工作台画面接口 | 返回 ego 真实页面截图 |
| 已有历史会话测试文字 | 写入、等待读回、清空通过，最终输入框为空 |
| 正式草稿核对、填写接口 | 未确认被拒绝；一次性凭据填写成功，重放被拒绝；仅本次标记文字随后清空 |
| 会话身份、纯图片入口 | 唯一识别，重复身份核对稳定；没有选择或上传文件 |
| 断开后重连 | 通过 |

原始结构化证据保存在已忽略的 `.boss-agent/e2e/`，不提交简历、图片、聊天正文或本机凭据。

## 本机与隔离测试

`npm run check:ego` 使用真正的 ego 运行时和仅监听回环地址的测试网站，验证合成 PNG 的上传字节、唯一上传次数、CDP 响应体读取，以及真实弹窗来源与接入。只向本机发送合成图片，不使用用户简历，不连接招聘方。

自动回归覆盖用户接管保护、同名会话切换、消息回执、图片入口歧义、完整句引用；原有 BOSS 隔离执行测试继续验证批量发送、去重与异常暂停。

最终检查：168 个测试文件、975 项测试通过；架构、TypeScript、生产构建通过。Lint 只有原有 `app/layout.tsx` 的 Fast Refresh 警告。`check:ego`、BOSS 隔离投递与预览回归通过。临时服务和自有任务空间已关闭。

## 代码位置

- ego 接入：`src/browser-agent/ego-cdp-connection.ts`、`ego-cdp-runtime.mjs`；检查脚本：`scripts/check-ego-browser.mjs`。
- 服务、浏览器读写：`scripts/boss-preview.mjs`、`src/browser-agent/boss-reader.ts`。
- 图片入口、收件人、回执：`src/browser-agent/boss-delivery-dom.ts`；草稿状态：`boss-composer.ts`、`src/domain/boss-draft.ts`。
- 引用与招呼语：`src/features/applications/website/lib/boss-preparation.ts`。
- 工作台：同模块 `BossBrowserConnection.tsx`、`BossDraftFill.tsx`、`BossWorkbench.tsx`、`lib/boss-client.ts`。
- 回归：`ego-cdp-connection.test.ts`、`boss-delivery-dom.test.ts`、`boss-composer.test.ts`、`boss-preparation.test.ts`、`boss-browser-connection.test.ts`、`scripts/check-boss-preview.mjs`。
- 入口与说明：`package.json`、`README.md`、`docs/boss-preview.md` 和本文件。

## 尚未验证

本轮没有点击真实招聘方的「立即沟通」或「发送」，没有向 BOSS 上传简历。因此真实新建沟通、文字发送、图片上传响应与新消息回执的完整闭环，以及结果写回投递记录，仍需要核对具体目标与内容后验证。上述通过项不能替代这一步，也不能据此宣称所有 BOSS 页面均适配。

