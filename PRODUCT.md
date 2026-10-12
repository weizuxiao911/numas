# Numas · 牛马 AI — 产品说明

> 你的赛博牛马 🐮
> Numas 基于开源项目 [opencode](https://github.com/anomalyco/opencode) 构建，
> 是一个**本地运行的 AI 工作台**，面向编码与日常办公任务。

---

## 1. 它是什么？

**一句话**：Numas 是"你的赛博牛马"——一个跑在你本机、随叫随到的 AI 工作台，帮人写代码、改文件、跑命令、处理日常任务。

**和官方 opencode 的关系**：
- 官方 opencode 定位是"开源的 AI 编码 agent"（The open source AI coding agent），核心是一个终端里的 agent 运行时：能读写代码、执行命令、接入任意模型。
- Numas 是 opencode 的 fork，**完整继承其内核**，并把它产品化成"有品牌、有桌面形态、可分离部署"的工作台。

**由三部分组成**：

| 组成部分 | 角色 | 说明 |
| --- | --- | --- |
| **opencode 引擎** | AI agent 运行时 | 工具调用 / 会话 / 模型与 provider 接入，CLI 命令名 `numas` |
| **浏览器工作台** | Web UI | 内嵌上游 `packages/app`；Numas 自有前端 `webapp/` 独立开发 |
| **桌面壳** | macOS 应用 | 托盘常驻、无 Dock，托管本地 server（`http://127.0.0.1:24096`） |

**形态**：既可以只当作 CLI/终端工具用，也可以作为桌面应用常驻后台，或作为 Web IDE 在浏览器里用。

---

## 2. 支持功能

### 2.1 AI 编码 agent（继承上游内核）

- **多 Agent 模式**：内置 `build`（默认、完整权限）与 `plan`（只读、适合分析与规划）两个 agent，`Tab` 切换。
- **子 Agent**：`general` 子 agent 处理复杂搜索与多步任务，消息里 `@general` 调用。
- **工具调用**：读文件、改代码、跑命令、多步自主完成任务。
- **多模型 / 多 provider**：统一 provider 抽象，接入各类云端与本地模型。
- **MCP 支持**：接入 Model Context Protocol server，扩展工具 / 资源 / prompt。
- **Plugin 机制**：通过插件钩子扩展会话、工具、权限等行为。
- **LSP / 会话分享**：一套完整的编码 agent 基础设施。

### 2.2 三种使用形态

- **TUI（终端界面）**：`numas`，全屏终端交互，最贴近编码工作流。
- **Web 工作台**：`numas web`，起服务并打开浏览器。
- **仅服务**：`numas serve`，headless，供 Web / 桌面壳 / 云端页面连接。

### 2.3 桌面应用（macOS）

- **托盘常驻、无 Dock**：静态 `LSUIElement=true` + 固定 bundle id `com.numas.app`。
- **托管本地服务**：随包分发 sidecar 二进制，启动后托管 `127.0.0.1:24096`。
- **托盘菜单**：点击 → **[打开] / [退出]**，[打开] 才拉起浏览器。
- **深链唤起**：`numas://serve?port=24096`。
- **一键安装**：脚本自动杀旧进程 → 装 → 去 quarantine → 启动；CLI 软链到 `~/.local/bin/numas`。
- **跨架构**：macOS arm64 / x64 / universal，及 Windows / Linux 打包。

### 2.4 Web IDE 工作台

- 基于 opensumi / codeblitz 的**纯浏览器 Web IDE**：编辑器、文件树、命令面板、终端面板。
- 分层架构：`service → commands → codeblitz → extensions` 单向依赖。
- 文件系统操作统一走 codeblitz → opencode server fs API，扩展间用全局命令总线通信。
- 跨平台路径正确（POSIX / Windows drive / 中文路径）。

### 2.5 内置扩展

- `packages/extensions`：docx / html / paper / pdf 扩展，构建时打成 `*.vsix` **内嵌进二进制**，
  运行时无需外部目录即可服务内置扩展市场。

### 2.6 部署能力

- **本地运行（默认）**：数据与文件不出本机。
- **前后端分离**：前端静态托管在云端，运行时直连访问者本机的 numas
  （`webapp && npm run build:site` → `webapp/site/`，编译期 `APP_BASE_URL` 决定后端基址）。

### 2.7 升级与版本

- **自升级只提示、不安装**：指向自有 Release（`weizuxiao911/numas`），发现新版本仅提示。
- **版本语义分离**：UA 版本固定跟随官方（供 provider 校验）；应用版本源为
  `packages/tauri/version.json`，用于升级判断与 `--version` 展示。

---

## 3. 设计理念

- **本地优先，数据不出机**：默认本机运行，文件与数据留在自己机器上；云端页面直连本机服务，
  而非把数据上传云端。
- **中文优先**：文档、接口、文案以中文为主，品牌调性鲜明（牛马 AI / 你的赛博牛马）。
- **AI 增强但不替代**：AI 提供诊断、建议、补丁候选与解释，关键改动由人确认。
- **分层与单一职责**：引擎 / 工作台 / 桌面壳各司其职；前端严格单向分层，扩展间解耦。
- **单一事实源**：端口 / CORS / 后端基址 / 版本号各有唯一来源，不散落硬编码。
- **直连无中间层**：客户端到 opencode 之间不加 HTTP 中间层。
- **不做 DEMO 级交付**：要么不做，要么一次做好；尊重客观事实，先分析再动手。
- **可审计**：AI 操作与代码变更可回溯。

---

## 4. 场景应用

### 4.1 本地个人开发

- 终端里 `numas` 直接和 AI 结对：读懂陌生代码、定位 bug、写补丁、跑测试。
- 桌面上双击图标常驻托盘，随用随开，不占 Dock、不打断工作流。

### 4.2 浏览器内编码（Web IDE）

- `numas web` 或桌面壳 [打开]，在浏览器里获得完整 IDE 体验：文件树、编辑器、终端、命令面板。

### 4.3 文档 / 办公处理

- 借助内置 docx / html / paper / pdf 扩展，直接在工作台内处理文档类任务。

### 4.4 云端页面 + 本机算力（分离部署）

- 把工作台页面托管在云端（nginx），访客打开页面后**直连自己本机的 numas**：
  页面统一、算力与数据留在各自机器上。适合团队内部分发同一套工作台界面。

### 4.5 代码分析与方案规划

- 用 `plan`（只读）agent 在不动文件的前提下探索代码库、生成方案，再切 `build` 落地。

---

## 5. 安装与使用

### 桌面版（macOS）

```bash
# 从 Releases 下载 numas-darwin-arm64.dmg 拖入「应用程序」
# 或一键脚本：
bash packages/tauri/scripts/install-macos.sh <numas_x.y.z_arch.dmg>
```

### CLI

```bash
numas            # 默认进入 TUI
numas web        # 起服务并打开 Web 工作台
numas serve      # 仅起本地服务（headless）
```

### 从源码构建

```bash
cd packages/opencode && bun run build --single   # 构建内嵌 packages/app 的 numas CLI
cd packages/tauri    && bun run build            # 打包桌面壳（自动同步 sidecar）
```

---

## 6. 许可与致谢

Numas 基于开源项目 **opencode**（`anomalyco/opencode`）构建，遵循其 MIT 许可。
仓库：<https://github.com/weizuxiao911/numas>
