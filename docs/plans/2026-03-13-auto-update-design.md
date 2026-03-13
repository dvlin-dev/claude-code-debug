# macOS Auto Update Design

**日期:** 2026-03-13

## 目标

为当前 Electron 桌面应用建立一条面向 `macOS -> GitHub Releases` 的自动更新闭环，要求：

- 仅支持 macOS 正式发布渠道
- 直接复用现有 GitHub Release 发版链路
- 主进程、IPC、preload、渲染层职责分离
- 启动后自动检查更新
- 设置页提供完整的手动更新控制
- 渲染层左下角提供更新提示弹窗
- 自动化测试覆盖配置契约、主进程状态流转和渲染层交互

## 约束

- 不引入自定义更新服务、私有 manifest 或历史兼容层
- 不实现 Windows、Linux、多渠道、灰度更新
- 不做旧实现迁移，直接以 `electron-updater + GitHub provider` 为唯一方案
- 自动更新只依赖签名后的 `zip + latest-mac.yml + blockmap`

## 方案选择

### 方案 A：`electron-updater + GitHub provider`

优点：

- 与当前 GitHub Release 流程天然一致
- 配置面最小，维护成本低
- 社区成熟，适合单平台单渠道

缺点：

- 发布资产格式受 `electron-builder` 约束
- 后续如果要灰度或自定义渠道，需要额外演进

### 方案 B：自定义 manifest 服务

优点：

- 灵活度最高
- 便于后续做灰度、渠道、最低支持版本策略

缺点：

- 明显超出当前需求
- 会引入额外服务和长期维护成本

### 方案 C：仅提示用户去 GitHub 下载

优点：

- 实现最少

缺点：

- 不满足自动下载和安装目标

**结论：采用方案 A。**

## 架构设计

### 1. 主进程更新服务

新增独立更新服务模块，单一职责负责：

- 封装 `electron-updater`
- 维护标准化更新状态
- 处理检查、下载、安装和错误映射
- 向外暴露只读状态与订阅能力

主进程其他模块不直接接触 `electron-updater` 实例。

### 2. IPC / preload 边界

通过新的更新专用 channel 暴露以下能力：

- `getUpdateState`
- `checkForUpdates`
- `downloadUpdate`
- `quitAndInstall`
- `onUpdateStateChanged`

preload 只做最薄的桥接，不承载业务逻辑。

### 3. 渲染层状态管理

`AppStore` 统一维护：

- 当前版本
- 更新状态
- 是否正在检查
- 是否存在可下载更新
- 下载进度
- 是否可安装

渲染层所有组件都只读 store，不直接处理 IPC 细节。

### 4. UI 交互

设置页新增一个更新面板，展示：

- 当前版本
- 状态说明
- 检查更新按钮
- 下载更新按钮
- 重启安装按钮

左下角提示弹窗负责全局提醒：

- 检查到新版本时提示
- 下载完成时提示安装
- 更新失败时提示错误

提示统一使用 `sonner`，位置改为左下角。

## 状态模型

定义显式状态，避免字符串散落在代码中：

- `idle`
- `checking`
- `available`
- `not-available`
- `downloading`
- `downloaded`
- `error`

状态对象中保留：

- `currentVersion`
- `availableVersion`
- `downloadPercent`
- `status`
- `message`
- `checkedAt`

## 生命周期

应用启动后：

1. 主窗口初始化
2. 更新服务在 app ready 后启动
3. 延迟触发后台检查，避免阻塞首屏
4. 渲染层在初始化时获取一次当前状态
5. 后续通过推送事件保持同步

## 发布要求

`electron-builder` 必须声明 GitHub publish 配置：

- owner: `dvlin-dev`
- repo: `agent-trace`

GitHub Actions 发布资产必须包含：

- `dist/*.dmg`
- `dist/*.dmg.blockmap`
- `dist/*.zip`
- `dist/*.zip.blockmap`
- `dist/latest-mac.yml`

## 错误处理

- 非 macOS 环境不启用自动更新
- 未打包开发环境不自动检查更新，但仍提供可解释状态
- 所有底层异常统一映射为用户可读消息
- 下载和安装动作在状态不允许时直接拒绝并返回明确错误

## 测试策略

### 单元测试

- 更新服务状态流转
- IPC channel 注册和转发
- preload 更新接口类型与行为

### 渲染测试

- 设置页在不同状态下展示正确按钮
- 左下角提示在更新可用、下载完成、错误时触发

### 发布契约测试

- `electron-builder.yml` 包含 GitHub publish 配置
- workflow 上传 `latest-mac.yml` 和 blockmap

## 非目标

- 增量灰度发布
- 版本回滚
- 渠道切换
- Linux / Windows 自动更新
- 远端配置驱动更新策略
