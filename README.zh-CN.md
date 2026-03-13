# Agent Trace

[English](./README.md)

一个桌面应用，用于拦截 Claude Code 的 API 流量，让你看到底层到底发生了什么 —— system prompt、工具调用、思考过程、完整对话流。

## 它做什么

Claude Code（Anthropic 的 CLI 工具）向 Claude API 发送请求。这个应用作为透明代理坐在中间，捕获每一个请求和响应，不修改任何内容。

```text
Claude Code  ──▶  代理 (localhost:8888)  ──▶  Anthropic API
                         │
                    捕获 & 展示
                         │
                    桌面应用 UI
```

## 能看到哪些数据

| 数据 | 来源 | 如何获取 |
|------|------|----------|
| **System Prompt** | `request.body.system` | 完整的系统提示词，包括 Claude Code 注入的指令、记忆、CLAUDE.md 内容 |
| **消息历史** | `request.body.messages` | 完整对话历史 —— 每条用户消息、助手回复、工具调用和结果 |
| **工具定义** | `request.body.tools` | Claude Code 注册的所有工具定义（Read、Write、Bash、Glob、Grep 等） |
| **思考过程** | `response` SSE 流 | 扩展思考块（`thinking_delta` 事件） |
| **工具调用** | `response` SSE 流 | 助手调用了哪些工具，用了什么参数 |
| **模型与元数据** | `request.body.model` + `request.body.metadata` | 使用的模型、会话标识、token 用量 |
| **请求头** | `request.headers` | API 版本、SDK 版本、启用的 beta 功能 |
| **耗时** | 代理层测量 | 请求时长、请求/响应大小 |

## 工作原理

**代理层** —— 一个运行在 `127.0.0.1:8888` 的 Node.js HTTP 服务器。接收 Claude Code 的请求，转发到 Anthropic API，并把响应流式传回。SSE（Server-Sent Events）响应在实时透传的同时，旁路收集用于存储。

**会话分组** —— Claude Code 在每个请求的 `metadata.user_id` 中嵌入了会话 UUID（`user_<hash>_account__session_<uuid>`）。代理提取这个 UUID 来将请求分组到对话中。对于非 Claude Code 客户端，降级到基于内容的匹配（system prompt 哈希 + 消息超集检测）。

**存储** —— 所有捕获的数据持久化到本地 SQLite 数据库（`~/Library/Application Support/agent-trace/history.db`）。超过 2000 条请求自动清理最旧的记录。

**UI** —— Electron + React 应用，采用类 ChatGPT 的对话视图。左侧边栏显示会话列表，右侧显示渲染后的对话流，可选的 Inspector 面板查看原始请求/响应数据。

## 安装使用

```bash
# 安装依赖
pnpm install

# 开发模式运行
pnpm dev

# 构建生产版本
pnpm build

# 本地生成 macOS 安装包
pnpm dist:mac
```

配置 Claude Code 使用代理：

```bash
# 将代理设置为 Claude Code 的 API 端点
export ANTHROPIC_BASE_URL=http://127.0.0.1:8888
```

然后正常使用 Claude Code，所有请求都会出现在应用中。

## macOS 发布

当前项目只支持这一条发布路径：

- 构建 macOS 安装包
- 通过 GitHub Actions 做签名和公证
- 直接发布到 GitHub Releases

### 本地发版命令

```bash
./scripts/release.sh 0.1.0
```

这个脚本会：

1. 检查工作区是否干净
2. 执行 `pnpm build`
3. 执行发布配置测试
4. 更新 `package.json` 版本号
5. 创建发版 commit
6. 创建 `v<version>` tag
7. 推送分支和 tag

当 tag 例如 `v0.1.0` 被推送后，会触发：

- `.github/workflows/release-macos.yml`

这个 workflow 会构建 macOS `arm64` 的 `.dmg` 和 `.zip`，在 secrets 齐全时完成签名和公证，然后上传到 GitHub Releases。

### 必填 GitHub Actions secrets

打开 GitHub 仓库后进入：

`Settings` -> `Secrets and variables` -> `Actions` -> `New repository secret`

添加下面这些 repository secrets：

- `CSC_LINK`
  - 导出的 Developer ID Application `.p12` 的 base64 内容
- `CSC_KEY_PASSWORD`
  - 这个 `.p12` 的密码
- `APPLE_API_KEY`
  - App Store Connect API Key 的 `.p8` 内容，支持原始 PEM 或 base64
- `APPLE_API_KEY_ID`
  - App Store Connect 的 Key ID
- `APPLE_API_ISSUER`
  - App Store Connect 的 Issuer ID

如果不填这些 secrets，本地仍然可以打包，但会跳过公证；GitHub Actions 也无法产出可正式公开分发的已公证版本。

## 技术栈

Electron 33 · React 19 · TypeScript · Zustand · shadcn/ui · better-sqlite3 · electron-vite
