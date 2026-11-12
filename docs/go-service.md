# Go 服务：文本快照

第二阶段打通「简历库 → Go → SQLite → 导入文本副本」。这是可选的本机功能，前端仍使用 IndexedDB；不会自动上传已有简历，也不会替换 Node 邮件执行器或官网扩展。

## 使用

需要 Go 1.27 或更高版本。先生成一个随机令牌，例如在 PowerShell 执行：

```powershell
[Convert]::ToHexString([Security.Cryptography.RandomNumberGenerator]::GetBytes(32))
```

将结果填入根目录 `.env.local` 的 `WORKBENCH_TOKEN`。这是服务端变量，不加 `NEXT_PUBLIC_` 前缀；文件已被 Git 忽略。Next.js 默认连接本机 3108 端口，更换端口时另设 `WORKBENCH_PORT`。

在另一个 PowerShell 终端设置相同的令牌，然后手动启动 Go 服务：

```powershell
$env:WORKBENCH_TOKEN = '填入同一串随机令牌'
cd server
go run ./cmd/workbench
```

启动或重启网页后，在简历库展开「本机文本备份」，选择简历并保存文本快照。刷新备份后，可选择「导入文本副本」重新打开正文。

**只保存正文和来源名称，不含 PDF、照片、检查结果、面试记录或版本关系。** 导入会创建新的文本副本，不覆盖原简历。保存的是当前已保存的检查正文（否则使用提取原文），尚未保存的修改草稿不包含在内。列表显示最近 100 份快照，暂不提供删除及自动同步。

默认数据库在根目录 `.server/workbench.db`，已忽略。`-db` 指定其他路径，`-listen 127.0.0.1:3109` 更换端口；相对路径按启动目录解析。`-owner` 用于选择本机数据命名空间，默认 `local`，不是登录账户。

## 接口与边界

| 接口 | 用途 |
| --- | --- |
| `GET /healthz` | 进程存活 |
| `GET /readyz` | 数据库能否读取预期迁移版本 |
| `POST /v1/resumes` | 创建不可变文本快照，返回 201 |
| `GET /v1/resumes` | 最近 100 份快照的元信息 |
| `GET /v1/resumes/{id}` | 读取快照正文 |

业务接口要求 `Authorization: Bearer <令牌>`，归属只取 Go 进程配置。浏览器不接触令牌，经 Next.js 的 `/api/local-resumes` 同源桥接；桥接只接受本机工作台地址、固定回环目标和同源写请求。Go 拒绝直接携带 Origin 的业务请求，两个服务的令牌不一致会在界面提示。

Go 仍只监听回环 IP。**这是单机功能，不是可部署的多用户鉴权方案。** 不应将桥接或 Go 服务反向代理给公网用户；多用户账户、会话与权限校验留待后续阶段实现。请求限制 2 MiB，正文限制 1 MiB；失败不会清除浏览器数据，保存操作不自动重试。

## 实现与验证

`cmd/workbench/` 管启动和退出，`internal/httpapi/` 管 HTTP 与认证，`internal/store/` 管存储。SQLite 使用 WAL、单写连接、只读连接池和外键约束。快照写入与归属创建在同一事务内；迁移失败回滚，遇到高于程序支持的数据库版本则拒绝启动。SQL 迁移嵌入程序；新增迁移时更新执行逻辑和版本，不能修改已应用的 SQL 来变更已有数据库。

```bash
cd server
go test ./...
go vet ./...
go build ./...
```

测试使用临时数据库和内存 HTTP 请求，覆盖重启读取、跨归属隔离、写失败回滚、认证与非法请求。前端另测桥接的来源限制、令牌保密、连接失败与导入不覆盖。CI 配置 Windows 和 Linux 检查。

安装 Node.js 与 Go 后，在仓库根目录运行 `npm run test:go-bridge`，会编译并启动临时 Go 进程，通过真实 HTTP 验证网页桥接、SQLite 保存、重启读回、认证失败与归属隔离，并模拟落库后响应中断。测试使用随机令牌、临时端口及数据库，结束后关闭进程并清理数据；不启动 Next.js 开发服务，也不访问真实简历。普通 `npm test` 不运行这组联调，CI 单独执行。

驱动使用 [modernc.org/sqlite](https://pkg.go.dev/modernc.org/sqlite)，不依赖 CGo；数据库放在本机磁盘，WAL 限制见 [SQLite 文档](https://www.sqlite.org/wal.html)。后续再实现完整附件备份、增量同步与后台任务队列。
