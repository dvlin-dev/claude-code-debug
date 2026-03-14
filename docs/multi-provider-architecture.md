# Agent Trace 多 Provider 改造方案

> 假设：第一阶段就把底层和 UI 设计成可承载异构协议 provider 的形态，但当前只强制实现 `anthropic` provider 可运行；`codex`、`gemini` 作为后续 provider 接入。

## 1. 背景

仓库已经从 `claude-code-debug` 改名为 `agent-trace`，但当前实现仍然围绕 Claude Code / Anthropic 单一路径展开：

- 代理层只有一个 `targetUrl`
- 会话归档优先依赖 Claude 的 `metadata.user_id`
- 渲染层只认识 Claude 请求体、Claude SSE 和 Claude 内容块
- 设置页、空状态、连接说明、README 文案都默认用户只会接 Claude Code

如果未来要接 `codex`、`gemini`，继续在现有结构上叠加 `if provider === ...` 会很快失控。现在需要先把“协议解析、会话归因、存储模型、UI 展示、配置方式”统一抽象出来，再逐个落 provider。

## 2. 目标与非目标

### 2.1 目标

1. 让主进程可以同时管理多个 provider 连接，而不是单一 `targetUrl`
2. 保留原始请求/响应，另外生成统一的标准化 trace 视图
3. 让 UI 先依赖标准化视图渲染，再按需回退到原始视图
4. 支持 provider 级别的过滤、标识、连接配置和状态展示
5. 保持 Anthropic 现有能力不回退，并保留向后兼容迁移路径

### 2.2 非目标

1. 第一阶段不要求一次性把 `codex`、`gemini` 全部实现完
2. 第一阶段不强求支持非 HTTP 传输，但底层要给 `websocket` / 其他流式协议预留扩展位
3. 第一阶段不做复杂鉴权托管，默认仍以“客户端透传鉴权头”为主

## 3. 现状分析

### 3.1 主进程与存储的单 provider 耦合

以下文件是当前最强的耦合点：

| 文件 | 当前行为 | 多 provider 风险 |
| --- | --- | --- |
| `src/main/index.ts` | 启动时只创建一个代理实例，默认回落到 `https://api.anthropic.com` | 无法同时管理多个 provider 连接 |
| `src/main/proxy/server.ts` | `createProxyServer` 只接收一个 `targetUrl`，只负责单上游转发 | 无法表达 provider 路由、profile、协议能力 |
| `src/main/store/settings-store.ts` | 设置只有 `targetUrl` 一个字段 | UI 和底层都无法保存多连接配置 |
| `src/shared/types.ts` | `AppSettings`、`SessionSummary`、`RequestRecord` 没有 provider/profile 维度 | 存储和 IPC 无法区分不同 provider 产生的 trace |
| `src/main/session/session-manager.ts` | 主策略是解析 Claude 的 `metadata.user_id` | 其他 provider 会直接退化为弱匹配 |
| `src/main/session/derive-session.ts` | 假定 `system`、`messages`、`thinking/tool_use/tool_result` 语义接近 Claude | 非 Claude 协议的会话归并准确率不可控 |
| `src/shared/extract-user-text.ts` | 直接处理 Claude 注入的 `<system-reminder>` | 逻辑应下沉为 provider 级标题提取策略 |
| `src/main/store/history-store.ts` / `src/main/store/database.ts` | 数据库存的是原始 request/response，只有 `model` 这个通用字段 | 缺少 provider、profile、协议类型、标准化摘要字段 |

### 3.2 渲染层与 UI 的单 provider 耦合

| 文件 | 当前行为 | 多 provider 风险 |
| --- | --- | --- |
| `src/renderer/src/lib/parse-claude-body.ts` | 只解析 Claude request/response 和 SSE | 其他 provider 无法进入对话视图 |
| `src/renderer/src/components/conversation-view.tsx` | 直接依赖 `parseClaudeRequest/Response`，并且只取最后一个 request 重建对话 | 无法适配不同协议，也无法支持更细粒度 timeline |
| `src/renderer/src/components/conversation-header.tsx` | 通过 Claude 解析结果拿 model/title | provider 标识、profile 标识、路由上下文都缺失 |
| `src/renderer/src/components/inspector-panel.tsx` | Tab 固定是 Claude 语义：System、Tools、Raw Req/Res | 缺少 provider 扩展区和标准化事件视角 |
| `src/renderer/src/components/setup-form.tsx` / `settings-dialog.tsx` | UI 只允许填写 `TARGET_URL` | 用户无法配置多个 provider profile |
| `src/renderer/src/components/proxy-instructions.tsx` / `empty-state.tsx` / `setup-page.tsx` | 文案直接写死 Claude Code | 产品定位和 UI 认知错误 |
| `tests/renderer/**` | 测试 fixture 都是 Claude body | 无法保护新抽象层 |

### 3.3 当前结构的根本问题

当前仓库把以下四件事混在了一起：

1. “如何监听并转发 HTTP 流量”
2. “如何识别这是哪个 provider”
3. “如何把 provider 私有协议解析成统一 trace”
4. “如何把统一 trace 展示成 UI”

要支持多 provider，必须先把这四层拆开。

## 4. 方案比较

### 方案 A：在现有结构上补薄适配层

做法：

- `targetUrl` 改成 `providers[]`
- `parse-claude-body.ts` 改成 `switch(providerId)`
- `session-manager.ts` 里继续塞各 provider 特判

优点：

- 改动小，短期上线快

缺点：

- 代理、会话、解析、UI 继续互相耦合
- 第二个 provider 勉强可做，第三个开始维护成本会明显失控
- 测试会变成大量条件分支快照

结论：

- 不推荐。只能当临时补丁，不能作为未来几年架构基础。

### 方案 B：Provider Registry + 标准化 Trace 模型 + 多 Listener Profile

做法：

- 引入 provider 注册表
- 引入标准化 trace 模型，原始数据与标准化数据并存
- 配置层改为多个 `ConnectionProfile`
- 主进程从“一个 proxy”升级为“一个 proxy manager + 多 listener”
- UI 只依赖标准化 trace，provider 特定内容通过扩展面板展示

优点：

- 能承载异构协议
- Anthropic 可以作为第一个 adapter 平滑落地
- 第二、第三个 provider 的接入成本稳定
- UI 可以稳定演进，而不是每加一个 provider 重写一遍

缺点：

- 前期抽象和迁移成本高于方案 A
- 需要补数据库迁移、fixture 和 adapter contract tests

结论：

- 推荐方案。当前仓库规模适合在这个阶段完成抽象升级。

### 方案 C：事件溯源式重写

做法：

- 把捕获链路重写成完整 ingestion pipeline
- 所有请求、流式分片、标准化事件都写 event store
- UI 全部从 projection 读取

优点：

- 长期能力最强

缺点：

- 对当前仓库过重
- 会推迟实际 provider 接入

结论：

- 不适合现在。可以把部分思想吸收到方案 B 里，但不应整体重写。

## 5. 推荐架构

推荐采用方案 B，并把抽象拆成六层。

### 5.1 核心概念

#### ConnectionProfile

表示一个可以被启动、停止和配置的本地监听入口。

建议字段：

```ts
type ProviderId = "anthropic" | "codex" | "gemini" | string;

interface ConnectionProfile {
  id: string;
  providerId: ProviderId;
  name: string;
  upstreamBaseUrl: string;
  localPort: number;
  enabled: boolean;
  transport: "http";
  authMode: "passthrough";
}
```

说明：

- 推荐一开始使用“每个 profile 一个本地端口”的模式，而不是单端口 path 路由
- 原因是对 CLI 最稳妥，保留原始 path，不依赖不同客户端是否支持 base path
- 例如：
  - `anthropic-dev -> 127.0.0.1:8888`
  - `codex-dev -> 127.0.0.1:8889`
  - `gemini-dev -> 127.0.0.1:8890`

#### ProviderDefinition

表示一个 provider 的产品与 UI 层定义。

```ts
interface ProviderDefinition {
  id: ProviderId;
  label: string;
  family: "anthropic" | "openai" | "google" | "custom";
  defaultUpstreamBaseUrl: string;
  setupHints: string[];
  codec: ProtocolCodec;
  sessionStrategy: SessionStrategy;
}
```

#### ProtocolCodec

负责把 provider 私有协议转换为统一 trace 结构。

```ts
interface ProtocolCodec {
  parseRequest(body: string | null, headers: Record<string, string>): NormalizedRequest | null;
  parseResponse(body: string | null, headers: Record<string, string>): NormalizedResponse | null;
  parseStream?(body: string | null, headers: Record<string, string>): NormalizedEvent[];
}
```

#### SessionStrategy

负责会话归并，不再由全局 `SessionManager` 硬编码 Claude 逻辑。

```ts
interface SessionStrategy {
  deriveIdentity(input: CapturedExchange): SessionIdentity | null;
  deriveTitle(input: CapturedExchange): string | null;
}
```

#### NormalizedTrace

统一给 UI 和搜索层使用的结构。

```ts
interface NormalizedMessage {
  role: "system" | "user" | "assistant" | "tool" | "unknown";
  blocks: Array<
    | { type: "text"; text: string }
    | { type: "reasoning"; text: string }
    | { type: "tool-call"; name: string; input: unknown; callId?: string }
    | { type: "tool-result"; content: unknown; callId?: string; isError?: boolean }
    | { type: "unknown"; rawType: string; payload: unknown }
  >;
}
```

关键点：

- UI 只消费 `NormalizedMessage`
- 原始 request/response 永远保留，作为 inspector 和问题排查的回退面

### 5.2 主进程改造

#### 5.2.1 从单一 ProxyServer 升级为 ProxyManager

当前：

- `src/main/index.ts` 只维护一个 `proxy`
- `toggleListening` 只有“开/关一个代理”两态

建议：

- 引入 `ProxyManager`
- 按 profile 维护多个 `ProxyServer` 实例
- `toggleListening` 升级成：
  - 全局开关全部启停
  - 可选的单 profile 启停

建议新增目录：

```text
src/main/providers/
  registry.ts
  definitions/
    anthropic.ts
    codex.ts
    gemini.ts
  codecs/
    anthropic.ts
    openai.ts
    gemini.ts
  sessions/
    anthropic-session-strategy.ts
    generic-session-strategy.ts
  proxy-manager.ts
  capture-pipeline.ts
```

#### 5.2.2 捕获链路拆分

当前 `src/main/proxy/server.ts` 同时负责：

- 接收请求
- 转发请求
- 判断 SSE
- 汇总 body
- 生成 `RequestRecord`

建议拆成：

1. `proxy-server.ts`
   - 只负责监听 socket / HTTP request lifecycle
2. `forwarder.ts`
   - 只负责上游转发
3. `capture-pipeline.ts`
   - 组装 raw exchange
   - 调 provider codec
   - 调 session strategy
   - 写存储
   - 广播 IPC

这样新增 provider 时，只需扩展 registry / codec / session strategy，不需要碰转发层。

#### 5.2.3 SessionManager 重构

当前 `SessionManager` 最大问题不是“代码写得不够通用”，而是“职责放错层了”。

建议变成：

- `SessionResolver` 作为通用 orchestrator
- provider-specific 身份提取由 `SessionStrategy` 提供
- 内置一个 `generic-session-strategy`
  - 可使用 `profileId + remotePort + path + message-growth + time-window` 组合信号兜底

Anthropic provider 仍然可以保留当前 `metadata.user_id` 快路径，但它应该只是 adapter 的一个实现，不应该继续成为全局默认。

### 5.3 数据模型改造

#### 5.3.1 设置模型

当前：

```ts
interface AppSettings {
  targetUrl: string;
}
```

建议：

```ts
interface AppSettings {
  profiles: ConnectionProfile[];
  defaultProfileId: string | null;
  autoStartProfiles: boolean;
}
```

兼容策略：

- 旧 `targetUrl` 启动后自动迁移成一个 `anthropic` profile
- 继续沿用 `8888` 作为第一个 Anthropic profile 的默认端口

#### 5.3.2 SQLite 模型

当前表结构没有 provider/profile 维度，也没有标准化视图。

建议至少做以下扩展：

##### `sessions`

新增字段：

- `provider_id TEXT NOT NULL`
- `profile_id TEXT`
- `client_family TEXT`
- `normalized_title TEXT`
- `meta_json TEXT`

##### `requests`

新增字段：

- `provider_id TEXT NOT NULL`
- `profile_id TEXT`
- `stream_kind TEXT`
- `endpoint_kind TEXT`
- `normalized_request_json TEXT`
- `normalized_response_json TEXT`
- `error_text TEXT`

##### `request_events`（新增）

如果只想看“最终结果”，这个表不是必须；但如果未来要真正支持跨 provider 的流式对话时间线、reasoning、tool event 对比，建议现在就建。

建议字段：

- `event_id TEXT PRIMARY KEY`
- `request_id TEXT NOT NULL`
- `provider_id TEXT NOT NULL`
- `sequence INTEGER NOT NULL`
- `phase TEXT NOT NULL`
- `event_type TEXT NOT NULL`
- `role TEXT`
- `block_type TEXT`
- `payload_json TEXT NOT NULL`
- `created_at TEXT NOT NULL`

好处：

- 不再依赖“用最后一条 request 重建整段对话”
- 不同 provider 的流式分片都能统一回放
- Inspector 可以从“静态原始 JSON”升级成“时间线 + 原始数据 + 标准化数据”三视角

### 5.4 IPC 与共享类型

`src/shared/types.ts` 目前太薄，几乎还是单 provider 存储 DTO。

建议拆成：

```text
src/shared/
  app-settings.ts
  provider-types.ts
  trace-types.ts
  ipc-channels.ts
```

新的 IPC 需要覆盖：

- `GET_PROFILES`
- `SAVE_PROFILES`
- `START_PROFILE_LISTENER`
- `STOP_PROFILE_LISTENER`
- `GET_PROFILE_STATUSES`
- `LIST_SESSIONS` 支持 provider/profile/filter 参数
- `GET_SESSION_TRACE`
- `GET_REQUEST_EVENTS`

设计原则：

- Renderer 不应自己拼 provider 逻辑
- Main 进程输出给 renderer 的应该已经是“可渲染 trace”

### 5.5 UI 改造

建议把 renderer 明确拆成四层：

1. `raw capture contract`
   - 仍然接收主进程返回的原始 session/request 数据
   - 但必须显式带 `providerId`、`providerLabel`、`profileId`
2. `provider adapter`
   - 负责 detect、parse、assemble conversation、build inspector sections
   - Claude 解析器退化成 registry 中的一个 adapter
3. `view model`
   - store 只暴露 `ConversationTimeline`、`SessionListItemVM`、`InspectorSection[]`
4. `presentation`
   - 组件只消费统一 view model，不直接理解 provider 私有协议

#### 5.5.1 Setup / Settings

当前 Setup 页只做一件事：填写 `TARGET_URL`。

建议改成“连接配置向导”：

1. 选择 provider 类型
2. 填写 profile 名称
3. 填写 upstream base URL
4. 自动分配或手工指定本地端口
5. 展示对应 CLI 的接入说明

Settings 弹窗也应从单字段表单升级为：

- Profiles 列表
- Add profile
- Edit profile
- Enable / disable
- Start / stop
- Copy local base URL

#### 5.5.2 Workspace 信息架构

建议把 Workspace 顶层信息结构改成：

- 左侧：Session 列表
  - 增加 provider badge
  - 支持 `All providers` / 单 provider / 单 profile 过滤
- 中间：Conversation / Timeline
  - 基于 `NormalizedMessage[]`
- 右侧：Inspector
  - Overview
  - Instructions / System
  - Tools
  - Events
  - Raw Request
  - Raw Response
  - Provider Extras

#### 5.5.3 ConversationView 重构

当前 `src/renderer/src/components/conversation-view.tsx` 的核心问题有两个：

1. 直接调用 `parseClaudeRequest/Response`
2. 只看最后一条 request

建议重构成：

- `trace-store` 负责拉取一个 session 的标准化 trace
- `conversation-assembler` 负责基于 `requests[]` 组装 timeline
- `conversation-view.tsx` 只做展示
- provider 差异通过 block type 和 extras 体现，而不是在组件里写 provider 分支

关键要求：

- renderer 不再把“最后一个 request 等于全量会话快照”当成前提
- 即使某个 provider 只返回增量消息，也能通过 assembler 正常组装

#### 5.5.4 命名与文案

以下文案需要系统性去 Claude 化：

- Setup 页副标题
- Empty state
- Proxy instructions
- 测试描述
- README / README.zh-CN
- `parse-claude-body.ts`、`extract-user-text.ts` 这类具名文件

建议的产品表达：

- “Connect Provider”
- “Capture agent traffic”
- “Session”
- “Trace”
- “Provider”
- “Connection Profile”

而不是继续把 Claude 作为默认术语写进产品骨架。

#### 5.5.5 Inspector 与降级策略

当前 Inspector 固定是 Claude 形状的 tab，这在多 provider 下会成为持续负担。

建议改成 schema-driven sections：

- `Overview`
- `Instructions/Input Context`
- `Tools`
- `Events`
- `Raw Request`
- `Raw Response`
- `Provider Extras`

其中：

- section 是否展示由 provider adapter 决定
- 未知 provider 至少要稳定降级到 `Overview + Raw Request + Raw Response`
- 如果一个 session 内混用了多个 provider，session/header 应显示 `Mixed`，request 级列表必须展示各自 provider

### 5.6 测试策略

当前测试的主要问题不是覆盖率，而是 fixture 单一。

建议分四层：

#### 1. Provider codec contract tests

每个 provider 一组标准 fixture：

```text
tests/fixtures/providers/
  anthropic/
  codex/
  gemini/
```

验证：

- request parse
- response parse
- stream parse
- title/session identity derive

#### 2. Store / migration tests

验证：

- `targetUrl -> profiles[]` 迁移
- 旧 SQLite 表升级
- 历史 Anthropic 数据自动补 `provider_id`

#### 3. Renderer trace rendering tests

验证：

- 同一套 `NormalizedTrace` 能被统一渲染
- provider badge / filters / inspector tabs 正常工作
- fallback raw rendering 不崩

#### 4. E2E smoke tests

至少覆盖：

- 首次运行创建 Anthropic profile
- 添加第二个 provider profile
- 启动多个 listener
- 不同 provider 请求进入同一 UI，但以 provider 维度可过滤

## 6. 建议的目录重组

不建议继续把 provider 逻辑零散塞在 `main/session` 和 `renderer/lib`。

建议重组为：

```text
src/
  shared/
    provider-types.ts
    trace-types.ts
    app-settings.ts
    ipc-channels.ts

  main/
    providers/
      registry.ts
      definitions/
      codecs/
      sessions/
      proxy-manager.ts
      capture-pipeline.ts
    proxy/
      proxy-server.ts
      forwarder.ts
      stream-collector.ts
    store/
      database.ts
      migrations/
      history-store.ts
      settings-store.ts
    ipc/
      register-ipc.ts

  renderer/src/
    features/
      providers/
      traces/
      inspector/
    stores/
      app-store.ts
      profile-store.ts
      trace-store.ts
```

目录目标很明确：

- provider 逻辑集中
- trace 逻辑集中
- UI 组件不再直接理解某个 provider 私有协议

## 7. 分阶段迁移计划

### 阶段 0：清理命名和文案

范围：

- README / README.zh-CN
- Setup / Empty / Instructions / Settings 文案
- 文件命名中显式的 `claude` 标识

目标：

- 先把产品心智从“Claude 调试器”改成“多 provider trace 工具”

### 阶段 1：引入 Profile 与 Provider Registry

范围：

- `AppSettings` 升级到 `profiles[]`
- `ProxyManager` 落地
- Anthropic provider 第一个 adapter 落地
- 历史数据迁移

目标：

- 不改 UI 主体，也能让底层先脱离单 `targetUrl`

### 阶段 2：引入 NormalizedTrace

范围：

- `parse-claude-body.ts` 拆成 provider codec
- `ConversationView` 改读标准化 trace
- Inspector 新增标准化视图

目标：

- 渲染层不再依赖 Claude 私有结构

### 阶段 3：接入第二个 Provider 作为验收样本

建议优先 `codex` 或兼容 OpenAI Responses 的 provider。

目标：

- 验证架构是否真的能承接第二个协议家族
- 暴露 registry、session strategy、UI extensibility 的真实问题

### 阶段 4：强化搜索、过滤和事件时间线

范围：

- provider/profile filter
- event timeline
- request diff / trace compare

目标：

- 把“能接多 provider”升级成“能高效分析多 provider”

## 8. 优先级建议

如果要控制风险，我建议按下面顺序推进：

1. 先做 `profiles[] + ProxyManager + ProviderRegistry`
2. 再做 `NormalizedTrace` 与 UI 解耦
3. 再接入第二个 provider
4. 最后补事件时间线和高级分析能力

原因：

- 先改配置与路由，能最快把单点瓶颈拆掉
- 先用 Anthropic adapter 跑通新骨架，能减少大改同时引入多个变量
- 第二个 provider 应该是对架构的验收，不应该和架构抽象在同一波里一起赌

## 9. 主要风险

1. 不同 provider 的流式协议差异可能比当前预估更大
2. 部分 CLI 可能不支持自定义 base path，所以我更推荐“每 profile 一个本地端口”
3. 如果继续让 renderer 直接解析 raw body，后续抽象会再次塌回 provider 分支地狱
4. 如果不做历史数据迁移，现有用户升级后会出现“旧 trace 没 provider 维度”的混乱状态
5. 如果不引入标准 fixture，后续每加一个 provider 都会靠手工回归，成本会持续上升

## 10. 我建议优先改的文件

第一批应该优先动这些位置：

- `src/shared/types.ts`
- `src/main/store/settings-store.ts`
- `src/main/index.ts`
- `src/main/ipc/register-ipc.ts`
- `src/main/proxy/server.ts`
- `src/main/session/session-manager.ts`
- `src/main/session/derive-session.ts`
- `src/renderer/src/lib/parse-claude-body.ts`
- `src/renderer/src/components/conversation-view.tsx`
- `src/renderer/src/components/inspector-panel.tsx`
- `src/renderer/src/components/setup-form.tsx`
- `src/renderer/src/components/settings-dialog.tsx`

## 11. 结论

这个仓库现在最需要的不是“再加一个 provider 分支”，而是把“监听转发、provider 协议、会话归因、标准化 trace、UI 展示”拆成稳定边界。

推荐路线是：

- 用 `ConnectionProfile` 替代单一 `targetUrl`
- 用 `ProxyManager` 替代单一 `ProxyServer`
- 用 `ProviderRegistry + ProtocolCodec + SessionStrategy` 承接异构协议
- 用 `NormalizedTrace` 作为 renderer 的唯一主输入
- Anthropic 先迁进新骨架，再以 `codex` 或 `gemini` 作为第二个 provider 做验收

这样改完，Agent Trace 才真正从“Claude Code 抓包器”升级成“多 provider agent trace 平台”。
