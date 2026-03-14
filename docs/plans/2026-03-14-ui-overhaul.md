# UI Overhaul: radix-lyra 主题迁移 + 布局重构

> 状态: **全部完成 ✅**
> 创建: 2026-03-14
> 最后更新: 2026-03-14 17:10

## 一、这个需求是干什么的

Agent Trace 当前的 UI 有两层问题需要一起解决：

**底层问题：shadcn 主题过时**

项目使用的是 shadcn `new-york` 风格，对应的是旧版组件 API。目标主题是 `radix-lyra`（preset `auFywKm`），具体配置为：

- Style: Lyra（组件使用 `rounded-none`，锐角设计）
- Font: Inter Variable
- Base Color: Neutral
- Radius: None
- Menu: Default / Solid
- Menu Accent: Subtle

两套风格的组件 API 不兼容（Button 的 variant class、Slot import 路径、size 定义都不同），必须重新生成所有 UI 原子组件。

**布局问题：信息展示不完整，交互不够顺畅**

1. Profile 管理藏在 Settings 弹窗里，不直观
2. Session 列表没有 provider 筛选和日期分组
3. Inspector 面板需要手动打开，且不显示 token usage / stop reason / sizes
4. Onboarding 是传统表单，缺少引导感
5. Tool call 和 tool result 没有通过 callId 关联展示
6. System instructions 在 conversation 里不可见
7. 已捕获但未展示的数据：token usage、stop reason、request/response size、error details

## 二、方案是什么

分两个阶段执行，顺序不可调换：

### Phase 1：radix-lyra 主题迁移

把 shadcn 底层从 `new-york` 切换到 `radix-lyra`。这是一个纯机械性变更，不改任何业务逻辑和布局结构。

**变更范围：**
- `components.json` — style 从 `new-york` 改为 `radix-lyra`
- `package.json` — 新增 `@fontsource-variable/inter`、`tw-animate-css`、`radix-ui`；移除不再需要的 `@radix-ui/react-*` 分包
- `src/renderer/src/index.css` — 替换为 Lyra 主题变量（Inter 字体、半透明 dark border、新 radius 计算、chart 色值）
- `src/renderer/src/components/ui/*` — 用 `shadcn add` 重新生成所有组件
- 业务组件中的 `@radix-ui/react-slot` import — 改为 `radix-ui`

**不变的：**
- 所有业务组件的功能逻辑
- Store / IPC / hook 层
- 测试
- 布局结构

**验收标准：**
- `pnpm typecheck` 通过
- `pnpm test` 通过
- `pnpm build` 通过
- `pnpm dev` 启动后视觉正常，所有页面可交互

### Phase 2：布局重构 + 数据展示增强

在 Lyra 组件基础上重构布局，补全缺失的数据展示。

**功能清单（零丢失 + 新增）：**

所有现有功能保留，具体见下方步骤中的逐项对照。新增的数据展示：

| 数据 | 来源 | 展示位置 |
|------|------|---------|
| Token usage (input/output/reasoning) | NormalizedUsage | Inspector Overview 卡片 |
| Stop reason | NormalizedExchange.response.stopReason | Inspector Overview 行 |
| Request/Response size | CapturedExchange.requestSize/responseSize | Inspector Overview 行 |
| Profile name | SessionListItemVM.profileId → profile lookup | Inspector Overview 行 |
| Endpoint kind | NormalizedExchange.endpointKind | Inspector Overview 行 |
| Tool callId | NormalizedMessageBlock.callId | Conversation tool 块底部 |
| Tool-result isError | NormalizedMessageBlock.isError | Conversation result 块红色标记 |
| Reasoning token count | NormalizedUsage.reasoningTokens | Reasoning 折叠标题 |
| System instructions | NormalizedExchange.request.instructions | Conversation 顶部系统消息 |
| Profile 端口 + 运行状态 | ConnectionProfile + statuses | Settings profile 行 |
| enabled / autoStart | ConnectionProfile | Settings profile 行 |

**视觉 mockup：** `docs/ui-mockups/redesign-proposal.html`

## 三、按步骤执行的计划

> 每一步完成后，更新本节对应步骤的状态标记：
> - ⬜ 未开始
> - 🔄 进行中
> - ✅ 完成
> - ⏭️ 跳过（附原因）

---

### Phase 1：radix-lyra 主题迁移

#### Step 1.1 ✅ 安装新依赖、移除旧依赖

```bash
pnpm add @fontsource-variable/inter tw-animate-css radix-ui
pnpm remove @radix-ui/react-slot
```

检查 `package.json`，确认 `radix-ui` 和字体包已加入 dependencies。

验证：`pnpm install` 无报错。

#### Step 1.2 ✅ 更新 components.json

把 `components.json` 更新为：

```json
{
  "$schema": "https://ui.shadcn.com/schema.json",
  "style": "radix-lyra",
  "rsc": false,
  "tsx": true,
  "tailwind": {
    "config": "",
    "css": "src/renderer/src/index.css",
    "baseColor": "neutral",
    "cssVariables": true,
    "prefix": ""
  },
  "iconLibrary": "lucide",
  "rtl": false,
  "aliases": {
    "components": "@/components",
    "utils": "@/lib/utils",
    "ui": "@/components/ui",
    "lib": "@/lib",
    "hooks": "@/hooks"
  },
  "menuColor": "default",
  "menuAccent": "subtle",
  "registries": {}
}
```

#### Step 1.3 ✅ 替换 index.css 主题变量

用 Lyra preset 生成的 CSS 替换 `src/renderer/src/index.css`。关键变更：

- 新增 `@import "tw-animate-css"`、`@import "shadcn/tailwind.css"`、`@import "@fontsource-variable/inter"`
- `@theme inline` 中新增 `--font-sans: 'Inter Variable', sans-serif` 和新的 radius 计算
- dark mode 中 `--border` 改为半透明 `oklch(1 0 0 / 10%)`
- dark mode 中 `--card`/`--popover`/`--sidebar` 改为 `oklch(0.205 0 0)`（比 background 略亮）
- `@layer base` 中 `html` 加 `font-sans`，`*` 加 `outline-ring/50`
- 保留项目特有的 `.drag-region` 样式

验证：`pnpm build` 通过（CSS 编译无报错）。

#### Step 1.4 ✅ 重新生成所有 UI 组件

先备份现有组件：

```bash
cp -r src/renderer/src/components/ui src/renderer/src/components/ui-backup
```

逐个用 shadcn CLI 重新生成（因为 electron-vite 的路径结构，可能需要手动从 shadcn 生成的文件复制内容）：

需要重新生成的组件清单：
- button
- badge
- input
- label
- dialog
- switch
- scroll-area
- tabs
- separator
- tooltip
- command (cmdk)
- sonner

每个组件生成后：
1. 检查 import 路径是否正确（`@/lib/utils` 等 alias）
2. 检查 `radix-ui` 统一包 import 替代了旧的 `@radix-ui/react-*` 分包
3. 检查 CVA variant 是否与业务组件的使用方式兼容

#### Step 1.5 ✅ 修复业务组件中的 breaking changes

遍历所有使用 UI 组件的业务代码，修复因 API 变更导致的问题：

1. Button size `"icon"` 是否仍然存在（Lyra 有 `icon`/`icon-xs`/`icon-sm`/`icon-lg`）
2. Badge variant 是否兼容
3. 任何直接引用 `@radix-ui/react-slot` 的地方改为 `radix-ui`
4. `resizable.tsx` 组件（react-resizable-panels）不是 shadcn 组件，不需要重新生成，但检查是否受 CSS 变量影响

#### Step 1.6 ✅ 验证 Phase 1 完成

```bash
pnpm typecheck
pnpm test
pnpm build
```

全部通过后，`pnpm dev` 启动，人工检查：
- [ ] Onboarding 页面渲染正常
- [ ] Workspace 页面三栏布局正常
- [ ] Session 列表可点击
- [ ] Conversation 消息渲染正常
- [ ] Inspector 面板可打开/关闭
- [ ] Settings 弹窗正常
- [ ] Command palette (⌘K) 正常
- [ ] Dark mode 样式正确

确认后删除备份：`rm -rf src/renderer/src/components/ui-backup`

---

### Phase 2：布局重构

#### Step 2.1 ✅ Sidebar 重构：Profile Switcher + Provider Filter + 日期分组

**改动文件：**
- `src/renderer/src/components/session-sidebar.tsx`
- `src/renderer/src/components/session-item.tsx`
- 新建 `src/renderer/src/components/profile-switcher.tsx`

**功能对照：**

| 现有功能 | 保留方式 |
|---------|---------|
| "All providers" 标题 | 替换为 Profile Switcher 组件 |
| "{N} traced sessions" 计数 | 保留在 filter tabs 旁边 |
| 搜索框 | 保留，位置不变 |
| Session 列表 (title, model, provider, count, time) | 全保留 + 增加日期分组 |
| 空状态 (EmptyState) | 保留 |

**新增：**
- Profile Switcher：显示当前 profile 名称、端口、运行状态（绿点）、下拉切换
- Provider Filter Tabs：All / Anthropic / Codex（按 providerLabel 过滤）
- 日期分组：Today / Yesterday / This Week / Earlier
- Provider Badge 颜色编码：Anthropic=橙，Codex=绿
- Sidebar 底部：+ New Profile、Settings 快捷入口

**实现细节：**
- Profile Switcher 从 `useProfileStore` 读取 profiles 和 statuses
- Filter tabs 状态存在 `useSessionStore`，新增 `providerFilter` 字段
- 日期分组是纯 UI 计算，不需要改 store 或 IPC

#### Step 2.2 ✅ Conversation Header 增强

**改动文件：**
- `src/renderer/src/components/conversation-header.tsx`

**功能对照：**

| 现有功能 | 保留方式 |
|---------|---------|
| Session title | 保留 |
| Model badge | 保留 |
| Raw mode toggle | 保留 |
| Inspector toggle | 保留 |

**新增：**
- Proxy address 显示 + copy 按钮（从 status bar 移动过来，因为它和当前 session 相关）

#### Step 2.3 ✅ Conversation View 增强

**改动文件：**
- `src/renderer/src/components/conversation-view.tsx`
- `src/renderer/src/components/message-block.tsx`
- `src/renderer/src/components/content-block.tsx`

**功能对照：**

| 现有功能 | 保留方式 |
|---------|---------|
| User message (blue) | 保留 |
| Assistant message (muted) | 保留 |
| Text block + Show more/less | 保留 |
| Reasoning block (purple, collapsible) | 保留 + 增加耗时/token 信息 |
| Tool-call block (blue border, name, JSON input) | 保留 + 增加 callId 和 status |
| Tool-result block (green border, preview, expand) | 保留 + 增加 isError 标记 |
| Unknown block fallback | 保留 |
| Copy button per message | 保留 |
| Raw mode | 保留 |
| Auto scroll to bottom | 保留 |

**新增：**
- System message 类型（cyan 色调，显示 instructions 预览，可展开）
- Tool-call 底部显示 callId（小字灰色）
- Tool-result 的 isError=true 时用红色边框和标记
- Reasoning 折叠标题显示 `💭 Thinking · {duration} · {tokens} tokens`

**数据需求：**
- reasoning duration：需要从 exchange 的 durationMs 或 SSE 时间戳推算。当前 NormalizedUsage 有 reasoningTokens 但没有 duration。可以先只显示 token 数，duration 留空。
- system instructions：从 `SessionTraceVM` 的 timeline 中提取 role=system 的消息（Anthropic adapter 已经把 instructions 标准化为 NormalizedBlock，但 timeline assembler 不包含 instructions）。需要在 SessionTraceVM 中新增 `instructions: NormalizedBlock[]` 字段，从第一个 exchange 的 `normalized.request.instructions` 提取。

#### Step 2.4 ✅ Inspector 面板重构

**改动文件：**
- `src/renderer/src/components/inspector-panel.tsx`
- `src/renderer/src/components/request-item.tsx`

**功能对照：**

| 现有功能 | 保留方式 |
|---------|---------|
| Inspector 标题 + 关闭按钮 | 保留 |
| Requests tab (method, path, status, duration, model) | 保留 |
| Overview section (label-value) | 保留 + 增强 |
| Text section | 保留 |
| Tool-list section (name, desc, schema) | 保留 |
| JSON section | 保留 |
| Raw-request / Raw-response section | 保留 |

**新增数据行（Overview section）：**
- Token Usage 卡片组：input / output / reasoning / total
- Stop Reason 值
- Request Size / Response Size（格式化为 KB）
- Profile 名称
- Endpoint Kind

**数据需求：**
- Token usage 和 stop reason 需要从 `ExchangeDetailVM` 中获取。当前 `ExchangeDetailVM` 只有 `inspector: InspectorDocument`。这些数据已经被 `buildInspector()` 写入了 overview section 的 items 中（label-value pairs）。所以不需要改 VM 或 IPC——只需要在渲染 overview section 时，识别特定 label（如 "Input Tokens"）并用卡片样式渲染。
- 如果 buildInspector 里还没有这些字段，需要在两个 adapter 的 `build-inspector.ts` 中补充。

#### Step 2.5 ✅ Inspector buildInspector 增强

**改动文件：**
- `src/main/providers/protocol-adapters/anthropic-messages/build-inspector.ts`
- `src/main/providers/protocol-adapters/openai-responses/build-inspector.ts`

检查两个 adapter 的 `buildInspector()` 输出，确保 overview section 包含以下 items：
- Provider
- Profile
- Model
- Path
- Status
- Duration
- Stop Reason（新增）
- Input Tokens（新增）
- Output Tokens（新增）
- Reasoning Tokens（新增，如果有）
- Request Size（新增）
- Response Size（新增）

#### Step 2.6 ✅ SessionTraceVM 增加 instructions 字段

**改动文件：**
- `src/shared/contracts/view-models.ts` — `SessionTraceVM` 新增 `instructions: NormalizedBlock[]`
- `src/main/queries/session-query-service.ts` — `getSessionTrace()` 从第一个 exchange 提取 instructions
- `src/renderer/src/components/conversation-view.tsx` — 在 timeline messages 前渲染 instructions

#### Step 2.7 ✅ Onboarding 卡片化

**改动文件：**
- `src/renderer/src/features/profiles/profile-setup-page.tsx` — 重写为卡片选择式
- `src/renderer/src/features/profiles/profile-form.tsx` — 保留作为"手动配置"入口

**功能对照：**

| 现有功能 | 保留方式 |
|---------|---------|
| Profile name 输入 | 卡片选择自动填充，手动配置入口保留 |
| Provider 下拉选择 | 替换为卡片点选 |
| Upstream URL 输入 | 卡片选择自动填充，手动配置入口保留 |
| Local port 输入 | 卡片选择自动填充，手动配置入口保留 |
| Existing profiles 列表 | 保留在卡片页面下方 |

#### Step 2.8 ✅ Settings Dialog 增强

**改动文件：**
- `src/renderer/src/components/settings-dialog.tsx`

**功能对照：**

| 现有功能 | 保留方式 |
|---------|---------|
| Profile 列表 (name, providerId, url) | 保留 + 增加端口、状态开关 |
| Profile count | 保留 |
| 自动更新 (version, status, button) | 保留 |
| 下载进度百分比 | 保留 |

**新增：**
- 每个 profile 行显示端口号
- 每个 profile 行显示运行状态开关（可启停）
- Add Profile 按钮

#### Step 2.9 ✅ Status Bar 更新

**改动文件：**
- `src/renderer/src/components/status-bar.tsx`

**功能对照：**

| 现有功能 | 保留方式 |
|---------|---------|
| "Agent Trace" 标题 | 保留 |
| Profile count badge | 移入 sidebar，status bar 改为显示 "N profiles active" |
| Proxy address + copy | 保留 |
| Settings button | 保留 |
| ⌘K 提示 | 保留 |

**新增：**
- 捕获计数："captured: N exchanges"
- 暗色模式切换按钮

#### Step 2.10 ✅ 验证 Phase 2 完成

```bash
pnpm typecheck
pnpm test
pnpm build
```

全部通过后，`pnpm dev` 启动，人工检查：
- [ ] Onboarding 卡片页：选择 provider → 自动创建 profile → 进入 workspace
- [ ] Profile Switcher：显示名称、端口、绿点状态，下拉可切换
- [ ] Provider Filter：All / Anthropic / Codex 切换正确过滤
- [ ] 日期分组：Today / Yesterday / This Week / Earlier 分组正确
- [ ] Provider Badge：Anthropic=橙，Codex=绿
- [ ] Conversation：User / Assistant / System / Tool 消息渲染正确
- [ ] Reasoning 块：显示 token 数
- [ ] Tool-call 块：显示 callId
- [ ] Tool-result 块：isError=true 显示红色
- [ ] Inspector Overview：token usage 卡片、stop reason、sizes
- [ ] Inspector Requests：method, path, status, duration, model 全显示
- [ ] Inspector Raw：request / response 原始数据可查看
- [ ] Settings：profile 列表含端口、状态开关
- [ ] Command Palette：sessions / profiles / actions 搜索正常
- [ ] Status Bar：捕获计数
- [ ] 暗色模式切换

更新现有测试中因 UI 结构变化而 break 的断言（如 renderer 测试中的文本匹配）。

---

## 四、风险与注意事项

1. **shadcn CLI 兼容性**：electron-vite 的项目结构（renderer 在 `src/renderer/src/`）可能导致 `shadcn add` 无法自动定位文件。如果 CLI 不可用，手动从 preset 项目（`/tmp/shadcn-test/vite-app/`）复制组件代码并调整 import 路径。

2. **resizable panel 不是 shadcn 组件**：`react-resizable-panels` 是独立库，不受主题迁移影响，但需要确认 CSS 变量变化不影响其样式。

3. **测试中的 UI 文本断言**：部分 renderer test 断言具体文本内容（如 "No sessions yet"），布局重构时如果改了文案需要同步更新测试。

4. **instructions 数据流**：Step 2.6 需要改 shared contracts 和 query service，这会影响 IPC 传输的数据量。instructions 可能很长，考虑只传前 500 字符的 preview。

5. **无需数据迁移**：当前没有真实用户数据，SQLite schema 和存储格式不变，不需要任何数据迁移。
