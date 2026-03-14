# Agent Trace 多 Provider 冻结方案

> 状态：Frozen
>
> 设计前提：
> - 这是一次允许重构的 clean break
> - 不考虑历史兼容
> - 不做数据迁移
> - 以最佳实践、模块化、单一职责为第一优先级
> - 第一阶段先用 `anthropic` 跑通新骨架
> - 第二阶段接入 `codex` 作为第二个协议样本

## 1. 结论

这次不再在现有 Claude/Anthropic 结构上打补丁，而是直接重建为一个清晰的五层系统：

1. `Connection Profiles`
2. `Transport Layer`
3. `Provider Runtime`
4. `Storage + Query`
5. `Renderer View Models`

冻结后的关键决策如下：

- 一个 profile 只绑定一个 provider、一个 upstream、一个本地端口
- session 范围严格限定在单 profile 内，不存在 mixed provider session
- provider 私有协议只允许在主进程解析，renderer 不再解析任何 provider body
- 原始数据保留，标准化数据在捕获时生成
- session timeline 在读取时组装，不在 renderer 内临时拼
- 不引入 `request_events` 表，先不做事件溯源
- 不做单独的“命名清理阶段”，命名与架构重建一起完成

## 2. 设计原则

### 2.1 单一职责

- transport 只管收包和转发
- provider adapter 只管协议理解
- session matcher 只管会话归并
- storage 只管持久化和查询
- renderer 只管展示 view model

### 2.2 主进程拥有协议语义

这是冻结方案里的硬约束：

- 所有 provider-specific parse 都发生在 main process
- renderer 不再 import `parseClaude*`
- renderer 看到的不是 provider body，而是主进程输出的标准化结果

### 2.3 一次解析，多处复用

- 捕获时做 eager normalization
- 查询 session timeline 时做 lazy assembly

原因：

- 单条 exchange 的协议解析是 provider-specific 且确定的，应该只做一次
- 整个 session 的对话组装依赖多条 exchange，应在读取时完成

### 2.4 不为不存在的场景设计

本方案明确不支持：

- mixed provider session
- 多 provider 共用同一个 listener
- renderer 二次解析 provider 原始协议
- 事件溯源式逐分片存储

## 3. 核心对象

## 3.1 ProviderDefinition

产品级 provider 定义。

```ts
type ProviderId = "anthropic" | "codex" | "gemini";

interface ProviderDefinition {
  id: ProviderId;
  label: string;
  defaultUpstreamBaseUrl: string;
  protocolAdapterId: ProtocolAdapterId;
  setup: ProviderSetupDescriptor;
}

interface ProviderSetupDescriptor {
  envVarName?: string;
  exampleBaseUrl?: string;
  instructions: string[];
}
```

说明：

- `ProviderDefinition` 只存产品与配置层信息
- 协议能力不直接挂在 provider 上，而是通过 `protocolAdapterId` 关联
- 这样 `codex` 和其他 OpenAI 风格 provider 可以共享同一协议 adapter
- 当前 `codex` 的经验默认 upstream 应落在 `https://chatgpt.com/backend-api/codex`
- `codex` 客户端会先尝试 `GET /responses` WebSocket，再回退到 HTTP `POST /responses`

## 3.2 ProtocolAdapter

协议级 adapter。

```ts
type ProtocolAdapterId =
  | "anthropic-messages"
  | "openai-responses"
  | "google-generative-language";

interface ProtocolAdapter {
  id: ProtocolAdapterId;
  normalize(exchange: CapturedExchange): NormalizedExchange;
  buildInspector(
    exchange: CapturedExchange,
    normalized: NormalizedExchange,
  ): InspectorDocument;
  sessionMatcher: SessionMatcher;
  timelineAssembler: TimelineAssembler;
}
```

说明：

- provider 和 protocol 是两个维度
- 一个 protocol adapter 可以被多个 provider 复用
- renderer 不直接接触 adapter

## 3.3 ConnectionProfile

运行时连接配置。

```ts
interface ConnectionProfile {
  id: string;
  name: string;
  providerId: ProviderId;
  upstreamBaseUrl: string;
  localPort: number;
  enabled: boolean;
  autoStart: boolean;
}
```

冻结决策：

- 一个 profile = 一个 provider = 一个 upstream = 一个本地端口
- 不做单端口 path routing
- 本地端口由系统自动分配，用户可手工修改

默认策略：

- 从 `8888` 开始递增探测空闲端口
- 冲突时 UI 显示明确错误，并允许“重新分配端口”

## 3.4 CapturedExchange

这是整套系统最核心的 contract。

```ts
interface CapturedExchange {
  exchangeId: string;
  providerId: ProviderId;
  profileId: string;
  method: string;
  path: string;
  requestHeaders: Record<string, string>;
  requestBody: string | null;
  responseHeaders: Record<string, string> | null;
  responseBody: string | null;
  statusCode: number | null;
  startedAt: string;
  durationMs: number | null;
  requestSize: number;
  responseSize: number | null;
}
```

说明：

- 它取代当前 `RequestRecord` 作为 capture pipeline 的核心输入
- `RequestRecord` 这个名字在新架构里不再保留
- `CapturedExchange` 是 raw 层对象，不包含标准化语义

## 3.5 NormalizedExchange

主进程为 renderer 和 query 层产出的标准化结果。

```ts
interface NormalizedExchange {
  exchangeId: string;
  providerId: ProviderId;
  profileId: string;
  endpointKind: string;
  model: string | null;
  request: {
    instructions: NormalizedBlock[];
    tools: NormalizedTool[];
    inputMessages: NormalizedMessage[];
    meta: Record<string, unknown>;
  };
  response: {
    outputMessages: NormalizedMessage[];
    stopReason: string | null;
    usage: NormalizedUsage | null;
    error: NormalizedError | null;
    meta: Record<string, unknown>;
  };
}

type NormalizedBlock =
  | { type: "text"; text: string }
  | { type: "reasoning"; text: string }
  | { type: "unknown"; rawType: string; payload: unknown };

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

冻结决策：

- raw 与 normalized 同时存
- `InspectorDocument` 从 `NormalizedExchange` 抽出为 sibling artifact
- renderer 只渲染 normalized + inspector view model
- raw 仅用于 raw inspector tab

## 3.6 SessionMatcher

这是这次冻结版里对原方案修正最大的地方。

Session matching 明确是有状态的，不再假装它是一个纯函数。

```ts
interface SessionMatcher {
  extractHint(
    exchange: CapturedExchange,
    normalized: NormalizedExchange,
  ): string | null;

  match(
    exchange: CapturedExchange,
    normalized: NormalizedExchange,
    candidates: SessionCandidate[],
  ): SessionMatchResult | null;

  createState(
    exchange: CapturedExchange,
    normalized: NormalizedExchange,
  ): unknown;

  updateState(
    currentState: unknown,
    exchange: CapturedExchange,
    normalized: NormalizedExchange,
  ): unknown;

  deriveTitle(
    normalized: NormalizedExchange,
  ): string | null;
}

interface SessionCandidate {
  sessionId: string;
  providerId: ProviderId;
  profileId: string;
  updatedAt: string;
  matcherState: unknown;
}

interface SessionMatchResult {
  sessionId: string;
  nextState: unknown;
}
```

职责划分：

- `extractHint`：无状态提取
  - Anthropic 可读取 `metadata.user_id`
  - 其他 provider 可读取自己的稳定标识
- `match`：有状态匹配
  - 允许 provider 自定义 superset、增量匹配或时间窗逻辑
- `createState / updateState`：显式维护匹配状态

这样 session matching 才能真正承接异构协议。

## 3.7 TimelineAssembler

用于把一个 session 下的多条 exchange 组装成统一 timeline。

```ts
interface TimelineAssembler {
  build(exchanges: NormalizedExchange[]): SessionTimeline;
}

interface SessionTimeline {
  messages: NormalizedMessage[];
}
```

冻结决策：

- timeline 不在 renderer 里拼
- timeline 由主进程或 query 层读取时生成
- adapter 必须明确自己的 assembly mode

不同协议的建议实现：

- `anthropic-messages`
  - 允许使用 snapshot-style assembler
- `openai-responses`
  - 默认按 incremental-style assembler 设计
- `google-generative-language`
  - 按实际协议落 adapter，不做预设猜想

注意：

- 在第二个 provider 真正接入前，必须先抓一次真实请求样本
- 不允许只靠猜测写 `codex` / `gemini` assembler

## 3.8 InspectorDocument

provider-specific inspector 数据也在主进程生成。

```ts
interface InspectorDocument {
  sections: InspectorSection[];
}

type InspectorSection =
  | {
      kind: "overview";
      title: string;
      items: Array<{ label: string; value: string }>;
    }
  | {
      kind: "text";
      title: string;
      text: string;
    }
  | {
      kind: "tool-list";
      title: string;
      tools: NormalizedTool[];
    }
  | {
      kind: "json";
      title: string;
      json: unknown;
    }
  | {
      kind: "raw-request";
      title: string;
      content: string | null;
    }
  | {
      kind: "raw-response";
      title: string;
      content: string | null;
    };
```

冻结决策：

- renderer 不再拥有 provider adapter registry
- renderer 只负责渲染 `InspectorSection[]`
- provider-specific inspector 提取逻辑归 main process

## 4. 运行时架构

## 4.1 模块边界

```text
src/
  shared/
    contracts/
      provider.ts
      profile.ts
      capture.ts
      normalized.ts
      session.ts
      inspector.ts
      ipc.ts

  main/
    bootstrap/
      app-bootstrap.ts
    providers/
      provider-catalog.ts
      protocol-adapters/
        anthropic-messages/
        openai-responses/
        google-generative-language/
    transport/
      proxy-manager.ts
      listener.ts
      forwarder.ts
    pipeline/
      capture-pipeline.ts
      session-resolver.ts
    storage/
      sqlite.ts
      exchange-repository.ts
      session-repository.ts
      profile-store.ts
    queries/
      session-query-service.ts
      request-query-service.ts
    ipc/
      register-ipc.ts

  renderer/src/
    stores/
      app-store.ts
      profile-store.ts
      session-store.ts
      trace-store.ts
    features/
      setup/
      profiles/
      sessions/
      trace/
      inspector/
```

## 4.2 Capture Pipeline

冻结后的 capture pipeline：

1. `Listener` 接收本地 HTTP 请求
2. `Forwarder` 转发到 profile 的 upstream
3. 返回时构建 `CapturedExchange`
4. 根据 `profile.providerId` 找到 `ProviderDefinition`
5. 根据 `protocolAdapterId` 找到 `ProtocolAdapter`
6. 调 `normalize(exchange)` 得到 `NormalizedExchange`
7. 调 `SessionMatcher` 归并 session
8. 持久化 raw + normalized
9. 发出 UI 更新事件

注意：

- `Listener` 不做 provider parse
- `Forwarder` 不做 session 判断
- `SessionResolver` 不直接理解 provider body

## 5. 存储设计

## 5.1 配置存储

profiles 存在独立配置文件中，不放 SQLite。

原因：

- 这是应用配置，不是历史数据
- 配置读写频率低，JSON 更简单
- provider catalog 是代码内静态定义，不需要落库

建议文件：

- `userData/profiles.json`

## 5.2 SQLite Schema

不做迁移，直接使用新 schema。

### `sessions`

```sql
CREATE TABLE sessions (
  session_id TEXT PRIMARY KEY,
  provider_id TEXT NOT NULL,
  profile_id TEXT NOT NULL,
  external_hint TEXT,
  title TEXT NOT NULL,
  started_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  exchange_count INTEGER NOT NULL,
  matcher_state_json TEXT NOT NULL
);

CREATE INDEX idx_sessions_profile_updated
  ON sessions(profile_id, updated_at DESC);
```

### `exchanges`

```sql
CREATE TABLE exchanges (
  exchange_id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  provider_id TEXT NOT NULL,
  profile_id TEXT NOT NULL,
  method TEXT NOT NULL,
  path TEXT NOT NULL,
  started_at TEXT NOT NULL,
  duration_ms INTEGER,
  status_code INTEGER,
  request_size INTEGER NOT NULL,
  response_size INTEGER,
  raw_request_headers_json TEXT NOT NULL,
  raw_request_body TEXT,
  raw_response_headers_json TEXT,
  raw_response_body TEXT,
  normalized_json TEXT NOT NULL,
  inspector_json TEXT NOT NULL,
  FOREIGN KEY(session_id) REFERENCES sessions(session_id)
);

CREATE INDEX idx_exchanges_session_started
  ON exchanges(session_id, started_at ASC);

CREATE INDEX idx_exchanges_profile_started
  ON exchanges(profile_id, started_at DESC);
```

冻结决策：

- 不建 `request_events`
- 不拆 `providers` 表
- 不把 profile 放进 SQLite

## 6. IPC 与 Query 层

Renderer 不直接拿 raw rows，而是拿 query service 的输出。

推荐 IPC：

```ts
GET_PROFILES
SAVE_PROFILES
START_PROFILE
STOP_PROFILE
GET_PROFILE_STATUSES
LIST_SESSIONS
GET_SESSION_TRACE
GET_EXCHANGE_DETAIL
CLEAR_HISTORY
```

返回模型：

```ts
interface SessionListItemVM {
  sessionId: string;
  providerId: ProviderId;
  providerLabel: string;
  profileId: string;
  title: string;
  model: string | null;
  updatedAt: string;
  exchangeCount: number;
}

interface SessionTraceVM {
  sessionId: string;
  providerId: ProviderId;
  providerLabel: string;
  profileId: string;
  title: string;
  timeline: SessionTimeline;
  exchanges: ExchangeListItemVM[];
}

interface ExchangeDetailVM {
  exchangeId: string;
  providerId: ProviderId;
  providerLabel: string;
  method: string;
  path: string;
  statusCode: number | null;
  durationMs: number | null;
  model: string | null;
  inspector: InspectorDocument;
}
```

冻结决策：

- renderer 不再自己查 DB row 再做协议级转换
- query service 负责把 storage model 转成 view model

## 7. Renderer 设计

## 7.1 冻结原则

- renderer 无 provider parser
- renderer 无 session assembly 逻辑
- renderer 无 raw schema 依赖

renderer 只消费：

- `SessionListItemVM`
- `SessionTraceVM`
- `ExchangeDetailVM`

## 7.2 页面结构

### Setup / Profiles

Setup 页直接变为 profile 管理入口：

- 选择 provider
- 填写 profile 名称
- 填写 upstream base URL
- 自动分配本地端口
- 展示 provider 专属接入说明

### Workspace

左侧：

- sessions 列表
- provider filter
- profile filter
- 文本搜索

中间：

- session timeline

右侧：

- exchange inspector

## 7.3 Inspector

Inspector 固定按 section schema 渲染，不再硬编码 Claude tabs。

默认 section 集合：

- `overview`
- `text`
- `tool-list`
- `json`
- `raw-request`
- `raw-response`

未知 provider 的最低保障：

- 仍可展示 overview
- 仍可展示 raw request/response

## 8. Session 规则

冻结规则：

1. session 只在同一 `profileId` 内匹配
2. session 只在同一 `providerId` 内匹配
3. 不存在 mixed provider session
4. session 标题由 `SessionMatcher.deriveTitle()` 产出
5. session 匹配状态持久化到 `matcher_state_json`

这样可以避免当前 `SessionManager` 那种“全局通用逻辑里夹杂 Claude 特判”的结构。

## 9. 对 review 的采纳结果

这版冻结方案对外部 review 的采纳结论如下：

### 采纳

- `F1`
  - 采纳
  - Session matching 改成显式有状态接口
- `F2`
  - 采纳
  - 补全 `CapturedExchange`
- `F4`
  - 采纳
  - 移除 `request_events`
- `F5`
  - 采纳
  - renderer 不再保留 provider adapter
- `F6`
  - 采纳
  - timeline assembler 独立建模，并要求第二个 provider 上线前先做真实协议验证
- `F7`
  - 采纳
  - 不再有独立的 Phase 0
- `F8`
  - 采纳
  - 把 provider 与 protocol adapter 两个维度彻底拆开
- `F9`
  - 采纳
  - 明确禁止 mixed provider session

### 不再相关

- `F3`
  - 在本冻结方案中不再相关
  - 因为我们明确不做数据迁移，也不兼容旧 schema

## 10. 实施顺序

冻结后的实施顺序只有三步。

### Step 1：重建 shared contracts 与主进程骨架

交付物：

- `ProviderDefinition`
- `ProtocolAdapter`
- `ConnectionProfile`
- `CapturedExchange`
- `NormalizedExchange`
- `SessionMatcher`
- `TimelineAssembler`
- `ProxyManager`
- 新 storage schema

这一步结束后：

- 旧的 `parseClaude*`
- 旧的 `SessionManager`
- 旧的单 `targetUrl` 配置

都应该被删除或隔离。

### Step 2：用 `anthropic` 跑通新架构

交付物：

- `anthropic-messages` adapter
- anthropic session matcher
- anthropic timeline assembler
- renderer 改为完全消费 VM

验收标准：

- 整个 renderer 中不存在 provider body parser
- 整个主进程中不存在 renderer 专用组装逻辑

### Step 3：接入 `codex` 验证抽象

前置要求：

- 先抓真实样本
- 确认：
  - 请求是 full snapshot 还是 incremental
  - session hint 在哪里
  - stream 格式是什么

交付物：

- `openai-responses` adapter
- codex provider definition
- 第二组 contract tests

如果这一步接不进去，说明 Step 1 的抽象仍然有问题，必须回改骨架，而不是继续在边缘打补丁。

## 11. 测试策略

### 11.1 Adapter Contract Tests

每个 protocol adapter 必须有独立 fixture。

目录建议：

```text
tests/fixtures/protocols/
  anthropic-messages/
  openai-responses/
  google-generative-language/
```

验证：

- normalize
- extractHint
- match
- timeline assembly
- inspector build

### 11.2 Storage / Query Tests

验证：

- session 持久化
- matcher state 更新
- query service 输出 VM

### 11.3 Renderer VM Tests

验证：

- session list 渲染
- timeline 渲染
- inspector section 渲染

冻结要求：

- renderer 测试不再断言 `claude-opus-*`
- renderer 测试不再断言 Claude SSE 事件名
- 这些断言全部下沉到 adapter contract tests

## 12. 最终冻结决策清单

为了避免实现时再次摇摆，最终拍板如下：

1. 保留 raw，捕获时生成 normalized
2. session matching 明确是有状态的
3. session 只在单 profile 内匹配
4. renderer 不再做 provider parse
5. provider 与 protocol adapter 分离
6. 不建 `request_events`
7. 不做 mixed provider session
8. 不做历史兼容和数据迁移
9. 不做单独命名清理阶段
10. 第二个 provider 必须用真实流量验证抽象

## 13. 一句话版本

Agent Trace 的冻结版架构是：

一个 clean-break 的多 provider 抓取与分析系统，主进程独占协议理解和会话归并，renderer 只消费标准化 view model；以 `profile -> transport -> adapter -> session -> storage -> query -> UI` 为唯一主链路，用 `anthropic` 跑通骨架，再用 `codex` 验证抽象。
