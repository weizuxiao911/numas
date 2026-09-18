# AGENTS.md — Numas AI 协作约定

> 用户与 AI 共同维护的项目协作规范. README.md 是给用户看的终态架构,
> specs/ 是需求与参考文档库 (含 numas 自有 PRD 与上游 opencode API 摘录),
> 本文件是 AI 协作协议与工程约束.
>
> 品牌: **Numas (🐮 牛马 AI)** — 打工人首选工作模式, 对标腾讯 workbuddy 类产品.

---

## 1. 用户与 AI 协作规范

### 1.0 标准开发流程 (编排与强约束)

> **AI 必须严格按以下 11 步推进, 每一步未到下界不进入下一步, 不允许跳步或合并**:

1. **用户提需求** — 用户输入明确任务
2. **双方讨论分析** — AI 调研 (搜代码/读文档/最小复现), 把事实摆出来, 不输出方案
3. **`question` 反馈建议或推荐方案** — AI 用 `question` 工具列出 2-4 个候选方案 + 推荐项, 含场景/取舍/影响面
4. **用户决策或反问** — 用户选 / 改 / 反问 → AI 补充事实回到步骤 2 或 3 → 直到**用户明确决策完成**才进入步骤 5
5. **执行开发** — 按用户决策改代码; 过程中若发现新歧义/不可逆风险 → 回到步骤 3 重确认
6. **按要求本地或部署容器验证** — 跑测试/构建镜像/起容器/抓真实流量, 不只"我觉得写对了"
7. **测试验收通过** — 跑通预期路径 + 边界 + 错误/降级 (按 §4.1 验收标准模板); 用户拍板"通过"才进步骤 8
8. **总结沉淀积累** — 本次踩坑/模式/隐式偏好 → 补 §4 避坑/实践 + 必要时 §3.2 长期偏好 (按 §3.1 自查铁律, 不依赖用户催)
9. **`question` 询问是否 git 提交推送** — 列选项: 提交+双远程 / 仅提交 / 暂存 / 不 git; 用户拍板后执行; **任何上一轮的 git 认可仅单次有效, 下轮重新问** (AGENTS.md §1.4)
10. **等待新需求** — 流程闭环, AI 不主动开新题
11. **异常分支**: 任何步骤发现违背 §1/§2 铁律 (含用户临时要求 AI 越权做不可逆动作) → AI 必须用 `question` 提醒并等用户拍板, 不沉默执行

> **反例**: ① AI 自行拍板方案直接动手 (跳过步骤 3-4); ② 改完代码就用一句"我准备提交"代替 question (跳过步骤 9, 违反 §1.4); ③ 用户在 §1.4 之外说"OK 就提交吧"AI 也照样 git add/commit (未真正走步骤 9 选项); ④ 改完不沉淀 (违反 §3.1).

### 1.1 责任分工

- **用户对结果负责**, AI 辅助完成开发/测试/问题处理等工作.
- **所有功能设计和技术方案必须由用户决策**, AI 仅能根据用户要求展开事实依据调查, 提供建议或方案推荐, **不得替人做决定**.

### 1.2 AI 自主边界 (仅限以下无歧义小动作)

- 拼写/格式/注释修复
- 已约定命名替换
- 单元测试补全
- 只读操作 (跑命令/读日志/截图)
- 临时文件清理 (mv stray 到 `.tmp/`)
- 维护 §4 避坑指南 (沉淀自身经验)

### 1.3 决策点必须用 `question` 工具反馈

适用范围: 技术选型/公开 API/数据模型/config schema 变更、跨模块/跨项目耦合改动、新依赖/新工具/新流程引入、删除/覆盖/迁移/远程写入/重写历史等**不可逆动作**, 以及任何用户未在对话中明确确认的功能/视觉/交互/边界处理.

反馈规范:
- 标题清晰、简洁, 不偏移主题
- 选项至少包含一项**推荐的可执行的、综合价值最高**的 (标"(推荐)")
- 必须由用户拍板, AI 不得用普通文本/隐式同意/"我准备 X 你 OK 吗"等替代

### 1.4 改动必反馈

只要 AI 动过项目文件 (任何改动, 不管多大), 完成后必须用 `question` 工具主动反馈, 询问 git 操作意向. **不得静默结束**.

反馈内容:
- 改了哪些文件 (简短列表)
- 关键改动点 (1-2 句话)

选项必须包含: 提交+推送 (双远程) / 仅提交 / 暂存 / 不 git 操作 (用户拍板).

即使上一轮用户取消了 git 操作选择, 只要 AI 后续又执行了其他改动, 也必须**再次主动反馈**.

> **铁律: 反馈必须真正调用 `question` 工具弹出可点选项, 严禁用普通文本代替!**
> - ❌ 反例 (无效): 正文写 "按约定询问 git 操作意向:" 然后就停, 或 "我准备提交, 你 OK 吗?" — 这不是 `question`, 用户没法拍板, 等于没问.
> - ❌ 反例: 用 `question` 工具问别的问题, 却把 git 选项塞进普通正文.
> - ✅ 正解: 一轮改动收尾时, 显式调用 `question` 工具, `questions[].options` 里放 git 操作选项 (首个标 "(推荐)"), 等用户点选返回后再据此执行.
> - 判据: 检查自己这一轮**有没有发出 `question` 工具调用**. 只输出了文字、没有工具调用 = 违规. 文档/调研类无代码改动的产出同样适用 (要不要提交文档也是 git 决策).

### 1.5 Git 流程 (双远程)

任何代码改动后, AI 必须用 `question` 工具反馈改动内容 + 列出提交/推送选项, 由用户决策. AI 不自作主张 `git add` / `git commit` / `git push`.

典型选项: 提交 (1 commit) / 拆 N 个 commit / 不提交; 推 gitlab / 推 github / 两个都推 / 不推; 提交信息 AI 写 / 用户给.

**多远程仓库同步**: 本仓库配置了 2 个远程:
- gitlab: `gitlab.grjky.com/new-app/numas`
- github: `weizuxiao911/numas`

用户拍板"推送"时, **默认两个远程仓库都要推** (gitlab + github), 除非用户明确只推某一个.

推送后自检 `git push` 两个 remote 都执行, 缺一个要补.

> **关键**: 用户对 git 的提示/认可**仅单次有效**. 下一次改动后必须重新提问.

---

## 2. 工程维护约束和规范

### 2.1 接手工作流程

接手工作时**必须以尊重客观事实为前提**, 对现有的功能设计实现和技术框架应用和约束进行全面了解, 再根据任务需求展开讨论和分析, 直到用户决策执行任务才能进行.

过程中如果你觉得满足条件可以进入执行, 可以使用 `question` 工具反馈给用户进行决策; 同理, 如果条件不满足时也可以使用 `question` 工具反馈用户进行选择, 以更好地推进工作落地.

**所有任务不为交付而着急**, 不做 DEMO 级的事. 要么不做, 要么就一次性做好. 做事时必须先充分讨论/分析后完成设计方案, 由用户决策执行才能推进执行. 挖出执行后, 要使用 `question` 工具反馈用户推进下一步操作, 所有的 git 操作必须由用户下达指示或你提问后得到用户认可后才能执行, **记住提示或认可仅单次有效!**

### 2.2 分层架构铁律

> **所有拓展文件系统操作必须通过 codeblitz 的文件系统和 opencode 访问服务器端, 不得直连 service.**

分层 (单向, 外层调内层, 内层不调外层):

```
外部  →  service  →  commands  →  codeblitz  →  extensions
```

- `extensions/` (`sumi/src/extensions/*`) 读写文件: 必须走 codeblitz (`@opensumi/ide-file-service` 的 `IFileServiceClient`) → opencode server fs API (`/api/fs/*`)
- **严禁** extensions 直接调用 service 层的 `__APP_FS__` / `service/fs.ts` 的任何方法
- service 层是 commands / codeblitz / 其他 service 调用的基础设施, 不暴露给 extensions 直调
- commands 层定义对外 API / token / interface, 是 service 与 codeblitz 之间的契约

**扩展间通信铁律 (vscode 标准)**:
- **内置拓展之间禁止直接 import / DI 注入其它拓展的 token/interface/实现** (跨拓展耦合,
  单拓展无法独立加载/卸载). 扩展能力必须**暴露为全局契约**后由调用方经标准机制消费,
  按优先级选型:
  1. **全局命令** (首选): 能力方 `CommandContribution.registerCommand` 注册 vscode 风格命令
     (如 `numas.browser.open`, 命令 id 字符串即跨拓展 API); 调用方
     `CommandService.executeCommand('numas.browser.open', url)` — 双方不互相 import
  2. **消息总线**: `service/event/eventBus.ts` 事件 (唯一 /global/event SSE) — 解耦广播
  3. **codeblitz 全局服务注入**: 仅限框架层接口 (IFileServiceClient / CommandService /
     编辑器等), 非某拓展私有
- **业务功能模块范式**: 业务功能按用户交互行为、遵循 codeblitz 兼容拓展标准开发, 通过框架
  扩展点 (ResourceProvider / EditorComponent / CommandContribution / opener / scheme 等)
  **注册到框架承载业务数据与交互**, 不在框架外自建承载; 模块间交互走上述全局通信, 禁止直连
- 反例 (2026-09 修正): PortsPanel 曾直接 import browser 拓展的 `BrowserToken` 注入 →
  改回 `executeCommand('numas.browser.open', proxyUrl)` (扩展间通信优先命令总线, 详见 §2.2)

### 2.3 跨平台路径铁律

> **路径以 opencode 服务端真实路径为单一事实源. 禁止自行拼接/重写/添加前导 `/`. 任何路径处理走 `sumi/src/infra/path.ts` 工具函数, 不要直接写正则/字符串拼接.**

**事实**: codeblitz 暴露的 `idePath` 与 opencode 宿主机 `hostPath` **完全一致**, 仅多 `file://` 协议头 (codeblitz editor 用). 不存在中间虚拟化映射. AI 不得发明 `path.win32` / `path.posix` 转换 / 自定义"虚拟根"层.

**禁令**:
- **禁止硬编码前导 `/`**: `'/' + segments.join('/')` 会让 Windows drive 渲染成 `/D:/projects` 多余前缀 (历史 bug: `extensions/filepicker/FilePicker.tsx:232`). 正确做法: 按首段是否含 `:` 判断, Windows drive 直接作为根 (`D:` / `D:/projects`), POSIX 才补前导 `/`
- **禁止硬编码分隔符**: 跨平台统一用 `/`, 用 `normalizeSep()` (`\\` → `/`). 服务端协议 / UI 展示均 POSIX 分隔
- **禁止写死的 `isWindowsDrive` / `path.win32` 判断到处散落**: 集中用 `infra/path.ts`:
  - `normalizeCwdPath(p)`: Windows drive 去前导 `/` + 去尾 `/` (server `path.win32` 处理)
  - `normalizeSep(p)`: `\\` → `/`
  - `isWindowsDrive(p)`: 单一权威检测
  - `absToRel(abs, ws)`: 宿主机绝对路径 → workspace 相对路径
  - `toHostPath(idePath, anchors)`: codeblitz 虚拟路径 → opencode 宿主路径 (来自 `infra/path.ts:toHostPath`, 不自造)
- **禁止 `/D:/...` 形态直接传给 server**: 走 `normalizeCwdPath` 规范化. 否则 server `path.win32` 按 POSIX 根解析 → 500/错目录
- **HTTP header 路径走 `encodeURI` (浏览器 fetch 强制要求)**: `x-opencode-directory` header 值必须 ISO-8859-1 (Latin-1), 客户端**必须** `encodeURI` 后再发 (中文/非 ASCII 路径直发会抛 `String contains non ISO-8859-1 code point`); server 端 `defaultDirectory` 防御性 `decodeURIComponent` 还原. 详细见 §2.4

**正确示例**:
```ts
// 绝对路径拼接 (POSIX '/Users/foo' / Windows 'D:/projects' 都对)
const p = (segments[0]?.includes(':') ? '' : '/') + segments.slice(0, i + 1).join('/');

// 路径规范化
const safe = normalizeCwdPath(userInput);   // 'D:/projects' 而非 '/D:/projects'

// server 请求前: header 走 encodeURI (兼容 fetch ISO-8859-1, 详见 §2.4)
headers: { 'x-opencode-directory': encodeURI(workspace) }

// server 端 defaultDirectory: 取 header 后防御性 decode
const raw = request.headers["x-opencode-directory"]
const dir = raw ? decodeURIComponent(raw) : process.cwd()
```

**检测方法**: 改完路径相关代码, **必须** 在 `dataDir` 是 Windows 路径 (如 `D:/projects`) 时跑一次, 验证:
- 面包屑/foot-path 不出现多余 `/` 前缀
- `getWorkspace()` / `urlWorkspace()` 返回 `D:/projects` 而非 `/D:/projects`
- `fs.listDir('D:/projects')` 200, 不 500
- 中文路径 `测试/中文目录/文件.md` 正常 resolve

### 2.4 opencode 跨进程通信约定

> **请求 opencode 统一使用 header 携带 `x-opencode-directory`. 不支持 header 的旧 V2 端点才用 `?directory=` query 方式.**

**事实**: opencode 服务端 workspace 路由有两套入口, 但 numas 客户端**必须**只走 header 一套:
- **header 入口** (所有 V1 端点 `/pty` `/file` `/path` 等): `x-opencode-directory` 是 workspace 唯一真实路径, server 端 `defaultDirectory(request, url)` 直接取该 header
- **V2 query 入口** (部分 `/api/...` 端点): `?directory=` query 作为 V2 workspace selector (历史兼容, server `selectedV2WorkspaceID` 才读)
- **混合 bug 链** (历史教训): sumi SDK client `v2/client.ts:33-52` 的 request rewrite 把 header 值复制到 query — `pick()` 比较时 `encodeURI(header)` 与 `encodeURIComponent(fallback)` 不一致导致 mismatch, 最终把 encoded header 写进 query, server `defaultDirectory` fallback 到 `process.cwd()` → 客户端 URL 指定 `?directory=Documents` 实际 PTY 跑到 numas 子目录, WS connect 时 query 是 `Documents` (encoded) → server routing 找不到该 session → **WS 404**

**禁令**:
- **禁止 client 把 header 写进 query**: numas fork 的 `@opencode-ai/sdk/v2/client` 的 request rewrite **只保留 header, 不写 `?directory=` query**. 已加 numas 增量 patch (`v2/client.ts` 后续修改需保留该 patch)
- **强制 client 对 header path 做 `encodeURI`**: 浏览器 fetch API 限制 header 值必须 ISO-8859-1, raw path 含中文/非 ASCII 字符直发会 throw `String contains non ISO-8859-1 code point` → 整个 fetch 失败. server 端 `defaultDirectory` 防御性 `decodeURIComponent` 兼容两端. (历史 `client.ts` 写"raw path + server decode"是基于错误前提, 已被 2026-09 实际报错修订)
- **禁止 `WorkspaceRoutingMiddleware` 兜底到 `process.cwd()` 后无声 fallback**: 若 `x-opencode-directory` 缺失或 decode 失败, 应显式报错或 400 (而不是静默用 server 启动 workdir 替代)

**正确示例**:
```ts
// client: 发送请求时 header 用 encodeURI 形态
const ws = normalizeCwdPath(getWorkspace());
fetch(url, { headers: { 'x-opencode-directory': encodeURI(ws) } });

// server: defaultDirectory 取 header 防御性 decode
function defaultDirectory(request, _url) {
  const raw = request.headers["x-opencode-directory"]
  return raw ? decodeURIComponent(raw) : process.cwd()
}
```

**检测方法**: 切换工作空间 (`?directory=/Users/foo/Documents`) 时, **必须**验证:
- `console` log `[opencode] runtime applied: { workspace: '/Users/foo/Documents' }` (而非 `process.cwd()` fallback 值)
- terminal create 出来的 PTY `cwd` 实际是 `/Users/foo/Documents` (而非 server 启动 workdir)
- WS `/pty/<id>/connect?directory=...` 不出现 404 (encoded header 不再泄漏到 query)
- server `/path?directory=...` 响应 `directory` 字段与请求一致

### 2.5 工程约定 / 禁忌

- **直连无代理**: client → opencode 之间不加 HTTP 中间层
- **CJK 路径 encodeURI**: HTTP header 必须 ISO-8859-1, `x-opencode-directory` 需 `encodeURI()`
- **单一事实源**: 端口 / CORS / APP_BASE_URL 由 dev.js 控制, 透 process.env 注入. 不要散落
- **平台兼容**: fs 命令按 host 平台分流 (mac/linux=POSIX, win=PowerShell); shell 走 `/pty/shells` 探测; **路径处理细则见 §2.3 — 所有路径拼接走 `sumi/src/infra/path.ts` 工具函数, 禁止硬编码前导 `/` 与 `\\` 分隔符**
- **单一职责**: 每个模块只做一件事
- **配置外置**: 敏感信息不入库
- **中文优先**: 文档/接口/文案中文为主
- **品牌**: Numas (牛马 AI) — 打工人首选工作模式. 文档/banner 体现这调性
- **临时文件统一放 `.tmp/`** (项目根, 已在 .gitignore): 日志/截图/临时数据/调试产物全部进 `.tmp/`. **禁止**写到 `/tmp/` (散落难追踪) 或项目其他目录 (污染源码). 后台进程 `&> .tmp/<name>.log` 是标准写法
- **AI agent 操作造成的 stray 零容忍** (本规则对上条的强制版本):
  - playwright mcp 截图/落盘 `filename` 一律**绝对路径** `.tmp/<name>.png`
  - 任何 `> file` / `tee file` / 截图工具的输出, 落盘路径必须在 `.tmp/` 下
  - 每次写完一组操作**必须自检** `git status --short` + `ls .tmp/` 确认没有散落到项目根或子目录的 stray 文件
  - 发现 stray 立刻 `mv` 到 `.tmp/` (mv 不算"破坏性操作")

### 2.6 上游 fork 约定继承

> numas fork 自 upstream opencode, 以下是 numas 必须继续遵守的上游约束 (有删减/中文化).
> 与 numas 自有约定冲突时, **以本节为准** + 在 §4 沉淀修正记录, 不得静默偏离.

#### 2.6.1 分支命名
- 短横线分隔 ≤3 词, **不**使用 `feat/` / `fix/` 之类前缀
- 示例: `session-recovery`, `fix-scroll-state`, `regenerate-sdk`

#### 2.6.2 提交与 PR 标题
- **conventional commit 风格**: `type(scope): summary`
- **type 合法集**: `feat` / `fix` / `docs` / `chore` / `refactor` / `test`
- **scope 可选**: 涉及包名/模块名时添加, 如 `core` / `opencode` / `tui` / `app` / `desktop` / `sdk` / `plugin`
- 示例: `fix(tui): simplify thinking toggle styling`, `docs: update contributing guide`, `chore(sdk): regenerate types`

#### 2.6.3 代码风格 (TypeScript / Effect)
- **单一函数**: 一函数到底, 除非可组合/可复用, 不预先抽单次使用的小 helper
- **避免 try/catch**: 能用 Schema decoder / Effect 错误通道就别 try/catch
- **避免 any**: 靠 type inference + schema 推断, 不显式 any
- **用 Bun API**: `Bun.file()` 替代 `fs.readFile`, `Bun.serve` 替代 node http 等
- **函数式数组方法**: 优先 `flatMap` / `filter` / `map`; filter 上挂 type guard 维持下游类型推断
- **常量优先**: `const` over `let`; 三元 / 早返回替代重赋值
- **避免 else**: 早返回替代 else, 提升主路径可读性
- **主函数读作 happy path**: 复杂校验/支持细节挪到紧邻的 helper, helper 紧贴主 export 下方
- **不 alias imports**: 不用 `import { foo as bar }` 或重命名 import
- **不 star imports**: 不用 `import * as Foo from "..."` 或 `import type * as Foo from "..."`
- **按需 dynamic import**: 重模块/启动敏感入口按需延迟加载; 动态导入的命名绑定写在用到它的最小作用域顶部, 不要 inline `.then(...)` 链
- **Effect generators**: 先 `yield* Service` 绑定到命名变量再调用方法, 不嵌套 `yield* (yield* Foo.Service).bar()`
- **同名命名空间导入**: `import { Project } from "@opencode-ai/core/project"` 后 `Project.ID`, 不 alias
- **Effect Schema helpers**: 解析不可信 JSON 优先 `Schema.UnknownFromJsonString` / `Schema.decodeUnknownOption`, 不手写 `JSON.parse` 包 `Effect.try`
- **Effect helper 不返 Effect**: 仅当 helper 真做 effectful 工作才返 Effect; 同步解析/校验/option 构造保持同步

#### 2.6.4 类型检查
- 从 **package dir** 跑 `bun typecheck`, **不**直接 `tsc`
- 例: `cd packages/opencode && bun run typecheck`
- CI 必须从 package dir 跑, 不允许从 repo root 触发 (历史教训: root 跑会污染上下文导致漏报)

#### 2.6.5 测试
- **避免 mocks**, `globalThis.*` 不到万不得已不用
- **测真实实现**, 不把逻辑复制到测试里再"测一遍"
- **tests 不能从 repo root 跑** (guard: `do-not-run-tests-from-root`)
- 必须从 package dir 跑, 例 `cd packages/opencode && bun test`

#### 2.6.6 V2 Session Core 架构约束 (核心)
> numas V2 session 重写上游架构, 以下是必须保留的不变量. 完整规范见 `specs/v2/session.md`.

- **durable prompt admission 与 model execution 分离**: `SessionV2.prompt(...)` 先 admit 一条 durable `session_input` row, 再调度 advisory `SessionExecution.wake(sessionID)`; `resume: false` 时只 admit 不调度
- **prompt 复用语义**: 复用 Session ID 沿用现有 Session; 复用 prompt message ID 仅当 Session/prompt/delivery mode 全匹配才做 exact retry; 冲突复用必须失败; 历史 projected prompts 在 exact retry 时懒合成 promoted inbox record
- **`SessionExecution` process-global + Session-ID based**: 本地实现持有 process-local Session coordinator, 仅在 drain 开始时通过 `SessionStore` + `LocationServiceMap.get(session.location)` 寻址; 任何层不得拿 Session ID
- **V2 interruption 只针对 active process-local ownership chain**, idle/missing 是 no-op
- **`SessionRunner` / model resolution / tool registry / permissions / filesystem 全部 Location-scoped**: 缺省 `Location.workspaceID` = implicit-local placement; 显式 workspace identity 保留给未来 placement 语义
- **每个 provider turn 仅一次显式 `llm.stream(request)` 调用**, durable continuation 前必须 reload projected history; 不桥接 legacy `SessionPrompt.loop(...)`, 不委托 in-memory tool loop
- **本地 Session drains 保持 process-local** 直到 clustering 实装: `SessionRunCoordinator` 合并 explicit same-Session resumes, 合并 prompt wakeups, 允许不同 Session 并发; advisory wakes 仅 drain eligible durable inbox; post-crash continuation recovery 需单独 explicit design
- **drain 无 durable identity / transcript boundary**
- **delivery 词汇显式**: 默认 steer (在 safe provider-turn boundary promote), 显式 `queue` 输入保持 pending 至 Session idle; promote 一条 queue 后重评 continuation, 再决定是否 promote 下一条; promote 任何新 user input 重置 selected agent 的 provider-turn allowance (一批 steers 重置一次)
- **`EventV2` replay owner claims 与 clustered Session execution ownership 分离**
- **System Context algebra / registry / built-ins 放 `src/system-context`**, Context Source producers 与其观察到的 domain 同地; Session History 选择 + Context Epoch 持久化 Session-owned

---

## 3. AI 自成长机制规范和约束

> 此部分 AI 自主维护. 接受用户的教导和帮助, 一切以用户意志为准.
> 不得替用户做决策, 只能提供建议或方案推荐!

> **🔔 AI 强制自查 (任务收尾必做, 未沉淀 = 任务未完成)**:
> 每次协作/一轮任务结束时, 在最终汇报前自查以下三项并落实:
>   ① 本次踩过的坑 / 排查教训 → 补 §4.2 避坑指南 (现象 / 复现路径 / 解决方案, 可回归的要标)
>   ② 反复出现的好做法 / 做事模式 → 补 §4.1 实践指南
>   ③ 用户给的纠正 / 隐式偏好 → 补 §3.2
> 反例: 2026-09 docker 会话连踩 7 坑未自主沉淀, 被用户提醒才补 §4 条目 11-17 —
> 违反 §3.1"自主跟进", 沉淀必须主动, 不依赖用户催促.

### 3.1 长期记忆维护

- **自主跟进项目迭代**: 每次协作后, 把沉淀的知识/教训同步到 §4 避坑指南, 避免同类问题多次出错.
- **沉淀自己的做事方法和习惯**: 反复出现的模式可以总结成 §4.1 实践指南的子项.
- **不替用户决策**: §1 已明确, 自成长过程中遇到需要权衡的方向, 用 `question` 反馈.

### 3.2 接受用户教导

- 用户给的纠正/指引, 当轮即时修正.
- 反复出现的同类纠正, 提炼成 §4 避坑指南.
- 用户的隐式偏好 (例如"回答精简", "先看现象再下结论"), 观察到后沉淀.
- **引导下载安装环节不写死版本号 / asset 文件名**: 走 GitHub Releases API latest 机制 (fetch latest release 的 assets[] 按 OS/arch 匹配 asset.name), 不在 buildDownloadLink/Url 类函数里塞写死的 semver / 文件名常量. build-time 配置 (tauri.conf.json / Cargo.toml 等) 的 semver 字段不在此列 (用户 2026-09-17 纠错).

### 3.3 自维护边界

AI **可以自主**做:
- §4 避坑指南/实践指南的增删改
- §3.2 沉淀长期偏好
- 拼写/格式/链接/目录校对
- `git mv` 与文档类 rename (跨文档引用同步)
- 临时文件清理 (.tmp/ stray)

AI **仍需 `question`**:
- §1/§2 任何规则条款的增删改
- 跨文档重组
- 与项目事实 (§1/§2) 冲突的修改

---

## 4. 实践手册与避坑指南

AI 自主维护, 用户可随时指出错误或要求补充. 后续按 §3.1 自查铁律持续沉淀.

### 4.1 实践指南

- 删除/重命名子包后, 提交前全仓 grep 包名 (含 `.html` / `.md` / 脚本), 清残留引用再提交. 本次删 `packages/desktop-tauri` 后 `test/launch.html` 仍有安装说明残留.
- `packages/tauri` 壳构建顺序: 先在 `packages/opencode` 跑 `bun run build --single` (内嵌 codeblitz 的 numas 二进制), 再 `packages/tauri` 的 `scripts/prepare.ts` 同步到 `binaries/numas-<triple>`, 最后 `tauri build`; 缺二进制时 `cargo check` 就会因 externalBin 校验失败.
- tray-only Tauri 壳: macOS 用 `ActivationPolicy::Accessory` 隐藏 Dock; 单实例 + `numas://` deep link 由 `tauri-plugin-single-instance` + `tauri-plugin-deep-link` 承载; 只 kill 自己 spawn 的 sidecar.

### 4.2 避坑指南

- 提交前先看工作区全貌: `git status` 可能混有上一轮遗留的未提交改动 (如 AGENTS.md / version.json), 不要默认全量 `git add -A`; 用 `question` 让用户拍板纳入范围与拆分方式.
- macOS dev 下 `tauri-plugin-deep-link` 的运行时 `register()` 返回 `unsupported platform`, `numas://` 只能在 `tauri build` 产出的 .app (CFBundleURLTypes) 里验证, 直接 `cargo run` 测不了 scheme.
- `tauri.conf.json` 的 `frontendDist` 相对 config 文件所在目录解析 (包根布局写 `assets`, 不要按 src-tauri 习惯写 `../assets`).
- opencode `bun run build` 会自动 bump `version.json` patch 并可能改写 `bun.lock` (平台包), 提交前逐项甄别, 不要无脑全量 add.
- macOS 26 按 **bundle id 记住菜单栏项的隐藏状态**: 若托盘项曾在 Accessory (无 Dock) 状态下创建而被系统放入隐藏位, 该 bundle id 会持续隐藏 (换新 bundle id 才恢复). 正确顺序: **先创建托盘项, 再切 Accessory**; 托盘图标用 22px 单色模板 (`icon_as_template(true)`), 显示位置由系统控制, 不要自定义.



