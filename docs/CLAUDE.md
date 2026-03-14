<!--
[INPUT]: docs/ 下所有协作文档
[OUTPUT]: 文档治理规则
[POS]: docs/ 协作规范

[PROTOCOL]: 仅在 docs 结构、治理规则或入口职责变化时更新本文件；禁止记录时间线。
-->

# docs/ 目录指南

## 结构约束（强制）

- `docs/` 第一层只允许 `design/`、`reference/`、`plans/`、`ui-mockups/` 与根索引/治理文件。
- 架构正文仅允许放在 `docs/design/*`。
- `docs/reference/` 仅允许扁平 Markdown，禁止子目录。
- `docs/plans/` 是执行期临时工作区，PR 合并前必须收敛。
- `docs/ui-mockups/` 存放 HTML 原型，不做文档治理。
- 禁止 `archive/` 目录。

## 文档职责

| 类型 | 职责 | 更新时机 |
|------|------|----------|
| `CLAUDE.md`（根） | 稳定协作边界：目录职责、架构约束、开发命令、关键 gotcha | 仅在边界/结构/契约失效时 |
| `index.md` | 导航入口：一行摘要 + 链接 | 仅在导航失真时 |
| `design/*` | 架构事实源：协议、数据流、模块边界 | 事实变化时直接修改正文 |
| `reference/*` | 稳定规则：发布流程、工程规范、验证基线 | 规则变化时 |
| `plans/*` | 执行期草稿：设计方案、实现计划 | 临时；采纳后迁移到 design/reference |

## 生命周期

状态仅允许 frontmatter `status`: `draft` | `active` | `in_progress` | `completed`。

禁止把 `plan`、`todo`、`draft` 等过程词写进正式文件名。

## 清理原则

- `completed` 文档只保留最终方案与结论，不保留逐轮执行播报。
- PR 合并前：`plans/*` 中被采纳的稳定事实必须回写到 `design/*` 或 `reference/*`，然后删除冗余 plan。
- 同功能文档优先并入单一事实源，避免重复维护。
- 历史过程依赖 git/PR，不在 docs 体系重复维护。
- 禁止时间线日志出现在 CLAUDE.md、index.md、代码注释中。

## 维护流程

1. 确定事实归属（架构 → design，规则 → reference）。
2. 直接修改对应正文。
3. `plans/*` 中被采纳的事实回写后删除冗余 plan。
4. 仅在导航失真时更新 `index.md`。
5. 仅在治理规则变化时更新本文件。
