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

- **开源贡献 AI 工作台定制 (2026-10-08 移除)** (用户决策): 曾内建于本工程的开源贡献工作台
  定制流程与 UI 已整体移除, 包括: ① 引导层 `src/extensions/welcome/**` (自定义 WelcomeView 六步
  skill / issue 卡片) + `config/runtime.ts` 注入 + `IdeLayout.tsx` 顶栏 `HelpButton`/`PrButton`;
  ② 接入门控层 `src/gate/**` (`Gate`/`numas.ts`/`login.ts`, 即 numas 探测、`numas://` 唤起、下载
  引导、登录门槛) + 独立部署 `build:site`/`dev:site`/`.env.site*`; ③ 任务分发层 `infra/repo.ts`
  (`?repo=` 关联判定) + `App.tsx` 的 `?repo=` 强制 IDE + `test/demo` + `test/launch.html` +
  `specs/开源项目贡献AI工作台功能需求规格书.md`; ④ opencode 侧 `NUMAS_SKILL_URLS` 自动写入
  `~/.config/opencode/numas.json` (仅去自动写入, **保留**对已有 numas.json 的加载).
  现在 `index.tsx` 直接渲染 `App`; welcome 页回落为 codeblitz **官方默认**欢迎视图
  (`runtimeConfig.startupEditor: 'welcomePage'`, 不再注入 `WelcomePage`);
  `editor-restore`/`workspace` 对 `scheme === 'welcome'` 的保留/清理逻辑**仍在**(官方 welcome tab
  的生命周期), 不要误删. 下文涉及 gate/welcome 定制/独立部署的避坑为**历史记录**, 相关代码已不存在.
- **历史: 前后端分离单源** (2026-09-20): 前端唯一源 = `packages/codeblitz`; 独立部署产物曾为
  `npm run build:site` → `packages/codeblitz/site/`. 该形态已随工作台定制移除; 旧 `test/ide` 拷贝亦已删除.
  **不要再拷贝前端源码到别处.**
- **历史: 自定义协议 scheme (`numas://`) 唤起与弹窗根因** (2026-09-22 实测): `src/gate` 已删除.
  结论留档: fire 未注册 scheme 本身**不弹窗**; 弹窗来自"系统认为有 handler 但 app 不存在"
  (Chrome `protocol_handler.allowed_origin_protocol_pairs` 记录 / LaunchServices 死注册). 清理:
  退出 Chrome 删 Preferences 嵌套 key (`origin -> scheme -> true`) + `lsregister -u <path>` 清死注册.
- 端口 404 排查先查**残留进程占用**: 已删除目录的 dev server 可能仍在监听 (如旧 `test/poc-opencode-ide`
  的 vite 占 5173), 新起服务 bind 不到 → 返回旧进程的 404. 用 `lsof -iTCP:<port> -sTCP:LISTEN -n -P`
  看 PID, 确认对应已删除目录后 `kill` 再验.
- **切工作区用定向 close 而非官方 `CLOSE_ALL`** (2026-09-23): `extensions/workspace/module.ts` 的
  `switchWorkspace` 改为遍历 editorGroups 定向 close (跳过 `scheme === 'welcome'` 的资源), 而非官方
  `EDITOR_COMMANDS.CLOSE_ALL` — 后者会把 welcome tab 一起关掉. 自定义 welcome 引导页虽已移除,
  官方 welcome tab 仍在, 该保留逻辑继续有效.
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
  `.app-ide, .app-ide * { box-shadow: none !important }` (flat 布局) 会清掉**所有**后代阴影. 解法:
  把阴影值定义为 CSS 变量, 再在 `@layer numas-override` 写
  `.app-ide .<目标> { box-shadow: var(...) !important }` (同层内比 `.app-ide *` specificity 高, 可盖过).
  现存例: `.app-ide .chat__settings-pop { box-shadow: var(--ai-pop-shadow) !important }`.
- **历史: 访问门槛 (登录态)** (2026-09-23, 已随工作台定制移除): 曾是 `src/gate/login.ts` 经
  `.env.{DEPLOY_ENV}` 的 `LOGIN_REDIRECT` 注入 (webpack `__APP_LOGIN_REDIRECT__`), `index.tsx` 渲染前
  `enforceLogin()` 未登录跳转. 该机制与独立部署一并删除.
- **chat 默认模型不再本地记忆** (2026-09-24): `modelPrefs` 曾把"最后选过的模型"写进 localStorage
  (`chat.modelPrefs.v1` 的 `default/defaultProvider`) → 打开就是上次选的模型 (如 MiniMax, 而非
  `config.model`) — 这是错误行为, 已移除. 现在模型选择只改内存态 (`currentModel/currentProvider`),
  未选时回落 `config.model` → 列表第一个. **切换模型功能不受影响** (`onSelect` 仍设 state).
- **webpack 必须配 `extensionAlias` (`.js`→`.ts`), 生成物 `.gen.js` 禁止入库** (2026-09-30):
  `@opencode-ai/sdk/v2` 按 TS nodenext 用 `.js` 后缀 import (如 `./gen/sdk.gen.js`), webpack 默认
  会去找真实 `.js`. 曾为绕过此问题提交了一套 `packages/sdk/js/src/v2/gen/**/*.gen.js`
  (`ec8cd1fd14`), 结果 **Bun/opencode/TUI 等 `.ts` 消费方也优先加载了这批陈旧 `.js`**, SDK 缺
  `experimental.capabilities`, 直接把 TUI 干成白屏. 现已在 `webpack.config.js` 加
  `resolve.extensionAlias = { '.js': ['.ts', '.tsx', '.js'] }` 并删除该批 `.gen.js`.
  后续: 只生成 `.gen.ts`; 若 webpack 报 `.gen.js` not found, 检查 extensionAlias 是否被删.
- **`bunfig.toml` 的 `linker="hoisted"` 会打断写死 `node_modules/<pkg>` 的路径** (2026-09-30):
  bun 1.4 对 workspace 默认 isolated; 为让 Windows 上 codeblitz webpack 解析 opensumi 全套传递依赖,
  bunfig 设 `linker="hoisted"` (扁平布局, 传递依赖提升到仓库根 `node_modules`)。副作用: 包内
  `node_modules/@codeblitzjs|@opensumi` 不再存在, 所有写死 `../node_modules/<pkg>` 的用法失效:
  1) `scripts/patch-*.js` 就地改第三方包源码 → 目标找不到、脚本静默跳过 (`patch-codeblitz-constant.js`
  还 exit 1 → `bun install` 直接失败)。修复: 统一走 `scripts/resolve-dep.js` 的 `resolvePkg(pkg)`
  逐级向上找 `node_modules/<pkg>`, 兼容两种布局。
  2) `package.json` 的 `node node_modules/webpack-cli/bin/cli.js` 失效 (webpack-cli 提升到根)。
  修复: 直接用 bin 名 `webpack-cli` (`bun run` 会把 `.bin` 注入 PATH)。
  检测: 改安装布局后重装依赖, 必须确认 7 个 patch 脚本全部 applied (而非「跳过/不存在」), 且
  `packages/codeblitz` 能 `bun run build` 通过。
  3) **pre-push `turbo typecheck` 的 `web#typecheck` 会失败**: 根 `.bin/tsc` 被
  `@typescript/old` (= `@typescript/typescript6` 依赖的 `typescript@6.0.3`) 的 `tsc` bin 抢占
  (不再是 pin 的 5.8.2), 且 `@types/react` 去重到根版本与 opensumi 不兼容 → `TS5101`/`TS2786`
  等. 隔离布局下 codeblitz 有自己的 `.bin/tsc`(5.x) 不受影响, hoisted 后没有 → 冲突暴露.
  (机器 turbo 缓存冷时才复现; 作者侧可能命中旧缓存.) 临时绕过: `git push --no-verify`.
