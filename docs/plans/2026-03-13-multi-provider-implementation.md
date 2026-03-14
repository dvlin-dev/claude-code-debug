# Multi-Provider Architecture Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 将 Agent Trace 从单一 Claude/Anthropic 抓包器重构为 clean-break 的多 provider trace 平台，主进程独占协议解析、Inspector 构建与会话归并，renderer 只消费标准化 view model。

**Architecture:** 实施顺序采用 contract-first + additive bridge。先完整定义 shared contracts，再并行搭建新 transport、provider runtime、storage、query、IPC 与 renderer；旧单 provider runtime 在 cutover 前保持可运行，仅作为临时桥接。捕获阶段生成 `NormalizedExchange`，同时由 `ProtocolAdapter.buildInspector()` 生成 `InspectorDocument` 并单独存储；session timeline 在 query 阶段由 `TimelineAssembler` 组装。

**Tech Stack:** Electron 33, React 19, TypeScript 5, Zustand 5, better-sqlite3, Vitest, Playwright

**Execution Rules:** 实施时必须遵循 `@superpowers:test-driven-development` 和 `@superpowers:verification-before-completion`。Tasks 1-10 是 additive 阶段：允许旧运行时与新运行时并存，但每个任务结束后应用必须仍可运行。Task 11 是唯一 destructive cleanup checkpoint；只有在 Task 10 完成并验证通过后，才允许删除旧骨架。

**Refinement To Frozen Doc:** 本 plan 将 `InspectorDocument` 从 `NormalizedExchange` 中抽出为 sibling artifact，由 `ProtocolAdapter.buildInspector()` 显式生成，并以 `inspector_json` 独立存储。这是为了让 query/inspector 读取更直接，也使 `normalize()` 和展示派生逻辑边界更清楚。最终文档在 Task 14 同步冻结方案。

---

### Task 1: 完整建立 Shared Contracts、View Models 与 Push Events

**Status:** Completed on 2026-03-13

**Files:**
- Create: `src/shared/contracts/provider.ts`
- Create: `src/shared/contracts/profile.ts`
- Create: `src/shared/contracts/capture.ts`
- Create: `src/shared/contracts/normalized.ts`
- Create: `src/shared/contracts/inspector.ts`
- Create: `src/shared/contracts/session.ts`
- Create: `src/shared/contracts/protocol.ts`
- Create: `src/shared/contracts/view-models.ts`
- Create: `src/shared/contracts/events.ts`
- Create: `src/shared/contracts/index.ts`
- Modify: `tests/harness/structural.test.ts`
- Test: `tests/harness/structural.test.ts`

**Step 1: 写失败测试**

在 `tests/harness/structural.test.ts` 中把 required files 扩成完整 contracts 集合：

```ts
const requiredFiles = [
  "src/shared/contracts/provider.ts",
  "src/shared/contracts/profile.ts",
  "src/shared/contracts/capture.ts",
  "src/shared/contracts/normalized.ts",
  "src/shared/contracts/inspector.ts",
  "src/shared/contracts/session.ts",
  "src/shared/contracts/protocol.ts",
  "src/shared/contracts/view-models.ts",
  "src/shared/contracts/events.ts",
  "src/shared/contracts/index.ts",
];
```

**Step 2: 运行测试确认失败**

Run: `pnpm exec vitest run tests/harness/structural.test.ts`

Expected: FAIL，提示 contracts 文件缺失。

**Step 3: 写完整 contract**

必须在这一任务里一次性落完以下类型，不允许“后续 task 再补字段”：

```ts
// src/shared/contracts/provider.ts
export type ProviderId = "anthropic" | "codex" | "gemini";
export type ProtocolAdapterId =
  | "anthropic-messages"
  | "openai-responses"
  | "google-generative-language";

export interface ProviderSetupDescriptor {
  envVarName?: string;
  exampleBaseUrl?: string;
  instructions: string[];
}

export interface ProviderDefinition {
  id: ProviderId;
  label: string;
  defaultUpstreamBaseUrl: string;
  protocolAdapterId: ProtocolAdapterId;
  setup: ProviderSetupDescriptor;
}
```

```ts
// src/shared/contracts/profile.ts
import type { ProviderId } from "./provider";

export interface ConnectionProfile {
  id: string;
  name: string;
  providerId: ProviderId;
  upstreamBaseUrl: string;
  localPort: number;
  enabled: boolean;
  autoStart: boolean;
}
```

```ts
// src/shared/contracts/capture.ts
import type { ProviderId } from "./provider";

export interface CapturedExchange {
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

```ts
// src/shared/contracts/normalized.ts
import type { ProviderId } from "./provider";

export interface NormalizedTool {
  name: string;
  description: string | null;
  inputSchema: unknown;
}

export interface NormalizedUsage {
  inputTokens: number | null;
  outputTokens: number | null;
  reasoningTokens: number | null;
}

export interface NormalizedError {
  code: string | null;
  message: string;
}

export type NormalizedBlock =
  | { type: "text"; text: string }
  | { type: "reasoning"; text: string }
  | { type: "unknown"; rawType: string; payload: unknown };

export type NormalizedMessageBlock =
  | { type: "text"; text: string }
  | { type: "reasoning"; text: string }
  | { type: "tool-call"; name: string; input: unknown; callId?: string }
  | { type: "tool-result"; content: unknown; callId?: string; isError?: boolean }
  | { type: "unknown"; rawType: string; payload: unknown };

export interface NormalizedMessage {
  role: "system" | "user" | "assistant" | "tool" | "unknown";
  blocks: NormalizedMessageBlock[];
}

export interface NormalizedExchange {
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
```

```ts
// src/shared/contracts/inspector.ts
import type { NormalizedTool } from "./normalized";

export interface InspectorDocument {
  sections: InspectorSection[];
}

export type InspectorSection =
  | { kind: "overview"; title: string; items: Array<{ label: string; value: string }> }
  | { kind: "text"; title: string; text: string }
  | { kind: "tool-list"; title: string; tools: NormalizedTool[] }
  | { kind: "json"; title: string; json: unknown }
  | { kind: "raw-request"; title: string; content: string | null }
  | { kind: "raw-response"; title: string; content: string | null };
```

```ts
// src/shared/contracts/session.ts
import type { CapturedExchange } from "./capture";
import type { NormalizedExchange, NormalizedMessage } from "./normalized";
import type { ProviderId } from "./provider";

export interface SessionCandidate {
  sessionId: string;
  providerId: ProviderId;
  profileId: string;
  updatedAt: string;
  matcherState: unknown;
}

export interface SessionMatchResult {
  sessionId: string;
  nextState: unknown;
}

export interface SessionTimeline {
  messages: NormalizedMessage[];
}

export interface TimelineAssembler {
  build(exchanges: NormalizedExchange[]): SessionTimeline;
}

export interface SessionMatcher {
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
  deriveTitle(normalized: NormalizedExchange): string | null;
}
```

```ts
// src/shared/contracts/protocol.ts
import type { CapturedExchange } from "./capture";
import type { InspectorDocument } from "./inspector";
import type { NormalizedExchange } from "./normalized";
import type { ProtocolAdapterId } from "./provider";
import type { SessionMatcher, TimelineAssembler } from "./session";

export interface ProtocolAdapter {
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

```ts
// src/shared/contracts/view-models.ts
import type { InspectorDocument } from "./inspector";
import type { ProviderId } from "./provider";
import type { SessionTimeline } from "./session";

export interface SessionListItemVM {
  sessionId: string;
  providerId: ProviderId;
  providerLabel: string;
  profileId: string;
  title: string;
  model: string | null;
  updatedAt: string;
  exchangeCount: number;
}

export interface ExchangeListItemVM {
  exchangeId: string;
  providerId: ProviderId;
  providerLabel: string;
  method: string;
  path: string;
  statusCode: number | null;
  durationMs: number | null;
  model: string | null;
}

export interface SessionTraceVM {
  sessionId: string;
  providerId: ProviderId;
  providerLabel: string;
  profileId: string;
  title: string;
  timeline: SessionTimeline;
  exchanges: ExchangeListItemVM[];
}

export interface ExchangeDetailVM extends ExchangeListItemVM {
  inspector: InspectorDocument;
}
```

```ts
// src/shared/contracts/events.ts
import type { SessionListItemVM } from "./view-models";

export interface TraceCapturedEvent {
  sessions: SessionListItemVM[];
  updatedSessionId: string | null;
  updatedExchangeId: string | null;
  profileId: string;
  providerId: string;
}

export interface ProfileStatusChangedEvent {
  statuses: Record<string, { isRunning: boolean; port: number | null }>;
}
```

**Step 4: 运行测试确认通过**

Run: `pnpm exec vitest run tests/harness/structural.test.ts`

Expected: PASS。

**Step 5: Commit**

```bash
git add tests/harness/structural.test.ts src/shared/contracts
git commit -m "refactor: add complete multi-provider shared contracts"
```

### Task 2: 引入 Provider Catalog 与 Profile Store，保留旧 defaults 作为桥接

**Status:** Completed on 2026-03-13

**Files:**
- Create: `src/main/providers/provider-catalog.ts`
- Create: `src/main/providers/definitions/anthropic.ts`
- Create: `src/main/providers/definitions/codex.ts`
- Create: `src/main/providers/definitions/gemini.ts`
- Create: `src/main/storage/profile-store.ts`
- Create: `tests/unit/providers/provider-catalog.test.ts`
- Create: `tests/unit/storage/profile-store.test.ts`
- Modify: `src/shared/defaults.ts`
- Test: `tests/unit/providers/provider-catalog.test.ts`
- Test: `tests/unit/storage/profile-store.test.ts`

**Step 1: 写失败测试**

```ts
it("returns anthropic, codex, gemini definitions", () => {
  const catalog = createProviderCatalog();
  expect(catalog.get("anthropic")?.protocolAdapterId).toBe("anthropic-messages");
  expect(catalog.get("codex")?.protocolAdapterId).toBe("openai-responses");
  expect(catalog.get("gemini")?.protocolAdapterId).toBe("google-generative-language");
});
```

```ts
it("allocates the next available local port starting at 8888", () => {
  const port = allocateLocalPort(new Set([8888, 8889]));
  expect(port).toBe(8890);
});
```

**Step 2: 运行测试确认失败**

Run: `pnpm exec vitest run tests/unit/providers/provider-catalog.test.ts tests/unit/storage/profile-store.test.ts`

Expected: FAIL。

**Step 3: 写最小实现**

约束：

- `src/shared/defaults.ts` 只新增 profile-aware 默认值
- 此任务不删除旧 `targetUrl` 默认值
- `targetUrl` 删除统一推迟到 Task 11

最小接口：

```ts
export const DEFAULT_PROFILE_PORT_START = 8888;
export const DEFAULT_PROVIDER_ID = "anthropic";
```

```ts
export function allocateLocalPort(usedPorts: Set<number>, start = 8888): number {
  let next = start;
  while (usedPorts.has(next)) next += 1;
  return next;
}
```

**Step 4: 运行测试确认通过**

Run: `pnpm exec vitest run tests/unit/providers/provider-catalog.test.ts tests/unit/storage/profile-store.test.ts`

Expected: PASS。

**Step 5: Commit**

```bash
git add src/main/providers src/main/storage/profile-store.ts src/shared/defaults.ts tests/unit/providers/provider-catalog.test.ts tests/unit/storage/profile-store.test.ts
git commit -m "refactor: add provider catalog and profile store"
```

### Task 3: 建立新 Transport Layer 与 Proxy Manager

**Status:** Completed on 2026-03-13

**Files:**
- Create: `src/main/transport/listener.ts`
- Create: `src/main/transport/forwarder.ts`
- Create: `src/main/transport/stream-buffer.ts`
- Create: `src/main/transport/proxy-manager.ts`
- Create: `tests/unit/transport/forwarder.test.ts`
- Create: `tests/unit/transport/proxy-manager.test.ts`
- Test: `tests/unit/transport/forwarder.test.ts`
- Test: `tests/unit/transport/proxy-manager.test.ts`

**Step 1: 写失败测试**

```ts
it("forwards request to the profile upstream while preserving path and query", async () => {
  const result = await forwardRequest({
    upstreamBaseUrl: "http://127.0.0.1:9000/api",
    method: "POST",
    path: "/v1/messages?stream=true",
    headers: { "content-type": "application/json" },
    body: Buffer.from("{}"),
  });
  expect(result.statusCode).toBe(200);
});
```

```ts
it("starts one listener per enabled profile and reports status by profile id", async () => {
  const manager = createProxyManager(/* deps */);
  await manager.startProfile("anthropic-dev");
  expect(manager.getStatuses()["anthropic-dev"]?.isRunning).toBe(true);
});
```

**Step 2: 运行测试确认失败**

Run: `pnpm exec vitest run tests/unit/transport/forwarder.test.ts tests/unit/transport/proxy-manager.test.ts`

Expected: FAIL。

**Step 3: 写最小实现**

要求：

- `listener.ts` 只管接收 HTTP
- `forwarder.ts` 只管转发
- `stream-buffer.ts` 只管收集 body
- `proxy-manager.ts` 只管按 profile 管理 listeners

**Step 4: 运行测试确认通过**

Run: `pnpm exec vitest run tests/unit/transport/forwarder.test.ts tests/unit/transport/proxy-manager.test.ts`

Expected: PASS。

**Step 5: Commit**

```bash
git add src/main/transport tests/unit/transport
git commit -m "refactor: add transport layer and proxy manager"
```

### Task 4: 实现新 SQLite Schema 与 Repositories

**Status:** Completed on 2026-03-13

**Files:**
- Create: `src/main/storage/sqlite.ts`
- Create: `src/main/storage/exchange-repository.ts`
- Create: `src/main/storage/session-repository.ts`
- Create: `tests/unit/storage/sqlite-schema.test.ts`
- Create: `tests/unit/storage/exchange-repository.test.ts`
- Create: `tests/unit/storage/session-repository.test.ts`
- Test: `tests/unit/storage/sqlite-schema.test.ts`
- Test: `tests/unit/storage/exchange-repository.test.ts`
- Test: `tests/unit/storage/session-repository.test.ts`

**Step 1: 写失败测试**

```ts
it("creates sessions and exchanges tables with the new schema", () => {
  const db = createSqliteDatabase(":memory:");
  const tables = listTables(db);
  expect(tables).toContain("sessions");
  expect(tables).toContain("exchanges");
});
```

```ts
it("stores session model as a denormalized column for fast list queries", () => {
  const row = sessionRepository.getById("session-1");
  expect(row?.model).toBe("claude-opus-4-6");
});
```

```ts
it("persists normalized exchange and inspector as separate columns", () => {
  repository.save({
    capturedExchange,
    normalizedExchange,
    inspectorDocument,
    sessionId: "session-1",
  });
  const row = repository.getById("exchange-1");
  expect(row?.normalized_json).toContain("\"providerId\":\"anthropic\"");
  expect(row?.inspector_json).toContain("\"sections\"");
});
```

**Step 2: 运行测试确认失败**

Run: `pnpm exec vitest run tests/unit/storage/sqlite-schema.test.ts tests/unit/storage/exchange-repository.test.ts tests/unit/storage/session-repository.test.ts`

Expected: FAIL。

**Step 3: 写最小实现**

落固定 schema：

```sql
CREATE TABLE sessions (
  session_id TEXT PRIMARY KEY,
  provider_id TEXT NOT NULL,
  profile_id TEXT NOT NULL,
  external_hint TEXT,
  title TEXT NOT NULL,
  model TEXT,
  started_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  exchange_count INTEGER NOT NULL,
  matcher_state_json TEXT NOT NULL
);

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
  inspector_json TEXT NOT NULL
);
```

**Step 4: 运行测试确认通过**

Run: `pnpm exec vitest run tests/unit/storage/sqlite-schema.test.ts tests/unit/storage/exchange-repository.test.ts tests/unit/storage/session-repository.test.ts`

Expected: PASS。

**Step 5: Commit**

```bash
git add src/main/storage/sqlite.ts src/main/storage/exchange-repository.ts src/main/storage/session-repository.ts tests/unit/storage/sqlite-schema.test.ts tests/unit/storage/exchange-repository.test.ts tests/unit/storage/session-repository.test.ts
git commit -m "refactor: add clean-break sqlite schema and repositories"
```

### Task 5: 实现 Anthrop​ic Protocol Adapter，并对齐 `ProtocolAdapter` 契约

**Status:** Completed on 2026-03-13

**Files:**
- Create: `src/main/providers/protocol-adapters/anthropic-messages/index.ts`
- Create: `src/main/providers/protocol-adapters/anthropic-messages/normalize.ts`
- Create: `src/main/providers/protocol-adapters/anthropic-messages/session-matcher.ts`
- Create: `src/main/providers/protocol-adapters/anthropic-messages/timeline-assembler.ts`
- Create: `src/main/providers/protocol-adapters/anthropic-messages/build-inspector.ts`
- Create: `tests/fixtures/protocols/anthropic-messages/request.json`
- Create: `tests/fixtures/protocols/anthropic-messages/response.sse.txt`
- Create: `tests/unit/providers/anthropic-messages/normalize.test.ts`
- Create: `tests/unit/providers/anthropic-messages/session-matcher.test.ts`
- Create: `tests/unit/providers/anthropic-messages/timeline-assembler.test.ts`
- Create: `tests/unit/providers/anthropic-messages/build-inspector.test.ts`
- Test: `tests/unit/providers/anthropic-messages/normalize.test.ts`
- Test: `tests/unit/providers/anthropic-messages/session-matcher.test.ts`
- Test: `tests/unit/providers/anthropic-messages/timeline-assembler.test.ts`
- Test: `tests/unit/providers/anthropic-messages/build-inspector.test.ts`

**Step 1: 写失败测试**

```ts
it("normalizes anthropic request/response into NormalizedExchange", () => {
  const exchange = makeCapturedExchangeFromFixture();
  const normalized = anthropicMessagesAdapter.normalize(exchange);
  expect(normalized.request.inputMessages[0]?.role).toBe("user");
  expect(normalized.response.outputMessages[0]?.role).toBe("assistant");
});
```

```ts
it("builds an inspector document from raw and normalized anthropic data", () => {
  const normalized = anthropicMessagesAdapter.normalize(exchange);
  const inspector = anthropicMessagesAdapter.buildInspector(exchange, normalized);
  expect(inspector.sections.length).toBeGreaterThan(0);
});
```

```ts
it("extracts session hint from metadata.user_id", () => {
  const hint = anthropicMessagesAdapter.sessionMatcher.extractHint(exchange, normalized);
  expect(hint).toBe("uuid-123");
});
```

**Step 2: 运行测试确认失败**

Run: `pnpm exec vitest run tests/unit/providers/anthropic-messages/normalize.test.ts tests/unit/providers/anthropic-messages/session-matcher.test.ts tests/unit/providers/anthropic-messages/timeline-assembler.test.ts tests/unit/providers/anthropic-messages/build-inspector.test.ts`

Expected: FAIL。

**Step 3: 写最小实现**

要求：

- `normalize.ts` 只做协议解析
- `build-inspector.ts` 只做 inspector 派生
- `session-matcher.ts` 只做 anthropic 会话匹配
- `timeline-assembler.ts` 只做 snapshot-style timeline

adapter 入口必须受编译时约束：

```ts
import type { ProtocolAdapter } from "../../../../shared/contracts";

export const anthropicMessagesAdapter = {
  id: "anthropic-messages",
  normalize: normalizeAnthropicExchange,
  buildInspector: buildAnthropicInspector,
  sessionMatcher: anthropicSessionMatcher,
  timelineAssembler: anthropicTimelineAssembler,
} satisfies ProtocolAdapter;
```

**Step 4: 运行测试确认通过**

Run: `pnpm exec vitest run tests/unit/providers/anthropic-messages/normalize.test.ts tests/unit/providers/anthropic-messages/session-matcher.test.ts tests/unit/providers/anthropic-messages/timeline-assembler.test.ts tests/unit/providers/anthropic-messages/build-inspector.test.ts`

Expected: PASS。

**Step 5: Commit**

```bash
git add src/main/providers/protocol-adapters/anthropic-messages tests/fixtures/protocols/anthropic-messages tests/unit/providers/anthropic-messages
git commit -m "feat: add anthropic protocol adapter with inspector support"
```

### Task 6A: 实现 Session Resolver 与 Capture Pipeline

**Status:** Completed on 2026-03-13

**Files:**
- Create: `src/main/pipeline/session-resolver.ts`
- Create: `src/main/pipeline/capture-pipeline.ts`
- Create: `tests/unit/pipeline/session-resolver.test.ts`
- Create: `tests/unit/pipeline/capture-pipeline.test.ts`
- Test: `tests/unit/pipeline/session-resolver.test.ts`
- Test: `tests/unit/pipeline/capture-pipeline.test.ts`

**Step 1: 写失败测试**

```ts
it("creates a new session when no candidate matches", async () => {
  const sessionId = await resolver.resolve(captured, normalized);
  expect(sessionId).toBeDefined();
});
```

```ts
it("reuses an existing session when matcher returns a candidate", async () => {
  const sessionId = await resolver.resolve(captured2, normalized2);
  expect(sessionId).toBe("session-1");
});
```

```ts
it("runs normalize -> buildInspector -> resolveSession -> persist", async () => {
  const result = await pipeline.process(captured);
  expect(result.sessionId).toBeDefined();
});
```

**Step 2: 运行测试确认失败**

Run: `pnpm exec vitest run tests/unit/pipeline/session-resolver.test.ts tests/unit/pipeline/capture-pipeline.test.ts`

Expected: FAIL。

**Step 3: 写最小实现**

`CapturePipeline` 必须执行以下顺序：

1. load provider definition
2. load protocol adapter
3. `normalize(exchange)`
4. `buildInspector(exchange, normalized)`
5. resolve session
6. persist session + exchange

**Step 4: 运行测试确认通过**

Run: `pnpm exec vitest run tests/unit/pipeline/session-resolver.test.ts tests/unit/pipeline/capture-pipeline.test.ts`

Expected: PASS。

**Step 5: Commit**

```bash
git add src/main/pipeline tests/unit/pipeline
git commit -m "feat: add session resolver and capture pipeline"
```

### Task 6B: 实现 Query Services 与 View Model 输出

**Status:** Completed on 2026-03-13

**Files:**
- Create: `src/main/queries/session-query-service.ts`
- Create: `src/main/queries/exchange-query-service.ts`
- Create: `tests/unit/queries/session-query-service.test.ts`
- Create: `tests/unit/queries/exchange-query-service.test.ts`
- Test: `tests/unit/queries/session-query-service.test.ts`
- Test: `tests/unit/queries/exchange-query-service.test.ts`

**Step 1: 写失败测试**

```ts
it("builds SessionTraceVM from normalized exchanges and timeline assembler", async () => {
  const trace = await queryService.getSessionTrace("session-1");
  expect(trace.timeline.messages.length).toBeGreaterThan(0);
});
```

```ts
it("returns ExchangeDetailVM with inspector document", async () => {
  const detail = await exchangeQuery.getExchangeDetail("exchange-1");
  expect(detail.inspector.sections.length).toBeGreaterThan(0);
});
```

**Step 2: 运行测试确认失败**

Run: `pnpm exec vitest run tests/unit/queries/session-query-service.test.ts tests/unit/queries/exchange-query-service.test.ts`

Expected: FAIL。

**Step 3: 写最小实现**

要求：

- query service 只输出 VM
- 不把 raw DB row 暴露给 renderer
- `SessionTraceVM.timeline` 必须来自 `TimelineAssembler.build()`

**Step 4: 运行测试确认通过**

Run: `pnpm exec vitest run tests/unit/queries/session-query-service.test.ts tests/unit/queries/exchange-query-service.test.ts`

Expected: PASS。

**Step 5: Commit**

```bash
git add src/main/queries tests/unit/queries
git commit -m "feat: add query services for session trace view models"
```

### Task 7: 用真实 HTTP + SQLite 重建集成测试 Harness

**Status:** Completed on 2026-03-13

**Files:**
- Modify: `tests/harness/integration.test.ts`
- Test: `tests/harness/integration.test.ts`

**Step 1: 重写失败测试**

把旧集成测试改写成新管线的真实集成测试，至少覆盖：

1. `listener -> forwarder -> capture-pipeline -> repositories -> query-services`
2. anthropic profile 捕获一条真实 HTTP 请求后，session 与 exchange 都可查询
3. query service 能返回 `SessionTraceVM` 和 `ExchangeDetailVM`

示例断言：

```ts
it("captures an anthropic exchange end-to-end and returns a session trace", async () => {
  await sendRequestThroughListener();
  const sessions = await sessionQuery.listSessions();
  expect(sessions.length).toBe(1);
  const trace = await sessionQuery.getSessionTrace(sessions[0]!.sessionId);
  expect(trace.timeline.messages.length).toBeGreaterThan(0);
});
```

**Step 2: 运行测试确认失败**

Run: `pnpm exec vitest run tests/harness/integration.test.ts`

Expected: FAIL。

**Step 3: 写最小实现**

约束：

- 使用真实 HTTP server
- 使用内存 SQLite
- 不 mock protocol adapter
- 不启动完整 Electron

**Step 4: 运行测试确认通过**

Run: `pnpm exec vitest run tests/harness/integration.test.ts`

Expected: PASS。

**Step 5: Commit**

```bash
git add tests/harness/integration.test.ts
git commit -m "test: rebuild integration harness for multi-provider pipeline"
```

### Task 8: Additive 重建 Bootstrap、IPC、Preload，并保留旧通道桥接

**Status:** Completed on 2026-03-13

**Files:**
- Create: `src/main/bootstrap/app-bootstrap.ts`
- Modify: `src/main/index.ts`
- Modify: `src/main/ipc/register-ipc.ts`
- Modify: `src/shared/ipc-channels.ts`
- Modify: `src/preload/index.ts`
- Modify: `src/preload/api.d.ts`
- Modify: `tests/unit/ipc-handlers.test.ts`
- Modify: `tests/unit/preload-update-api.test.ts`
- Test: `tests/unit/ipc-handlers.test.ts`
- Test: `tests/unit/preload-update-api.test.ts`

**Step 1: 写失败测试**

新增 multi-provider invoke 和 push channels，同时明确 update channels 保持不变。

新 invoke channels：

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

新 push channels：

```ts
TRACE_CAPTURED
PROFILE_STATUS_CHANGED
```

保留不变：

```ts
GET_UPDATE_STATE
CHECK_FOR_UPDATES
DOWNLOAD_UPDATE
QUIT_AND_INSTALL_UPDATE
UPDATE_STATE_CHANGED
```

**Step 2: 运行测试确认失败**

Run: `pnpm exec vitest run tests/unit/ipc-handlers.test.ts tests/unit/preload-update-api.test.ts`

Expected: FAIL。

**Step 3: 写最小实现**

执行策略：

- 旧 channels 暂时保留，直到 Task 11
- 新 channels 现在就接入
- `app-bootstrap.ts` 同时组装新 runtime 和旧 runtime
- `register-ipc.ts` 同时注册新旧 handler
- preload 同时暴露新旧 API

这是桥接策略，不是最终状态。

Preload 新 API 至少包含：

```ts
getProfiles(): Promise<ConnectionProfile[]>;
saveProfiles(input: ConnectionProfile[]): Promise<ConnectionProfile[]>;
startProfile(profileId: string): Promise<void>;
stopProfile(profileId: string): Promise<void>;
getProfileStatuses(): Promise<Record<string, { isRunning: boolean; port: number | null }>>;
listSessions(filter?: { providerId?: string; profileId?: string; query?: string }): Promise<SessionListItemVM[]>;
getSessionTrace(sessionId: string): Promise<SessionTraceVM>;
getExchangeDetail(exchangeId: string): Promise<ExchangeDetailVM>;
clearHistory(): Promise<void>;
onTraceCaptured(cb: (payload: TraceCapturedEvent) => void): () => void;
onProfileStatusChanged(cb: (payload: ProfileStatusChangedEvent) => void): () => void;
```

**Step 4: 运行测试确认通过**

Run: `pnpm exec vitest run tests/unit/ipc-handlers.test.ts tests/unit/preload-update-api.test.ts`

Expected: PASS。

**Step 5: Commit**

```bash
git add src/main/bootstrap/app-bootstrap.ts src/main/index.ts src/main/ipc/register-ipc.ts src/shared/ipc-channels.ts src/preload/index.ts src/preload/api.d.ts tests/unit/ipc-handlers.test.ts tests/unit/preload-update-api.test.ts
git commit -m "refactor: add profile-aware bootstrap ipc preload bridge"
```

### Task 9: 新建 Profile Management Renderer Foundation，不切主入口

**Status:** Completed on 2026-03-13

**Files:**
- Create: `src/renderer/src/stores/profile-store.ts`
- Create: `src/renderer/src/features/profiles/profile-setup-page.tsx`
- Create: `src/renderer/src/features/profiles/profile-form.tsx`
- Modify: `src/renderer/src/components/setup-form.tsx`
- Modify: `src/renderer/src/components/settings-dialog.tsx`
- Modify: `src/renderer/src/components/status-bar.tsx`
- Create: `tests/renderer/profile-management.test.tsx`
- Modify: `tests/renderer/setup-page.test.tsx`
- Test: `tests/renderer/profile-management.test.tsx`
- Test: `tests/renderer/setup-page.test.tsx`

**Step 1: 写失败测试**

```tsx
expect(screen.getByText(/connect provider/i)).toBeInTheDocument();
expect(screen.getByLabelText(/provider/i)).toBeInTheDocument();
expect(screen.getByLabelText(/upstream base url/i)).toBeInTheDocument();
expect(screen.getByLabelText(/local port/i)).toBeInTheDocument();
```

```tsx
it("shows existing profiles and lets the user add a new one", async () => {
  render(<ProfileSetupPage />);
  expect(screen.getByText("anthropic-dev")).toBeInTheDocument();
});
```

**Step 2: 运行测试确认失败**

Run: `pnpm exec vitest run tests/renderer/profile-management.test.tsx tests/renderer/setup-page.test.tsx`

Expected: FAIL。

**Step 3: 写最小实现**

约束：

- 此任务只落 profile 管理 UI 和 store
- 不改 `src/renderer/src/App.tsx`
- 不改 workspace 主视图
- 应用主入口继续走旧 renderer，因此任务结束后应用仍可运行

**Step 4: 运行测试确认通过**

Run: `pnpm exec vitest run tests/renderer/profile-management.test.tsx tests/renderer/setup-page.test.tsx`

Expected: PASS。

**Step 5: Commit**

```bash
git add src/renderer/src/stores/profile-store.ts src/renderer/src/features/profiles src/renderer/src/components/setup-form.tsx src/renderer/src/components/settings-dialog.tsx src/renderer/src/components/status-bar.tsx tests/renderer/profile-management.test.tsx tests/renderer/setup-page.test.tsx
git commit -m "feat: add profile management ui foundation"
```

### Task 10A: 新建 Trace Stores、Timeline 与 Inspector 组件，不切主入口

**Status:** Completed on 2026-03-13

**Files:**
- Create: `src/renderer/src/stores/trace-store.ts`
- Create: `tests/renderer/session-trace.test.tsx`
- Modify: `src/renderer/src/components/conversation-view.tsx`
- Modify: `src/renderer/src/components/inspector-panel.tsx`
- Modify: `src/renderer/src/components/request-item.tsx`
- Modify: `tests/renderer/workspace-page.test.tsx`
- Test: `tests/renderer/session-trace.test.tsx`
- Test: `tests/renderer/workspace-page.test.tsx`

**Step 1: 写失败测试**

```tsx
render(<ConversationView timeline={trace.timeline} />);
expect(screen.getByText("USER")).toBeInTheDocument();
expect(screen.getByText("ASSISTANT")).toBeInTheDocument();
```

```tsx
expect(screen.getByText(/overview/i)).toBeInTheDocument();
```

**Step 2: 运行测试确认失败**

Run: `pnpm exec vitest run tests/renderer/session-trace.test.tsx tests/renderer/workspace-page.test.tsx`

Expected: FAIL。

**Step 3: 写最小实现**

约束：

- `conversation-view.tsx` 不再 import `parse-claude-body.ts`
- `inspector-panel.tsx` 只渲染 `InspectorSection[]`
- 新 trace 组件允许通过 props 或 store 独立测试
- 此任务仍不切 `App.tsx`

**Step 4: 运行测试确认通过**

Run: `pnpm exec vitest run tests/renderer/session-trace.test.tsx tests/renderer/workspace-page.test.tsx`

Expected: PASS。

**Step 5: Commit**

```bash
git add src/renderer/src/stores/trace-store.ts src/renderer/src/components/conversation-view.tsx src/renderer/src/components/inspector-panel.tsx src/renderer/src/components/request-item.tsx tests/renderer/session-trace.test.tsx tests/renderer/workspace-page.test.tsx
git commit -m "feat: add trace rendering components based on view models"
```

### Task 10B: 切换 Renderer 主入口到新 Runtime，并接上 Push Events

**Status:** Completed on 2026-03-13

**Files:**
- Modify: `src/renderer/src/App.tsx`
- Modify: `src/renderer/src/stores/app-store.ts`
- Modify: `src/renderer/src/stores/session-store.ts`
- Modify: `src/renderer/src/hooks/use-proxy-events.ts`
- Modify: `src/renderer/src/pages/setup-page.tsx`
- Modify: `src/renderer/src/pages/workspace-page.tsx`
- Modify: `src/renderer/src/components/session-sidebar.tsx`
- Modify: `src/renderer/src/components/session-item.tsx`
- Modify: `src/renderer/src/components/main-content.tsx`
- Modify: `src/renderer/src/components/conversation-header.tsx`
- Modify: `src/renderer/src/components/command-palette.tsx`
- Modify: `tests/renderer/live-updates.test.tsx`
- Modify: `tests/e2e/first-run.spec.ts`
- Test: `tests/renderer/live-updates.test.tsx`
- Test: `tests/e2e/first-run.spec.ts`

**Step 1: 写失败测试**

```tsx
expect(screen.getByText(/all providers/i)).toBeInTheDocument();
expect(screen.getByText("Anthropic")).toBeInTheDocument();
```

```ts
// tests/renderer/live-updates.test.tsx
expect(api.onTraceCaptured).toHaveBeenCalled();
```

```ts
// tests/e2e/first-run.spec.ts
// 首启不再出现 TARGET_URL 输入，而是 provider setup
```

**Step 2: 运行测试确认失败**

Run: `pnpm exec vitest run tests/renderer/live-updates.test.tsx`

Run: `pnpm exec playwright test tests/e2e/first-run.spec.ts`

Expected: FAIL。

**Step 3: 写最小实现**

切换逻辑：

```tsx
if (!initialized) return <LoadingSkeleton />;
if (profiles.length === 0) return <ProfileSetupPage />;
return <WorkspacePage />;
```

同时：

- `app-store.ts` 改为初始化 profiles 和 updateState
- `session-store.ts` 调新的 `listSessions()`
- `use-proxy-events.ts` 改监听 `TRACE_CAPTURED`、`PROFILE_STATUS_CHANGED`
- update 相关逻辑保持不变

**Step 4: 运行测试确认通过**

Run: `pnpm exec vitest run tests/renderer/live-updates.test.tsx`

Run: `pnpm exec playwright test tests/e2e/first-run.spec.ts`

Expected: PASS。

**Step 5: Commit**

```bash
git add src/renderer/src/App.tsx src/renderer/src/stores/app-store.ts src/renderer/src/stores/session-store.ts src/renderer/src/hooks/use-proxy-events.ts src/renderer/src/pages/setup-page.tsx src/renderer/src/pages/workspace-page.tsx src/renderer/src/components/session-sidebar.tsx src/renderer/src/components/session-item.tsx src/renderer/src/components/main-content.tsx src/renderer/src/components/conversation-header.tsx src/renderer/src/components/command-palette.tsx tests/renderer/live-updates.test.tsx tests/e2e/first-run.spec.ts
git commit -m "feat: cut over renderer to profile-aware runtime"
```

### Task 11: 删除旧单 Provider 骨架、旧 IPC 桥接与 `targetUrl`

**Status:** Completed on 2026-03-14

**Files:**
- Delete: `src/main/proxy/server.ts`
- Delete: `src/main/proxy/forward.ts`
- Delete: `src/main/proxy/stream-collector.ts`
- Delete: `src/main/session/derive-session.ts`
- Delete: `src/main/session/session-manager.ts`
- Delete: `src/main/store/database.ts`
- Delete: `src/main/store/history-store.ts`
- Delete: `src/main/store/settings-store.ts`
- Delete: `src/main/store/user-data-migration.ts`
- Delete: `src/shared/types.ts`
- Delete: `src/shared/extract-user-text.ts`
- Delete: `src/renderer/src/lib/parse-claude-body.ts`
- Modify: `src/shared/defaults.ts`
- Modify: `src/shared/ipc-channels.ts`
- Modify: `src/preload/index.ts`
- Modify: `src/preload/api.d.ts`
- Modify: `tests/harness/structural.test.ts`
- Delete: `tests/unit/history-store.test.ts`
- Delete: `tests/unit/proxy-server.test.ts`
- Delete: `tests/unit/proxy-streaming.test.ts`
- Delete: `tests/unit/session-grouping.test.ts`
- Delete: `tests/unit/settings-store.test.ts`
- Delete: `tests/unit/user-data-migration.test.ts`
- Delete: `tests/renderer/request-detail.test.tsx`
- Test: `tests/harness/structural.test.ts`
- Test: `tests/harness/integration.test.ts`

**Step 1: 写失败测试**

在 `tests/harness/structural.test.ts` 中显式要求：

```ts
expect(exists("src/main/transport/proxy-manager.ts")).toBe(true);
expect(exists("src/main/session/session-manager.ts")).toBe(false);
expect(exists("src/renderer/src/lib/parse-claude-body.ts")).toBe(false);
```

**Step 2: 运行测试确认失败**

Run: `pnpm exec vitest run tests/harness/structural.test.ts`

Expected: FAIL，因为旧骨架和旧 bridge 仍存在。

**Step 3: 删除旧骨架并移除桥接**

要求：

- 删除旧 `targetUrl`
- 删除旧 `GET_SETTINGS` / `SAVE_SETTINGS` / `TOGGLE_LISTENING` 等旧 IPC
- 删除旧 `CAPTURE_UPDATED` 等只服务旧 renderer 的桥接逻辑
- 保留 update channels

**Step 4: 运行测试确认通过**

Run: `pnpm exec vitest run tests/harness/structural.test.ts`

Run: `pnpm exec vitest run tests/harness/integration.test.ts`

Expected: PASS。

**Step 5: Commit**

```bash
git add tests/harness/structural.test.ts
git add -A src/main src/shared src/preload src/renderer/src/lib tests/unit tests/renderer/request-detail.test.tsx
git commit -m "refactor: remove legacy single-provider runtime and bridge apis"
```

### Task 12: 采集真实 Codex 样本并冻结 Fixtures

**Status:** Completed on 2026-03-14

**Files:**
- Create: `tests/fixtures/protocols/openai-responses/request.json`
- Create: `tests/fixtures/protocols/openai-responses/response.sse.txt`
- Create: `docs/plans/2026-03-13-codex-fixture-notes.md`
- Test: manual capture step only

**Step 1: 采样真实流量**

前置条件：

- 新架构已可运行
- 可启动一个 `codex` profile

手工执行：

1. 用新 runtime 启动 `codex` profile
2. 让真实 Codex CLI 通过该 profile 发起一次最小请求
3. 保存原始 request body 和 response stream

**Step 2: 写入 fixture**

保存到：

- `tests/fixtures/protocols/openai-responses/request.json`
- `tests/fixtures/protocols/openai-responses/response.sse.txt`

并记录以下结论到 `docs/plans/2026-03-13-codex-fixture-notes.md`：

- 请求是 snapshot 还是 incremental
- session hint 在哪里
- stream 格式是什么
- 是否存在 tool-call / reasoning 专有字段

**Step 3: Commit**

```bash
git add tests/fixtures/protocols/openai-responses docs/plans/2026-03-13-codex-fixture-notes.md
git commit -m "test: capture real codex fixtures for protocol validation"
```

### Task 13: 接入 OpenAI Responses Adapter 并验证 Codex

**Status:** Completed on 2026-03-14

**Files:**
- Create: `src/main/providers/protocol-adapters/openai-responses/index.ts`
- Create: `src/main/providers/protocol-adapters/openai-responses/normalize.ts`
- Create: `src/main/providers/protocol-adapters/openai-responses/session-matcher.ts`
- Create: `src/main/providers/protocol-adapters/openai-responses/timeline-assembler.ts`
- Create: `src/main/providers/protocol-adapters/openai-responses/build-inspector.ts`
- Modify: `src/main/providers/definitions/codex.ts`
- Modify: `src/main/providers/provider-catalog.ts`
- Create: `tests/unit/providers/openai-responses/normalize.test.ts`
- Create: `tests/unit/providers/openai-responses/session-matcher.test.ts`
- Create: `tests/unit/providers/openai-responses/timeline-assembler.test.ts`
- Create: `tests/unit/providers/openai-responses/build-inspector.test.ts`
- Test: `tests/unit/providers/openai-responses/normalize.test.ts`
- Test: `tests/unit/providers/openai-responses/session-matcher.test.ts`
- Test: `tests/unit/providers/openai-responses/timeline-assembler.test.ts`
- Test: `tests/unit/providers/openai-responses/build-inspector.test.ts`

**Step 1: 写失败测试**

基于 Task 12 的真实样本写 contract tests：

```ts
it("normalizes a codex exchange into NormalizedExchange", () => {
  const normalized = openaiResponsesAdapter.normalize(exchange);
  expect(normalized.providerId).toBe("codex");
  expect(normalized.response.outputMessages.length).toBeGreaterThan(0);
});
```

```ts
it("assembles the correct timeline strategy for codex based on the captured fixture", () => {
  const timeline = openaiResponsesAdapter.timelineAssembler.build([normalized1, normalized2]);
  expect(timeline.messages.length).toBeGreaterThan(0);
});
```

**Step 2: 运行测试确认失败**

Run: `pnpm exec vitest run tests/unit/providers/openai-responses/normalize.test.ts tests/unit/providers/openai-responses/session-matcher.test.ts tests/unit/providers/openai-responses/timeline-assembler.test.ts tests/unit/providers/openai-responses/build-inspector.test.ts`

Expected: FAIL。

**Step 3: 写最小实现**

要求：

- `codex.ts` 只绑定 provider definition
- 所有协议逻辑只放在 `openai-responses` adapter
- adapter 同样必须 `satisfies ProtocolAdapter`
- session matcher 逻辑必须以 Task 12 的真实样本为准，不允许猜测

**Step 4: 运行测试确认通过**

Run: `pnpm exec vitest run tests/unit/providers/openai-responses/normalize.test.ts tests/unit/providers/openai-responses/session-matcher.test.ts tests/unit/providers/openai-responses/timeline-assembler.test.ts tests/unit/providers/openai-responses/build-inspector.test.ts`

Expected: PASS。

**Step 5: Commit**

```bash
git add src/main/providers/protocol-adapters/openai-responses src/main/providers/definitions/codex.ts src/main/providers/provider-catalog.ts tests/unit/providers/openai-responses
git commit -m "feat: add openai responses adapter and codex provider"
```

### Task 14: 同步文档并做最终验证

**Status:** Completed on 2026-03-14

**Files:**
- Modify: `README.md`
- Modify: `README.zh-CN.md`
- Modify: `docs/design/architecture.md`
- Modify: `docs/multi-provider-architecture-frozen.md`
- Modify: `docs/plans/2026-03-13-codex-fixture-notes.md`
- Test: `tests/harness/structural.test.ts`
- Test: `tests/harness/integration.test.ts`
- Test: `tests/e2e/first-run.spec.ts`

**Step 1: 更新文档**

文档必须反映以下事实：

- Agent Trace 是多 provider 平台
- setup 入口是 profiles，不是 `TARGET_URL`
- provider-specific parse 和 inspector 构建都在主进程
- `InspectorDocument` 已从 `NormalizedExchange` 中抽出并独立存储
- renderer 只消费 view model

**Step 2: 运行类型检查**

Run: `pnpm typecheck`

Expected: PASS。

**Step 3: 运行单元与渲染测试**

Run: `pnpm test`

Expected: PASS。

**Step 4: 运行结构与集成测试**

Run: `pnpm exec vitest run tests/harness/structural.test.ts`

Run: `pnpm exec vitest run tests/harness/integration.test.ts`

Expected: PASS。

**Step 5: 运行首启 E2E**

Run: `pnpm exec playwright test tests/e2e/first-run.spec.ts`

Expected: PASS。

**Step 6: 运行构建**

Run: `pnpm build`

Expected: PASS。

**Step 7: Commit**

```bash
git add README.md README.zh-CN.md docs/design/architecture.md docs/multi-provider-architecture-frozen.md docs/plans/2026-03-13-codex-fixture-notes.md
git commit -m "docs: finalize multi-provider runtime architecture"
```

## Exit Criteria

只有满足以下条件，实施才算完成：

1. Task 1 已定义完整 contracts、VM types 和 push event types
2. renderer 中不存在 `parseClaude*`
3. renderer 不直接解析 raw provider body
4. session 匹配只发生在单 profile 内
5. `targetUrl` 和旧单 provider IPC 已从最终代码删除
6. update channels 仍可工作
7. `tests/harness/integration.test.ts` 覆盖新管线
8. `anthropic` 和 `codex` 至少各有一组 protocol adapter contract tests
9. `pnpm typecheck`、`pnpm test`、`pnpm build`、`tests/e2e/first-run.spec.ts` 全部通过

## Post-Review Hardening (2026-03-14)

### Task H1: 补充回归测试，锁定 review 剩余问题

**Status:** Completed on 2026-03-14

新增或收紧以下测试：

- `tests/unit/pipeline/capture-pipeline.test.ts`
  - 新增 retention limit 集成测试，要求超过上限时按完整 session 淘汰最旧会话
- `tests/unit/providers/anthropic-messages/normalize.test.ts`
  - 新增 Anthropic SSE usage / stop reason 提取测试
- `tests/unit/storage/exchange-repository.test.ts`
  - 新增 typed row contract test
- `tests/unit/storage/session-repository.test.ts`
  - 新增 typed row contract test
- `tests/unit/storage/history-maintenance-service.test.ts`
  - 新增 clear-all 事务性与 retention policy 单元测试
- `tests/harness/structural.test.ts`
  - 新增 normalized naming、provider residue、provider-neutral copy、required files 守护

### Task H2: 修复 storage 与 pipeline 根问题

**Status:** Completed on 2026-03-14

落地以下改动：

- 引入 `HistoryMaintenanceService`
- `clearHistory()` 改成单事务删除
- 增加 count-based retention policy，但按完整 session 淘汰，不切碎单个 session
- `CapturePipeline` 在写入后立即执行 retention enforcement
- `SessionRepository` / `ExchangeRepository` 返回 typed rows，不再对外暴露 `Record<string, unknown>`

### Task H3: 修复 provider 层一致性问题

**Status:** Completed on 2026-03-14

落地以下改动：

- Anthropic normalizer 支持从 SSE 提取 `stopReason` 和 `usage`
- 删除 Anthropic normalizer 中对同一 response body 的重复 JSON 解析
- `anthropic` / `openai-responses` inspector overview 统一通过 provider label formatter 生成 provider 展示名
- 从 shared provider contract 中移除 `gemini` / `google-generative-language`
- 删除未实现的 `src/main/providers/definitions/gemini.ts`

### Task H4: 修复 renderer 与 shared contract 漏洞

**Status:** Completed on 2026-03-14

落地以下改动：

- `ConversationView` / `MessageBlock` / `ContentBlock` 只消费 normalized block names
- 删除 renderer 中对 `tool_use` / `tool_result` 的兼容分支
- `trace-store` 删除与 fail-fast 设计冲突的防御性 `typeof` 检查
- setup / empty-state 文案改为 provider-neutral 表述

### Task H5: 全量验证

**Status:** Completed on 2026-03-14

Verified with:

- `pnpm test`
- `pnpm typecheck`
- `pnpm build`
- `pnpm rebuild:electron`
- `pnpm exec playwright test tests/e2e/first-run.spec.ts`
- `pnpm rebuild:node`
- `pnpm test`
