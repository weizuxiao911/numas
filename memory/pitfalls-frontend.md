## 避坑指南 — sumi 前端 / codeblitz / 布局 / chat

#### 19. 冷启动 left slot 折叠 / `defaultPanels` 失效: `fixLayout` 把 undefined currentId 清成 `''`

- **问题描述**: 配了 `appConfig.defaultPanels.left='@opensumi/ide-explorer'` 冷启动仍永久折叠 (48px + 持久化 `currentId:''`). 根因链: `LayoutService.restoreTabbarService` 用 `fixLayout(layoutState.getState(MAIN, defaultLayoutState))` 读态; 冷启动无持久化时 `defaultLayoutState.left = {currentId:undefined, size:undefined}`; `fixLayout` (`@opensumi/ide-core-browser/.../default-layout.js`) 对每槽位 `if(!size) currentId=''` **无条件**把 size 缺失的 currentId 清成 `''` (undefined 也被清); restore 三分支: `undefined`→消费 defaultPanels 展开, 非空→恢复, `''`→保持折叠 → defaultPanels 永远失效.
- **复现路径**: 清空 IndexedDB(`CODEBLITZ_HOME`)+localStorage 后冷启动, `localStorage.layout` 立刻写回 `{left:{currentId:''}}`, left slot 48px.
- **解决方案 (已修)**: ① postinstall patch `fixLayout` → `if(!size && currentId) currentId=''` (仅 currentId 本有值才清, undefined 保留交 defaultPanels), 脚本 `sumi/scripts/patch-opensumi-fixlayout.js` + 接入 `package.json` postinstall 链; ② `slots.ts` buildSlots() 加 `defaultPanels.left` module key; ③ `index.html` 最早 inline script 预置 `localStorage.layout` (仅无 key 时写 explorer+size, 用户折叠后 key 存在不覆盖 → 尊重用户).
- **遗留待办 (未解决, 用户已认可暂缓)**: 冷启动 left 仍有 <1s 延迟才出现. 根因: explorer 容器由 codeblitz `LayoutRestoreContributation.onDidStart` 才 `registerContainer` (动态模块, SlotRenderer 渲染等 `clientApp.appInitialized`), 而 right `chat-panel` 是 numas 静态 `ComponentContribution.registerComponent(...,SlotLocation.right)` 首帧即注册. **right"访问即展开"真相**: right 折叠态 `minSize:0/defaultSize:0` 宽度 0 看不见 + chat 容器注册早; left 折叠态 `minSize:49` 窄条可见 + explorer 容器注册晚. 彻底消延迟方向: 让 left explorer 容器在更早时机 (静态 ComponentContribution 仿 chat-panel, 或查 codeblitz bundle `registerContainer` 路径 ~175971) 注册.
- **排查方法**: 首帧宽度序列用 `page.addInitScript` + `requestAnimationFrame` 轮询 `.left-slot/.right-slot` `getBoundingClientRect().width` 记变化点; esbuild production 会把 `console.log`/无消费的全局赋值当 pure 死代码删掉, 诊断日志要挂到真正被读取的地方; 强制 rebuild 需 `rm dist/.numas-sumi-build-hash dist/main.*.js dist/opensumi.*.js` 再 `node dev.js`.

#### 20. docker 冷启动 storage 报错: `/home/.codeblitz EntryNotFound` + stat 缺失文件裸 500

- **现象 A (虚拟家目录 EntryNotFound)**: 容器内冷启动 console 刷 `EntryNotFound: 'file:///home/.codeblitz/datas/workbench.json' is not found`; codeblitz 框架启动要建用户配置目录, 拼出虚拟家目录 `/home/.codeblitz`.
  - **根因**: numas `toHostPath` 本有 `/home`→真实 home 映射, 但 `whenHostAnchors` 只等 `directory` 就绪就 resolve (directory 可从 URL `?directory=` 早早兜底, home 必须等 `/path`); 框架 storage 早期请求赶在 home 注入前 → home 为空 → `/home` 映射失败 → FileNotFound. 且 `initRuntime` 里 `setHostAnchors` 排在 `probeDefaultShell`(/pty/shells 串行请求) 之后, 进一步拖晚锚点.
  - **修复 (sumi src, 不动 node_modules)**: ① `infra/host.ts` `whenHostAnchors` 改为等 `directory && home` **都**就绪 (二者同源 /path 一次性注入); ② `opencode.service.ts` 把 `setHostAnchors` 提前到 `/path` 一返回就注入, 不被 probeDefaultShell 拖后.
- **现象 B (stat 缺失文件 500 而非 404)**: `curl /api/fs/stat?path=<不存在>` 返 500; 框架冷启动探测 `recent.json`/`editor-webview.json` 等尚不存在的 storage 文件刷 500.
  - **根因 1 (core)**: `packages/core/src/filesystem.ts` `resolve()` 里 `fs.realPath(absolute).pipe(Effect.orDie)` — 不存在的路径 realPath 先 ENOENT die, 根本到不了后面 `fs.stat()` 抛的标准 PlatformError NotFound. 改 `orElseSucceed(() => absolute)` 让 stat 给出权威 NotFound (与同文件 root realPath 容错同写法).
  - **根因 2 (server, 最关键)**: `packages/server/src/handlers/fs.ts` 的 `fileSystem` 包装 (把 NotFound defect → `Effect.fail(FileNotFoundError)`) 原本写在 `response(Effect.gen(...).pipe(fileSystem))` 的 **内层**; `response()` 经 `LocationMiddleware` provide, 其内层 fail 的 typed error **不被 HttpApi 序列化成 404** 而漏给最外层 `errorLayer` → 裸 500. 对比铁证: `fs.read` 用 `handleRaw(Effect.gen(...).pipe(fileSystem))` (fileSystem 在顶层) → 不存在返 **404**; `fs.stat` 用 `response(gen.pipe(fileSystem))` → **500**. 修法: fileSystem 移到 `response(...)` **外层** `response(gen).pipe(fileSystem)`.
  - **附带**: 拓宽 NotFound defect 识别 (effect v4 beta 形状不固定: `PlatformError && reason._tag==='NotFound'` / `reason._tag==='NotFound'` / `code==='ENOENT'` / message 正则), mkdir 补包装.
- **铁律**: **不得再手改 node_modules** (用户明令). 历史 postinstall patch (`patch-codeblitz-homefileserviceprovider.js` 等) 打过 `bundle/codeblitz.global.js` 这种 webpack 根本不引用的 UMD 全包 (实际入口是 `lib/index.js`), 是死 patch; 新修复一律走 sumi/opencode src.
- **排查方法**: ① server 侧 `console.error('[fs-diag]', JSON.stringify({name,msg,code,reasonTag}))` 进 catchCause 打 die defect 真实形状 (容器 `docker logs` 看), 别靠猜 instanceof; ② `curl -H "x-opencode-directory: <header>" /api/fs/stat?path=<x>` 直接复现, 对比 header 不同 (/root vs /) 的 200/500 定位锚点; ③ 同一 defect 用两个 handler (handleRaw vs response) 的返码对比, 快速区分「defect 识别失败」还是「错误序列化层位错误」; ④ 最终判功能: `docker exec numas find /root/.codeblitz -type f` 看 storage 文件是否都建成 (建成=早期 500/404 只是探测噪音, numas 前端已 catch).

#### 27. chat webview 是 codeblitz 内联组件, 可用 `useInjectable` 拿框架服务 (如 `IMessageService`)

- **现象**: 想在 chat webview 弹 codeblitz 原生 toast 通知 (`IMessageService.info`), 担心 webview 隔离无法访问 DI. 实际 `extensions/chat/module.ts` 用 `registerComponent` 把 `Chat` 组件注册到 `SlotLocation.right`, 是 **内联 React 组件 (跟其他 panel 一样在 codeblitz React tree 渲染)**, 完整继承框架 DI 容器, 可直接 `useInjectable`.
- **根因**: 误把 codeblitz 内联 webview 当 iframe/沙箱. codeblitz 真正用 iframe 隔离的只有 webview extension (vscode `webview` API), 而 `registerComponent` 注册的 React 组件是无缝嵌入主框架的.
- **正解**:
  ```ts
  import { useInjectable } from '@opensumi/ide-core-browser/lib/react-hooks/injectable-hooks';
  import { IMessageService } from '@opensumi/ide-overlay'; // 从 ide-overlay/common 取 token
  const messageService = useInjectable<IMessageService>(IMessageService);
  messageService?.info('已复制');
  ```
  `@opensumi/ide-overlay` 是传递依赖 (codeblitz 注入层会注册实现), 直接 import token 可用.
- **相关路径**: `IMessageService.info/warning/error(message, buttons?, closable?, props?)` — `MayCancelablePromise<string | undefined>`.
- **排查方法**: 想要"用 codeblitz 原生 UI" 时, 先确认当前组件是 `registerComponent` (内联) 还是 vscode webview (隔离). 前者全开 DI, 后者要 postMessage.

#### 28. 文本可选问题排查: 全局 `user-select: none` 在父容器, 文本子元素需显式 `user-select: text` 才可选

- **现象**: chat 消息正文/用户气泡/工具代码块鼠标拖不动选不中, 复制按钮也选不出连续多行.
- **根因**: 框架层 (`@opensumi/ide-core-browser` 的全局 / `.workbench` 等) 或父容器设了 `user-select: none` 防止 UI 误选, **CSS 不会自动继承允许**; 子元素想可选必须显式声明 `user-select: text`.
- **正解** (本项目 `sumi/src/extensions/chat/webview/styles.ts`):
  ```css
  .chat__msg-body, .chat__msg-user-text, .tool__code {
    user-select: text; /* 但 head/button/icon 保持 none, 避免拖动折叠按钮时选中文本 */
  }
  ```
- **保持 `user-select: none` 的元素** (按钮/标题/状态栏, 不允许误选): `.chat__todos-head` / `.chat__modal-item` / `.q__head` / `.chat__qmodal-caret` / `.tool__caret` / `.sub__out > summary` / `.sub__head` / `.sub__dot` 等. grep 现有 `user-select: none` 区分"该禁选"和"误伤"两类.
- **排查方法**: 1) DevTools 选中目标元素看 computed style `user-select`, 2) 检查所有父级选择器 (尤其 body/workbench 全局), 3) 不要"全局放开"会破坏按钮/标题的不可选体验, 精准放到文本容器.

#### 29. 卡片标题左/折叠按钮右布局: caret 必须 `margin-left: auto`, 父级 `display: flex` 才生效; 新子组件别漏 styles.ts

- **现象**: 工具/卡片 head `[icon, name, status, caret]` DOM 顺序, 视觉上 caret 紧贴 status 而不是贴右, 标题框左右不平衡.
- **根因**: 父级 `.tool__head` 已是 `display: flex; gap: 8px;` 但 caret 没 `margin-left: auto`, 默认自然流挨着上一个元素. 同理 `.todo__title` 用 `flex: 1` 撑开只让 `.todo__caret` 贴右, 但 `.tool__caret` 没声明 → 失败.
- **正解** (本项目 `sumi/src/extensions/chat/webview/styles.ts`):
  ```css
  .tool__caret, .todo__caret { margin-left: auto; }
  ```
  或者把"撑开元素" (title / summary) 设 `flex: 1; min-width: 0` (`reason__caret` 也靠 `margin-left: auto` 居右, 模式统一).
- **附加**: `.sub` 卡片 (委派子任务) 在 `SubAgentCard.tsx` 用 `sub__head` 类但 **styles.ts 完全没有定义**, 渲染时是裸 DOM (默认 block 流, 全宽). 新增子组件务必 grep styles.ts 确认样式存在, 否则 fallback 到浏览器默认渲染. 补法参考 `.todo` / `.reason` 玻璃卡片风格 (圆角 + `--ai-input-bg` 背景 + 1px divider).
- **排查方法**: 1) 改布局前看 DOM 结构和 CSS 类名是否齐全 (`grep className` 与 `grep -n "\.类名"` 交叉), 2) 折叠 caret 靠右两种写法选其一 (margin-left:auto 或 flex:1 撑开), 项目内统一一种, 3) 子组件新增先建空 styles.ts 段占位, 避免裸 DOM.

#### 34. 子代理 (task/subagent) 的 question/permission 请求在主界面不可见 → 子代理永久阻塞

- **现象**: 子代理调用 `question` 工具提问 (或触发权限 ask) 时, 主会话界面无任何提示, 父会话一直 busy, 子代理阻塞在 deferred, 用户只能 abort 主会话. 默认权限下不可达, 需配置放行才触发.
- **根因**:
  1. **默认 subagent 没有 question 工具**: `agent.ts` defaults `question:"deny"`, 仅 `build`/`plan` 覆写 allow; `general`/`explore`/自定义子代理继承 deny, 在 `llm/request.ts:resolveTools` 被 `Permission.disabled` 过滤. 用户全局 `permission: { question: "allow" }` (或按 agent) 才可能触发.
  2. **事件 payload messageID 位置**: `question.asked` properties = `{id, sessionID, questions, tool:{messageID,callID}}` (schema `v1/question.ts`), **没有顶层 `messageID`/`requestID`**; 内联卡片按 `props.messageID` 取会永远 undefined.
  3. **主视图丢弃子会话事件**: `ChatbotView.tsx` 事件处理在 `properties.sessionID !== 当前` 时 return; 且无 `question.list`/`permission.list` 恢复; 无会话树遍历 → 子会话 pending 永不展示.
- **解决方案 (对齐官方 app `session-request-tree`)**:
  - 事件处理移到会话过滤**之前**, 按事件 sessionID 存 store (question 用 sessionStorage 持久化 store; permission 用 `interactions` state).
  - **会话树遍历**: `session.list` 不带 `roots=true` 拿全量会话 (含子会话, `parentID` 字段), 建 childID→parentID map; 当前消息里的 task part `state.metadata.sessionId` 作兜底; BFS 取子树中**第一个** pending question/permission → 主会话 `QuestionDock`/`PermissionModal`, reply/reject/abort 都路由到 `ownerSessionID` (子会话).
  - **pending 对账**: 启动/切会话时 `GET /question` + `GET /permission` 全量回填 store, 覆盖事件丢帧/页面重载 (官方 CLI run 同款 bootstrap).
- **验证方法**:
  1. 测试 workspace 写 `.opencode/opencode.jsonc`: `{ "permission": { "question": "allow", "bash": "ask" } }` (新目录 = 新 instance, config 立即生效, 不用重启 server).
  2. 主 agent 委派 `general` 子代理, 指示它必须调用 question 工具 (或跑 bash 触发权限 ask); `GET /question` / `GET /permission` 看到 pending 的 `sessionID` = 子会话.
  3. playwright 两条路径都验: **恢复路径** (先提问后开页面, 靠 list 对账 + 树遍历出 dock) 与 **实时路径** (页面开着事件到达). 作答后核对父会话 task output = 子代理返回值; 忽略 (reject) 后 pending 清空且流程终止不悬挂.
- **排查方法**:
  1. **「可见的 playwright 浏览器被人工点击」**: 自动化验证时用户可能直接点可见浏览器窗口, 造成"dock 自动提交"误判. 用受控实验区分: 注入 fetch spy 记录 `new Error().stack` (确认调用来自 `QuestionDock.submitAll` 还是未知路径), 或只观察不点击 15s+ 看 dock 是否自行消失.
  2. **「reject 后 task 变 error 不是悬挂」**: `question.reject` → `Deferred.fail(RejectedError)` → question 工具 die → 子代理 tool error → task 工具按 `findLast(tool error)` 判失败. 这是服务端既有语义 (非 UI bug), 关键是 pending 清空且父会话回到 idle.
  3. **「事件顺序」**: `question.asked` 一定在对应 tool part `message.part.updated` 之后 (processor 先更新 tool running 再 execute); 内联/投影方案按 `tool.messageID` 关联 message 行, dock 方案直接按 sessionID 找 store, 不依赖顺序.
  4. **「作答后主视图消息列表变成了子代理的」**: 作答/忽略回调里用 `ownerSessionID` (可能是子会话) 调 `loadMessages(sid)` 会直接把主视图 `rows` 覆盖成子会话消息 (sessionID state 没变, 但显示内容错了). 修法: 仅当 `sid === sessionIDRef.current` (提问属于当前查看会话) 时才刷新; 子会话提问作答后主视图无需重载 (task part 状态不随作答变化).
  5. **「进入子代理会话再返回后, 卡片内联消息区空了」**: 内联投影只靠 `onEvent` 实时累积 rows, 组件重挂载 (切走再回来/列表重载) 后为空且不回补. 修法: 挂载时 `aiListMessages(subSessionId)` 回补 + 实时事件跟随 (回补行被实时行覆盖去重); 内联渲染直接复用主消息组件 (`MessageRow`/`PartRenderer`), 与主会话同款格式 (markdown/代码窗/工具卡), 不用 iframe.

#### 35. 浅色主题下 `--ai-accent` 解析为白色/半透明 → 用它做的状态指示不可见 (空 DOM 观感)

- **现象**: 子代理卡片运行态用自绘「三个空 span 小点 + `background: var(--ai-accent)`」+ 行尾「运行中」文字 `color: var(--ai-accent)`. 浅色主题 (`design-light`) 下用户看到指示器区域"DOM 是空的"——实为 `--ai-accent: var(--button-background, #6366f1)` 在该主题解析成 `#ffffff` / `rgba(255,255,255,.08)`, 白点白底/白字白底完全不可见.
- **根因**: `--ai-accent` 是"按钮背景色"语义, 可能是半透明白 (styles.ts 顶部 `--ai-neon` 注释早已记录该风险); 直接当**前景色/小图形填充**用, 明主题下丢失对比度. 空 span + CSS 背景的点阵形态也让排查时 DOM 看起来"空".
- **解决方案 (用户拍板)**: 状态表现**复用 shell 工具卡 (ToolView) 的既有组件**, 不另起一套:
  - 运行中 → `<span className="oc-tool__spinner" />` + 触发行加 `is-pending` (标题 shimmer)
  - 完成/出错 → `<span className="oc-tool__indicator">` + 图标; 出错由容器类 (`.oc-sub.is-error .oc-tool__title`) 把标题变红
  - 删除自绘 `.oc-sub__dots`/`.oc-sub__indicator`/`.oc-sub__status` 与 accent 前景色
- **改动文件**: `sumi/src/extensions/chatbot/webview/parts/SubAgentCard.tsx` + `styles.ts`.
- **排查方法**: ① 状态指示"看不见"先查 `getComputedStyle` 的实际颜色 + 当前主题 (`document.documentElement.className` 含 `design-light`/`design-dark`); ② 不要用 `--ai-accent` 做前景/填充, 前景用 `--ai-fg`/`--ai-fg-muted`/`--ai-danger`, 强调光效才用 `--ai-neon`; ③ 同类状态优先复用 `.oc-tool__spinner` / `.oc-tool__indicator` 保持全站一致.

#### 36. paste 事件里 `await` 之后 `getAsFile()` 失效 → 截图/文件粘贴静默失败 (合成 DataTransfer 测试假阳性)

- **现象**: 聊天输入框粘贴截图/文件无任何反应 (无附件卡片、无报错); 但用 `new DataTransfer() + dispatchEvent('paste')` 的合成测试**正常**添加附件.
- **根因**: paste 事件里先做了异步动作 (`await fs.mkdirp('.tmp')`) 才遍历 `clipboardData.items` 调 `it.getAsFile()` — **DataTransferItem 只在事件同步阶段有效**, 事件回调返回/跨过 await 后即失效, `getAsFile()` 返回 null → 循环 `continue` 静默跳过. 合成事件的数据不经过系统剪贴板, 不受失效影响, 所以自动化测试会假阳性.
- **解决方案**: paste 回调**第一段同步**取 File 快照 (`const files = fileItems.map(it => it.getAsFile()).filter(Boolean)`), 之后再 `await` 写盘/生成预览.
- **改动文件**: `sumi/src/extensions/chatbot/webview/ChatbotView.tsx` (`onPaste`).
- **排查方法**: ① 用真实剪贴板验证 (`navigator.clipboard.write([new ClipboardItem({'image/png': blob})])` + `Meta+V`), 不要只用合成 `dispatchEvent`; ② 在 paste 上挂 capture 监听打 `clipboardData.types/items` 确认事件与 kind 是否到达, 区分「事件没到」vs「处理逻辑跳过了」; ③ 任何 `getAsFile()` 取值必须在事件同步阶段完成.

#### 37. 新增 opencode V2 端点在 dev (7788) 下 404: webpack devServer proxy 白名单没加路径

- **现象**: 前端调 `POST /instance/reload` 在 dev (`http://localhost:7788`) 返回 404; 但直连 opencode (24096) 正常 200. 生产同源 (opencode serve 托管 UI) 不受影响.
- **根因**: sumi webpack devServer 的 `proxy.context` 是**白名单** (列出 `/api` `/session` `/question` ...), 只有列出的前缀才转发到 24096, 其余走 SPA fallback. 新增 V2 端点 (`/instance/reload`) 不在列表 → dev 下 404.
- **解决方案**: 新增端点时同步把路径前缀加进 `sumi/webpack.config.js` 的 `devServer.proxy[0].context` (如 `'/instance'`); 改完**必须重启 webpack dev server** (config 不热更新).
- **排查方法**: dev 下新端点 404 → 先直连 opencode 端口验证端点本身 (200 则排除服务端), 再检查 `webpack.config.js` 的 proxy context 是否含该前缀; 注意 `/instance` 是独立前缀 (不是 `/api/instance`).

#### 38. 自定义布局里渲染 codeblitz 标准 slot (如 bottom 终端): 需 layoutConfig 映射 + 显式激活容器

- **现象**: SoloLayout 里 `<SlotRenderer slot={SlotLocation.bottom} />` 渲染官方终端 (TerminalNextModule) 时, tabbar 面板挂载了但**无激活容器** (panel 高度 0, 无 xterm); 且 tab 列表混入其它自定义 slot 的面板.
- **根因**: ① 终端 view 注册**不带 location**, 靠 `layoutConfig[SlotLocation.bottom].modules` 收录 (`getSlotLocation` 反查), 不映射就不出现; ② 框架 tabbar 的 `currentContainerId` 来自持久化 layout state, numas 冷启动脚本把 `bottom.currentId` 置 `''` → 容器不激活; ③ 自定义 slot 名 (`solo.aside.container`) 与标准 slot 混用时, 容器注册的 side 推断可能把自定义 slot 的面板也挂进 bottom tabbar (显示多余 tab, 不影响功能).
- **解决方案**: `config/modules.ts` 注册 `TerminalNextModule` + `App.tsx` 的 `layout` 把 `[SlotLocation.bottom].modules = ['@opensumi/ide-terminal-next']`; 渲染后由调用方 (asidetopbar) `IMainLayoutService.toggleSlot(SlotLocation.bottom, true)` 轮询激活 (`getTabbarHandler('terminal')?.isActivated()`), 无终端实例 (`ITerminalController.clients.size===0`) 时 `executeCommand('terminal.add')` 自动新建.
- **附带**: `BuiltinBrowserModule` 曾在 codeblitz 容器重构 (452f001) 时从 config/modules 漏掉 → `browser.open` 命令 `HANDLER_NOT_FOUND`; 浏览器视图相关功能要先确认该模块已注册.
- **排查方法**: 新 view 不显示 → 先查 `registry.config.layoutConfig` 里对应 slot 的 modules 是否含该模块/panel id; 再查 tabbar `isActivated()`; 命令不存在 (`HANDLER_NOT_FOUND`) → grep `config/modules.ts` 是否漏注册该 module.

#### 39. vsix 扩展启动丢失 (线上全部失效): `createApp` 只执行一次, 与异步 metadata 赛跑

- **现象**: 远程容器 (oscollege) 所有 vsix 扩展 (docx/html/paper/zip-viewer) 都不生效; `/extensions/metadata.json` 200 有 4 条, 前端也打印 `metadata 拉取 OK: 4 entries`, 但点 docx 落到文件系统默认二进制错误页. 本地 dev 正常.
- **根因**: `sumi/src/App.tsx` 里 `installMetadata()` (fetch metadata.json) 与 `resolveBoot()` (fetch /path) 并行赛跑; `AppRenderer` 内 `createApp(opts)` 用 `useConstant` **只执行一次** (`@codeblitzjs/ide-core/lib/api/renderApp.js`). 若 `/path` 先返回 (远程慢网络: 本地实测 metadata 3072ms 就绪, app 3070ms 创建, 差 2ms), `createApp` 捕获空 `extensionMetadata`, 之后 `setMeta` 只更新 React props, **ClientApp 不会重建** → 永久只剩 2 个内置扩展 (`vsicons-slim`/`ide-dark-theme`), 4 个 vsix 全丢.
- **解决方案**: ① `index.tsx` 渲染前调 `preloadExtensionMetadata()` (模块级单例, 只 fetch 一次); ② App 用 `metaReady` 门控: 预取落地 (或 8s 超时降级) 才挂 `AppRenderer`; ③ mount 后兜底: `getPreloadedMetadata()` 无 vsix 时 `location.reload()` 重试一次 (`sessionStorage` 标记防死循环).
- **改动文件**: `sumi/src/index.tsx`, `sumi/src/service/extension/extension.service.ts` (预取单例 + `getPreloadedMetadata`), `sumi/src/App.tsx`, `sumi/src/service/extension/index.ts`.
- **排查方法**: ① 线上现象与本地不一致时, 直接探测 app 内 `ExtensionService.extensionMetaDataArr` (浏览器控制台经 webpack module cache 拿 `app.injector.get(ExtensionService)`), 只有 2 个内置 = vsix 没注册; ② 对照本地同探测 = 6 条 (2 内置 + 4 vsix); ③ `metadata.json` 接口 200 ≠ 扩展注册成功 — 两表分离 (fetch 成功 vs ClientApp ServerConfig 快照), 别只看接口.

#### 42. design 主题下 titleActions 动作图标不可见 (终端工具条按钮空白): 全局 `.kt-icon::before { display:none }`

- **现象**: 终端模式面板工具条按钮 (搜索/清屏/拆分/关闭)、底部面板展开/折叠等 20x20 按钮位置空白无图标; `titleActions___Xv1Ic design-titleActions___M7kD7` 里 `iconAction` span 有尺寸但 `::before display:none`.
- **根因**: design 主题全局 `.kt-icon::before { display:none }`, 只给特定 slot (bottom) 定义了 `iconAction` 尺寸/显示; 其它 slot (left/editor/panel toolbar) 的图标 glyph 全被隐藏. 之前只修了 `.app-solo__aside-sidebar [class*="titleActions"]` (explorer 标题图标).
- **解决方案**: `sumi/src/styles/app-shell.css` 加通用规则 `.app-solo [class*="titleActions"] span[class*="iconAction"]::before, ... span[class*="btnAction"]::before { display: inline-block !important; }`; 编辑器 tab 栏 `editor_actions` 整体 `display:none` (aside 布局用不到拆分, 图标也不可见).
- **改动文件**: `sumi/src/styles/app-shell.css`.
- **排查方法**: 扫描可见区域里 `[class*="iconAction"]` / `[class*="kticon"]` 的 `getBoundingClientRect().width < 2` + `::before display`; 注意要排除隐藏祖先 (display:none) 的误报.

#### 43. 排查「加载慢」先换全新 browser context 对照: 旧测试 tab 累积状态会假性放大启动时间

- **现象**: Playwright 长寿命测试 tab 实测启动 3.2s (spinner 到 app 挂载), 误判为代码/门控引入延迟; 同一 URL 用全新 context 实测仅 394ms.
- **根因**: 反复 reload/交互的旧 tab 累积状态 (缓存、worker、扩展宿主、节流) 拖慢后续加载; 另外 `page.route` 拦截忘摘会人为注入延迟 (本次曾残留一个 `setTimeout(3000)` 的 metadata route, 导致 metadata 请求 `duration=3007ms`).
- **解决方案/排查方法**: ① 判断启动耗时用**全新 browser context** (`browser.newContext()` + `newPage()`) 对照, 不拿旧 tab 数据下结论; ② 排查"某请求慢"先看 `performance.getEntriesByType('resource')` 的 `start/duration` — `duration` 异常整 (如 3007ms) 多为测试 route/timer 残留; ③ 测试完 `page.unroute()` 或关 tab, 避免污染后续验证; ④ 代码侧正常路径延迟只看真实依赖 (本次 metadata 2ms / /path 1ms, 门控无回归).

#### 45. SOLO/IDE 模式切换必须整页 reload + 模式持久化; IDE 模式组合收敛在 IdeLayout.tsx

- **现象**: 点 SOLO/IDE 切换按钮后回到原模式 (永远进不了 IDE).
- **根因**: `@codeblitzjs/ide-core` 的 `AppRenderer` 内部 `const app = useConstant(() => createApp(opts))` — ClientApp (含 `layoutComponent`/`layoutConfig`/`defaultPanels`) **只在首次挂载创建一次**; 运行时 `setAppMode` 只让 React 重渲染 App 组件, ClientApp 不重建 → 布局不变. 所以切换必须 `location.reload()` 让 createApp 用新 mode 配置重建; 而 `_appMode` 原先只存内存 (module 变量), reload 后重置回 solo → 切换永远无效.
- **解决方案**: `App.tsx` 模式持久化到 `localStorage['NUMAS_MODE']` (`_appMode` 初始化读, `setAppMode` 写); 切换按钮保持 `setAppMode` + `location.reload()`.
- **IDE 模式组合 (不注册新 slot / 不改 SOLO 组件)**: 全部收敛在 `sumi/src/layouts/IdeLayout.tsx` — 标准槽 (left explorer / main editor / bottom terminal) + 直接 `SlotRenderer` 渲染 SOLO 已注册的自定义槽 (`SOLO_SLOTS.SidebarAction` 模式切换 / `SOLO_SLOTS.MainAction` 项目选择 / `SOLO_SLOTS.MainContainer` chatbot 右栏); `IDE_MODE.panels` 用同一批 panel id 激活. IDE 专属样式 (顶栏高度/隐藏 SOLO 专用按钮) 用 `.app-ide` scoped CSS 在 IdeLayout 内注入.
- **附加 (SplitPanel 尺寸)**: `SplitPanel` 从**子元素 props** (`defaultSize`/`savedSize`/`flex`) 读尺寸, 不是 CSS flex; 自定义包装组件要透传这些 props (如 `IdeRightPanel defaultSize={380}`), 且包装 div 需 `height: 100%` (SplitPanel 的 wrapper 是 block, 子元素 height auto 会塌成内容高).
- **排查方法**: 改布局不生效 → 先确认是否走了 reload (createApp 一次性); 模式不记忆 → 查 localStorage `NUMAS_MODE`; SplitPanel 子元素尺寸不对 → 查子元素 props 是否有 `defaultSize`/`flex`, 及是否 `height: 100%`.

#### 46. tabbar 面板初始宽度 = app 侧 `appConfig.panelSizes[slot]`; `SlotRenderer.defaultSize` 对 tabbar 面板无效

- **现象**: 在 `IdeLayout.tsx` 给左侧 `SlotRenderer` 设 `defaultSize={278}` / `{300}` 完全无效, 实测 left 总宽恒为 383 (384 持久化).
- **根因**: tabbar 面板宽度由 `@opensumi/ide-main-layout` 的 `panel.view.js` 决定: `tabbarService.updatePanelSize(appConfig.panelSizes?.[side] || panelSize || 335)` — **未配 panelSizes 时兜底 panelSize=335** → left 总宽 = 335 + 48 (activity bar) = 383. `SlotRenderer.defaultSize` 只对非 tabbar 的 SplitPanel 直接子节点 (或自绘列) 生效; tabbar 槽位 (left/right 等 isTabbar) 读 app 侧配置.
- **解决方案**: 面板初始宽度写 `App.tsx` appConfig: `panelSizes: { [SlotLocation.left]: 278, [SlotLocation.right]: 450 }` (值 = 面板宽, 不含 activity bar); 拖拽下限写 `IdeLayout.tsx` 对应 `SlotRenderer` 的 `minResize` (如 left 204). 持久化的 layout 状态 (`localStorage layout` / `global:/layout-global` 的 size) 会覆盖初始值, 属预期 (用户拖过就以拖过为准).
- **排查方法**: 面板宽度不符合预期 → 先看 `appConfig.panelSizes` 有没有该 slot (没有则兜底 335+bar), 再看持久化 layout size 是否覆盖; 别在 React 布局组件里改 defaultSize (对 tabbar 无效).

#### 47. 自定义布局嵌 SlotRenderer + 长内容: BoxPanel wrapper `min-height:auto` + wrapper 是 block → 内容撑破视口 (composer 被顶出屏幕)

- **现象**: IDE 右栏 chatbot 发一次消息后, 输入框 (composer) 被推到视口外 (y 829 > viewport 810), 整个右栏/body 高度被撑到 3000+px; 消息列表不内部滚动而是随内容无限增高.
- **根因 (三层叠加)**:
  1. **BoxPanel wrapper `min-height: auto`**: `.app-ide` 作为 BoxPanel 子组件, BoxPanel 给每个子元素套一层 wrapper (CSS-module 类名 `wrapper___hash`, **不是字面 `.wrapper`**), 默认 `min-height: auto` → 长内容把它撑高 (3214 > box-panel 810), flex 收缩失效.
  2. **SlotRenderer 的 `.resize-wrapper` 是 block**: 右栏里 `<SlotRenderer>` 渲染的 wrapper 是 `display: block`, 内部 chatbot 的 `flex: 1 1 0%` 失去 flex 上下文 → 高度 = 内容高度, 不被容器约束.
  3. **`> *` 通配把 `<style>` 当 flex 项**: 用 `.app-ide__right > *:not(.app-ide__chat-topbar)` 约束时, topbar 组件渲染的 `<style>{styles}</style>` 也是直接子元素, 被赋 `flex: 1 1 auto` 占了 451px.
- **解决方案** (`sumi/src/layouts/IdeLayout.tsx`):
  ```css
  .app-ide [class*="box-panel"] > [class*="wrapper"] { min-height: 0; }
  .app-ide__right { min-height: 0; }
  .app-ide__right > *:not(.app-ide__chat-topbar):not(style) {
    flex: 1 1 auto; min-height: 0; min-width: 0;
    display: flex; flex-direction: column; overflow: hidden;
  }
  ```
  验证: 发送消息后 chatbot 稳定 726px, composer y=741 不动, `.chat__messages` h=586 / scrollHeight 3465 内部滚动.
- **排查方法**:
  1. 量整条链每层 `{h, flex, minHeight, height, overflow}`: `.app-chatbot` → `.resize-wrapper` → `.app-ide__right` → `.app-ide__body` → BoxPanel wrapper → box-panel; **哪层 h 超出容器高度, 就是那层缺 `min-height: 0` / 缺 flex 上下文**.
  2. CSS-module 类名带 `___hash` 后缀, 字面 `.wrapper` 选择器匹配不到 → 用 `[class*="wrapper"]` 属性选择器.
  3. 用 `> *` 通配子元素时必须排除 React 组件内联的 `<style>`/`<script>` (`:not(style)`), 否则它们会被当 flex 项占位.

#### 50. 拦截 codeblitz 文件树 drop 做外部上传: 拖拽高亮 `mod_dragover` 残留背景色

- **现象**: 拖文件到资源管理器上传 (files 拓展), 完成后整棵树节点残留浅蓝背景 (`rgb(214,235,255)`, 类 `mod_dragover`), 不还原默认态.
- **根因**: 树的高亮状态只在它自身的 `dragleave`/`drop` 流程里清; 外部拖拽时我们的 window 捕获监听 `preventDefault` + `stopPropagation` 拦下了 drop, 树收不到清理事件. 且**上传触发的 fs 变更 → 树刷新重渲染会把已清的高亮再套回去** (同步/60ms 补发 dragleave 都被覆盖).
- **解决方案**: drop 后**等上传完成** (树重渲染稳定) 再补发 `dragleave` (目标 = drop 点元素, `bubbles: true`), 另加 300ms 兜底再清一次. 不要手动删 `mod_dragover` 类 (React 状态还在, 下次渲染会加回来).
- **验证**: 拖拽后 `document.querySelectorAll('[class*="mod_dragover"]').length === 0` 且节点背景回到透明; playwright 合成 drop 即可复现/回归 (拖拽用 `browser_drop`).

#### 51. marked 7 的 renderer 是旧式签名 (href,title,text): 按 v9+ token 解构会把链接渲染成 undefined

- **现象**: markdown 预览/chat 里 `[文字](url)` 渲染成 `<a href="undefined">undefined</a>` (带 target/rel 属性, 说明自定义 renderer 生效但取不到字段).
- **根因**: 项目装的 marked 是 **7.0.5**, `renderer.link` 签名是 `link(href: string, title, text: string): string` (旧式); 实现按 v9+ 的 token 解构 `link({ href, title, text })` 写 → 第一个参数是字符串, 解构全 undefined. (`marked.d.ts` 里 renderer 段 vs tokenizer 段容易看混.)
- **解决方案**: 按 marked 7 签名写: `link(href, title, text) { return `<a href="${href}"${title?` title="${title}"`:''} target="_blank" rel="noopener noreferrer">${text}</a>`; }`. 升级 marked 到 v9+ 时才改回 token 解构.
- **排查方法**: 渲染出的 `<a>` 有 target/rel 但 href/text 是 undefined = 自定义 renderer 的参数签名不匹配; 对照 `node_modules/marked/lib/marked.d.ts` 的 renderer 签名, 不要照抄网上 v9+ 示例.

#### 54. SOLO 布局持久化后跨模式消费: sidebar.collapsed 被 IDE 模式 ActionBar 镜像逻辑读取 → 模式切换按钮重复

- **现象**: SOLO 下折叠 sidebar 后切到 IDE 模式, 顶栏出现**两个** SOLO/IDE 模式切换按钮.
- **根因**: `ActionBar` (MainAction 槽, SOLO/IDE 都渲染) 有「sidebar 折叠时镜像显示 mode-switch + 展开按钮」逻辑, 读 `layout.state.sidebar.collapsed`. IDE 顶栏同时渲染 `SideTopbar` (SidebarAction 槽, 自带 mode-switch) → 持久化把 SOLO 的折叠态带进 IDE → 镜像也渲染 → 重复.
  - 持久化前 `sidebar.collapsed` 每次刷新重置 false, 所以该 bug 被掩盖; 加持久化 (AGENTS 布局状态全量持久化) 后暴露.
- **解决方案**: 镜像逻辑加模式判断 `getAppMode() === 'solo'` — IDE 下不渲染 SOLO 的镜像元素 (mode-switch/expand 对 IDE 左栏无意义, IDE 左栏显隐走 IMainLayoutService).
- **排查方法**: 「某按钮/元素重复」先查同一 slot 被几个布局同时渲染 (IDE 顶栏渲染 SidebarAction + MainAction 两个槽) + 该元素是否被跨模式共享的状态驱动; 持久化改动上线后, 复查所有消费该状态的组件是否按模式 guard.

#### 55. 两个 UI 细节坑: hover 显现按钮用 display 切换导致行抖动; 玻璃弹层透明度过低显"被遮罩"

- **现象 A (hover 抖动)**: 会话列表项 hover 时行高/行宽变化, 列表整体抖动; 根因是删除按钮 `display: none` → hover 时 `display: inline-flex` 重新占位 (24px 宽 + 高过文字行) → 名称列宽/行高跳变.
  - **解法**: 按钮常驻占位, 用 `visibility: hidden` → hover/`:focus-visible` 时 `visibility: visible`; 布局尺寸全程不变.
- **现象 B (弹层"被遮罩"/发灰)**: 自绘玻璃 modal 用了 74% 透明底 + `backdrop-filter: blur`, 底下 45% 黑遮罩透出 → 卡片显灰暗 (像素采样 ~225 灰), 观感像被遮罩盖住.
  - **解法**: 对齐参照组件的**实际计算值**而非设计稿直觉 — chat 模型选择 modal 实测 `background: color(srgb 1 1 1 / 0.96)` (近不透明), 改 96% 后像素 ~250 亮白.
- **排查方法**: ① "hover 抖动"先量 hover 前后目标行/相邻行的 `getBoundingClientRect` (h/w/name 宽度), 定位是哪个子元素出现导致; ② "弹层颜色不对"别猜, 用 `getComputedStyle(el).backgroundColor` 对比参照元素 + 截图区域像素采样; 注意 portal 出去的节点不继承源容器的 CSS 变量 (`--ai-*` 定义在 `.chat`), 跨容器复用样式要自带变量/兜底值.

#### 56. `width: 100%` 元素加 `margin-left` 撑出横向滚动条: 改 `width: auto`

- **现象**: 给分组下的列表项 (基础样式 `width: 100%`) 加 `margin-left: 22px` 做缩进对齐, modal body 立即出现横向滚动条.
- **根因**: `width: 100%` 是相对 containing block 的宽度, 再加 margin 后总占宽 = 100% + 22px → 溢出父容器.
- **解法**: 缩进场景把该项改 `width: auto` (block 元素 auto 宽自动填满剩余空间, 含 margin 计算) — 或 `width: calc(100% - 22px)`; 不要 `width:100%` + margin 混用.
- **排查方法**: 元素莫名横向滚动 → 量 `scrollWidth - clientWidth` 定位溢出容器, 检查子项 `width:100%` + margin/padding(非 border-box) 组合.

#### 57. 图片/视频无法预览: StaticResourceService 缺 `file` provider, `file://` URI 原样返回被浏览器拦截

- **现象**: explorer 打开图片 (ImagePreview) 空白/不显示; 图片文件本身正常 (fs API 能读).
- **根因**: `StaticResourceService.resolveStaticResource(uri)` 在 **没有对应 scheme provider 时原样返回 uri** (`if (!this.providers.has(uri.scheme)) return uri`). codeblitz 的 `file` provider 在 `EditorSpecialModule` 里 (`EditorStaticResourceContribution`), 该模块**不在默认 modules 列表** (`@codeblitzjs/ide-core/lib/core/modules.js`), 我们也没注册 → 实际 providers 只有 `monaco` + `kt-ext` → `<img src="file:///...">` 被浏览器拦.
  - 排查指纹: 浏览器控制台注入取 injector → `StaticResourceService.providers.keys()` = `['monaco','kt-ext']` (无 file).
- **解决方案 (不注册整个 EditorSpecialModule — 会带 breadcrumb/preference/doc-provider override 副作用)**:
  只补 `file` provider (加在 `RegistryStaticResourceContribution.registerStaticResolver`):
  ```ts
  service.registerStaticResourceProvider({
    scheme: 'file',
    resolveStaticResource: (uri) => {
      const fsPath = uri.codeUri?.path || uri.path?.toString() || '';
      const ws = effectiveCwd();                    // URL ?directory= logical
      const rel = ws ? absToRel(fsPath, ws) : null; // infra/path
      if (!rel) return uri;                          // 工作区外原样
      return URI.parse(`${appBaseUrl().replace(/\/+$/, '')}/api/fs/read/${encodeURIComponent(rel)}?directory=${encodeURIComponent(ws)}`);
    },
    roots: [appBaseUrl()],
  });
  ```
  **关键**: img/video 标签无法带 `x-opencode-directory` header → 必须走 `?directory=` query (V2 workspace selector); V2 fs read 返回文件真实 mime (`image/png`) 可直接渲染.
- **验证**: providers 含 `file`; `new Image()` 设解析后的 URL → `onload` + `naturalWidth>0`; 或 curl `?directory=` 返回 200 + `image/png`.
