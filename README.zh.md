<h1 align="center">Numas · 牛马 AI</h1>
<p align="center">你的赛博牛马 🐮</p>
<p align="center">
  <a href="README.md">English</a> | 简体中文
</p>

---

Numas 是一个本地运行的 AI 工作台（编码 / 办公任务），由三部分组成：

- **opencode 引擎** — AI agent 运行时（工具调用 / 会话 / 模型/provider 接入），CLI 命令名 `numas`
- **codeblitz IDE** — 浏览器端工作台（编辑器 / 终端 / 扩展市场）
- **桌面壳** — macOS 应用（托盘常驻，托管本地服务）

默认本地运行，数据与文件不出本机。

---

## 安装

### 桌面版（macOS）

从 [Releases](https://github.com/weizuxiao911/numas/releases/latest) 下载 `numas-darwin-arm64.dmg`，拖入 `应用程序`。

或用脚本一键安装（杀旧进程 → 装 → 去 quarantine → 启动）：

```bash
bash packages/tauri/scripts/install-macos.sh <numas_x.y.z_arch.dmg>
```

装好后 CLI `numas` 会软链到 `~/.local/bin/numas`。

### CLI 用法

```bash
numas            # 默认进入 TUI（终端界面）
numas web        # 起服务并打开 Web 工作台
numas serve      # 仅起本地服务（headless）
```

> CLI 二进制在桌面 app 内（`numas.app/Contents/MacOS/numas`）；也可直接从源码构建。

### 从源码构建

```bash
cd packages/opencode && bun run build --single   # 构建内嵌 codeblitz 的 numas CLI
cd packages/tauri    && bun run build            # 打包桌面壳（自动同步 sidecar）
```

细节见 [`packages/tauri/README.md`](packages/tauri/README.md)。

---

## Agents

内置两种 Agent，`Tab` 键切换：

- **build** — 默认，完整权限，适合开发工作
- **plan** — 只读，适合代码分析与方案规划（默认拒绝改文件、执行 bash 前询问）

另含 **general** 子 Agent（复杂搜索 / 多步任务），消息里 `@general` 调用。

---

## 仓库

- GitHub: <https://github.com/weizuxiao911/numas>

## 致谢

Numas 基于开源项目 [opencode](https://github.com/anomalyco/opencode) 构建。
