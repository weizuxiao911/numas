## 避坑指南 — opencode 服务端 / 路径 / 沙箱 / CLI / 网络

#### 1. opencode 服务端 `WorkspaceRoutingMiddleware` 静默 fallback 到 `process.cwd()`

- **问题描述**: sumi SDK client 的 request rewrite 把 header 值复制到 query (`pick()` 比较 `encodeURI(header)` 与 `encodeURIComponent(fallback)` 不一致导致), server `defaultDirectory` 兜底到 `process.cwd()`, 客户端 URL 指定 `?directory=Documents` 实际 PTY 跑到 numas 子目录, WS connect 时 query 是 `Documents` (encoded) → server routing 找不到该 session → **WS 404**.
- **复现路径**: 工作空间切到非 numas 启动目录 (`?directory=/Users/foo/Documents`), opencode 后端监听非 :24096 端口, 客户端发起 PTY WS connect.
- **解决方案**: numas fork 的 `@opencode-ai/sdk/v2/client` 的 request rewrite **只保留 header, 不写 `?directory=` query**; client 对 header path 做 `encodeURI`; server `defaultDirectory` 防御性 `decodeURIComponent` 兼容. 见 §2.4.

#### 2. 前导 `/` 硬编码让 Windows drive 渲染成 `/D:/projects`

- **问题描述**: `'/' + segments.join('/')` 在 Windows 下给 `D:/projects` 路径加前导 `/`, 变成 `/D:/projects` 多余前缀, server `path.win32` 按 POSIX 根解析 → 500 / 错目录.
- **复现路径**: `dataDir = 'D:/projects'` 时调用 `fs.listDir('D:/projects')`.
- **解决方案**: 按首段是否含 `:` 判断, Windows drive 直接作为根 (`D:` / `D:/projects`), POSIX 才补前导 `/`. 所有路径拼接走 `sumi/src/infra/path.ts` 工具函数. 见 §2.3.

#### 3. 浏览器 fetch header 限制 ISO-8859-1, 中文路径直发抛错

- **问题描述**: HTTP header 值必须 ISO-8859-1 (Latin-1), raw path 含中文/非 ASCII 字符直发会 throw `String contains non ISO-8859-1 code point` → 整个 fetch 失败.
- **复现路径**: `x-opencode-directory: /Users/测试/目录` (未 encodeURI).
- **解决方案**: client **必须** `encodeURI(ws)` 后再发; server `defaultDirectory` 防御性 `decodeURIComponent`. 见 §2.4.

#### 13. 项目 fork 的 Effect 是 v4 beta, 标准 API 可能运行时缺失

- **问题描述**: `Layer.provideService` 编译能过 (类型有), 运行时 `b.provideService is not a function` 直接崩.
- **复现路径**: 用标准 Effect v3 API 在 opencode fork (v4 beta) 里 provide context.
- **解决方案**: fork 内新代码先搜同仓用法/避开重 context 注入; 参数直传优先于 context provide; 跑 smoke test 确认运行时 API 存在.

#### 21. symlink 指向 workspace 外: 沙箱用「逻辑路径」校验, 别用 realPath 后的物理路径

- **问题描述**: workspace 内 symlink 指向外部目录 (如 `/home/community/333 -> /app/333`), explorer list 能显示 (需 fs.list 归一化 symlink type), 但 **stat / 展开 / 「在终端打开」全失败**: fs.stat/list 500 (`Path escapes the location`), pty.create 400 (`BadRequest`).
- **根因**: 边界安全检查用了 **realPath 解析后** 的物理路径做 `contains(root, real)`:
  - `packages/core/src/filesystem.ts` `resolve()`: `fs.realPath(absolute)` 把 `.../333/sub` 解析成 `/app/333/sub`, 再 `contains(root=/home/community, /app/...)` = false → die.
  - `packages/opencode/.../handlers/pty.ts` create: `FSUtil.contains(FSUtil.resolve(instanceDir), FSUtil.resolve(cwd))`, 而 `FSUtil.resolve` 内部 `realpathSync` (fs-util.ts:250) 同样把 cwd 物理化 → BadRequest.
- **解决方案 (用户拍板「放开 symlink 跟随」)**: 边界校验改用**逻辑路径** (`path.resolve`, 不 realpath) — 仍拦截直接 `../` 路径逃逸 (`contains(directory, absolute)`), 但放行「逻辑路径在 workspace 内、realPath 后落在外」的 symlink:
  - fs `resolve()`: 删 `contains(root, real)` 二次校验, 只留逻辑 `contains(directory, absolute)`; `resolveTarget()` 同理删 parentReal 校验.
  - fs `list`: symlink dirent (`item.type==="symlink"`) 用 `fs.stat(join)` 跟随, 按目标类型归一化成 `file`/`directory` (schema `Entry.type` 只有这俩字面量, 不加新 type); broken symlink catch 成 null 跳过.
  - pty create: 边界校验 `path.resolve` 逻辑路径; spawn `cwd` 传逻辑路径 (chdir 自身穿透 symlink) + 显式 `env.PWD=逻辑路径` — zsh/bash 启动校验 `$PWD` 与 getcwd() inode 一致后信任它, 于是终端 `pwd`/提示符显示 symlink 逻辑路径 (`/home/community/333/sub`) 而非物理 (`/app/333/sub`), 与 explorer 路径一致 (`pwd -P` 才是物理).
- **排查方法**: ① 区分「list 显示」vs「stat/展开」: list 已归一化能显示不代表 resolve 沙箱放行; ② 容器内 `node -e 'fs.statSync(link)'` 报 ENOENT 但 `ls -la link` 正常 → symlink target 在容器内不存在 (挂载范围外/绝对宿主路径), 非代码问题; ③ pty 400 用浏览器 network 抓 `POST /pty` request body 的 `cwd`, 对照 `FSUtil.resolve` 是否 realpath 物理化.

#### 24. workspace 根是 symlink 时 fs.watcher 事件路径 real vs logical 不匹配 → 客户端静默丢弃

- **问题描述**: workspace URL/header 给 logical 路径 (`/home/community/222`, symlink → `/app/222`). `InstanceStore.load` 调 `FSUtil.resolve` realpath, 后续 `Location.Service.directory` / watcher 订阅路径 / `event.location.directory` 全部走 real path. Watcher 触发时 `@parcel/watcher` 给的 `update.path` 也是 real path (即使订阅时用 symlink path, parcel 内部归一化). 客户端 `/api/fs/list` 按 memory/pitfalls-server.md#21 修复后走 logical 路径 (`filesystem.ts:resolve` 用 `path.resolve` 不 realpath), 文件树里是 `/home/community/222/2.txt`. SSE 推到客户端的事件里 `file: "/app/222/2.txt"` (real) — `invalidateFromWatcher` → `ops.hasFile(real)` false → **事件被静默丢弃**, UI 不更新. 用户感受是 "opencode 没发事件 到 /global/event" (网络层事件**有**上行, 只是客户端无 UI 动作).
- **复现路径**: workspace 是 symlink (`/home/community/222 -> /app/222`), `touch /home/community/222/2.txt` 后浏览器 Network 看 `/global/event` SSE 流 — 能看到 `type:"file.watcher.updated"` 事件, 但 `properties.file` 是 `/app/222/2.txt` (real), 客户端文件树匹配失败.
- **解决方案 (用户拍板「watcher callback 内 real→logical 转换」)**: 不能让客户端做反向解析 (违反分层架构铁律, 跨平台不一致). 核心思路: InstanceStore.load 同步建立 `real → logical` 映射 (real = `FSUtil.resolve(input)`, logical = `path.resolve(FSUtil.windowsPath(input))`), boundNode 通过 resolver 拿到 logical 注入 `Location.Service.logicalDirectory`, watcher callback 在 publish 前用 `path.relative(real, file)` 检测子树关系, 在内则替换 prefix 为 logical. 关键决策点:
  - 不动 schema (`Location.Ref` 在 `protocol/groups/{event,session,location}` 出现, 加 optional 字段会污染 wire, SDK regen 联级), 走 side-channel (`LogicalDirectoryRegistry` 进程级 Map, 不进 layer 依赖图).
  - 不在 watcher 订阅路径做文章 — parcel 订阅 symlink path 也归一化为 real path 触发, 事件 path 永远 real. 转换只能发生在 callback.
  - 不要在 `InstanceStore.load` 改用 logical (cache key 会变成 logical, 副作用: 同一物理目录经不同 symlink 访问变成不同 instance, 跨模块影响面广).
  - 转换函数 `logicalToRealPath(file, realRoot, logicalRoot)` 必须用 `path.relative + startsWith("..")` 检测, 避免字符串前缀误匹配 (`/app/222` vs `/app/222x`). 文件不在 workspace 子树内 (`relative` 越界或 absolute) 必须**原样返回**, 不替用户改前缀.
- **落实位置**:
  - `packages/opencode/src/project/logical-directory-registry.ts` (新增) — 进程级 `Map<string,string>`, `set/get/delete/clear` 4 API, `set` 内做 `real !== logical` 判空避免冗余 entry.
  - `packages/opencode/src/project/instance-store.ts` — `load`/`reload` 各加 `logicalDirectory = path.resolve(FSUtil.windowsPath(input.directory))` 一行, `LogicalDirectoryRegistry.set(directory, logicalDirectory)`; `disposeDirectory` 加 `delete` 清理.
  - `packages/core/src/location.ts` — `BoundOptions { logicalDirectory?: string }` 入参, `Interface` 加 `readonly logicalDirectory?: string` (runtime, 非 schema); `layer(ref, options?)` / `boundNode(ref, options?)` 透传.
  - `packages/core/src/location-services.ts` — `buildLocationServiceMap(replacements?, resolveLogicalDirectory?)` 第二参为 `(ref: Ref) => string | undefined`.
  - `packages/opencode/src/server/routes/instance/httpapi/server.ts` — `createRoutes` 内 `buildLocationServiceMap([], (ref) => LogicalDirectoryRegistry.get(ref.directory))` 注入.
  - `packages/core/src/filesystem/watcher.ts` — callback 内 `const file = logicalToRealPath(update.path, location.directory, location.logicalDirectory)` 后 publish; helper 放在 `protecteds` 之后, 注释写明相对路径检测原理.
  - `packages/core/test/filesystem/watcher.test.ts` — `provide(directory, vcs?, logicalDirectory?)` 加参; `withTmp` options 加 `logicalDirectory?: (realDirectory) => string` resolver, 通过 `init: async (d) => { await fs.rename(d, actual); await fs.symlink(actual, d) }` 把 tmpdir 重命名后挂 symlink; 加 `describeSymlink("symlinked workspace root")` 测试块, 写 `via-symlink.txt` 经 logicalDirectory 路径, 期望事件 `file` 是 logical 路径而非 real.
- **排查方法**:
  1. **区分「list 显示」vs「watcher 事件」**: list 已走 logical (memory/pitfalls-server.md#21) 不代表事件也走 logical; 先 curl `GET /api/fs/list?path=<logical>` 看返回路径是 `/home/community/222/2.txt` (logical), 再 curl `GET /global/event?directory=<logical>` (SSE) 看事件 `properties.file` — 两者 prefix 不一致即确诊.
  2. **「订阅 symlink path 也会归一化」的真相**: 单独跑 `@parcel/watcher` (sumi node_modules 已有) 写最小复现, 订阅 real / symlink / nested symlink, file path 无论订阅哪种都是 real. macOS fs-events、Linux inotify、Win ReadDirectoryChangesW 均归一化. 不要尝试"订阅 logical 让 parcel 给 logical path" — 无效.
  3. **`path.relative` 边界检测 vs `startsWith`**: `/app/222` 与 `/app/222x` 用 `startsWith` 都匹配, 用 `path.relative('/app/222', '/app/222x/foo')` 得 `../222x/foo` (越界), 检测越界必须 `relative.startsWith('..') || path.isAbsolute(relative) || relative === ''` 三选一 (relative=='' 时 file 就是 root 自身, 不需要替换 prefix).
  4. **logicalToRealPath 不该改 workspace 外路径**: 即便上游误传一个不在 realRoot 子树内的 path (e.g. 另一个 instance 的事件因 SSE 没过滤混入), 必须返回原值, 让上层 LocationServiceMap / VCS 等的 directory equality check (`event.location.directory !== ctx.directory`) 自行过滤, 不要替上游做语义判断.

#### 25. UI 运行时填 API key 后模型 `ProviderModelNotFoundError: Model not found: <provider>/<model>. Did you mean: <model>?` (必须重启才生效)

- **问题描述**: 容器起来后, 用户在「模型管理」(/connect 弹层) 给一个**启动时未连接**的服务商 (如 `minimax-cn-coding-plan`) 填 API key、选模型、发消息, 立刻报 `ProviderModelNotFoundError: Model not found: minimax-cn-coding-plan/MiniMax-M3. Did you mean: MiniMax-M3?`; `/provider` catalog 里该 provider 和模型明明都在; **重启容器后同 key 又正常**.
- **根因 (不是分支差异! 先对 SHA)**:
  1. Provider 运行时表是 **per-directory 惰性构建一次** 的 `InstanceState` (`provider.ts` 的 `InstanceState.make(state, ...)`), 闭包构建时 `auth.all()` **只读一次** key, 经 `mergeProvider` 把已连接 provider 合并进 `s.providers` (运行时激活表); 而 `/provider` 列表读的是 **catalog** (`s.database`, 含未连接 provider) — 两表分离.
  2. UI 填 key 走 `PUT /auth/{id}` → `handlers/control.ts` 的 authSet **只 `auth.set()` 写 auth.json, 从不失效 Provider state**; `InstanceState.invalidate` 全仓只被 pty(location)/tui(config) 调用, Provider 从没失效过.
  3. 于是运行时新增 key 后 `s.providers[id]` 仍空 → `getModel` 拿不到 provider → 用 catalog 给 suggestions 抛 `ModelNotFoundError`. 浏览器刷新**无效** (state 在服务端进程, 按 directory 缓存); 必须后端失效或重启.
- **关键坑: 失效 API 选错上下文**: 首版修复用 `InstanceState.invalidate(state)` (内部 `ScopedCache.invalidate(cache, yield* directory)`), 但 `PUT /auth` 是 **RootHttpApi 全局 control 路由** (auth.json 跨 workspace 全局共享), **无 per-request `InstanceRef`/directory context** → invalidate 读 directory 直接 die → PUT 返回 **500** (`Unexpected server error`, ref err_xxx). 正确做法: 用 **`ScopedCache.invalidateAll`** (不依赖 directory) 失效所有 instance — auth 本就是全局的.
- **解决方案 (已修)**:
  - `src/effect/instance-state.ts` — 新增 `invalidateAll(self)` (`ScopedCache.invalidateAll(self.cache)`, 无需 directory context; 区别于 `invalidate(self)` 要 `yield* directory`).
  - `src/provider/provider.ts` — `Interface` 加 `invalidateAll(): Effect<void>`; layer 内 `const invalidateAll = Effect.fn(...)(() => InstanceState.invalidateAll(state))` 并加入 `Service.of({...})`.
  - `src/server/routes/instance/httpapi/handlers/control.ts` — authSet/authRemove 里 `auth.set/remove` 后 `yield* provider.invalidateAll()` (yield `Provider.Service`).
  - 连带: `test/fake/provider.ts` 补 `invalidateAll: () => Effect.void`; `test/server/httpapi-global.test.ts` + `httpapi-control-plane.test.ts` 这两个直接 build controlHandlers 的测试补 `Layer.mock(Provider.Service)({})` (否则缺 Provider context 报 `Service not found`).
- **验证方法**: ① 容器启动时**不**连目标 provider → 运行中 `PUT /auth/<id>` 填真 key → 不重启直接 `POST /session/.../prompt_async` 发消息 → 应 `finish=stop` 出真实回复 (修复前: `session.error` ModelNotFound); ② `DELETE /auth/<id>` 后发消息 → 应干净报 ModelNotFound (非 500); ③ 再 PUT 重连 → 恢复. 用 `/global/event` SSE 抓 `session.error` 事件看 message (prompt_async 返回 204, 错误只走 SSE, `/message` 里 assistant 消息可能不落盘).
- **排查教训**:
  1. **"切分支/重建镜像就好" 先别归因代码差异 — 先 `git rev-parse <branch>` 对 SHA**. 本例 main 与 feat/yunyan 是**同一 commit**, "好了" 的真实变量是**容器重启** (state 重建重读 auth.json), 不是分支.
  2. **catalog ≠ 运行时激活表**: `/provider` 能列出 provider/model 只代表 catalog 有; 发消息能否用看 `s.providers` (InstanceState, 构建时快照 auth). 两表现象不一致是这类 bug 的指纹.
  3. **全局路由 vs instance 路由的 context 边界**: handler 里调任何 `InstanceState.*` (隐式读 `directory`/`InstanceRef`) 前, 先确认该路由挂在 RootHttpApi(全局, 无 InstanceRef) 还是 InstanceHttpApi(有 directory). 全局资源 (auth/config) 变更用 `invalidateAll`.

#### 26. 会话标题在「首条消息失败/未产出」后永不生成 + 中断的空 assistant 气泡无状态

- **问题 A (标题)**: 用户首条消息**报错** (如 #25 的 ModelNotFound, 当时 provider 未激活) 或极早中断, 会话标题一直停在 `New session - <ts>` (前端显示"新会话"); 之后正常发消息标题也不更新.
- **根因 A**: `packages/opencode/src/session/prompt.ts` 的 `ensureTitle` 在每个 LLM 轮次 `step===1` 时 `Effect.forkIn` 跑, 但旧逻辑前置条件 `if (input.history.filter(real).length !== 1) return` — 要求**恰好 1 条真实用户消息**才生成. 第一条失败后第二条成功时已有 2 条用户消息 → 直接 return, 标题永久缺失. 注意: 单纯 abort (点停止) **不会**杀标题 fork (fork 出的 title 任务不受 prompt abort 影响, 多数情况标题仍能生成); 真正缺标题的是**第一条 message 报错** (title fork 里 getSmallModel/getModel 拿不到 model 而失败) 的场景.
- **修复 A (已修)**: 删掉 `length !== 1` 限制. 上面已有 `isDefaultTitle(title)` 闸 (非默认标题 = 已生成, 直接 return), 所以放宽后: 标题仍是默认值就基于**首条真实用户消息** (`context = history.slice(0, idx+1)`) 补生成, 已生成则不重复. 单消息正常路径行为不变.
- **问题 B (空气泡)**: 模型产出任何内容**前**点停止, 后端留一条 `parts=[]`、`finish=None`、无 error 的 assistant 消息 (报错 ModelNotFound 则**不产生** assistant 行, 错误走红色横幅). 前端 `MessageRow` 对空 parts assistant 只渲染复制按钮 → 空白气泡; abort 的 error 事件又被前端刻意静默 (Chat.tsx `session.error` 里 `/AbortError|aborted|interrupt/` 不弹错) → 用户看不到任何状态.
- **修复 B (已修)**: `sumi/.../chat/webview/components/MessageRow.tsx` 对 assistant 行算 `hasContent` (text/reasoning 非空, 或有 tool/file part); `!streaming && !hasContent` 时渲染灰色斜体占位「已停止生成」(样式 `.chat__msg-aborted`, 用 `--ai-fg-muted`). 报错场景不留空 assistant 行, 故占位不会误伤报错.
- **验证方法**:
  1. 标题: 新建会话 → 第 1 条发给**未连接** provider (报错, 标题停 New session) → 第 2 条发给已连接 provider 成功 → 标题应补生成 (实测 "周末徒步路线规划"). 查 `GET /session` 的 `title`.
  2. 空气泡: `GET /session/<id>/message` 看 assistant 行 `parts=[] finish=None` 即中断空消息; 前端该行应显「已停止生成」. 报错路径 (`GET /global/event` 的 `session.error`) 不落 assistant 行, 走红色错误横幅.
- **排查教训**:
  1. **fork 的 title 任务 vs prompt 主循环 abort**: `Effect.forkIn(scope)` 出的标题生成不随 prompt abort 取消, 所以"点停止"一般不丢标题; 丢标题要查 title fork **内部是否失败** (getModel 报错) — 别只盯着 abort.
  2. **空 assistant 消息是 abort 指纹, 报错不留 assistant 行**: `parts=[] && finish=None && error=null` = 中断在产出前; `session.error` SSE 事件 + 无 assistant 行 = 报错. 前端区分这两类才能给对状态 (中断→"已停止生成", 报错→红色横幅).
  3. **前端静默 abort 错误是对的** (不弹红框), 但静默不等于不展示 — 中断状态要在消息流里用占位表达.

#### 30. pty create 在 symlink workspace 返回 400 `{"_tag":"BadRequest"}`: boundary check 混了 real vs logical 维度

- **现象**: POST `/pty` 在 symlink workspace (k8s 容器内 `logical=/home/community/实验三_网络爬虫与数据可视化` → `real=/usr/local/.storage/course/实验三_.../workdir`) 一直返 400. 浏览器 explorer 在该 workspace 任何位置右键「在终端打开」传 body `cwd` (logical) 必 400; 不传 cwd 用 instance 默认能过. header 跟 body 用同一 logical 路径也 400 (因为 server 端把 header realpath 化了, body 保持 raw logical, 字符串不在同一子树).
- **根因** (`packages/opencode/src/server/routes/instance/httpapi/handlers/pty.ts:84-88` 修复前):
  ```ts
  const instanceDir = (yield* InstanceState.context).directory
  // ↑ InstanceStore.load 调 FSUtil.resolve realpath 化, 等于物理路径
  const logicalInstance = path.resolve(FSUtil.windowsPath(instanceDir))  // real
  const logicalCwd = path.resolve(FSUtil.windowsPath(ctx.payload.cwd))    // logical (raw)
  if (ctx.payload.cwd && !FSUtil.contains(logicalInstance, logicalCwd))
    return yield* new HttpApiError.BadRequest({})
  ```
  `path.relative("/usr/local/.storage/.../workdir", "/home/community/.../app")` 跨根越界 → 400. 跟中文无关, 任何 symlink/mount workspace 都触发.
- **修法 (修法 B, 跟 #21 / #24 logical 路径约定一致)**: 复用 `LogicalDirectoryRegistry` (`packages/opencode/src/project/logical-directory-registry.ts:18-36`, `InstanceStore.load` 同步建立 real → logical 映射), 把 `logicalInstance` 反查回 logical:
  ```ts
  const realInstanceDir = (yield* InstanceState.context).directory
  const logicalInstance =
    LogicalDirectoryRegistry.get(realInstanceDir) ?? path.resolve(FSUtil.windowsPath(realInstanceDir))
  ```
  查不到时 (workspace 非 symlink, real==logical) fallback 走 realpath, 行为不变. spawn cwd / PWD env 仍用 logicalCwd, chdir 穿透 symlink, zsh 启动校验 $PWD 跟 getcwd() inode 一致后信任 $PWD, `pwd`/提示符跟 explorer 路径一致 (#21 同模式).
- **复现命令** (本地 k8s, 容器内造 symlink):
  ```bash
  kubectl exec $POD -- sh -c '
    mkdir -p /home/.storage/course/实验3_网络爬虫与数据可视化/app docs
    touch /home/.storage/course/实验3_网络爬虫与数据可视化/README.md
    ln -sfn /home/.storage/course/实验3_网络爬虫与数据可视化 /home/community/实验3_网络爬虫与数据可视化
  '
  curl -sS -i 'http://numas.localhost/pty' \
    -H 'x-opencode-directory: %2Fhome%2Fcommunity%2F%E5%AE%9E%E9%AA%8C3_%E7%BD%91%E7%BB%9C%E7%88%AC%E8%99%AB%E4%B8%8E%E6%95%B0%E6%8D%AE%E5%8F%AF%E8%A7%86%E5%8C%96' \
    -H 'content-type: application/json' \
    --data-raw '{"command":"/bin/zsh","args":["--login"],"cwd":"/home/community/实验3_网络爬虫与数据可视化"}'
  # 修复前 400 {"_tag":"BadRequest"}, 修复后 200
  ```
- **验证矩阵** (本地 k8s deployment `numas` + ingress `numas.localhost`, image `numas:patched`):
  | 场景 | 修复前 | 修复后 |
  |------|--------|--------|
  | header + body logical 同路径 | 400 | 200 |
  | 子目录 cwd (`/app`) | 400 | 200 |
  | 两级子目录 (`/docs`) | 400 | 200 |
  | 父目录 header + logical 子 cwd (原 200 路径) | 200 | 200 (不回归) |
  | 真越界 (`/etc`) | 400 | 400 (沙箱守住) |
- **排查方法**: 1) `path.relative` debug: pty handler 加 `console.log` 打 `logicalInstance` / `logicalCwd` / `relative`, 跑 curl 看输出; 2) 跟 #24 fs watcher 模式一样, server 内部用 real, 对前端暴露走 logical (boundary check / spawn cwd / PWD env); 3) LogicalDirectoryRegistry 查不到时 (`real === logical` 的 workspace) 走 fallback, 跟历史行为一致; 4) 部署 patched image 必须重建 `numas:patched` 重新打, `kubectl cp` 改的 binary 不会跨 pod 重建带过去 (镜像 fs 只读), 走 `kubectl rollout restart deployment` + 改 image 拉新 tag.

#### 31. V1 file handlers (/file, /find, /file/content) + FileSystemSearch 仍用 real-relative, 在 symlink workspace 下与 explorer 文件树对不齐

- **现象**: #21/#24/#25/#30 修了 V2 `/api/fs/*`、watcher、pty, **但 V1 实验性 `/file` `/file/content` `/find` `/find/file` 端点 (`packages/opencode/src/server/routes/instance/httpapi/handlers/file.ts`) 和 `FileSystemSearch` (ripgrepLayer) 仍用 real-relative**。症状: symlink workspace 下 list 返 `absolute` 用 real base 拼 (跟 explorer logical 对不上, gitignore `ignored` 字段走 hybrid 路径算 relative 越界), content 用 `InstanceState.context.directory` (real) + user logical path resolve 出 hybrid 路径 existsSafe 失败返空内容, findText/ripgrep output 是 cwd-relative real 跟 logical 对不上. grep/glob/find 在 caller 层用 `path.relative(location.directory, ...)` (location.directory 是 real) 算 real-relative entry.path, fuzzysort state 全是 real-relative, symlink workspace 下 fuzzy 结果无法跟 explorer tree 匹配.
- **根因 (4 处)**:
  1. `file.ts:list` line 67 用 `(yield* InstanceState.context).directory` (real) 算 `path.resolve(real, item.path)` 拼 hybrid absolute, `path.relative(real, hybrid)` 越界;
  2. `file.ts:content` line 97-100 boundary check 走 real, `fs.existsSafe(real/hybrid)` 在 symlink workspace 下 hybrid 路径不存在;
  3. `file.ts:findText` line 28-30 `ripgrep.grep({ cwd: realInstanceDir, ... })` 输出是 cwd-relative (real-relative), 直接返 `match.entry.path` 没用 logical 维度;
  4. `core/src/filesystem/search.ts` (ripgrepLayer) line 73-100 `path.relative(location.directory, ...)` 用 real 算 relative, state.files 灌入也是 real-relative.
- **修法**:
  - 抽共享工具到 `core/src/fs-util.ts`: `FSUtil.realToLogical(file, realRoot, logicalRoot?)` — 共享给 watcher (callback real→logical 事件) 与 FileSystemSearch (ripgrep output 转换) 与 V1 file handler. 边界检测用 `path.relative + startsWith("..")` 兜底字符串前缀误匹配. `file === realRoot` 时直接返 logicalRoot. watcher.ts 删除私有 `logicalToRealPath` (原实现名反了, 注释说明已挪到 FSUtil 共享).
  - V1 file.ts: 用 `LogicalDirectoryRegistry.get(realDir) ?? realDir` 反查 logical (`logicalInstanceDir(realDir)` helper), boundary check 跟 `path.resolve` 都走 logical; `list` 用 logical base 算 `absolute` 字段, gitignore/ignore 也用 logical 读; `findText` 把 ripgrep 输出 `path.resolve(realCwd, rel)` → `realToLogical(abs, realCwd, logicalInstance)` → `path.relative(logicalInstance, abs)`.
  - FileSystemSearch (ripgrepLayer): 内部 `cwd` 仍用 real (跟 watcher / pty 一致, inotify 跟 symlink 容易 miss), 但 caller 层把 output 转 logical: `toLogicalRelative(cwdRel) = path.relative(logicalRoot, FSUtil.realToLogical(path.resolve(cwd, rel), realRoot, logicalRoot))`. 转换对子目录查询 (`input.path` 是非 `.`) 也正确, 因为 `path.resolve(cwd, rel)` 拼回 real abs.
  - V2 server handlers (`server/handlers/fs.ts:fs.watch`) line 138-143 已有 `filterRootLogical` 转换, 配套不动.
- **改动文件**:
  - `packages/core/src/fs-util.ts` — 新增 `FSUtil.realToLogical(file, realRoot, logicalRoot?)`, 共享工具.
  - `packages/core/src/filesystem/watcher.ts` — 删私有 `logicalToRealPath`, 改调 `FSUtil.realToLogical`. 注释说明已挪到 FSUtil 共享.
  - `packages/core/src/filesystem/search.ts` — ripgrepLayer `onEntry` / `glob` / `grep` 三处加 `toLogicalRelative` 转换; `find` 不变 (state 已转). 内部 `realRoot = location.directory`, `logicalRoot = location.logicalDirectory ?? realRoot`.
  - `packages/opencode/src/server/routes/instance/httpapi/handlers/file.ts` — `logicalInstanceDir(realDir)` helper, `findText` / `list` / `content` 三处用 logical 维度. 注释引用 memory/pitfalls-server.md#21/24/30.
  - `packages/core/test/filesystem/search.test.ts` — 加 `describe("FSUtil.realToLogical")` 6 个纯函数 unit test (logical 缺省 / logical==real / 子树内 / 子树外含同名前缀 / root 自身 / nested child).
  - `packages/opencode/test/server/httpapi-file.test.ts` — 加 `describe("logical path semantics")` 4 个 handler 集成测: list 绝对路径拼 logical、content boundary 越界拒绝、findText 输出 logical-relative、非 symlink fallback real. 不用真 symlink (见排查方法 4).
- **排查方法**:
  1. **「in-process 测真 symlink 莫名 ENOENT」 的真相**: `test/server/httpapi-file.test.ts` 一开始用 init hook (`fs.rename(tmp, real_xxx) + fs.symlink(real_xxx, tmp)`) 造真 symlink workspace, in-process webHandler request 期间 `fs.lstat(logicalInstance)` 报 ENOENT 但 `realInstanceDir` 是 OK 的, 即 logical symlink 被某 cleanup 路径误删. 同进程同 fs 视角, **测试主体 (Bun.write 之后立即 lstat) 能 stat 到 symlink**, 但 webHandler in-process 不行 — 说明 opencode layer build / InstanceStore load / fileSystem 中间件链里**有 fs.rm(symlink) 之类副作用**. 当前 fixture 实现 `tmpdir()` line 104 `fs.realpath(dirpath)` 早于 init 拿 tmp.path, [Symbol.asyncDispose] 用 realpath 调 `fs.rm` 删, 不会影响 in-process (afterEach 之后才跑). **最可能**: `Layer.provideMerge(Observability.layer)` 链上某 NodeFileSystem 初始化副作用, 或 `InstanceStore.load` 内部对 `directory` 物理化时调用 `fs.realpath` 命中某种 macOS symlink resolution cache 异常. **结论**: handler 行为只依赖 `LogicalDirectoryRegistry` 反查 + 字符串拼接, 不需要真 symlink. 测试改用**手动注入 `LogicalDirectoryRegistry.set(real, logical)`** 模拟 symlink workspace 的 side-channel 状态, 避开真 symlink 生命周期陷阱.
  2. **「fs.exists 在 macOS 上跟 symlink 但 in-process 报 ENOENT」 排查失败原因**: 单测 `bun -e ...` + `Effect.runPromise(pipe(NodeFileSystem.layer))` 跑同一个 path 返回 true, 但同 process 的 webHandler 返回 false. **唯一差异**是 webHandler 跑了 `Layer.provideMerge(Observability.layer)` 等一系列 layer. 怀疑是 `@effect/platform-node` 的 stat cache (effect FileSystem.stat 有内部 `nodeStat` effectify cache) 跟 symlink path 解析时命中 ENOENT 后缓存. 但查 `NodeFileSystem.js` line 33-44 (`access`) 和 line 310 (`stat`) 都是直接 effectify 无 cache, 排除. **剩下最大嫌疑**: opencode layer build 期间某处 `fs.rm(logical)` (待定位, 不在本次修复范围).
  3. **`path.resolve(cwd, cwdRel)` 在子目录查询时**必须先 resolve 回 real abs, 再 `realToLogical` 整段映射到 logical abs, **不能**直接 `realToLogical(cwdRel, location.directory, ...)` — `cwdRel` 是 cwd-relative, `location.directory` 不一定是 cwd, `path.relative` 越界触发 fallback 原样返回. 必须 `path.resolve(cwd, cwdRel)` 拼 abs 才能让 realToLogical 安全替换 prefix.
  4. **`FileSystem.FileSystem` (effect) 的 `exists` 在 effect v4 beta 实现**: 看 `node_modules/.bun/@effect+platform-node-shared/.../NodeFileSystem.js` line 32-44, `exists` 内部是 `NFS.access(path, F_OK)`, 不带 `O_NOFOLLOW`, 跟 symlink 跟随到 target. macOS 上对 symlink logical 路径应该 true. 但 in-process 测试 in-process 跑同一 path 报 false — 见排查方法 2.

#### 32. yargs `--no-xxx` 自动否定机制把未声明 `--xxx` 的 flag 误识别 → `web` 命令直接打印 help 退出 (code 1)

- **现象**: opencode `web` 命令加 `--no-open` boolean flag (期望默认 false, 传了跳过自动开浏览器) — 命令启动后**直接打印 help 退出** code=1, dev.js 的 spawn 进程异常退出, 后续 server 不起来, 30s 后 dev.js timeout 才报"server 没起来".
- **根因 (yargs auto-negation)**: yargs 默认把 `--no-xxx` 当成**未声明的** `--xxx` boolean 的**否定形式**. 当子命令**没有声明 `open`** 这个 option 时, yargs 在 parse 阶段把 `--no-open` 解析为 `--open=false`, 但因为 `--open` 本身未声明, yargs 进入"strict mode"路径打印 help 并 `process.exit(1)`. 同样坑位: `--no-foo` / `--no-bar` 都会触发, 跟具体子命令无关. **改用正向 flag 名 (如 `--dev` / `--skip-open` / `--manual-open`) 绕过**, 不依赖 `--no-` 前缀.
- **复现**:
  ```bash
  opencode web --no-open --port 24098
  # → 打印 Options 帮助, code=1 退出 (期望: server 起来, --no-open 抑制浏览器自动打开)
  ```
- **解决方案 (numas)**: opencode `web` 命令改用 `--dev` 命名 (含义: dev 模式, caller 自行开浏览器) + dev.js `--cwd <path>` 透传 workspace URL + server ready 后自己 `spawn open "http://localhost:PORT/?directory=<encoded>"`. `--cwd` 不传时 `dev.js` 不加 `--dev`, opencode 走原"自动开浏览器"路径 (向后兼容).
- **关键代码位置**:
  - `opencode/packages/opencode/src/cli/cmd/web.ts` — `.option("dev", { type: "boolean", default: false })` + `if (!devMode) { setTimeout(spawn /bin/sh -c "open $url &", 1500) }`.
  - `dev.js` — `parseFlag('--cwd', process.env.NUMAS_CWD)` + CWD 校验 + `webArgs.push('--dev')` + 启动后 `http.get /health` 轮询 ready 后 `spawn open $targetUrl` (URL 已 `encodeURI`).
- **排查方法**:
  1. **症状锁链**: `web` 命令带新 boolean flag 启动就退出 → 第一反应是 yargs 解析问题, 不是 binary bug. 看启动 log 有没有 "Options: -h, --help ..." 帮助文本 + "exit code 1" → 确诊 yargs 跳 help.
  2. **二等分法**: 单独 `opencode web --help` 对比正常 help; 加新 flag 后看 help 输出里**这个 flag 有没有出现** — 出现但退出 = yargs 接受但别的逻辑退出; **不出现** = yargs 误判为未识别 flag, 是 auto-negation.
  3. **测试方法**: yargs 自动生成 `opencode web --no-anything` 都会触发 (把 `--no-anything` 当作未声明 boolean 的否定). 简单排查: `opencode web --no-help --port 24098` 同样会跳 help → 锁定是 yargs auto-negation, 不是 `--no-open` 特有.
  4. **避开方法**: 不用 `--no-` 前缀的 flag 名, 用正向语义 (true = 启用某个 dev 行为). 例: `--dev` (dev 模式) / `--skip-open` (跳过自动开) / `--manual-open` (caller 自己开). 历史 opencode 命令里 `--no-mdns` 是因为 `mdns` 真的在 options 里声明过 (network.ts:33-37), auto-negation 命中已知字段, 不跳 help.

#### 33. symlink workspace 下 sumi `CustomFileSystemProvider.rename` 报 "rename across different cwd not supported" — `anchors.directory` 是 real, 跟 logical 形态 mismatch

- **现象**: symlink workspace (e.g. `/Users/foo/data/实验1` → `/Users/foo/real/实验1`), 浏览器 explorer 拖拽 `111/222` → 工作根, codeblitz explorer 弹错 `FileSystemError.Unknown('rename across different cwd not supported')`. console 显示 `from.relPath=1.txt from.headerPath=/Users/foo/data/实验1 to.relPath=1.txt to.headerPath=/Users/foo/data/实验1/222` (注意 from/to 都被压成 `1.txt`, headerPath 形态不一致).
- **根因 (前端 sumi 错位)**:
  1. opencode server 端 `InstanceStore.load` 走 `FSUtil.resolve` realpath 化 workspace (跟 §2.3 一致), 所以 `anchors.directory` = `/Users/foo/real/实验1` (**real**).
  2. browser explorer 拖拽时 `oldUri.fsPath = /Users/foo/data/实验1/222/1.txt` (**logical**, 浏览器不知道 symlink, 也不该知道).
  3. sumi `provider.ts:resolveFsPath` 算 relPath 时: `a = normalizeCwdPath(logicalAbs) = /Users/foo/data/实验1/222/1.txt`, `c = anchors.directory = /Users/foo/real/实验1`. `a.startsWith(c + '/')` → **false** (real ≠ logical 字符串 mismatch), 落进 line 95-100 "file outside workspace" 兜底, 返 `{ relPath: '1.txt', headerPath: '/Users/foo/data/实验1/222' }`.
  4. `from.headerPath = /Users/foo/data/实验1` (line 91 兜底), `to.headerPath = /Users/foo/data/实验1/222` (line 97), **两者不同** → 抛 "rename across different cwd not supported".
- **错误架构**: **server 端 fs/* 全部返 logical 路径** (memory/pitfalls-server.md#21/24/30/31 修过), 但 sumi 前端用 `anchors.directory` (real) 算 relPath — 这是越界的. 前端不该消化 symlink → real 转换, **该用 `effectiveCwd()` (URL `?directory=` 同源 logical) 作 ws 边界**.
- **解决方案 (sumi 修法)**:
  - `provider.ts:rename` 重写: 不再用 `resolveFsPath` 算 relPath, 走 `toHostPath` 拿 logical abs, 再 `absToRel(logicalAbs, effectiveCwd())` 算 relPath. header 也用 `effectiveCwd()` (logical) 而非 `anchors.directory` (real).
  - 删 "rename across different cwd not supported" 抛错 — 改成 `absToRel` 返 null 时抛 "rename 路径不在 workspace 内" (新错误带 abs+ws, 便于排查).
  - 加 `_resolveFsAbs(uri)` 私有 helper: `uri.fsPath` → `toHostPath` (已经在 home 锚点内) → logical absolute string.
  - `absToRel` import from `infra/path` (line 49 `import { absToRel, ... } from '../../infra/path'`).
- **改动文件**:
  - `sumi/src/service/filesystem/provider.ts` — `rename` 重写 + `_resolveFsAbs` 新私有方法 + `absToRel` import.
- **排查方法**:
  1. **「from/to headerPath 不一致但 file 形态又对」**: console.log `[fs-provider] rename {from, to}` 看 headerPath 是不是 workspace 子目录 (e.g. `/.../222`), 那就是 resolveFsPath line 95-100 误判. 修法: 别用 resolveFsPath, 走 `toHostPath + absToRel(..., effectiveCwd())`.
  2. **「anchors.directory vs effectiveCwd 差什么」**: `anchors.directory` = opencode /path 响应的 real (InstanceStore 物理化). `effectiveCwd()` = URL `?directory=` 同源 logical. symlink workspace 下两者 **不同**, 任何 `absToRel(abs, anchors.directory)` 在 logical workspace 内都会越界. **前端拿 ws 永远走 `effectiveCwd()`** (URL 是 logical source-of-truth).
  3. **「from/to 都变 basename 了」**: resolveFsPath line 95-100 把 a 跟 c 当字符串比较, mismatch 时丢 workspace 前缀只返 basename, 同时 headerPath 装的是 parent dir. 这是 caller 把 headerPath 当 "workspace 边界" 用的根本 bug — 改 caller 让它用 logical 形态算 relPath, 别用 headerPath 维度.
  4. **「playwright drag 在 codeblitz tree 不可靠」**: playwright `dragTo` 用 `page.mouse.down/move/up`, 很多 React DnD / codeblitz tree 走 react-dnd 监听 HTML5 `dragstart/dragover/drop`, 普通 mouse drag 不触发. 改用 `page.evaluate` 在 `dragstart/drop` 节点上 `dispatchEvent(new DragEvent(...))` 模拟 (DataTransfer 传空 dt, codeblitz React handler 自己读 `e.dataTransfer.getData` 或 DOM 反查 uri). 终点用 `elementFromPoint(x, y)` 找, 命中 `kt-modal-wrap` 等 overlay 是正常, codeblitz 会按坐标在 tree 里找最近 treeitem.
  5. **「opencode 端 `/api/fs/rename` 接受 logical rel 路径」**: server `filesystem.ts:rename` 走 `resolve(input.from)` (line 246, #21 修复后走 logical `path.resolve` 不 realpath), `from.absolute = path.resolve(logical_ws, '111/222') = /Users/foo/data/实验1/111/222` logical abs, chdir 穿透 symlink, `fs.rename` Node API 自己 realpath 物理化 — 成功. **不需要 server 端任何改动**.

#### 41. UI rebuild 后浏览器永远拿到旧页面: gzip 缓存 key 用「路径 + 原始字节数」, chunk hash 等长替换误命中

- **现象**: sumi rebuild 后 curl (`http://127.0.0.1:24096/`) 返回新 index.html (`main.457eab3d.js`), 但浏览器 `fetch('/')` / 页面仍加载旧 chunk (`main.222412bc.js`); 表现为 CSS/JS 修复"没生效" (改完像没改), 反复排查代码无果.
- **根因**: `opencode/packages/opencode/src/server/shared/ui.ts` 的 `uiGzipCache` key = 文件绝对路径, 命中条件 = `data.byteLength` 一致. index.html 无 contenthash, rebuild 后只有 chunk hash 变了 (`main.a1b2c3d4.js` → `main.e5f6a7b8.js`, **长度相同**) → 字节数比对误命中 → 服务端持续吐旧 gzip HTML (引用旧 chunk). curl 默认不带 `Accept-Encoding: gzip` → 走非缓存分支拿到新内容, 所以 curl 与浏览器表现不一致.
- **解决方案**: `embeddedUIResponse` 里 `text/html` 不走 gzip 缓存 (现场 gzip) + 加 `Cache-Control: no-cache` (浏览器每次 revalidate); 静态资源 (contenthash 文件名) 缓存逻辑不变.
- **改动文件**: `opencode/packages/opencode/src/server/shared/ui.ts`.
- **排查方法**: ① 浏览器 `fetch('/', {cache:'no-store'})` 读 HTML 引用的 chunk hash, 与 `curl` / 磁盘 `dist/index.html` 对比 — 不一致即此 bug; ② 别把「curl 正常」当作浏览器正常, 两者 Accept-Encoding 路径不同.

#### 44. 切换项目 (workdir) 后 chatbot 的 agents/skills 仍是旧项目的: 实例按目录缓存, 需显式 `POST /instance/reload`

- **现象**: 切换项目后 chatbot 的 agent/model/skill 列表仍是旧项目的; 手动点设置里的「重新加载」后才刷新.
- **根因**: opencode 实例按 directory 惰性创建并缓存 (`InstanceStore` 的 `cache`, key=realpath directory); UI 的 agents/skills/models/providers 只在 mount / `runtime-ready` / `instance.reloaded` 时拉取 (`loadConfig`). 切 workdir 只更新每请求的 `x-opencode-directory` header, 不触发任何配置刷新.
- **解决方案**: `chatbot.setProject` 里 `state.setWorkdir(dir)` 后自动 `POST /instance/reload` (等同设置里「重新加载」: 服务端 `InstanceStore.reload` dispose + 重建实例, 重读 `.opencode/agent|skill` / `opencode.json` / `~/.config/opencode`), 完成后 `instance.reloaded` 事件驱动 `loadConfig()` 刷新 agents/skills/models/providers. 先 await POST 保证服务端已替换实例, 后续 listSessions 命中重载后的新实例.
- **改动文件**: `sumi/src/extensions/chatbot/webview/ChatbotView.tsx` (`setProject`).
- **排查方法**: 切项目后配置不刷新 → 用 fetch spy 看是否发出 `/instance/reload` (header 应为新目录); 服务端 reload 逻辑在 `opencode/packages/opencode/src/project/instance-store.ts` 的 `reload` (替换 cache entry + `emitReloaded`).

#### 48. 子域端口代理 (--domain-proxy): Effect v4 全局中间件拿不到服务 + `__APP_CONFIG__` 重建丢字段

- **功能**: opencode 新增 `--domain-proxy <domain>` (对标 code-server `--proxy-domain`): 已知端口 P 暴露为 `http://P.<domain>/` (path/query 原样, 不带 `/proxy` 前缀). 公网需泛域名 DNS + 泛域名证书.
- **坑 1 (全局中间件服务注入)**: 首版把中间件做成 `HttpRouter.middleware(fn, { global: true })` 放进 `createRoutes` 的 provide 列表 → typecheck 报 `Request<"GlobalRequires", Config>` 不在 `RouteRequirements`; 服务 (Ports/HttpClient/ServerAuth) 在中间件内 yield 不到 (GlobalRequires 需求 `Layer.provide` 不剥离, `HttpRouter.serve` 又把 Request-tagged 需求从层需求剔除).
  - **解法**: 中间件注册放进**已有服务的 raw 路由层** — `portsRoute(domainProxy)` 的 `HttpRouter.use` gen 内 `router.addGlobalMiddleware((effect) => ...)`, 服务**闭包捕获** (gen 内先 `yield* PortsService / HttpClient / Socket.WebSocketConstructor / ServerAuth.Config`), WS 构造函数在调用点 `Effect.provideService` 注入 → 零服务需求. 必须在路由匹配前拦截 (全局中间件), 否则子域请求命中 opencode 同名路由 (`/api/*`, `/session/*`).
- **坑 2 (前端配置丢失)**: 注入到 `index.html` 的 `__APP_CONFIG__.domainProxy` 被 `sumi/src/config/app.ts:buildAppConfig()` **重建丢弃** (只列已知字段) → 前端读不到. 修法: `AppConfig` 加 `domainProxy?: string` + `buildAppConfig` 显式透传.
- **改动文件**: `opencode/packages/opencode/src/ports/ports-domain-proxy.ts` (Host 解析 + auth + isKnown + HTTP/WS 反代), `ports-route.ts` (factory + addGlobalMiddleware), `cli/network.ts` (--domain-proxy), `server/server.ts` + `routes/instance/httpapi/server.ts` (参数透传), `server/shared/ui.ts` (注入 __APP_CONFIG__), `sumi/src/config/app.ts` + `service/ports/ports.service.ts:proxyUrl` + `extensions/browser/browser.service.ts:normalizeUrl/deproxyUrl` (子域形态互转).
- **验证方法**: ① `curl -H "Host: 8123.localhost" http://127.0.0.1:24099/` → 命中代理 (200 + 目标内容); 未知端口 → 404 `not known`; 普通 Host → 仍走 UI; ② `curl http://127.0.0.1:24099/ | grep __APP_CONFIG__` 看注入; ③ 前端 DI 探针: React fiber (`document.querySelector('codeblitz-root')['__reactFiber$…']` 向上找 `memoizedProps.app.injector`) → `inj.get(PortsServiceImpl token).proxyUrl(8123)` 应返 `http://8123.localhost/`.

#### 61. CSP 里 `*` 不匹配 `blob:`/`data:` 特殊 scheme → pdf.js fake worker 加载失败

- **现象**: PDF 阅读器报 `无法加载: Setting up fake worker failed: Failed to fetch dynamically imported module: blob:...`; PDF 渲染不出来.
- **根因**: opencode 服务端 CSP header `script-src * 'unsafe-inline' ...` — CSP 规范里 `*` **不匹配** `blob:`/`data:`/`filesystem:` 特殊 scheme, 必须显式列出. pdf.js 的 fake worker 回退路径在主线程 `import(blob:)` → 被拦.
- **复现**: 任意 PDF 打开 → console 报 worker blob 加载失败; 对比 `curl -I` 看 CSP header.
- **解决方案**: CSP `script-src` 显式加 `blob:` (`opencode/packages/opencode/src/server/shared/ui.ts` 的 `csp()`); worker-src 同理要列 `blob:`.
- **排查方法**: 看到 `blob:` 资源被 CSP 拦 (console 的 CSP violation), 检查对应指令有没有显式列 blob: — 不要以为 `*` 包含它.

#### 68. `/api/fs/write` 的 content 是 base64 而非明文 → 写入文件乱码

- **问题描述**: webview 调 `POST /api/fs/write` 写 `.anno` JSON, body 传明文 `content`, 服务端 204 成功但磁盘文件是乱码二进制 (明文被按 base64 解码), 重新读取解析失败 → 标注「保存了但重载丢失」.
- **根因**: 该 API 契约是 `{ path, content: <base64> }` (见 `sumi/src/service/filesystem/filesystem.service.ts` 的 `bytesToBase64(content)`), 不是明文. 传明文时服务端 `Buffer.from(content, 'base64')` 把可见字符解成垃圾字节, 无任何报错.
- **解决方案**: 客户端写文本文件必须 **UTF-8 → base64** 后传: `TextEncoder` 编码 → 分块 `String.fromCharCode` 拼接 (避免超长参数溢出) → `btoa`. 读侧 `/api/fs/read` 返回裸字节 (无 base64), 直接 `res.json()`/arrayBuffer 均可.
- **排查方法**: 「API 204 成功但文件内容乱码」→ 对照同仓库既有调用方 (sumi filesystem.service) 确认 body 编码契约, 别只看 HTTP 状态码.

#### 70. 终端 sendText 用 `\n` 结尾 → 命令不执行 (pty 提交键是 `\r`)

- **问题描述**: 通过 ITerminalController / vscode 终端往 pty 发送命令时 `sendText(\`${cmd}\n\`)`, 终端显示命令但**不执行** (光标停在行尾不回车), 误判"终端不执行代码".
- **根因**: 终端提交/回车键是 **`\r`** (CR), 不是 `\n` (LF); xterm/pty 把 `\n` 当换行显示, 不触发提交.
- **解决方案**: `sendText(\`${cmd}\r\`)` (或 `\r\n`). 判断依据: 终端能显示命令文本说明写入通道正常, 不执行就是提交键不对.
- **排查方法**: 「终端显示命令但不执行」→ 先查结尾字符是 `\r` 还是 `\n`; 同时区分「命令没送达」(查 executeCommand/桥接日志) 与「送达没提交」(查结尾符).

#### 71. createTerminal 后立即 sendText → 命令丢失 (pty 异步就绪竞态)

- **问题描述**: 「运行代码」新建终端后立即 `client.sendText(cmd)`, 终端打开只有 shell 提示符 (如 `➜ 目录`), 命令文字都没出现; 日志显示 `sent` 早于 `create2 ok` (pty 创建) 约 50ms+.
- **根因**: `ITerminalController.createTerminal()` resolve 只代表前端 TerminalClient 建立, 底层 pty 是异步创建的; 在 pty 就绪前 `sendText` 写入的数据被丢弃 (无报错).
- **解决方案**: 新建终端后 `await new Promise(r => setTimeout(r, 800))` 等 pty 就绪再 `sendText`; 已有终端 (activeClient) 直接发. 更严谨可监听终端 ready 事件.
- **排查方法**: 「终端打开但命令没出现」→ 对比 `sent` 与 `create2 ok` 时间戳顺序; 命令丢失优先怀疑时序, 不是通道问题 (与 #70 提交键区分: #70 是显示不执行, 本坑是根本不显示).
