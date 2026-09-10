# AGENTS.md — Numas AI 协作约定

> 用户与 AI 共同维护的项目协作规范. README.md 是给用户看的终态架构,
> docs/AI 工作台总体设计.md 是项目静态事实, 本文件是 AI 协作协议与工程约束.
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
  改回 `executeCommand('numas.browser.open', proxyUrl)` (见 docs/AI 工作台总体设计.md 依赖规则 4/5)

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

> AI 自主维护, 用户可随时指出错误或要求补充.

### 4.1 实践指南

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

### 4.2 避坑指南

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

#### 4. AI 操作造成的 stray 文件污染项目根

- **问题描述**: playwright mcp 截图默认相对路径或 `/tmp/`, 散落到项目根或子目录, 污染源码/触发 lint warning.
- **复现路径**: `screenshot({path: 'foo.png'})` 不带目录前缀.
- **解决方案**: 截图/落盘 `filename` 一律**绝对路径** `.tmp/<name>.png`; 任何 `> file` / `tee file` 输出必须在 `.tmp/`; 写完一组操作自检 `git status --short` + `ls .tmp/`; stray 立刻 `mv` 到 `.tmp/`. 见 §2.5.

#### 5. AI 静默 commit / push, 用户失去决策权

- **问题描述**: AI 自作主张 `git add` / `git commit` / `git push`, 违反"用户对结果负责 + 用户对 git 操作拍板"原则.
- **复现路径**: AI 完成功能后默认执行 commit + push 双远程, 不走 question 工具.
- **解决方案**: 任何改动后**必须**用 `question` 工具列出提交/推送选项, 等用户拍板; 用户对 git 的提示/认可仅单次有效, 下次改动重新提问. 见 §1.4/§1.5.

#### 6. question 选项缺推荐, 用户必须自己拍板所有选项

- **问题描述**: AI 用 question 工具但选项无推荐标, 用户失去"综合价值最高"参考, 易选错或来回问.
- **复现路径**: 选项平铺无标, 用户从 4-5 个里盲目选.
- **解决方案**: 选项至少包含一项**推荐的可执行的、综合价值最高**的 (标"(推荐)"); 标题简洁不偏移主题. 见 §1.3.

#### 7. 用户提示/认可被跨任务复用, 误以为已批准新动作

- **问题描述**: 用户在某轮认可"提交+双远程推送", AI 把它带到下一轮的所有改动, 跳过 question.
- **复现路径**: 第二轮改动后 AI 直接 `git push`, 没问.
- **解决方案**: 用户对 git 的提示/认可**仅单次有效**, 每轮改动后重新走 question. 见 §1.5 末尾强调.

#### 8. CLI `chromium --no-sandbox` 启动需要 bundle ESM 路径, 误用 CJS 路径

- **问题描述**: 排查工具 `cli/chromium-sandbox-flag.js` 启动 puppeteer 时 bundle 路径写错 (`./bundle.js` 找不到).
- **复现路径**: `node cli/chromium-sandbox-flag.js`.
- **解决方案**: 用 `path.join(__dirname, '../dist/something.cjs')`, ESM 项目入口指向 `dist/index.cjs`.

#### 9. 端口反代 URL 拼接漏 `replace(/\/+$/, '')`, 双斜杠出错

- **问题描述**: `proxyUrl(port)` 拼接 baseUrl + `/proxy/<port>/` 时, baseUrl 含尾斜杠会导致 `http://localhost:24096//proxy/8000/`.
- **复现路径**: `appBaseUrl()` 返回 `/` 或 `http://localhost:24096/`.
- **解决方案**: 拼接前 `replace(/\/+$/, '')`, 见 `proxyUrl()` 实现.

#### 10. 内置浏览器默认 `<embed>` 渲染 PDF 不可靠 (依赖 Chrome PDF 插件)

- **问题描述**: headless Chrome 无 PDFium, 部分 Chrome flag 禁用 PDF viewer, `<embed src=blob type=application/pdf>` 渲染失败显示空白.
- **复现路径**: 启用 PDF plugin 禁用的 Chrome.
- **解决方案**: 默认 `pdfMode='pdfjs'`, 走 pdf.js + canvas 渲染, 跨环境可靠. worker 从 unpkg/jsdelivr CDN 拉, CSP `worker-src * blob:` 已透传.

#### 11. 代码/patch 改了但运行镜像没重建 → "改了没修复"假象

- **问题描述**: sumi postinstall patch (storage 路径) 与 Dockerfile 已改, 但容器内 binary 仍是旧产物 (marker 为 0), 用户验证仍失败, 误判方案无效.
- **复现路径**: 改 Dockerfile/package.json/patch 后直接跑旧镜像验证.
- **解决方案**: 验证前先确认"运行中产物"确实含改动: docker 镜像用 `docker exec strings /home/.numas/exec/opencode | grep marker`; 本地 dist 用 grep marker; 交叉/重编产物看构建时间戳. 先对产物版本, 再谈方案对错.

#### 12. 改完源码忘了重编产物就验证 → 旧产物报错误导排查

- **问题描述**: 修 opencode 注入链后直接起旧 binary 验证, 反复报 `provideService is not a function`, 误以为修复方向错.
- **复现路径**: 源码改动后, 运行验证用的 binary/dist 是改动前构建的.
- **解决方案**: 改服务端/前端源码后, 验证前必须重新构建对应产物 (记录构建时间/日志尾部 smoke 通过), 或先 `git log`/时间戳确认产物新于源码改动.

#### 13. 项目 fork 的 Effect 是 v4 beta, 标准 API 可能运行时缺失

- **问题描述**: `Layer.provideService` 编译能过 (类型有), 运行时 `b.provideService is not a function` 直接崩.
- **复现路径**: 用标准 Effect v3 API 在 opencode fork (v4 beta) 里 provide context.
- **解决方案**: fork 内新代码先搜同仓用法/避开重 context 注入; 参数直传优先于 context provide; 跑 smoke test 确认运行时 API 存在.

#### 14. ubuntu 镜像预置 uid 1000 用户, useradd 撞 UID

- **问题描述**: Dockerfile `useradd --uid 1000` 在 debian:12-slim 正常, 换 ubuntu:24.04 后 exit 4 "UID 1000 is not unique" (官方镜像预置 ubuntu 用户 uid 1000).
- **复现路径**: 基础镜像 debian → ubuntu 后不检查预置用户直接构建.
- **解决方案**: 换 base 镜像先核对预置用户/包差异 (apt 包可用性实测一次通过); 本项目按用户拍板直接 USER root, 不自建服务用户.

#### 15. 镜像层 ENV 默认值抢占用户 `-e` 覆盖 → "改端口没生效"

- **问题描述**: Dockerfile `ENV NUMAS_PORT=4096` + entrypoint 优先读长名 NUMAS_PORT → `docker run -e PORT=8080` 永远 4096.
- **复现路径**: 镜像留默认 ENV, entrypoint 长名优先.
- **解决方案**: 约定"短名 env (-e PORT) 是用户替换镜像默认的主通道": 读值顺序 短名 → 长名 → 内置默认 (entrypoint v() 已实现); `-e PORT` 与 `-p` 映射必须配套 (8080:8080), 提示文案写明.

#### 16. fork flag 传了但没人消费 → 前端永远用编译期默认 (dev 碰巧掩盖)

- **问题描述**: opencode `--registry` 参数从未 provide 到 UI 注入层 (RegistryConfig 无 provide 点), 前端 registryBaseUrl 恒为 sumi webpack 编译期默认 `http://127.0.0.1:7790`; dev 时浏览器本机恰好跑着 registry 所以"碰巧工作", 容器部署语义反转 (浏览器侧 127.0.0.1 是用户电脑) 才暴露.
- **复现路径**: 注入链无 provide; 验证只看"功能正常"没查运行时注入值.
- **解决方案**: 验证"配置/注入链"要看运行时实际值 (页面 evaluate `window.__APP_CONFIG__.registryBaseUrl`), 不能只凭功能 OK; 容器场景 registry 必须经同源反代 (--registry /proxy/7790), 启动方显式传参, 不写死编译期.

#### 17. "简化"框架适配逻辑丢字段语义 → 资源路由回归 (explorer 图标全 404)

- **问题描述**: 静态资源 provider 的 resolveStaticResource "简化"成一律 `registryBaseUrl + path`, 丢掉原实现的 `uri.authority` 分流语义 → codeblitz 市场资产 (alipay CDN 的 vsicons 图标, uri 自带 authority) 被指到本地 registry → 图标全 404.
- **复现路径**: 改 kt-ext 静态解析后不对比旧 dist 视觉/网络行为.
- **解决方案**: 改动前先理解字段语义 (authority = 外部市场 host, 无 authority = 本地 registry 扩展); 改动后用旧 dist 页面做网络级对照 (图标请求 host), 再下"简化"结论.

#### 18. 容器缺 lsof → opencode 端口 scan 全空 → /proxy 反代 404 (非竞态)

- **问题描述**: fork 的 /proxy 只代理 "known ports" (scan + whitelist); 容器精简镜像没装 lsof → scan `listenCands=0` → /proxy/7790 永远 404. 排查时先看到页面 500ms 请求失败, 误判为 scan 3s 窗口竞态.
- **复现路径**: 容器内起服务 (绑 0.0.0.0) 后经 /proxy/<port> 访问持续 404; docker logs 里 `[ports] scan: listenCands=0`.
- **解决方案**: 看 scan 日志区分竞态 (listenCands>0 但尚未收录) vs 工具缺失 (listenCands=0); 容器镜像 apt 装 lsof (scan POSIX 用 lsof). 后续架构已绕开该链: 扩展市场改 opencode 内置 /extensions 同源端点, 无端口反代依赖.

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

#### 22. ENV HOME=/home 但交互工具链 (nvm/oh-my-zsh) 装在 /root → zsh 终端 node 缺失、主题不加载

- **问题描述**: 容器内 root (uid 0) 运行, Dockerfile `ENV HOME=/home` (codeblitz 虚拟家目录 `/home/.codeblitz` 自洽需要, 见 Dockerfile:44-50); 但 oh-my-zsh 装 `/root/.oh-my-zsh`、nvm 装 `/root/.nvm`、auto-load 写 `/root/.zshrc`. zsh 启动按 `$HOME=/home` 读 `/home/.zshrc` (不存在) → **nvm 不加载 (node/npm command not found)、oh-my-zsh 主题不加载 (提示符裸 `容器ID#`)**. python/git 走 apt 全局 `/usr/bin` 不受影响.
- **复现路径**: `docker exec <c> bash -lc 'which node'` → 空 (bash 不读 zshrc); `docker exec <c> zsh -lic 'node --version'` → command not found; 但 `zsh -ic 'source /root/.nvm/nvm.sh; node --version'` 手动 source 后正常 → 锁定加载位置错配, 非 node 未装.
- **解决方案 (用户拍板「家目录统一 /home, 不使用 /root」)**: 所有**交互工具链**装到 `$HOME=/home` 下: oh-my-zsh → `/home/.oh-my-zsh`, nvm+node 22 → `/home/.nvm` (`ENV NVM_DIR=/home/.nvm`), 配置 → `/home/.zshrc`; 验证 `zsh -ic 'node --version; echo $ZSH_THEME'`.
  - **注**: 程序目录 `/home/.numas` (opencode binary/ui/extensions) 与 `HOME=/home` 对齐 (2026-09 全量迁移 /root → /home, 见 Dockerfile 注释), entrypoint 默认 `--web-ui /home/.numas/ui`; 与工作区根 `/home/community` 同前缀, 不再分两个 root.
- **排查方法**: 容器内 `echo $HOME` + `ls $HOME/.zshrc $HOME/.nvm` 确认工具链是否在 $HOME 下; `zsh -lic '...'` 测 login+interactive (numas PTY 实际是 `zsh --login -i`); oh-my-zsh 是否加载看 `$ZSH` 变量非空 / `$ZSH_THEME`.
- **附加 (终端慢/卡 spinner 误判)**: zsh login 实测仅 ~0.45s (`time zsh -ic 'node --version'`), nvm/ohmyzsh 不是瓶颈; 终端面板卡 spinner 真因常是 **codeblitz workbench storage 初始化失败** (`/api/fs/mkdir` 500) 拖住整个工作台模块加载, 与 shell 速度无关. 验证终端先确认 mkdir 204/200 + explorer 树已渲染, 再测 shell.

#### 23. 改动收尾用普通文本"询问 git"代替 question 工具 → 用户无法拍板, 等于没问

- **问题描述**: 一轮改动/文档产出完成后, AI 在正文写 "按约定询问 git 操作意向:" 或 "我准备提交, 你 OK 吗?" 就停下, **没有真正调用 `question` 工具**. 这不是可点选的决策弹窗, 用户没法拍板, 违反 §1.4 "改动必反馈".
- **复现路径**: 写完文档/改完代码, 习惯性用一句话收尾代替工具调用; 或用 `question` 问了别的技术问题, 却把 git 选项塞在普通正文里.
- **解决方案**: 收尾**必须显式调用 `question` 工具**, `questions[].options` 里放 git 操作选项 (提交+推送双远程 / 仅提交 / 暂存 / 不操作, 首个推荐项标 "(推荐)"), 等用户点选返回后再执行. 判据: 自查这一轮**有没有发出 `question` 工具调用** — 只输出文字、无工具调用 = 违规. 文档/调研类无代码改动同样适用 (是否提交文档也是 git 决策). 见 §1.4 铁律.

#### 24. workspace 根是 symlink 时 fs.watcher 事件路径 real vs logical 不匹配 → 客户端静默丢弃

- **问题描述**: workspace URL/header 给 logical 路径 (`/home/community/222`, symlink → `/app/222`). `InstanceStore.load` 调 `FSUtil.resolve` realpath, 后续 `Location.Service.directory` / watcher 订阅路径 / `event.location.directory` 全部走 real path. Watcher 触发时 `@parcel/watcher` 给的 `update.path` 也是 real path (即使订阅时用 symlink path, parcel 内部归一化). 客户端 `/api/fs/list` 按 AGENTS.md #21 修复后走 logical 路径 (`filesystem.ts:resolve` 用 `path.resolve` 不 realpath), 文件树里是 `/home/community/222/2.txt`. SSE 推到客户端的事件里 `file: "/app/222/2.txt"` (real) — `invalidateFromWatcher` → `ops.hasFile(real)` false → **事件被静默丢弃**, UI 不更新. 用户感受是 "opencode 没发事件 到 /global/event" (网络层事件**有**上行, 只是客户端无 UI 动作).
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
  1. **区分「list 显示」vs「watcher 事件」**: list 已走 logical (AGENTS.md #21) 不代表事件也走 logical; 先 curl `GET /api/fs/list?path=<logical>` 看返回路径是 `/home/community/222/2.txt` (logical), 再 curl `GET /global/event?directory=<logical>` (SSE) 看事件 `properties.file` — 两者 prefix 不一致即确诊.
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
  - `packages/opencode/src/server/routes/instance/httpapi/handlers/file.ts` — `logicalInstanceDir(realDir)` helper, `findText` / `list` / `content` 三处用 logical 维度. 注释引用 AGENTS.md #21/24/30.
  - `packages/core/test/filesystem/search.test.ts` — 加 `describe("FSUtil.realToLogical")` 6 个纯函数 unit test (logical 缺省 / logical==real / 子树内 / 子树外含同名前缀 / root 自身 / nested child).
  - `packages/opencode/test/server/httpapi-file.test.ts` — 加 `describe("logical path semantics")` 4 个 handler 集成测: list 绝对路径拼 logical、content boundary 越界拒绝、findText 输出 logical-relative、非 symlink fallback real. 不用真 symlink (见排查方法 4).
- **排查方法**:
  1. **「in-process 测真 symlink 莫名 ENOENT」 的真相**: `test/server/httpapi-file.test.ts` 一开始用 init hook (`fs.rename(tmp, real_xxx) + fs.symlink(real_xxx, tmp)`) 造真 symlink workspace, in-process webHandler request 期间 `fs.lstat(logicalInstance)` 报 ENOENT 但 `realInstanceDir` 是 OK 的, 即 logical symlink 被某 cleanup 路径误删. 同进程同 fs 视角, **测试主体 (Bun.write 之后立即 lstat) 能 stat 到 symlink**, 但 webHandler in-process 不行 — 说明 opencode layer build / InstanceStore load / fileSystem 中间件链里**有 fs.rm(symlink) 之类副作用**. 当前 fixture 实现 `tmpdir()` line 104 `fs.realpath(dirpath)` 早于 init 拿 tmp.path, [Symbol.asyncDispose] 用 realpath 调 `fs.rm` 删, 不会影响 in-process (afterEach 之后才跑). **最可能**: `Layer.provideMerge(Observability.layer)` 链上某 NodeFileSystem 初始化副作用, 或 `InstanceStore.load` 内部对 `directory` 物理化时调用 `fs.realpath` 命中某种 macOS symlink resolution cache 异常. **结论**: handler 行为只依赖 `LogicalDirectoryRegistry` 反查 + 字符串拼接, 不需要真 symlink. 测试改用**手动注入 `LogicalDirectoryRegistry.set(real, logical)`** 模拟 symlink workspace 的 side-channel 状态, 避开真 symlink 生命周期陷阱.
  2. **「fs.exists 在 macOS 上跟 symlink 但 in-process 报 ENOENT」 排查失败原因**: 单测 `bun -e ...` + `Effect.runPromise(pipe(NodeFileSystem.layer))` 跑同一个 path 返回 true, 但同 process 的 webHandler 返回 false. **唯一差异**是 webHandler 跑了 `Layer.provideMerge(Observability.layer)` 等一系列 layer. 怀疑是 `@effect/platform-node` 的 stat cache (effect FileSystem.stat 有内部 `nodeStat` effectify cache) 跟 symlink path 解析时命中 ENOENT 后缓存. 但查 `NodeFileSystem.js` line 33-44 (`access`) 和 line 310 (`stat`) 都是直接 effectify 无 cache, 排除. **剩下最大嫌疑**: opencode layer build 期间某处 `fs.rm(logical)` (待定位, 不在本次修复范围).
  3. **`path.resolve(cwd, cwdRel)` 在子目录查询时**必须先 resolve 回 real abs, 再 `realToLogical` 整段映射到 logical abs, **不能**直接 `realToLogical(cwdRel, location.directory, ...)` — `cwdRel` 是 cwd-relative, `location.directory` 不一定是 cwd, `path.relative` 越界触发 fallback 原样返回. 必须 `path.resolve(cwd, cwdRel)` 拼 abs 才能让 realToLogical 安全替换 prefix.
  4. **`FileSystem.FileSystem` (effect) 的 `exists` 在 effect v4 beta 实现**: 看 `node_modules/.bun/@effect+platform-node-shared/.../NodeFileSystem.js` line 32-44, `exists` 内部是 `NFS.access(path, F_OK)`, 不带 `O_NOFOLLOW`, 跟 symlink 跟随到 target. macOS 上对 symlink logical 路径应该 true. 但 in-process 测试 in-process 跑同一 path 报 false — 见排查方法 2.

#### 33. symlink workspace 下 sumi `CustomFileSystemProvider.rename` 报 "rename across different cwd not supported" — `anchors.directory` 是 real, 跟 logical 形态 mismatch

- **现象**: symlink workspace (e.g. `/Users/foo/data/实验1` → `/Users/foo/real/实验1`), 浏览器 explorer 拖拽 `111/222` → 工作根, codeblitz explorer 弹错 `FileSystemError.Unknown('rename across different cwd not supported')`. console 显示 `from.relPath=1.txt from.headerPath=/Users/foo/data/实验1 to.relPath=1.txt to.headerPath=/Users/foo/data/实验1/222` (注意 from/to 都被压成 `1.txt`, headerPath 形态不一致).
- **根因 (前端 sumi 错位)**:
  1. opencode server 端 `InstanceStore.load` 走 `FSUtil.resolve` realpath 化 workspace (跟 §2.3 一致), 所以 `anchors.directory` = `/Users/foo/real/实验1` (**real**).
  2. browser explorer 拖拽时 `oldUri.fsPath = /Users/foo/data/实验1/222/1.txt` (**logical**, 浏览器不知道 symlink, 也不该知道).
  3. sumi `provider.ts:resolveFsPath` 算 relPath 时: `a = normalizeCwdPath(logicalAbs) = /Users/foo/data/实验1/222/1.txt`, `c = anchors.directory = /Users/foo/real/实验1`. `a.startsWith(c + '/')` → **false** (real ≠ logical 字符串 mismatch), 落进 line 95-100 "file outside workspace" 兜底, 返 `{ relPath: '1.txt', headerPath: '/Users/foo/data/实验1/222' }`.
  4. `from.headerPath = /Users/foo/data/实验1` (line 91 兜底), `to.headerPath = /Users/foo/data/实验1/222` (line 97), **两者不同** → 抛 "rename across different cwd not supported".
- **错误架构**: **server 端 fs/* 全部返 logical 路径** (AGENTS.md #21/24/30/31 修过), 但 sumi 前端用 `anchors.directory` (real) 算 relPath — 这是越界的. 前端不该消化 symlink → real 转换, **该用 `effectiveCwd()` (URL `?directory=` 同源 logical) 作 ws 边界**.
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

#### 35. 浅色主题下 `--ai-accent` 解析为白色/半透明 → 用它做的状态指示不可见 (空 DOM 观感)

- **现象**: 子代理卡片运行态用自绘「三个空 span 小点 + `background: var(--ai-accent)`」+ 行尾「运行中」文字 `color: var(--ai-accent)`. 浅色主题 (`design-light`) 下用户看到指示器区域"DOM 是空的"——实为 `--ai-accent: var(--button-background, #6366f1)` 在该主题解析成 `#ffffff` / `rgba(255,255,255,.08)`, 白点白底/白字白底完全不可见.
- **根因**: `--ai-accent` 是"按钮背景色"语义, 可能是半透明白 (styles.ts 顶部 `--ai-neon` 注释早已记录该风险); 直接当**前景色/小图形填充**用, 明主题下丢失对比度. 空 span + CSS 背景的点阵形态也让排查时 DOM 看起来"空".
- **解决方案 (用户拍板)**: 状态表现**复用 shell 工具卡 (ToolView) 的既有组件**, 不另起一套:
  - 运行中 → `<span className="oc-tool__spinner" />` + 触发行加 `is-pending` (标题 shimmer)
  - 完成/出错 → `<span className="oc-tool__indicator">` + 图标; 出错由容器类 (`.oc-sub.is-error .oc-tool__title`) 把标题变红
  - 删除自绘 `.oc-sub__dots`/`.oc-sub__indicator`/`.oc-sub__status` 与 accent 前景色
- **改动文件**: `sumi/src/extensions/chatbot/webview/parts/SubAgentCard.tsx` + `styles.ts`.
- **排查方法**: ① 状态指示"看不见"先查 `getComputedStyle` 的实际颜色 + 当前主题 (`document.documentElement.className` 含 `design-light`/`design-dark`); ② 不要用 `--ai-accent` 做前景/填充, 前景用 `--ai-fg`/`--ai-fg-muted`/`--ai-danger`, 强调光效才用 `--ai-neon`; ③ 同类状态优先复用 `.oc-tool__spinner` / `.oc-tool__indicator` 保持全站一致.
