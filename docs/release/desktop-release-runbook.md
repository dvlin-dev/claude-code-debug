# macOS 发布说明

当前项目只看这一条发布路径：

- 生成 macOS 安装包
- 通过 GitHub Actions 做签名 / 公证 / 打包
- 直接发布到 GitHub Release
- 应用内通过 GitHub Release 做自动更新

不包含：

- Windows
- Linux
- 多渠道分发
- 对象存储/CDN

## 1. 当前项目离发布还差什么

当前项目已经有基础 `electron-builder` 配置，但还没有形成可用的 macOS 发布链路。

已有：

- `electron-builder`
- `electron-builder.yml`
- `mac` 目标：`dmg`、`zip`
- `resources/icon.png`

还缺：

- `dist:mac` 脚本
- 发布入口脚本，例如 `scripts/release.sh`
- `scripts/run-electron-builder.cjs`
- `build/entitlements.mac.plist`
- `resources/icon.icns`
- GitHub Actions 发布 workflow
- Apple 签名 / 公证 secrets

相关文件：

- `/Users/lin/code/agent-trace/package.json`
- `/Users/lin/code/agent-trace/electron-builder.yml`

## 2. 参考 moryflow PC 应该抄什么

`moryflow PC` 里真正值得复用到你项目的，只有 macOS 发布这部分：

### 本地发版入口

参考文件：

- `/Users/lin/code/moryflow/apps/moryflow/pc/scripts/release.sh`

它的核心作用是：

1. 检查 Git 状态
2. 检查版本号和 tag
3. 跑发布前检查
4. bump 版本号
5. commit
6. 打 tag
7. push

### electron-builder 包装脚本

参考文件：

- `/Users/lin/code/moryflow/apps/moryflow/pc/scripts/run-electron-builder.cjs`

这个脚本的作用很简单：

- 不直接在命令行里散落调用 `electron-builder`
- 统一从脚本入口执行 builder

### macOS 签名 / 公证配置

参考文件：

- `/Users/lin/code/moryflow/apps/moryflow/pc/electron-builder.yml`
- `/Users/lin/code/moryflow/apps/moryflow/pc/build/entitlements.mac.plist`

你项目真正需要参考的是这些配置：

- `mac.icon`
- `mac.hardenedRuntime: true`
- `mac.gatekeeperAssess: false`
- `mac.entitlements`
- `mac.entitlementsInherit`

### GitHub Actions 发布

参考文件：

- `/Users/lin/code/moryflow/.github/workflows/release-pc.yml`

你只需要抄它的 macOS 发布骨架：

- tag 触发
- macOS runner
- 注入 Apple secrets
- 构建应用
- 执行 `electron-builder`
- 上传到 GitHub Release

## 3. 你这个项目建议保留的最小方案

建议只做下面这一套：

1. 本地执行 `scripts/release.sh <version>`
2. 脚本更新版本号、commit、tag、push
3. GitHub Actions 在 macOS runner 上构建 `dmg + zip`
4. CI 完成签名和公证
5. CI 把产物上传到 GitHub Release

就够了。

## 4. 你现在要补的配置

### A. `package.json`

建议增加至少这些脚本：

- `pack`
- `dist`
- `dist:mac`

建议形态：

- `dist:mac` 负责 `pnpm build && node ./scripts/run-electron-builder.cjs --mac`

### B. `electron-builder.yml`

建议把 macOS 发布补成至少这样一组能力：

- `icon`
- `artifactName`
- `hardenedRuntime: true`
- `gatekeeperAssess: false`
- `entitlements`
- `entitlementsInherit`

### C. `build/entitlements.mac.plist`

新增这个文件，供签名 / 公证使用。

最小可参考 `moryflow` 当前内容：

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
  <dict>
    <key>com.apple.security.cs.allow-jit</key>
    <true/>
    <key>com.apple.security.cs.allow-dyld-environment-variables</key>
    <true/>
  </dict>
</plist>
```

### D. 图标

新增：

- `resources/icon.icns`

### E. 发布脚本

新增：

- `scripts/run-electron-builder.cjs`
- `scripts/release.sh`

`release.sh` 最少做这些事：

1. 校验版本号
2. 检查 Git 工作区
3. 跑 `pnpm build`
4. 修改 `package.json` 版本号
5. commit
6. 打 `v<version>` tag
7. push

### F. GitHub Actions

新增一个最小 workflow，例如：

- `.github/workflows/release-macos.yml`

最小职责：

1. tag 触发
2. macOS runner
3. 安装依赖
4. 构建
5. 注入 Apple 签名 / 公证 secrets
6. 运行 `electron-builder`
7. 上传 GitHub Release 资产

## 5. 需要准备的 Apple secrets

只列当前这条 GitHub Release 发布链路需要的：

- `CSC_LINK`
- `CSC_KEY_PASSWORD`
- `APPLE_API_KEY`
- `APPLE_API_KEY_ID`
- `APPLE_API_ISSUER`

含义：

- `CSC_LINK`
  - Developer ID Application 证书导出的 `.p12`
- `CSC_KEY_PASSWORD`
  - `.p12` 密码
- `APPLE_API_KEY`
  - App Store Connect API Key 的 `.p8` 内容
- `APPLE_API_KEY_ID`
  - API Key ID
- `APPLE_API_ISSUER`
  - Issuer ID

## 6. 自动更新要求

当前自动更新方案只支持：

- macOS
- GitHub Release
- `electron-updater + GitHub provider`

发布资产必须包含：

- `.dmg`
- `.dmg.blockmap`
- `.zip`
- `.zip.blockmap`
- `latest-mac.yml`

其中真正被自动更新消费的是：

- `.zip`
- `.zip.blockmap`
- `latest-mac.yml`

应用内行为：

1. 应用启动后延迟后台检查更新
2. 设置页可以手动检查、下载和安装
3. 左下角 toast 会在有新版本、下载完成、更新失败时提示

## 7. TARGET_URL 拼接规则

代理转发时，`TARGET_URL` 会被当成完整 base URL 使用：

- 会保留用户填写的 pathname
- 会把 Claude Code 发来的原始请求路径继续拼接到后面
- 会自动处理是否带尾 `/`

例如：

- `TARGET_URL = http://c.c.wegic.top:3000/api`
- 请求路径 = `/v1/messages?beta=true`

最终会转发到：

- `http://c.c.wegic.top:3000/api/v1/messages?beta=true`

## 8. 最终你只需要达成的结果

完成后，发布流程应该是：

1. 本地执行 `./scripts/release.sh 0.1.0`
2. 仓库自动产生 `v0.1.0`
3. GitHub Actions 构建并公证 macOS 安装包
4. 在 GitHub Releases 里拿到 `.dmg`、`.zip`、`latest-mac.yml` 和 blockmap
5. 客户端能检测、下载并安装新版本

## 9. 参考文件

当前项目：

- `/Users/lin/code/agent-trace/package.json`
- `/Users/lin/code/agent-trace/electron-builder.yml`

参考实现：

- `/Users/lin/code/moryflow/apps/moryflow/pc/scripts/release.sh`
- `/Users/lin/code/moryflow/apps/moryflow/pc/scripts/run-electron-builder.cjs`
- `/Users/lin/code/moryflow/apps/moryflow/pc/electron-builder.yml`
- `/Users/lin/code/moryflow/apps/moryflow/pc/build/entitlements.mac.plist`
- `/Users/lin/code/moryflow/.github/workflows/release-pc.yml`
