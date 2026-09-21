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
