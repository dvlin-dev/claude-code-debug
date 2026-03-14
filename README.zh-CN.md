# Agent Trace

[English](./README.md)

一个桌面应用，用于抓取并分析多 provider 的 agent 流量。当前运行时基于 profile：每个 profile 绑定一个 provider、一个 upstream base URL 和一个本地监听端口。

## 它做什么

Agent Trace 在本地监听 agent 客户端和上游 provider 之间的流量。请求会被转发到上游，同时在主进程内完成协议标准化、会话归并、SQLite 持久化和 Inspector 构建，renderer 只消费标准化后的 view model。

```text
Agent Client  ──▶  Profile Listener (localhost:8888/8889/...)  ──▶  上游 Provider
                               │
                         捕获 + 标准化
                               │
                        SQLite + Query
                               │
                          Electron UI
```

## 能看到哪些数据

| 数据 | 来源 | 如何获取 |
|------|------|----------|
| **指令块** | 标准化 request | 从 provider 请求体里提取的 system/developer 指令 |
| **消息流** | 标准化 request/response | 用户消息、助手消息、reasoning、tool call、tool result |
| **工具定义** | request body | 工具列表和 JSON Schema |
| **请求头** | 原始 headers | provider 特有的路由信息和 session hint |
| **用量** | response 结束事件 | provider 暴露的 token 统计 |
| **耗时与大小** | listener + forwarder | duration、request size、response size |
| **原始载荷** | 原始 request/response | Inspector 中直接查看原始协议内容 |

## 工作原理

**Profiles** —— profile 定义 `providerId`、`upstreamBaseUrl`、`localPort` 和启动行为，多个 profile 可以并行运行。

**Transport Layer** —— 主进程独占本地监听和转发逻辑。每一次请求都会被捕获成一条完整的 raw exchange。

**Protocol Adapters** —— provider-specific 解析全部发生在 main process。adapter 负责 normalize、buildInspector、session matching 和 timeline assembling。

**Storage + Query** —— SQLite 同时存 raw exchange、normalized exchange 和 inspector document。renderer 读到的是 VM，不是数据库行。

**UI** —— renderer 不再解析任何 provider body，只渲染 `SessionListItemVM`、`SessionTraceVM` 和 `ExchangeDetailVM`。

## 当前 Provider 支持

- `anthropic`
  - 默认 upstream: `https://api.anthropic.com`
  - protocol adapter: `anthropic-messages`
- `codex`
  - 默认 upstream: `https://chatgpt.com/backend-api/codex`
  - protocol adapter: `openai-responses`
  - 当前 listener 走的是 Codex 的 HTTP fallback 路径，WebSocket 预探测后会回退到 `POST /responses`

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

先在应用里创建 profile 并启动 listener，再把客户端指向本地 listener。

Anthropic profile 例子，监听在 `127.0.0.1:8888`：

```bash
export ANTHROPIC_BASE_URL=http://127.0.0.1:8888
```

Codex profile 例子，监听在 `127.0.0.1:8889`：

```bash
export OPENAI_BASE_URL=http://127.0.0.1:8889
```

然后正常运行客户端，捕获到的 session 会按 provider/profile 出现在应用中。

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
