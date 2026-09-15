## 实践指南 (AGENTS.md §4.1)

#### 1. 如何撰写功能设计与验收标准

模板 (写入 `docs/<功能名>功能设计与测试用例.md`):

```
# <功能名> 功能设计

> 一句话概括设计目标 + 链路入口

## 1. 设计说明
### 1.1 整体结构   (可选 mermaid graph TD)
### 1.2 设计原则   (3-5 条 bullet, 每条一行)
### 1.3 核心链路   (可选 mermaid sequenceDiagram / flowchart)

## 2. 验收标准 (X.X-1, X.X-2...)
每条: 操作 + 期望 + 状态 (✅ 已验证 / ⏳ 待验)

## 3. 执行记录
| 用例 | 结果 | 备注 |
| --- | --- | --- |
```

要点:
- **写"为什么"不写"做了什么"**: 设计原则 + 链路说明目的, 验收写行为
- **验收可执行**: 每条都是可单步验证的具体动作, 避免"功能正常"这种不可验证
- **测试覆盖三类**: 正常路径 / 边界 / 错误/降级
- **跨模块改动必须列影响面**: 列出被影响的拓展/服务/scheme/事件名

#### 2. 如何高效排查定位关键问题

定位流程 (从表象到根因):

1. **看现象**: 截图 / console / network 三件套, 不靠脑补
2. **找最小复现**: 单步操作能复现 vs 时序/条件才复现, 优先前者
3. **二等分定位**: 沿调用链/数据流画边界, 从中间往两端二分 (例: client → proxy → server, 先确认 proxy 在不在, 再深查两端)
4. **怀疑一切**: 文档说的 ≠ 代码做的. 一旦现象与设计不符, 优先相信现象, 去 grep 代码
5. **历史教训**: `git log --all --oneline -- <file>` + `git blame` 看是不是回归. `git log --grep "<关键字>"` 看历史 issue
6. **确认修复方向**: 找根因后再讨论方案, 不在"症状"层面来回修

输出沉淀到避坑指南: 现象 / 复现路径 / 解决方案 / 是否需要回归测试.

#### 3. 如何拆分多轮任务 (推荐做法)

- 一轮 = 一个可独立验证的里程碑 (build + 跑通 +1 个核心场景)
- 每轮开头**回顾上一轮状态**, 结尾**给当前状态摘要** (committed + pushed + 已知遗留)
- 跨轮任务**先 question 确认是否继续**, 不要一气呵成做完多轮

#### 4. 自定义协议 deep link 启动本地应用 + 未安装引导

- **事实**: JS 无法检测协议处理器是否注册 (应用是否安装). 浏览器对未注册的 `xxx://` 静默无响应, 对已注册的弹「打开 xxx?」确认.
- **检测启发式**: 点击后设 2.5s 定时器 + 监听 `blur`/`visibilitychange` — 应用真被拉起时窗口失焦 (信号到达即取消定时器); 定时器走完仍未失焦 → 判定未安装 → 弹下载引导 modal.
- **公网部署**: deep link 由**访客浏览器**执行, 部署在公网/容器行为一致; 服务端 `open -a` 只会拉起服务器本机 (容器无 GUI), 公网场景不可用.
- **引导 UI**: modal 给「前往下载」(官网链接, `target=_blank` + `rel=noreferrer`) /「重试打开」(重新走 launch+检测) /「取消」; 支持 Esc + 点遮罩关闭; `createPortal` 到 body 避免父级 overflow 裁剪.
- **参考实现**: `sumi/src/layouts/IdeLayout.tsx` 的 `WorkBuddyButton` (WORKBUDDY_DOWNLOAD_URL = 官网首页).
  **当前状态 (2026-09)**: 用户要求把该功能整体注释掉 — 组件/CSS/JSX 使用/`createPortal` import 均以注释保留, 恢复时逐处取消注释即可.

### 4.2 避坑指南

## 5. SOLO 模式终端承载与保活

- **承载**: SOLO 自定义布局无 IDE 的 bottom tabbar, 终端由 `SoloLayout` 的 aside 内 `<SlotRenderer slot={SlotLocation.bottom} />` 渲染 (与 IDE 同一 terminal-next 模块, 能力一致: 多 tab/新建/关闭).
- **挂载**: 不要依赖 `mainLayout.getTabbarHandler('terminal')` 轮询激活 (SOLO 下不存在, 会 8 次重试后放弃, 终端永不创建); 直接 `terminals.createTerminal({})`.
- **保活**: 终端 tab 全部关闭后必须自动重建 — 在终端视图激活时挂 1.5s 轮询 `clients.size === 0 → ensureTerminal()`; 点胶囊/切 tab 时也调 ensureTerminal (无则建/有则聚焦).
- **运行代码**: 新建终端后等 pty 就绪 (~800ms) 再 sendText, 提交键用 `\r` (见 pitfalls-server #70/#71).

#### 6. chat 功能对齐官方 App 的基准 (followup / ↑↓ 历史 / 工具卡默认展开)

> 用户要求「功能完整对齐官方实现, 只改 UI 表现」时, 以 `opencode/packages/app` (官方 App) 为唯一基准, **不要用 TUI 对照**.
> 官方 App 用 **V2 管线** (`api.session.prompt` + `session.next.*` 事件 + sync/reducer); numas chat 是 **V1 管线** (`promptAsync` + `message.part.*` 事件). 行为语义可在 V1 上对齐; 管线迁移是大工程 (单独立项).

- **followup (busy 时再发消息)**: 官方设置 `settings.general.followup: "steer"(默认) | "queue"` (`app/src/context/settings.tsx:187`).
  - steer: 立即发送 (服务端在下一个 provider turn 边界拾取处理)
  - queue: 进 followup dock (状态在 `app/src/pages/session.tsx` items/paused/failed; UI `composer/session-followup-dock.tsx`): idle 后自动逐条发, 手动 [发送] [编辑], abort → `paused` (不自动发), 新排队/手动发送解除暂停, 发送失败标 `failed`
  - **abort 语义**: 官方 `api.session.interrupt` + 暂停 dock — **不存在「abort 时先发排队消息」**
  - numas 实现: `NUMAS_CHAT_FOLLOWUP_MODE` (默认 steer) + dock ([立即发送][编辑] + failed/sending 态), `ChatbotView.tsx`
- **↑↓ 输入历史**: 官方 `app/src/components/prompt-input/history.ts` — 全局持久化 (`prompt-history.v1`), max 100, 连续重复去重; 光标条件 `canNavigateHistoryAtCursor`: 未浏览时 ↑ 仅当输入为空且光标在开头, ↓ 仅当光标在末尾; 浏览中开头/末尾均可; ↑ 光标置 start, ↓ 置 end; 首次 ↑ 存草稿, ↓ 回草稿; 最旧一条不循环; 编辑输入即退出浏览
  - numas: `NUMAS_CHAT_PROMPT_HISTORY` + 同款光标/草稿逻辑 (ChatbotView)
- **工具卡默认展开**: 官方 `packages/session-ui/src/components/part-default-open.ts` — bash/shell 由 `shellToolPartsExpanded` 决定; edit/write/patch/apply_patch 由 `editToolPartsExpanded` 决定 (纯删除 diff 不展开); 其余折叠. 用户点击切换后以用户为准 (`toolOpen ?? defaultOpen`)
  - numas: `chat.toolParts.v1` (设置面板两个开关) + `ToolView.partDefaultOpen`
- **官方实现定位速查**: 消息列表 `app/src/pages/session/timeline/`; 输入框 `app/src/components/prompt-input/` (submit.ts = 发送/abort); 工具卡 UI `packages/session-ui/src/components/basic-tool.tsx` (Collapsible + trigger); dock 系列 `app/src/pages/session/composer/session-*-dock.tsx`

#### 7. chat 开销统计口径 (token / 成本 / 时间; subagent 记账事实)

- **server 记账事实** (`opencode/packages/opencode/src/session/processor.ts:435-456`):
  - `ctx.assistantMessage.tokens = usage.tokens` — **赋值** (非累加; 多 step 时只留最后一步 usage)
  - `ctx.assistantMessage.cost += usage.cost` — **累加**
  - **subagent 是独立会话**: `tool/task.ts:159` 创建 `parentID=当前会话` 的子会话, 子 agent 的 LLM 调用记在**子会话**消息里, **不回写主会话** → 主会话 tokens 天然**不含** subagent
- **官方口径** (`app/src/components/session/session-context-metrics.ts`): `getSessionContext(messages)` 只传主会话 messages → 官方"总 token"**不含 subagent** (numas 默认与官方一致)
- **numas 含子实现** (用户要求"开销含子 + 区分"): `ChatbotView.refreshSubagentStats` — `aiListAllSessions` 建 `parentID → children` map, BFS 找**所有后代** (含深层, 防环 seen) → 逐子会话 `aiListMessages` + `sumMessagesStats` 累计 token/cost, 墙钟取子会话 `time.updated - time.created`; 刷新时机 = 切会话 + `rows.length` 变化 (流式不触发)
- **口径定义**: 开销 token = 各消息 `input+output+reasoning` **累计** (不含 cache); 时间 = 主会话墙钟 + 各子会话墙钟**累加** (不用 max/全局区间 — 会重复计并行时间或含空闲); stats bar 显示总 (主+子), modal 分"开销 (含子代理)" 分项 (主会话 / 子代理(N) / 合计)
