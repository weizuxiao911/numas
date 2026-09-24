# AGENTS.md — packages/codeblitz (前端交互层) 子工程规范

> codeblitz = numas 前端唯一源 (原 sumi), opensumi/codeblitz 交互层 (纯浏览器)。
> 本文件是本子工程的工程约束, 与根 `AGENTS.md` 配合使用。

---

## 1. 分层架构铁律

> **所有拓展文件系统操作必须通过 codeblitz 的文件系统和 opencode 访问服务器端, 不得直连 service.**

分层 (单向, 外层调内层, 内层不调外层):

```
外部  →  service  →  commands  →  codeblitz  →  extensions
```

- `extensions/` (`src/extensions/*`) 读写文件: 必须走 codeblitz (`@opensumi/ide-file-service` 的 `IFileServiceClient`) → opencode server fs API (`/api/fs/*`)
- **严禁** extensions 直接调用 service 层的 `__APP_FS__` / `src/service/filesystem` 的任何方法
- service 层是 commands / codeblitz / 其他 service 调用的基础设施, 不暴露给 extensions 直调
- commands 层定义对外 API / token / interface, 是 service 与 codeblitz 之间的契约

**扩展间通信铁律 (vscode 标准)**:
- **内置拓展之间禁止直接 import / DI 注入其它拓展的 token/interface/实现** (跨拓展耦合,
  单拓展无法独立加载/卸载). 扩展能力必须**暴露为全局契约**后由调用方经标准机制消费,
  按优先级选型:
  1. **全局命令** (首选): 能力方 `CommandContribution.registerCommand` 注册 vscode 风格命令
     (如 `numas.browser.open`, 命令 id 字符串即跨拓展 API); 调用方
     `CommandService.executeCommand('numas.browser.open', url)` — 双方不互相 import
  2. **消息总线**: `src/service/event` 事件 (唯一 /global/event SSE) — 解耦广播
  3. **codeblitz 全局服务注入**: 仅限框架层接口 (IFileServiceClient / CommandService /
     编辑器等), 非某拓展私有
- **业务功能模块范式**: 业务功能按用户交互行为、遵循 codeblitz 兼容拓展标准开发, 通过框架
  扩展点 (ResourceProvider / EditorComponent / CommandContribution / opener / scheme 等)
  **注册到框架承载业务数据与交互**, 不在框架外自建承载; 模块间交互走上述全局通信, 禁止直连
- 反例 (2026-09 修正): PortsPanel 曾直接 import browser 拓展的 `BrowserToken` 注入 →
  改回 `executeCommand('numas.browser.open', proxyUrl)` (扩展间通信优先命令总线)

---

## 2. 跨平台路径铁律

> **路径以 opencode 服务端真实路径为单一事实源. 禁止自行拼接/重写/添加前导 `/`. 任何路径处理走 `src/infra/path.ts` 工具函数, 不要直接写正则/字符串拼接.**

**事实**: codeblitz 暴露的 `idePath` 与 opencode 宿主机 `hostPath` **完全一致**, 仅多 `file://` 协议头 (codeblitz editor 用). 不存在中间虚拟化映射. AI 不得发明 `path.win32` / `path.posix` 转换 / 自定义"虚拟根"层.

**禁令**:
- **禁止硬编码前导 `/`**: `'/' + segments.join('/')` 会让 Windows drive 渲染成 `/D:/projects` 多余前缀 (历史 bug: `extensions/filepicker/FilePicker.tsx`). 正确做法: 按首段是否含 `:` 判断, Windows drive 直接作为根 (`D:` / `D:/projects`), POSIX 才补前导 `/`
- **禁止硬编码分隔符**: 跨平台统一用 `/`, 用 `normalizeSep()` (`\\` → `/`). 服务端协议 / UI 展示均 POSIX 分隔
- **禁止写死的 `isWindowsDrive` / `path.win32` 判断到处散落**: 集中用 `src/infra/path.ts`:
  - `normalizeCwdPath(p)`: Windows drive 去前导 `/` + 去尾 `/`
  - `normalizeSep(p)`: `\\` → `/`
  - `isWindowsDrive(p)`: 单一权威检测
  - `absToRel(abs, ws)`: 宿主机绝对路径 → workspace 相对路径
  - `toHostPath(idePath, anchors)`: codeblitz 虚拟路径 → opencode 宿主路径 (来自 `infra/path.ts:toHostPath`, 不自造)
- **禁止 `/D:/...` 形态直接传给 server**: 走 `normalizeCwdPath` 规范化. 否则 server `path.win32` 按 POSIX 根解析 → 500/错目录
- **HTTP header 路径走 `encodeURI` (浏览器 fetch 强制要求)**: `x-opencode-directory` header 值必须 ISO-8859-1 (Latin-1), 客户端**必须** `encodeURI` 后再发 (中文/非 ASCII 路径直发会抛 `String contains non ISO-8859-1 code point`); server 端 `defaultDirectory` 防御性 `decodeURIComponent` 还原. 详细见 §3

**正确示例**:
```ts
// 绝对路径拼接 (POSIX '/Users/foo' / Windows 'D:/projects' 都对)
const p = (segments[0]?.includes(':') ? '' : '/') + segments.slice(0, i + 1).join('/');

// 路径规范化
const safe = normalizeCwdPath(userInput);   // 'D:/projects' 而非 '/D:/projects'

// server 请求前: header 走 encodeURI (兼容 fetch ISO-8859-1, 详见 §3)
headers: { 'x-opencode-directory': encodeURI(workspace) }
```

**检测方法**: 改完路径相关代码, **必须** 在 dataDir 是 Windows 路径 (如 `D:/projects`) 时跑一次, 验证:
- 面包屑/foot-path 不出现多余 `/` 前缀
- `getWorkspace()` / `urlWorkspace()` 返回 `D:/projects` 而非 `/D:/projects`
- `fs.listDir('D:/projects')` 200, 不 500
- 中文路径 `测试/中文目录/文件.md` 正常 resolve

---

## 3. opencode 跨进程通信约定

> **请求 opencode 统一使用 header 携带 `x-opencode-directory`. 不支持 header 的旧 V2 端点才用 `?directory=` query 方式.**

**事实**: opencode 服务端 workspace 路由有两套入口, 但 numas 客户端**必须**只走 header 一套:
- **header 入口** (所有 V1 端点 `/pty` `/file` `/path` 等): `x-opencode-directory` 是 workspace 唯一真实路径, server 端 `defaultDirectory(request, url)` 直接取该 header
- **V2 query 入口** (部分 `/api/...` 端点): `?directory=` query 作为 V2 workspace selector (历史兼容, server `selectedV2WorkspaceID` 才读)
- **混合 bug 链** (历史教训): SDK client request rewrite 把 header 值复制到 query — `pick()` 比较时 `encodeURI(header)` 与 `encodeURIComponent(fallback)` 不一致导致 mismatch, 最终把 encoded header 写进 query, server `defaultDirectory` fallback 到 `process.cwd()` → 客户端 URL 指定 `?directory=Documents` 实际 PTY 跑到 numas 子目录, WS connect 时 query 是 encoded → server routing 找不到该 session → **WS 404**

**禁令**:
- **禁止 client 把 header 写进 query**: numas fork 的 `@opencode-ai/sdk/v2/client` 的 request rewrite **只保留 header, 不写 `?directory=` query**. 已加 numas 增量 patch, 后续修改需保留
- **强制 client 对 header path 做 `encodeURI`**: 浏览器 fetch API 限制 header 值必须 ISO-8859-1, raw path 含中文/非 ASCII 字符直发会 throw → 整个 fetch 失败. server 端 `defaultDirectory` 防御性 `decodeURIComponent` 兼容两端
- **禁止 `WorkspaceRoutingMiddleware` 兜底到 `process.cwd()` 后无声 fallback**: 若 `x-opencode-directory` 缺失或 decode 失败, 应显式报错或 400

**正确示例**:
```ts
// client: 发送请求时 header 用 encodeURI 形态
const ws = normalizeCwdPath(getWorkspace());
fetch(url, { headers: { 'x-opencode-directory': encodeURI(ws) } });

// server: defaultDirectory 取 header 防御性 decode
const raw = request.headers["x-opencode-directory"]
const dir = raw ? decodeURIComponent(raw) : process.cwd()
```

**检测方法**: 切换工作空间 (`?directory=/Users/foo/Documents`) 时, **必须**验证:
- `console` log `[opencode] runtime applied: { workspace: '/Users/foo/Documents' }` (而非 `process.cwd()` fallback 值)
- terminal create 出来的 PTY `cwd` 实际是 `/Users/foo/Documents` (而非 server 启动 workdir)
- WS `/pty/<id>/connect?directory=...` 不出现 404 (encoded header 不再泄漏到 query)
- server `/path?directory=...` 响应 `directory` 字段与请求一致

---

## 4. 本子工程避坑

- **前后端分离单源** (2026-09-20): 前端唯一源 = `packages/codeblitz`; numas 接入门控内建在 `src/gate`
  (探测目标取 `appBaseUrl()` — CLI/内嵌=同源自身秒过, 独立部署=本机 numas). 独立部署产物:
  `npm run build:site` → `packages/codeblitz/site/` (`.env.site` 注入后端基址, 平台侧静态托管);
  旧 `test/ide` 拷贝已删除. **不要再拷贝前端源码到别处.**
- codeblitz 前置 numas 检测 (`src/gate`) 支持 `?numasPort=<port>` URL 覆盖 (仅当该参数存在时生效),
  用于不打扰真实环境地模拟"未安装/自定义端口"验证引导分支; 默认探测配置的后端基址 (`appBaseUrl()`).
- **自定义协议 scheme (`numas://`) 唤起的浏览器行为与弹窗根因** (2026-09-22 实测修订, 取代旧结论):
  - **Chrome 强制要求用户手势**: 页面加载时自动 fire (iframe / `location.href` 均如此) 被静默拦截,
    console 报 `Not allowed to launch 'numas://serve' because a user gesture is required`, **无系统弹窗**.
    解法: 进入时 fire 一次(尽力而为, 部分浏览器有效) + **首次用户交互 (pointerdown/keydown) 补 fire**
    (满足手势); **整页最多补一次** (用 ref 跨 phase 持久, 反复 fire 会在下述"已允许"状态下反复弹框).
  - **未注册 scheme + 手势 fire**: Chrome 报 `Failed to launch ... scheme does not have a registered
    handler`, **静默失败, 无系统弹窗** (playwright 实测 + AppleScript 窗口枚举确认).
  - **弹窗真正根因 (两个)**:
    1. **Chrome "始终允许" 记录**: 用户曾在 Chrome 确认框勾"始终允许"后, 该 origin+scheme 存于
       `Default/Preferences` → `protocol_handler.allowed_origin_protocol_pairs[origin][scheme]=true`;
       Chrome 跳过确认**直接交系统启动** → 应用已删/未装 → macOS 弹「找不到该文件」/「未设定用来打开URL」;
       gate 反复 fire → **一直弹**. 清理: 退出 Chrome → 编辑 Preferences 删嵌套 key (结构是
       `origin -> scheme -> true`, 不是扁平 key!) + `safe_browsing.external_app_redirect_timestamps[scheme]`
       → 重开 Chrome. (Chrome 运行中编辑会被覆盖, 必须先退出.)
    2. **LaunchServices 死注册**: dmg 挂载/已删构建产物残留声称 `numas:` scheme → 系统选到失效 handler →
       弹框. 清理: `lsregister -dump | grep -E '^path:.*numas.*\.app$'` 逐条 `lsregister -u`
       (挂载卷死路径需先卸载卷; 构建产物 app 直接删).
  - **结论**: fire 未注册 scheme 本身**不会弹窗**; 弹窗一律来自"系统认为有 handler 但 app 不存在"
    (allowed 记录 / 死注册). 排查弹窗先查这两处, 再动 gate 代码.
- 端口 404 排查先查**残留进程占用**: 已删除目录的 dev server 可能仍在监听 (如旧 `test/poc-opencode-ide`
  的 vite 占 5173), 新起服务 bind 不到 → 返回旧进程的 404. 用 `lsof -iTCP:<port> -sTCP:LISTEN -n -P`
  看 PID, 确认对应已删除目录后 `kill` 再验.
- **welcome 引导步骤 ↔ 远程 skill 名必须精确一致** (2026-09-23): 前端按钮经 `chatbot.send` 发
  `请执行「<技能名>」技能。`, 该名字**必须逐字等于** numas-skills 仓库的 skill 目录名 / `index.json` 的
  `name` / SKILL.md frontmatter `name` 三者 (含空格/中英混排). 任一处不一致 → AI 找不到 skill, 引导断链.
  改动步骤文案 (如 `fork并clone` → `Fork克隆`) 时, 四处同步: `WelcomeView.tsx` 的 `SKILL_*` 常量 +
  按钮 JSX 文案 + 远程仓库目录/index.json/frontmatter + `IdeLayout.tsx` 顶部按钮的触发串.
- **改远程 skill 内容必须递增 `index.json` 的 `version`** (2026-09-23): 客户端按 version 比对缓存
  (`~/.cache/opencode/skills/<name>/`), 内容改了但 version 未变 → 不会重新拉取, 用户看到的还是旧 skill.
  端到端验收 skill 前先重启 numas (拉取新 version).
- **切工作区不能无条件 `CLOSE_ALL`** (2026-09-23): `extensions/workspace/module.ts` 的 `switchWorkspace`
  原本执行官方 `EDITOR_COMMANDS.CLOSE_ALL`, 会把 welcome 引导页 tab (`welcome://`) 一起关掉 →
  切项目后引导页消失. 修复: 改为**定向 close**(遍历 editorGroups, 跳过 `scheme === 'welcome'` 的资源).
  凡是"切项目重置编辑器"的逻辑都要保留 welcome tab.
- **`--editor-border` 全局从未定义** (2026-09-23): 代码里多处写 `var(--editor-border)` (app-shell.css
  的 aside resizer / IdeLayout 右栏 resizer), 但 CSS/主题/opensumi 都**没有**定义该变量 → 该声明
  **在计算值阶段整条失效**, 边框/分隔线实际不可见 (不是继承默认色). 用到它必须写兜底
  (`var(--editor-border, #ebebeb)`), 或改用真正被定义的主题 token (`--panel-border` / `--app-border`).
- **IDE 三栏间 gutter 分隔** (2026-09-23): `IdeLayout.tsx` 用 `--gutter-w` (2px) 在拖动条中间画窄灰带
  (`resize-handle-horizontal/vertical::before` + 自绘 `.app-ide__right-resizer::before`), 命中区保持
  `--resizer-w` (6px) 不变. 关键坑: overrides.css 的 `[class*="resize-handle"]::before` 透明/hover
  高亮是 **unlayered `!important`**, 必须放进 `@layer numas-override { ... !important }` 才盖得住
  (CSS 层叠层对 `!important` 的优先级反转); 且**要连 `:hover` 态一并重写**, 否则 layer 里的静态色会
  把 hover 高亮顶掉.
- **布局规则别写在组件内 `<style>`** (2026-09-23): `IdeLayout.tsx` 的样式串只在 **IDE 模式组件挂载**时
  进 DOM, SOLO 模式下不渲染 → 规则失效. 跨模式通用规则 (`--gutter-w` / resize-handle 样式) 必须放
  **全局 CSS** (`app-shell.css` / `overrides.css`); SOLO aside 内 explorer↔编辑器 的 gutter 就因此放在
  `app-shell.css` 的 `@layer numas-override`.
- **SOLO aside 默认宽度受持久化覆盖** (2026-09-23): `layout.service.ts` 的 `ASIDE_RATIO` (打开时视口占比)
  只在**无持久化宽度**时生效 — `openAside()` 优先用 `cur.width` (来自 `NUMAS_SOLO_LAYOUT_V1`), 且
  `asideWidthManual` 标记拖拽后 resize 不再按比例重置. 改 `ASIDE_RATIO` 后, 已有持久化的用户看不到变化
  → 验证时先 `localStorage.removeItem('NUMAS_SOLO_LAYOUT_V1')`; 线上要让默认生效需用户拖动/清 key.
- **IDE 布局里加阴影必须在 `@layer numas-override` 开例外** (2026-09-23): `IdeLayout.tsx` 的
  `.app-ide, .app-ide * { box-shadow: none !important }` (flat 布局) 会清掉**所有**后代阴影, welcome
  引导页在 `.app-ide` 内 → 其步骤条阴影被清. 解法: 把阴影值定义为 CSS 变量 (如 welcome.css 的
  `--numas-welcome-steps-shadow`), 再在 `@layer numas-override` 写
  `.app-ide .numas-welcome__steps { box-shadow: var(--numas-welcome-steps-shadow) !important }` (同层内
  比 `.app-ide *` specificity 高, 可盖过). 同类例: `.app-ide .chat__settings-pop`.
- **welcome 底部步骤条通栏** (2026-09-23): `.numas-welcome__steps` 原 `max-width: 780px` (对齐 issue
  内容列) 会让贴底栏/阴影两侧留白. 要通栏整宽 = 对齐编辑器 tab 容器: 去 `max-width` + `width:
  calc(100% + 48px)` + `margin-left/right: -24px` 抵消 `.numas-welcome` 的 24px 左右 padding (二者同在
  welcome.css, 改 padding 时需同步这里).
- **访问门槛 (登录态) 内建在 `src/gate/login.ts`** (2026-09-23): 独立部署经 `.env.{DEPLOY_ENV}` 的
  `LOGIN_REDIRECT` (webpack DefinePlugin → `__APP_LOGIN_REDIRECT__`) 注入登录地址; `src/index.tsx`
  **渲染前**调 `enforceLogin()` — cookie 无 `token` 且无 `authorization` → 跳
  `{LOGIN_REDIRECT}{encodeURIComponent(当前URL)}`. **未注入 `LOGIN_REDIRECT` → 不门槛**
  (桌面/CLI/内嵌/本地 dev 不受影响). env: `.env.site`(生产→beta.cloudlab.top) / `.env.site-test`(测试).
  前端**读不到请求的 `Authorization` 头**, 只能靠 cookie/注入 (这是 gate 用 cookie 的原因).
- **chat 默认模型不再本地记忆** (2026-09-24): `modelPrefs` 曾把"最后选过的模型"写进 localStorage
  (`chat.modelPrefs.v1` 的 `default/defaultProvider`) → 打开就是上次选的模型 (如 MiniMax, 而非
  `config.model`) — 这是错误行为, 已移除. 现在模型选择只改内存态 (`currentModel/currentProvider`),
  未选时回落 `config.model` → 列表第一个. **切换模型功能不受影响** (`onSelect` 仍设 state).
