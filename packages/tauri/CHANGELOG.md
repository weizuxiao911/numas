# numas 桌面壳更新日志

本文件为 numas Tauri 桌面壳 (packages/tauri) 的版本更新记录。
每次发版前由 AI 按 §3.2 自主维护: 对照 `git log --oneline -20 -- packages/tauri/` 整理本版变更, 写到对应版本段。
release.ts 发布时读本文件对应版本段作为 GitHub Release notes。

## [0.1.17] - 2026-09-20

### 修复
- 双击/深链只托盘后台运行, 托盘「打开」才开浏览器 (深链不再抢前台弹窗)
- 关闭 `hardenedRuntime`, 修复打包后内置终端 500 问题
- 托盘图标可见性: 无 Dock 状态 (Accessory) 下图标正常显示

### 新增
- macOS 一键安装脚本 (去除 Gatekeeper quarantine)
- 无签名凭据时自动 ad-hoc 整包签名 + 签名配置模板
- 构建脚本支持 `--target` (mac arm64 / x64 / universal 双架构)

### 其他
- 深链 scheme: `numas://serve?port=24096`, 由工作台唤起本地服务端
