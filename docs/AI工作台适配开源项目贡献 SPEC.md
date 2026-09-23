# 开源贡献业务链路设计

## 核心流程

1. 用户访问“活动任务页”（内容参考 https://antdesign.beta.oscollege.net/os/compete/87, 风格参考 https://workshop.cloudlab.top/），卡片显示活动任务，点击卡片的【领取任务】按钮，进入“开源贡献 AI 工作台”页面（携带任务项目、issue等信息）。使用如下真实项目作为验证：
  - https://github.com/antgroup/vsag/issues/2862
  - https://github.com/antgroup/vsag/issues/2865
  - https://github.com/antgroup/vsag/issues/2867
  - https://github.com/antgroup/vsag/issues/2869
  - https://github.com/antgroup/vsag/issues/2870
  - https://github.com/antgroup/vsag/issues/2871
  - https://github.com/jeandle/jeandle-jdk/issues/620
  - https://github.com/jeandle/jeandle-jdk/issues/621  

2. 进入“开源贡献 AI 工作台”后先检测是否安装 numas 应用程序（通过 numas://scheme 方式唤起），如果未安装提供下载地址，引导安装，直到可以访问接入；如果已安装，接入本地服务器，显示 AI 工作台，实现按 packages/codeblitz 完成，先不用管项目初始化问题，确保“开源贡献 AI 工作台”正常接入到本地 numas 应用程序，将其作为服务器端！

## 注意事项

1. “开源贡献 AI 工作台”是纯 web IDE 项目，部署在平台侧， 通过 numas://scheme 方式唤起用户本地的 numas 作为服务器端。（前后端分离）
2. 如果用户本地未下载 numas 应用程序，需提供下载地址，并引导安装，直到“开源贡献 AI 工作台”可以接入本地 numas 应用程序 API 接口。
3. “活动任务页”（:5173，实现在 test/demo 下）和“开源贡献 AI 工作台”（:7788, 实现在 pacakges/codeblitz 下，使用 webpack 运行，单独打包成 site 产物，补充前置 numas://scheme 检测和下载引导，直到IDE 接入本地 numas 服务器）是两个单独的 web 网站。边界职责说明： 
  - “活动任务页”： 显示业务交互，按参考完成独立站点，终点是“领取任务”按钮
  - “开源贡献 AI 工作台”： 是从点击“领取任务”按钮，到加载 IDE 为止
  - 本地 numas 服务器： 后台运行，仅提供 API 接口

--- 

# packages/codeblitz 改造

> 改造当且仅当访问codeblitz（:7788）URL 参数是repo={远程git仓库地址}时生效

1. 维持现有流程：认领任务（test/demo，端口5173） → 检测或引导下载，直到启动本地 numas 服务，codeblitz 与本地 numas 正常通信（packages/codeblitz，端口7788）
2. 检查 codeblitz 请求 URL 是否携带 repo 参数，如果是切换成 IDE 模式
3. 其他我们边做边调整，我觉得可以后你负责维护功能设计到文档(docs/AI工作台适配开源项目贡献 SPEC.md)

---

## 功能设计 (AI 维护)

### 1. URL `?repo=` → 强制 IDE 模式 (2026-09-20 定稿)

- **触发**: codeblitz 页面 URL 携带 `repo` 参数 (远程 git 仓库地址; 由活动任务页【领取任务】注入)
- **行为**: 加载时强制 `ide` 模式, 并写入 `localStorage.NUMAS_MODE` (后续无 repo 打开也保持 IDE)
- **无 repo**: 按 `localStorage.NUMAS_MODE` / 默认 `solo`
- **参数处理**: `repo` / `issue` 保留在 URL, 不做一次性清理 (供 AI 工作台后续读取 issue/项目信息)
- **手动切换**: 模式切换按钮保留, 不锁定
- **实现**: `packages/codeblitz/src/App.tsx` — `readStoredAppMode()` 前置 URL 判定 (`urlRepoMode()`)
- **与门控关系**: 模式判定在模块加载时完成, 与 Gate (numas 接入门控) 无耦合; 接入成功后按判定模式渲染

### 2. 完整业务链与项目初始化 (2026-09-20 用户认知, 待决策)

> 以下为用户提供的需求认知, 先记录不实现; 标注「待决策」的点需用户拍板后才开发.

**完整业务链**: 认领任务(:5173) → AI 工作台(:7788, 默认 IDE 模式, 接入本地 numas)
→ **引导用户认知 issue** → **人与 AI 交互修复问题** → **提交 PR**.

**问题**: 进入 IDE 后, 用户是不清楚流程的。URL `?repo=` 是**原仓库**地址 (如 `antgroup/vsag`),
但开源贡献提 PR 的标准路径是 **fork**(fork 到自己账号 → clone 自己 fork → 改 → PR 回原仓库).
因此**项目初始化**是进入 IDE 后必须解决的前置问题:
- 检查当前项目是否与 repo 有关联; 没有 → 引导"获取项目"(未选择项目).
- 目标: 让用户无感知地走通「fork → clone → 初始化」.

**两条候选路 (已决策 2026-09-20)**:
- ✅ **选定方案 A: AI 智能体执行默认流程 + 对话引导用户交互**
  - 进入工作台后**激活 AI**, 由 AI 引导用户完成 fork → clone → 初始化 → 认知 issue → 交互修复 → 提交 PR
  - 用户不熟流程, AI 用对话逐步引导用户操作(而非全自动, 需用户交互确认)
- ~~方案 B: 定制可持久化初始化向导~~ (未选)

**驱动方式铁律**: **不改造 chat 扩展本身, 只驱动 chat 工作!**
- 通过 `CommandService.executeCommand` 驱动: `chat.newSession` / `chat.send(text)` / `chat.setProject` 等
- 进入 IDE 后(URL 带 repo)由**新增编排层**激活 chat 面板 + 发引导消息, 不动 chat 内部代码
- chat 已有的对外命令: `CHATBOT_COMMANDS.newSession / send / setProject / getProject / addContext / getCurrentSessionID` 等

### 3. 完整引导流程 (2026-09-20 用户定稿)

> 核心: **AI 执行必须人驱动** —— 第一句指令必须由人发出, AI 完全被动.
> 不跑偏的关键: 用**预设引导起点(场景化快捷入口)**, 人点一下 = 发出我们设计好的第一句.

**第一句触发**: 进入工作台后 AI 不自动发消息. chat 输入区提供**预设引导卡片** (如「初始化这个项目」
「了解这个 issue」「提交 PR」), 用户点卡片 = 人发送预设话术 (可改). 用户也可自由输入.

**前置校验 (进入 IDE 后, URL 带 repo 时)**:
- codeblitz 有持久化记忆 (localStorage workdir / NUMAS_MODE 等).
- **若当前选择的项目与传入 repo 没有关联 → 机械性重置项目工程** (清 workdir / 相关持久化),
  再进入引导, 避免旧项目干扰.

**引导主流程 (AI 被动, 人驱动逐步推进)**:
1. **安装 gh** → 引导用户安装 GitHub CLI (缺则引导)
2. **提供 token / 登录** → 用户提供 GitHub 身份 (gh auth login)
3. **fork 项目** → 把 URL repo (原仓库) fork 到用户账号
4. **clone** → clone 用户自己的 fork 到本地项目目录
5. **AI 引导用户认知 issue** → 展示/讲解 issue 内容
6. **人提供技术解决方案** → 用户给方案, AI 不擅自决定
7. **AI 执行修复** → 按用户方案改代码 (写操作仍走 permission 审批)
8. **人工核对验收** → 用户确认修改正确
9. **直到可以提交 PR** → 多次 commit 只在用户自己的仓库 (fork), 不碰原仓库

**待验证的技术点 (识别策略)**:
- fork → clone 后的项目仓库, 是否应**绑定 2 个远程仓库地址** (origin=用户 fork, upstream=原仓库)
  作为"项目与 repo 关联"的识别策略? (待确认)

**待决策点 (延续)**:
- 权限策略: 每次写操作弹审批 (A) / 只对写危险操作弹 (B) / 首次授权记住 (C). 倾向 B.
- 持久化: 项目↔repo 映射存 localStorage 还是 numas 服务端.

---

## 4. Skill 分发机制 (2026-09-22 定稿并实装)

> 目标: AI 引导能力 (skill) 随 numas 分发, **用户零配置**, 且**不写死在 opencode 代码里**.

**架构**:
1. **远程 skill 仓库**: `https://github.com/weizuxiao911/numas-skills` (public, gitee 镜像待建)
   - 结构: `index.json` + `<skill-name>/SKILL.md` (目录名 = skill name)
   - **必须用 raw 内容地址** (opencode discovery 直接 GET `{url}/index.json` 与 `{url}/{skill}/文件`;
     仓库网页地址会 404)
2. **numas 首次启动自动创建 `~/.config/opencode/numas.json`**, 写入 `skills.urls` (raw 地址):
   - 实现: `packages/opencode/src/config/config.ts` 的 `loadGlobal` (常量 `NUMAS_SKILL_URLS`)
   - 双 URL 冗余: GitHub raw + Gitee raw (一个失败静默跳过)
   - 已存在不覆盖 (用户可手动改 numas.json 覆盖默认源)
3. **opencode 启动时按 `skills.urls` 远程拉取** skill → 缓存到 `~/.cache/opencode/skills/<name>/`
   → skill 工具可加载 (AI 引导能力生效)
4. **更新机制**: 改 skill 内容后**递增 index.json 的 version** → 客户端重新拉取

**已验证** (2026-09-22): numas.json 自动创建 ✓ → 从 GitHub raw 拉取「开发环境检查」✓ →
缓存 SKILL.md (version=1) ✓ → `/skill` API 列出 ✓

**已分发 skill**:
- `开发环境检查`: 自动跑 `gh --version` / `gh auth status`, 缺失时引导安装 (brew/官网) 与
  `gh auth login` 授权, 最后汇总环境状态.

---

## 5. welcome 引导页 + 顶部入口 (节点 2, 2026-09-22 定稿)

> 用 codeblitz **官方 welcome 机制** (`runtimeConfig.WelcomePage` + `startupEditor: 'welcomePage'`),
> 未选项目/无打开文件时显示. 组件放 `packages/codeblitz/src/extensions/welcome/`.

**页面内容**:
1. **大屏 issue 卡片**: repo / 标题 (链接 → 新标签页打开) / 状态 / labels / 正文 (Markdown 渲染, 不限高)
2. **底部悬浮步骤按钮组** (sticky 贴底, 内容滚动时始终可见; 按时序展开, 点击行为交给用户):
   | step | 按钮 | 行为 |
   |---|---|---|
   | 1 | 开发准备 | 触发「开发准备」技能 (gh 安装/授权检查, 确保工具可用) |
   | 2 | Fork克隆 | **先弹 FilePicker 选 clone 父目录** → 触发「Fork克隆」技能 (含目标目录) → fork/clone 需用户授权 → 轮询项目目录出现 → 自动切换工作区 → **生成项目 AGENTS.md + .logs** |
   | 3 | 排查定位 | 触发「排查定位」技能 (AI 解释 issue 现状/成因 + 引导分析, 不替用户处理) |
   | 4 | 方案设计 | 触发「方案设计」技能 (question 确认 + AI 代笔方案文档) |
   | 5 | 执行修复 | 触发「执行修复」技能 (按方案执行 + question 决策 + 用户授权) |
   | 6 | 提交PR | 触发「提交PR」技能 (验收 + 授权后才提交) |

> **步骤拆分** (2026-09-23): 原 4 步 (环境检查/载入工程/修复问题/提交 PR) 拆为 6 步 —
> 「修复问题」拆成「排查定位 → 方案设计 → 执行修复」三阶段, 强调 AI 引导用户理解/决策、不替用户处理。
> 后端 skill 同步拆为 6 个独立 skill (见 §6)。

**顶部入口** (`IdeLayout`):
- **[帮助] 按钮** (顶部右侧, `?` icon): `WorkbenchEditorService.open(URI('welcome://'))` → 打开/聚焦 welcome tab
  (官方注册 ONE_PER_WORKBENCH, 重复打开只聚焦; 解决用户手动关闭 welcome 后无法重新打开)
- **[提交PR] 按钮** (顶部右侧): **仅选择项目后显示** (订阅 workdir 变化) → 触发「提交PR」技能
- **项目选择按钮** (选择项目 / 当前项目名): 未选项目显示 `选择项目 ⌄`; **选中项目后箭头隐藏、原位换成 `✕`**
  (融合同一胶囊) → 点 `✕` 弹 **modal confirm** (确认关闭/取消) → 确认后清空 workdir + 刷新 → 恢复默认状态
  (无项目 → welcome)

**关键设计决策**:
- **step2 时序 (方案 A)**: AI 无法触发前端弹窗 → 先让用户选目录, 再把「技能 + 仓库 + 目标目录」发给 chat;
  clone 完成由前端**轮询**判定 (等 `.git` 出现 → `.git/index` 连续两次存在 = checkout 落地) →
  **走 chat 的 `setProject` 命令切换** (含实例 reload + 会话重载; 直接 setWorkdir 会导致资源管理器/chat 不刷新)
- **step 不做前端状态机**: 按钮全部可点, 前置条件由 skill/AI 检查并引导 (简单、不易卡死)
- **按钮只发触发消息** (`chatbot.send` 跨拓展命令), 流程提示词在远程 skill 里, 不捆绑到按钮
- **chat 会话跟随项目** (2026-09-22): 会话恢复时校验归属 — **无项目 或 会话不属于当前项目** → 不恢复并清指针,
  避免"关闭/切换项目后 chat 仍显示旧项目会话"

**FilePicker 增强** (选择目录体验):
- **新建目录**: 头部「＋ 新建目录」按钮 (位于搜索框前) → 行内输入名称 → 当前目录创建 → 刷新列表
- **进入子目录清空搜索词** (过滤条件不带入影响子目录)

**issue 数据来源** (方案 A + gh 兜底, 2026-09-22):
- **主**: 浏览器直接 fetch `api.github.com/repos/{owner}/{repo}/issues/{n}` (CORS 允许; 未鉴权 60 req/hr)
- **兜底**: API 失败/限流 → **本地 gh 读取** (`gh issue view ... --json`, 用用户 gh 登录态, 不受未鉴权限流影响);
  机制: opencode `session.shell` + **临时会话** (create → shell 取 `parts[].state.output` → delete, 不污染项目会话)
- 两者都失败 → 卡片显示错误 + 引导先执行「开发环境检查」技能 (修 gh 安装/授权)

---

## 6. 已分发技能 (numas-skills 仓库)

> 6 步流程对应 6 个独立 skill (2026-09-23 拆分替换旧 4 个; 缓存 version 已递增, 客户端重新拉取).

| 技能 | 用途 |
|---|---|
| 开发准备 | gh 安装/授权检查与引导, 确保工具可用 (环境就绪前置) |
| Fork克隆 | 用户选本地根目录 → 授权后 fork+clone → 双远程 → **生成项目 AGENTS.md 协作规则 + 初始化 .logs 日志** → 切换工作区 |
| 排查定位 | AI 解释 issue 现状/成因 + 引导用户分析定位问题文件, **不替用户处理** |
| 方案设计 | question 提问确认 + 协助方案设计, **AI 只代笔写方案文档, 不替用户设计** |
| 执行修复 | 按用户方案执行 + 关键决策 question + 用户授权, **用户决策 AI 执行** |
| 提交PR | 引导用户验收 → **用户认可并授权后才提交** PR, 谨慎执行 |

### 默认协作规则 AGENTS.md + 日志 (Fork克隆 生成)

每个 clone 出的任务项目在**项目根**自动生成 `AGENTS.md` (**已存在不覆盖**), 定义人与 AI 协作规则:

1. **人决策, AI 执行**: 所有功能/方案/边界处理由用户拍板, AI 仅负责执行
2. **决策必用 question**: 需要用户决策时必须用 question 工具弹选项 (含推荐项), 不得用普通文本替代
3. **关键信息持久化日志**: AI 把关键交互追加到 `.logs/{YYYYMMdd}.log` (如 `.logs/20260923.log`), 格式:

```text
[2026-09-23 10:00:00] 一句话描述摘要信息
- 按点描述关键信息, 如输入/执行/输出等关键信息内容
```

同时初始化 `.logs/` 目录. **日志机制统一由项目 AGENTS.md 约束, 不在每个 skill 里重复**
(单一职责: skill 只管触发引导, 日志规则激活 AGENTS.md 后由 AI 执行).

---

## 7. 节点进度

| 节点 | 内容 | 状态 |
|---|---|---|
| 1 | 前置校验 + 机械重置 (URL 带 repo 时校验 workdir 关联, 不匹配重置) | ✅ 已验收 (2026-09-22) |
| 2 | welcome 引导页 (issue 卡片 + 6 步按钮组) + 顶部入口 (帮助/提交PR) | ✅ 已实现待验收 |
| 3 | 开发准备 skill (gh 安装/授权引导) | ✅ skill 已分发 |
| 4 | Fork克隆 skill (fork+clone+双远程 + 生成项目 AGENTS.md/.logs + 切换) | ✅ skill 已分发 (待端到端验收) |
| 5 | 关联识别持久化 (双远程策略) | ⬜ 待开发 |
| 6 | 排查定位 → 方案设计 → 执行修复 三 skill (AI 引导 + 人决策) | ✅ skill 已分发 (待端到端验收) |
| 7 | 提交PR skill (验收 + 授权后提交) | ✅ skill 已分发 (待端到端验收) |
| 8 | 项目默认 AGENTS.md 协作规则 + .logs 日志持久化 | ✅ Fork克隆 生成 (待端到端验收) |
