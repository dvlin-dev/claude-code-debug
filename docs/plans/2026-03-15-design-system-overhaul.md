---
title: Design System Overhaul — e2b-Inspired Minimal Industrial
status: draft
---

# Design System Overhaul

## 背景

当前 UI 沿用了 shadcn/ui 默认脚手架样式，各模块独立添加颜色和间距，缺乏统一视觉语言。参照 e2b.dev Dashboard 的设计规范，需要在保持方正（`rounded-none`）工业风基底的前提下，完成一次系统性的视觉收敛。

### e2b 核心设计语言（来自截图分析）

| 维度 | 做法 |
|------|------|
| 配色 | 近乎黑白灰底色，仅 1 种品牌强调色（橙），绿色专供 LIVE 状态指示 |
| 字号 | 严格 3 层：Display（32px+大数字）、Body（14px）、Caption（11px 大写 + 字间距） |
| 卡片 | 白底 + 极细 1px 边框，内部宽松留白，不使用彩色背景 |
| 侧栏 | 图标 + 文字菜单项，按大写字母分组（INTEGRATION / TEAM / BILLING） |
| 状态栏 | 底部，终端风格：路径 + 系统状态（绿点 + ALL SYSTEMS OPERATIONAL） |
| 交互 | 选中项用品牌色文字（非填充背景），hover 用极浅灰底 |
| 留白 | 大量呼吸空间，卡片间、卡片内均有充足 padding |

### 当前问题

1. **配色噪音** — 每种角色/类型都有独立色系（蓝/青/品红/绿/红/橙），对话视图像调色板
2. **字号散乱** — 使用了 8/9/10/11/12/14/16px 共 7 级字号，无清晰层级
3. **消息卡片过重** — user=蓝底、system=青底、reasoning=品红底，视觉权重过高
4. **侧栏层级缺失** — 仅有日期分组，缺少视觉节奏
5. **状态栏位置浪费** — 顶部标题栏占据了宝贵空间，与 macOS 交通灯区域冲突
6. **间距紧凑** — 按钮、Badge、列表项贴得太近，缺少呼吸感
7. **交互状态粗糙** — hover 和 selected 都是同一个 `bg-accent` 填充

---

## 方案总览

7 个改造区域，按视觉冲击力排序：

```
1. 配色体系  ─→  收敛到单品牌色 + 语义色
2. 消息卡片  ─→  统一白底，角色用左边框 + 小标签区分
3. 字号规范  ─→  4 级严格量表
4. 状态栏    ─→  移至底部，终端风格
5. 侧栏节奏  ─→  增加分组标签，放大间距
6. 间距系统  ─→  全局松化
7. 交互状态  ─→  精细化 hover/selected/focus
```

---

## 1. 配色体系

### 原则

- 基底保持黑白灰（OKLCH 无彩色，已有良好基础）
- 新增 1 个品牌强调色变量 `--accent-brand`，用于选中态、激活态、链接
- 语义色仅保留 `success`（绿）和 `error`（红），不再按角色分配颜色
- Context Chip 的多色方案保留但降低饱和度

### 新增 CSS Token

```css
:root {
  /* 品牌强调 — 暖橙（参考 e2b） */
  --accent-brand: oklch(0.75 0.15 55);
  --accent-brand-foreground: oklch(0.98 0 0);
  --accent-brand-muted: oklch(0.75 0.15 55 / 10%);

  /* 语义色（已有，微调） */
  --success: oklch(0.65 0.18 145);
  --success-muted: oklch(0.65 0.18 145 / 10%);
  --warning: oklch(0.75 0.15 75);
  --warning-muted: oklch(0.75 0.15 75 / 10%);
}

.dark {
  --accent-brand: oklch(0.78 0.14 55);
  --accent-brand-muted: oklch(0.78 0.14 55 / 15%);
}
```

### 变更映射

| 位置 | 当前 | 改为 |
|------|------|------|
| SessionItem 选中 | `bg-accent` | `border-l-2 border-accent-brand bg-accent-brand-muted` |
| Provider Badge（Anthropic） | `bg-orange-500/10 text-orange-500` | `bg-accent-brand-muted text-accent-brand` |
| Provider Badge（Codex） | `bg-emerald-500/10 text-emerald-500` | `bg-success-muted text-success` |
| 状态栏 LIVE 绿点 | `bg-emerald-500` | `bg-success` |
| User 消息背景 | `bg-blue-50 border-blue-200` | `bg-card border-border` |
| System 消息背景 | `bg-cyan-50 border-cyan-200` | `bg-card border-border` |
| Assistant 消息背景 | `bg-muted/50 border-border` | `bg-card border-border` |
| Reasoning 背景 | `bg-fuchsia-50 border-fuchsia-200` | `bg-card border-l-2 border-l-fuchsia-400` |
| Tool call 背景 | `bg-blue-50 border-l-blue-500` | `bg-card border-l-2 border-l-muted-foreground/40` |
| Tool result (ok) | `bg-green-50 border-l-green-500` | `bg-card border-l-2 border-l-success` |
| Tool result (err) | `bg-red-50 border-l-red-500` | `bg-card border-l-2 border-l-destructive` |

### Context Chip 降饱和

保留多色分类，但从 `500` 降到 `400`，背景 opacity 从 `5%` 降到 `3%`：

```
border-l-cyan-500  →  border-l-cyan-400/70
bg-cyan-500/5      →  bg-cyan-400/3
```

---

## 2. 消息卡片

### 当前结构

```
┌─ bg-blue-50 border-blue-200 ─────────────────┐  ← 颜色过重
│  [USER]                            [Copy]     │
│  message text ...                             │
│  ┌─ border-l-2 border-blue-500 bg-blue-50 ─┐ │  ← 嵌套颜色
│  │  tool-call: Read                         │ │
│  └──────────────────────────────────────────┘ │
└───────────────────────────────────────────────┘
```

### 目标结构

```
┌─ bg-card border border-border ────────────────┐  ← 统一容器
│  ● user  ·  model-name              [Copy]    │  ← 小圆点 + 角色文字
│                                               │
│  message text ...                             │
│                                               │
│  ┃ Read                                       │  ← 左边框仅 2px，无背景
│  ┃ {"file_path": "..."}                       │
│                                               │
│  ┃ ✓ Result                                   │  ← success 用绿色边框
│  ┃ file contents...                           │
└───────────────────────────────────────────────┘
```

### 具体变更

**MessageBlock 容器：**
```tsx
// Before
const containerStyle = isUser
  ? "bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800"
  : isSystem
    ? "bg-cyan-50 dark:bg-cyan-950/30 border border-cyan-200 dark:border-cyan-800"
    : "bg-muted/50 border border-border";

// After — 统一白底
const containerStyle = "bg-card border border-border";
```

**角色指示器：** 替换彩色 Badge 为小圆点 + 灰色文字
```tsx
// Before
<Badge variant={badgeVariant} className={cn("text-[10px]", badgeClass)}>
  {message.role.toUpperCase()}
</Badge>

// After
<span className="flex items-center gap-1.5 text-xs text-muted-foreground">
  <span className={cn(
    "inline-block h-1.5 w-1.5 rounded-full",
    isUser ? "bg-accent-brand" : isSystem ? "bg-muted-foreground/50" : "bg-foreground/30",
  )} />
  {message.role}
</span>
```

**Tool call / Tool result — 去掉背景色：**
```tsx
// Before (tool-call)
"border-l-2 border-blue-500 bg-blue-50 dark:bg-blue-950/20"

// After
"border-l-2 border-muted-foreground/30"
```

```tsx
// Before (tool-result success)
"border-green-500 bg-green-50 dark:bg-green-950/20"

// After
"border-l-2 border-success"
// error:
"border-l-2 border-destructive"
```

**Reasoning — 保留品红但仅作边框：**
```tsx
// Before
"bg-fuchsia-50 dark:bg-fuchsia-950/30 border border-fuchsia-200 dark:border-fuchsia-800"

// After
"border-l-2 border-fuchsia-400/60"
```

---

## 3. 字号规范

### 4 级量表

| 级别 | 尺寸 | 用途 | Tailwind |
|------|------|------|----------|
| **Display** | 18px | 页面标题、空状态大文字 | `text-lg` |
| **Body** | 14px | 消息正文、session 标题、主内容 | `text-sm` |
| **Label** | 12px | 按钮、Badge、输入框、时间戳 | `text-xs` |
| **Caption** | 11px | 分组标题（大写 + 字间距）、次要元数据 | `text-[11px]` |

### 废弃

- `text-[8px]` — 全部提升到 `text-[11px]`（Provider 标签 AN/CX）
- `text-[9px]` — 全部提升到 `text-xs`（端口号、快捷键提示、toggle 按钮）
- `text-[10px]` — 全部提升到 `text-[11px]` 或 `text-xs`
- `text-base` (16px) — Inspector Token 数值保留为 `text-lg`（Display 级）

### 逐文件变更

| 文件 | 当前 | 改为 |
|------|------|------|
| `profile-switcher.tsx` | `text-[8px]`（tag）、`text-[10px]`（name）、`text-[9px]`（port/btn） | `text-[11px]`、`text-xs`、`text-xs` |
| `session-item.tsx` | `text-[10px]`（badges、time） | `text-[11px]` |
| `status-bar.tsx` | `text-[10px]`、`text-[9px]`（⌘K） | `text-[11px]`、`text-xs` |
| `context-chip.tsx` | `text-[11px]`（label）、`text-[9px]`（badge） | `text-[11px]`、`text-[11px]` |
| `inspector-panel.tsx` | `text-[10px]`、`text-[11px]` | `text-[11px]`、`text-xs` |
| `session-sidebar.tsx` | `text-[10px]`（日期组标题） | `text-[11px]` |
| `conversation-header.tsx` | `text-[10px]`（badge） | `text-[11px]` |
| `profile-setup-page.tsx` | `text-[10px]`、`text-[9px]` | `text-[11px]`、`text-xs` |

---

## 4. 状态栏重构

### 当前布局

```
┌─ StatusBar (TOP, h-10) ──────────────────────────────────────┐
│  [dragRegion + pl-16] Agent Trace     :8888  │ 3 sessions │ ⚙ │ ⌘K │
├──────────────────────────────────────────────────────────────┤
│  Sidebar (25%)          │  MainContent (75%)                 │
```

### 目标布局

```
┌─ DragRegion (TOP, h-8, transparent) ─────────────────────────┐
│  [macOS traffic lights]                                      │
├──────────────────────────────────────────────────────────────┤
│  Sidebar (25%)          │  MainContent (75%)                 │
│                         │                                    │
│                         │                                    │
├──────────────────────────────────────────────────────────────┤
│  Agent Trace v0.x │ >_profile@127.0.0.1:8888  │ ● LISTENING │ ⚙ │ ⌘K │
└─ StatusBar (BOTTOM, h-8) ────────────────────────────────────┘
```

### 具体变更

**`workspace-page.tsx` — 调换顺序：**
```tsx
// Before
<div className="flex h-screen flex-col">
  <StatusBar />           {/* 顶部 */}
  <div className="flex-1">...</div>
</div>

// After
<div className="flex h-screen flex-col">
  <div className="drag-region h-8 shrink-0" />  {/* 极简拖拽区 */}
  <div className="flex-1 overflow-hidden">...</div>
  <StatusBar />           {/* 底部 */}
</div>
```

**`status-bar.tsx` — 终端风格重写：**
```tsx
// 底部状态栏
<div className="flex h-8 items-center justify-between border-t px-4 text-[11px]">
  {/* 左: 应用标识 */}
  <span className="font-medium text-muted-foreground">Agent Trace</span>

  {/* 中: 终端路径 */}
  <span className="font-mono text-muted-foreground">
    {runningProfile
      ? `>_${runningProfile.name.toLowerCase()}@127.0.0.1:${port}`
      : ">_idle"}
  </span>

  {/* 右: 状态 + 工具 */}
  <div className="flex items-center gap-3">
    {primaryPort ? (
      <span className="flex items-center gap-1.5">
        <span className="h-1.5 w-1.5 rounded-full bg-success" />
        <span className="uppercase tracking-wider font-medium text-success">Listening</span>
      </span>
    ) : (
      <span className="flex items-center gap-1.5 text-muted-foreground">
        <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/30" />
        Stopped
      </span>
    )}
    <span className="h-3 w-px bg-border" />
    <button onClick={onSettingsClick}>⚙</button>
    <button onClick={toggleCommandPalette} className="font-mono">⌘K</button>
  </div>
</div>
```

---

## 5. 侧栏节奏

### 日期分组标签 — 匹配 e2b 的 INTEGRATION/TEAM 样式

```tsx
// Before
<div className="px-1 pb-1 pt-3 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
  {group.label}
</div>

// After
<div className="px-4 pb-1.5 pt-5 text-[11px] font-medium uppercase tracking-wider text-muted-foreground/70">
  {group.label}
</div>
```

### ProfileSwitcher — 增加呼吸空间

```tsx
// Before: space-y-2 p-3
// After:  space-y-3 p-4

// ProfileRow padding
// Before: gap-1.5 px-1.5 py-1
// After:  gap-2 px-3 py-2
```

### Session Item — 选中态重设计

```tsx
// Before
"hover:bg-accent"
isSelected && "bg-accent"

// After
"hover:bg-muted/50"
isSelected && "bg-accent-brand-muted border-l-2 border-l-accent-brand"
```

增加 padding：
```tsx
// Before: px-3 py-2.5
// After:  px-4 py-3
```

### 搜索框

```tsx
// Before: h-8 pl-8 text-xs
// After:  h-9 pl-9 text-xs  (稍高，图标居中更好看)
```

---

## 6. 间距系统

### 全局松化

| 位置 | 当前 | 改为 | 说明 |
|------|------|------|------|
| Sidebar header | `p-3` | `p-4` | 顶部区域更宽松 |
| Sidebar session list | `px-2 pb-2` | `px-2 pb-2` | 不变 |
| Session item | `px-3 py-2.5` | `px-4 py-3` | 行高增加 |
| Conversation area | `space-y-4 p-4 max-w-3xl` | `space-y-5 p-6 max-w-4xl` | 更宽阅读区 |
| Message card padding | `p-3` | `p-4` | 内部留白 |
| Conversation header | `px-4 py-2` | `px-4 py-3` | 略松 |
| Inspector header | `px-3 py-2` | `px-4 py-3` | 对齐主区域 |
| Inspector tab bar | `px-2 py-1.5` | `px-3 py-2` | 略松 |

---

## 7. 交互状态

### 三层交互态

| 状态 | 当前 | 改为 |
|------|------|------|
| **Hover** | `bg-accent`（与 selected 相同） | `bg-muted/50`（极浅） |
| **Selected** | `bg-accent` | `bg-accent-brand-muted` + `border-l-2 border-accent-brand` |
| **Focus** | `ring-1 ring-ring/50` | 保持不变 |

### 按钮 hover 细节

```tsx
// Ghost button hover: 保持 hover:bg-muted
// Icon button: 增加 hover:scale-105 transition-transform
```

### 列表项过渡

```tsx
// 确保所有可点击列表项有统一过渡
"transition-colors duration-150"
```

---

## 不变更的部分

- `rounded-none` — 方正风格已与 e2b 一致
- Inter 字体 — 与 e2b 同族
- ResizablePanel 布局 — 仅调整间距
- 深色模式 Token 结构 — 已有良好基础
- Lucide 图标库 — 清晰统一
- Context Chip 多色分类逻辑 — 仅降饱和度
- 安装向导（ProfileSetupPage）流程 — 仅字号对齐

---

## 受影响文件清单

| 文件 | 变更类型 |
|------|----------|
| `src/renderer/src/index.css` | 新增 Token（accent-brand、success、warning） |
| `src/renderer/src/components/status-bar.tsx` | 重写：移至底部，终端风格 |
| `src/renderer/src/pages/workspace-page.tsx` | 布局调整：StatusBar 移到底部，顶部加 drag region |
| `src/renderer/src/components/message-block.tsx` | 去颜色背景，统一白底容器，角色指示器改圆点 |
| `src/renderer/src/components/content-block.tsx` | 去背景色，仅保留 border-left |
| `src/renderer/src/components/session-item.tsx` | 选中态改 border-left，字号提升，间距松化 |
| `src/renderer/src/components/session-sidebar.tsx` | 日期组标签样式，搜索框高度，整体间距 |
| `src/renderer/src/components/profile-switcher.tsx` | 字号提升（8→11, 9→12, 10→12），间距松化 |
| `src/renderer/src/components/conversation-header.tsx` | 字号对齐，间距松化 |
| `src/renderer/src/components/conversation-view.tsx` | max-w 放宽，间距增大 |
| `src/renderer/src/components/context-chip.tsx` | 颜色降饱和度 |
| `src/renderer/src/components/inspector-panel.tsx` | 字号对齐，间距松化 |
| `src/renderer/src/components/request-item.tsx` | 字号对齐 |
| `src/renderer/src/components/empty-state.tsx` | 字号对齐到 Display |
| `src/renderer/src/features/profiles/profile-setup-page.tsx` | 字号对齐 |

共 15 个文件，全部在 `src/renderer/src/` 内。无后端变更，无新增依赖。

---

## 实施顺序

```
Phase 1: Token + 消息卡片   — 视觉冲击最大，涉及 index.css + message-block + content-block
Phase 2: 字号归一           — 系统性 find/replace，涉及 10+ 文件
Phase 3: 状态栏迁移         — workspace-page + status-bar 重写
Phase 4: 侧栏打磨           — session-sidebar + session-item + profile-switcher
Phase 5: 间距 + 交互        — 全局 padding/margin 调整 + hover/selected 精细化
Phase 6: 最终验收           — pnpm typecheck + 视觉走查
```

---

## 验收标准

- [ ] `pnpm typecheck` 通过
- [ ] 深色/浅色模式均正常渲染
- [ ] 消息卡片无彩色背景，仅 border-left 区分
- [ ] 最小字号 ≥ 11px（废弃所有 8/9/10px）
- [ ] 状态栏在窗口底部
- [ ] Session 选中态有明确的 brand 色左边框
- [ ] 对话区域 max-w 从 3xl 提升到 4xl
