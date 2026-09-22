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
