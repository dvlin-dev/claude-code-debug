# Live Conversation Sync Design

**日期:** 2026-03-13

## 目标

修复会话页里的消息时序问题，确保：

- 用户消息在当前轮请求发出后立即可见
- AI 回复在当前轮响应结束后立即可见
- 不依赖“下一条用户消息”才能把上一条 AI 回复补出来
- 兼容标准 Anthropic SSE 和常见兼容网关的 delta-only SSE

## 问题

当前问题由两个独立缺口叠加导致：

1. 当前选中会话的请求列表没有实时刷新
2. SSE 响应解析器对事件格式假设过强

### 缺口 1：请求列表没有实时同步

主进程在请求完成后会通过 `IPC.CAPTURE_UPDATED` 把新的 session 列表推给渲染层，但渲染层当前只更新了 sidebar 的 `sessions`，没有刷新当前选中会话的 `requests`。

因此：

- 右侧会话视图只会在切换 session 时重新加载请求明细
- 同一个 session 内的新请求保存后，对话区不会自动拿到最新 request

### 缺口 2：SSE 解析器过于严格

当前 `parseClaudeResponse()` 默认假设流式响应会包含：

- `message_start`
- `content_block_start`
- `content_block_delta`

但很多兼容网关只返回：

- `content_block_delta`
- `message_stop`

甚至 `content_block_delta` 里也不带 `index`。在这种情况下，当前解析器会返回 `null`，导致当前轮 assistant 回复无法从 `responseBody` 中恢复出来。

### 为什么会表现成“下一条用户消息来了才显示上一条 AI 回复”

因为下一轮 Claude Code 请求的 `requestBody.messages` 会把上一轮 assistant 回复带进去。也就是说：

1. 当前轮响应结束时，右侧未刷新或解析失败，看不到 assistant 回复
2. 下一轮用户请求发出时，新 request 的 `messages` 已包含上一轮 assistant 回复
3. 对话重建时，就看起来像“上一条 AI 回复延迟到下一条用户消息时才出现”

## 设计原则

- 不做针对某个网关的特殊兼容
- 主进程只负责采集、持久化、广播“发生了什么”
- 渲染层只负责根据事件同步当前会话数据
- 响应解析器只负责把原始 Claude 响应还原成统一的 assistant message
- 先用失败测试锁定问题，再做最小但完整的修复

## 方案对比

### 方案 A：只修渲染层实时刷新

做法：

- `CAPTURE_UPDATED` 到来时，如果更新的 session 正好是当前选中的 session，就重新加载请求列表

优点：

- 能解决“当前会话不刷新”的问题

缺点：

- 如果 `responseBody` 是 delta-only SSE，当前轮 assistant 回复仍然解析失败

### 方案 B：只修 SSE 解析器

做法：

- 把 `parseClaudeResponse()` 改成兼容 delta-only SSE

优点：

- 能恢复更多真实响应格式

缺点：

- 当前选中会话还是不会自动刷新，UI 仍可能延迟显示

### 方案 C：同时修正事件同步和 SSE 解析

做法：

- 主进程广播结构化 capture 事件，不只传 sessions
- 渲染层在收到 capture 事件时同步 session 列表，并按需刷新当前会话请求列表
- 把 SSE 解析逻辑提纯为独立模块，兼容标准事件序列和 delta-only 事件序列

优点：

- 从根本上解决时序问题
- 对不同上游实现更健壮
- 模块职责清晰，后续好维护

缺点：

- 改动面更大，需要同步更新事件契约和测试

**结论：采用方案 C。**

## 目标架构

### 1. 结构化 capture 事件

新增共享事件载荷类型，例如：

- `sessions`
- `updatedSessionId`
- `updatedRequestId`

主进程在请求持久化完成后只广播一次这个事件。渲染层据此决定：

- sidebar 刷新 session 列表
- 如果当前选中的就是 `updatedSessionId`，则重新拉取该 session 的请求列表

### 2. 请求同步逻辑下沉到 request store

`request-store` 增加围绕“当前选中 session”的同步能力，例如：

- `loadRequests(sessionId)`
- `refreshSessionIfSelected(sessionId, selectedSessionId)`

这样 hook 不需要自己理解 request store 的内部状态，只负责把事件转发给 store。

### 3. 响应解析器拆分职责

把当前混在一起的 `parseClaudeResponse()` 拆成清晰的两层：

- `parseClaudeJsonResponse(body)`
- `parseClaudeSseResponse(body)`

其中 SSE 解析器需要支持：

- 标准 `message_start/content_block_start/content_block_delta`
- 只有 `content_block_delta` 的流
- 缺失 `index` 时回退到默认 block `0`
- `text_delta`
- `thinking_delta`
- `input_json_delta`

并统一输出 `ParsedClaudeResponse`。

### 4. ConversationView 保持只关心“最后一个 request 的完整对话”

`ConversationView` 不负责做“增量事件流”拼接，只消费 store 里已经同步好的 `requests`。这样 UI 层职责单一，不引入额外双向状态。

## 受影响文件

- `src/shared/types.ts`
- `src/shared/ipc-channels.ts`
- `src/main/index.ts`
- `src/preload/index.ts`
- `src/renderer/src/lib/electron-api.ts`
- `src/renderer/src/hooks/use-proxy-events.ts`
- `src/renderer/src/stores/request-store.ts`
- `src/renderer/src/lib/parse-claude-body.ts`
- `tests/unit/ipc-handlers.test.ts`
- `tests/renderer/live-updates.test.tsx`
- `tests/renderer/request-detail.test.tsx`
- 新增解析器或同步相关测试

## 验证

- 失败测试先能稳定复现两个问题
- 修复后：
  - 当前选中 session 收到 capture 事件会立即刷新请求列表
  - delta-only SSE 能解析出 assistant 回复
  - 标准 Anthropic SSE 仍然兼容
- 全量测试通过
- 类型检查通过
- 构建通过
