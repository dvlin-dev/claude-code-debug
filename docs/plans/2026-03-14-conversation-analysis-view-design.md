# Conversation Analysis View Design

> 状态: **待实现**
> 创建: 2026-03-14
> 最后更新: 2026-03-14

## 一、背景

Agent Trace 的一个核心目标不是只做“聊天记录查看器”，而是要帮助我们分析 AI 客户端在底层到底发送了什么、注入了什么、如何组织上下文。

这带来一个天然矛盾：

1. 如果完全按原始数据渲染，对话列表会被大量 system reminder、hook 输出、技能列表、项目级上下文污染，可读性很差。
2. 如果简单把这些内容过滤掉，虽然对话好看了，但我们会失去对底层运行逻辑的可观察性，无法继续做“学习分析 / 逆向理解”。

因此，这次改造的目标不是“把噪声删掉”，而是把同一份底层数据变成多种可切换的分析视图。

## 二、基于真实数据的结论

这份方案不是凭空猜测，而是根据本地真实历史数据整理出来的。

### 2.1 数据存储现状

本地数据位于 Electron userData 目录：

- SQLite: `~/Library/Application Support/agent-trace/agent-trace.db`
- Profiles: `~/Library/Application Support/agent-trace/profiles.json`

数据库中同时保留：

- `sessions`：会话级标题、模型、更新时间、matcher 状态
- `exchanges`：原始请求/响应头、原始 body、`normalized_json`、`inspector_json`

这说明当前系统已经具备“原始数据永远保留”的基础，不需要为了新方案增加新的底层采集通道。

### 2.2 Anthropic 真实数据特征

根据本地 `normalized_json`，Anthropic 的 `request.inputMessages` 具备以下特点：

1. 它是快照式的。
   每个 exchange 的 request 都会携带“当前时刻完整上下文”，包括历史 user/assistant 消息。

2. 第一条 user message 经常不是自然用户输入，而是 system 注入的容器。
   真实内容里出现了：
   - `<system-reminder> SessionStart:startup hook success ...`
   - 可用 skills 列表
   - `CLAUDE.md` / 项目上下文注入

3. 真正的用户消息可能和这些 system-reminder 混在同一个 user message 的多个 text block 中。

4. 当前 title 解析、timeline 渲染如果不做分类，就会把这些底层注入内容误判成“普通 user 消息”。

### 2.3 OpenAI / Codex 真实数据特征

Codex/OpenAI Responses 更接近增量式结构：

1. 每个 exchange 只追加当前 turn。
2. timeline 目前按 exchange 叠加的方向是对的。
3. 但后续同样可能出现 developer/system 注入、tool 输出、reasoning summary 等需要区分展示层级的内容。

### 2.4 当前代码中的关键问题

当前实现的问题不在“有没有原始数据”，而在“展示层没有区分消息类型”。

现状：

- `src/main/providers/protocol-adapters/anthropic-messages/timeline-assembler.ts`
  - 直接把最后一个 exchange 的 `request.inputMessages + response.outputMessages` 当成对话列表
- `src/main/providers/protocol-adapters/openai-responses/timeline-assembler.ts`
  - 只做 system 去重，不做更细粒度分类
- `src/renderer/src/components/conversation-view.tsx`
  - 只有单一 Conversation 渲染路径
- `src/renderer/src/components/message-block.tsx`
  - 只有 role 维度，没有“来源类别 / 可见性 / 分析标签”

这意味着：

- 默认视图不可读
- 底层上下文没有被结构化呈现
- 研究价值和产品可用性都没有被最大化

## 三、目标

### 3.1 功能目标

1. 默认视图应当能清晰看到“真正的对话”。
2. 所有底层消息依然必须可见，不能因为清洗而消失。
3. 用户可以区分：
   - 真正对话
   - 系统注入
   - hook 输出
   - meta prompt
   - tool call / tool result
   - system/developer instructions
4. 视图切换不依赖重新抓包，不改变原始存储。

### 3.2 架构目标

1. 原始数据零损失。
2. 分类逻辑在 main process 完成，不放到 renderer 临时猜。
3. Timeline 是“可分析的结构化视图模型”，而不是仅仅一串消息数组。
4. 新增逻辑能同时服务：
   - session title 推导
   - conversation 列表
   - context 分析视图
   - 搜索与过滤

### 3.3 非目标

这次不做：

1. 改动采集链路和代理协议处理方式
2. 改写数据库 schema 去迁移历史原始数据
3. 在 renderer 中直接解析 raw request body
4. 做完整“提示词逆向报告”自动生成

## 四、设计原则

### 原则 1：Raw 永远保留

数据库中的 raw request/response、normalized、inspector 都保留原样。

### 原则 2：分类而不是删除

任何“清洗”都只能生成派生视图，不允许覆盖原始消息。

### 原则 3：多视图而不是单视图

同一 session 至少要支持三种观察方式：

1. `Conversation`
   适合阅读真实对话
2. `Context`
   适合分析被注入的底层上下文
3. `Raw`
   适合查看最底层 message blocks / JSON

### 原则 4：隐藏不是消失

在 `Conversation` 视图中，被折叠的底层消息要能明确感知到存在，例如：

- `Hidden system context (3 items)`
- `Hidden meta prompt (1 item)`

点击后可展开看原文。

## 五、核心方案

## 5.1 引入“分析型 timeline message”

当前 `SessionTimeline` 只有：

```ts
{
  messages: NormalizedMessage[]
}
```

这不足以表达“分类、可见性、来源、折叠”。

建议扩展为：

```ts
interface TimelineMessageVM {
  id: string;
  role: "system" | "user" | "assistant" | "tool" | "unknown";
  blocks: NormalizedMessageBlock[];
  category:
    | "conversation"
    | "system-reminder"
    | "instruction"
    | "meta-prompt"
    | "tool-call"
    | "tool-result"
    | "reasoning"
    | "unknown";
  source:
    | "request-input"
    | "response-output"
    | "request-instructions";
  visibility: "primary" | "secondary" | "hidden";
  derivedFromExchangeId?: string;
  annotations?: string[];
}

interface TimelineHiddenGroupVM {
  id: string;
  kind: "hidden-group";
  category: "system-reminder" | "instruction" | "meta-prompt" | "unknown";
  count: number;
  messages: TimelineMessageVM[];
}

interface SessionTimeline {
  messages: Array<TimelineMessageVM | TimelineHiddenGroupVM>;
}
```

这里的关键点是：

1. `role` 仍然保留，兼容现有消息语义。
2. `category` 才是分析层的主维度。
3. `visibility` 用于默认视图控制，而不是物理删除。
4. `source` 帮我们回答“这段内容来自 request 还是 response，还是 instructions”。

## 5.2 建立统一的消息分类器

新增一层 shared provider runtime 工具，例如：

- `src/main/providers/protocol-adapters/shared/classify-message.ts`
- `src/main/providers/protocol-adapters/shared/build-analysis-timeline.ts`

职责：

1. 判断一个 message / block 是否属于：
   - 普通对话
   - system reminder
   - instruction 注入
   - meta prompt
   - tool 调用
   - tool 结果
   - reasoning

2. 生成统一的 `TimelineMessageVM`

3. 对 Anthropic 和 OpenAI 复用相同规则，provider 只负责补充自己的装配方式

### 建议规则

#### A. `system-reminder`

满足任一条件：

- text block 以 `<system-reminder>` 开头
- 清洗后以 `SessionStart:` / `hook ` / `startup ` 开头
- 明显是 hook 输出包装内容

#### B. `instruction`

来源是 `request.instructions`

这些内容不能继续混在主对话里，应该进入 `Context` 视图或 Conversation 顶部折叠区。

#### C. `meta-prompt`

例如：

- `[SUGGESTION MODE: ...]`
- 明显的代理控制提示
- 不是用户自然输入，而是上层工具模式注入

#### D. `conversation`

真正给用户看的自然语言消息：

- 用户自然输入
- assistant 自然回复

#### E. `tool-call` / `tool-result`

保持结构化，不把它们降级成纯文本。

#### F. `reasoning`

保留，但默认折叠。

## 5.3 Provider 装配策略

### Anthropic

Anthropic 仍然使用“快照策略”，但不是直接拿最后一个 exchange 的原始 `inputMessages`。

应改为：

1. 取最后一个 exchange 作为当前快照
2. 把其中的 `request.inputMessages` 和 `response.outputMessages` 映射成分类后的 `TimelineMessageVM`
3. 对 `request.instructions` 单独映射成 `instruction` 类别
4. 在 build 结束前做隐藏分组

换言之：

- “快照”保留
- “直接渲染 raw normalized messages”取消

### OpenAI / Codex

OpenAI 仍然使用“增量策略”。

但在每次 push 进 timeline 前：

1. 先分类
2. 再做 system / instruction / meta prompt 的可见性处理
3. 最后对相邻隐藏项做分组

## 5.4 三层 UI 视图设计

### View A: Conversation

默认显示：

- `conversation`
- `tool-call`
- `tool-result`
- `reasoning`（折叠）

默认折叠：

- `system-reminder`
- `instruction`
- `meta-prompt`
- `unknown`

折叠后显示占位组，例如：

- `Hidden system context (2 messages)`
- `Hidden injected instructions (1 section)`
- `Hidden meta prompt (1 message)`

### View B: Context

专门用于分析底层上下文。

显示：

- `instruction`
- `system-reminder`
- `meta-prompt`
- `unknown`

可以按来源分组：

- Request instructions
- Request input injections
- Hidden prompt wrappers

这个视图的目标不是“聊天体验”，而是“解释这次交互前到底塞了什么”。

### View C: Raw

保留现有 raw mode，但职责更加明确：

- 不做语义分类解释
- 直接展示 message blocks / JSON

这层是最底保底视图，用来验证分类器有没有误判。

## 5.5 Conversation 与 Context 之间的关系

建议不要做成页面级路由切换，而做成 conversation header 下的 tab：

- `Conversation`
- `Context`
- `Raw`

这样切换成本最低，也最符合“同一份数据、不同观察角度”的心智模型。

## 六、具体落点

## 6.1 Shared contracts

需要改动：

- `src/shared/contracts/session.ts`
- `src/shared/contracts/view-models.ts`

目标：

1. 扩展 `SessionTimeline`
2. 引入 `TimelineMessageVM`
3. 引入 `TimelineHiddenGroupVM`
4. 给 renderer 一个稳定的、带分类信息的 VM

## 6.2 Main process

需要改动：

- `src/main/providers/protocol-adapters/anthropic-messages/timeline-assembler.ts`
- `src/main/providers/protocol-adapters/openai-responses/timeline-assembler.ts`
- 新增 `src/main/providers/protocol-adapters/shared/classify-message.ts`
- 新增 `src/main/providers/protocol-adapters/shared/build-analysis-timeline.ts`

目标：

1. 统一分类逻辑
2. provider 只负责“如何取消息”，shared 负责“如何解释消息”
3. query service 输出的 timeline 已经是可分析的结构化数据

## 6.3 Renderer

需要改动：

- `src/renderer/src/components/conversation-view.tsx`
- `src/renderer/src/components/message-block.tsx`
- `src/renderer/src/components/content-block.tsx`
- `src/renderer/src/components/conversation-header.tsx`
- 可能新增：
  - `context-view.tsx`
  - `timeline-hidden-group.tsx`
  - `timeline-tabs.tsx`

目标：

1. 默认 Conversation 不再被 system-reminder 淹没
2. Context 视图可以完整看到底层 injected context
3. Raw 继续作为最底层校验入口

## 6.4 Title 解析联动

当前 title 解析已经修过一次，但后续建议复用同一套分类规则。

方向：

- title 应当只从 `conversation` 类 user message 中找
- 明确排除 `system-reminder` / `instruction` / `meta-prompt`

这样标题推导和 conversation 视图会保持一致，不会再次出现“列表标题来自 hook 输出，但正文又被隐藏”的割裂感。

## 七、实施步骤

### Phase 1：数据模型与分类器

1. 扩展 shared contracts
2. 实现 `classify-message.ts`
3. 为真实出现过的模式写单测：
   - `<system-reminder>`
   - skill 列表注入
   - `CLAUDE.md` 注入
   - `[SUGGESTION MODE: ...]`
   - 普通 user/assistant 文本
   - tool call / tool result

### Phase 2：Timeline assembler 改造

1. 改 Anthropic assembler
2. 改 OpenAI assembler
3. 增加隐藏组聚合逻辑
4. 基于真实 fixture 和本地样本补回归测试

### Phase 3：Renderer 多视图

1. Conversation / Context / Raw tabs
2. MessageBlock 支持 category 标签
3. Hidden group 折叠组件
4. Reasoning / tool 结果的交互优化

### Phase 4：回归验证

1. 本地真实历史数据人工检查
2. Anthropic 快照会话检查
3. OpenAI/Codex 增量会话检查
4. Raw 与 Context 内容一致性检查
5. 标题、sidebar、conversation header 一致性检查

## 八、风险与取舍

### 风险 1：分类误伤

有些真实用户消息可能恰好长得像 system-reminder 或 meta prompt。

缓解：

1. 分类规则保守
2. 一律保留 Raw 视图
3. 被隐藏的内容可展开
4. 分类规则尽量基于 wrapper/source，而不是纯文本关键词

### 风险 2：Anthropic 快照与 OpenAI 增量策略继续分裂

两个 provider 的 timeline 来源不同，很容易各做各的。

缓解：

共享“分类 + 可见性 + 隐藏组”层，让 provider 只保留“消息来源装配差异”。

### 风险 3：UI 复杂度上升

多 tab、多类别、多折叠会让组件层复杂一些。

缓解：

1. 先把复杂度放在 VM 层
2. renderer 只消费已经结构化的 timeline
3. 保持 Raw 视图尽量简单

## 九、验收标准

方案完成后，应满足：

1. 默认 Conversation 视图只显示主要对话，不被 reminder/context 淹没
2. Context 视图能完整看到注入的底层上下文
3. Raw 视图仍能看到最底层 message blocks
4. 三个视图之间的数据是同源投影，不存在“某条消息彻底丢失”
5. Anthropic 真实历史样本中：
   - `我爱你`
   - `你是谁`
   - `你会什么`
   等自然消息能正确出现在 Conversation
6. 像 `<system-reminder>`、skills 列表、`CLAUDE.md` 注入应进入 Context 或折叠组
7. Title、sidebar、conversation header 使用一致的“有效用户输入”规则

## 十、结论

这次改造不应该走“清洗后替换原始数据”的路线，而应走“保留原始数据、构建分析型多视图”的路线。

最终目标不是把底层逻辑藏起来，而是把它们从“对话噪声”升级为“可研究、可切换、可解释的上下文层”。

这能同时满足两个需求：

1. 产品可用性：对话默认可读
2. 研究价值：底层上下文完整可观察
