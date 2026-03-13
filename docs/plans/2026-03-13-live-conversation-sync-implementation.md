# Live Conversation Sync Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 修复会话页消息延迟显示问题，使当前轮 assistant 回复在响应完成后立即出现在右侧对话区，并兼容标准与兼容网关的 SSE 格式。

**Architecture:** 主进程广播结构化 capture 事件，渲染层根据事件同步 session 列表并按需刷新当前会话请求列表；响应解析层拆成 JSON 与 SSE 两个职责清晰的解析函数，SSE 解析器兼容标准事件序列和 delta-only 事件序列。

**Tech Stack:** TypeScript, Electron IPC, Zustand, Vitest, React Testing Library

---

### Task 1: 为实时同步补失败测试

**Files:**
- Modify: `tests/renderer/live-updates.test.tsx`
- Modify: `src/renderer/src/hooks/use-proxy-events.ts`
- Test: `tests/renderer/live-updates.test.tsx`

**Step 1: 写失败测试**

- 模拟 `onCaptureUpdated` 收到针对当前选中 session 的事件
- 断言 request store 会重新加载该 session 的 requests
- 再加一个非当前 session 的 case，断言不会误刷新

**Step 2: 运行测试确认失败**

Run: `pnpm exec vitest run tests/renderer/live-updates.test.tsx`

### Task 2: 为 delta-only SSE 解析补失败测试

**Files:**
- Modify: `tests/renderer/request-detail.test.tsx`
- Modify: `src/renderer/src/lib/parse-claude-body.ts`
- Test: `tests/renderer/request-detail.test.tsx`

**Step 1: 写失败测试**

- 构造只有 `content_block_delta` 的 SSE 响应
- 构造缺失 `content_block_start` 且缺失 `index` 的情况
- 断言仍能解析出 assistant 文本内容

**Step 2: 运行测试确认失败**

Run: `pnpm exec vitest run tests/renderer/request-detail.test.tsx`

### Task 3: 引入结构化 capture 事件契约

**Files:**
- Modify: `src/shared/types.ts`
- Modify: `src/preload/index.ts`
- Modify: `src/renderer/src/lib/electron-api.ts`
- Modify: `src/main/index.ts`

**Step 1: 定义共享事件载荷**

- 新增 capture 事件 payload 类型
- 明确 `sessions`、`updatedSessionId`、`updatedRequestId`

**Step 2: 主进程发送结构化事件**

- 在请求持久化后发送结构化 payload
- clear data 也发同一契约的空 payload

### Task 4: 实现渲染层实时请求同步

**Files:**
- Modify: `src/renderer/src/stores/request-store.ts`
- Modify: `src/renderer/src/hooks/use-proxy-events.ts`
- Test: `tests/renderer/live-updates.test.tsx`

**Step 1: request store 增加按需刷新能力**

- 增加 `refreshSessionIfSelected(updatedSessionId, selectedSessionId)`
- 内部只在命中当前 session 时调用 `getSessionRequests`

**Step 2: hook 只负责消费事件**

- 更新 session store
- 调用 request store 的条件刷新

**Step 3: 运行测试确认通过**

Run: `pnpm exec vitest run tests/renderer/live-updates.test.tsx`

### Task 5: 重构并增强 Claude 响应解析器

**Files:**
- Modify: `src/renderer/src/lib/parse-claude-body.ts`
- Test: `tests/renderer/request-detail.test.tsx`

**Step 1: 拆分 JSON 与 SSE 解析**

- 提取 `parseClaudeJsonResponse()`
- 提取 `parseClaudeSseResponse()`

**Step 2: 支持兼容网关 SSE**

- 对缺失 `content_block_start` 的 delta 自动创建 block
- 对缺失 `index` 的事件默认归并到 `0`
- 保持对 `thinking_delta` 和 `input_json_delta` 的支持

**Step 3: 运行测试确认通过**

Run: `pnpm exec vitest run tests/renderer/request-detail.test.tsx`

### Task 6: 全量验证

**Files:**
- Verify only

**Step 1: 运行单测**

Run: `pnpm test`

**Step 2: 运行类型检查**

Run: `pnpm typecheck`

**Step 3: 运行构建**

Run: `pnpm build`

### Task 7: 更新说明文档

**Files:**
- Modify: `docs/release/desktop-release-runbook.md`

**Step 1: 补充消息实时同步说明**

- 说明会话列表和当前会话明细的同步机制
- 说明兼容 Anthropic SSE 与常见兼容网关 SSE
