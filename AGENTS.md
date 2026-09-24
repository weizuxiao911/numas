# AGENTS.md — Numas AI 协作约定

> 用户与 AI 共同维护的项目协作规范. README.md 是给用户看的终态架构,
> specs/ 是需求与参考文档库 (含 numas 自有 PRD 与上游 opencode API 摘录),
> 本文件是**全局** AI 协作协议; 各子模块的工程约束见下方索引, 由各子目录自行维护.
>
> 品牌: **Numas (🐮 牛马 AI)** — 打工人首选工作模式, 对标腾讯 workbuddy 类产品.

---

## 0. 子工程 AGENTS.md 索引

> 各子模块/子目录**自行维护**本目录下的 AGENTS.md; 本文件只保留全局规范与引用.
> 改动子模块前, 先读对应 AGENTS.md.

| 子模块 | AGENTS.md | 覆盖内容 |
|---|---|---|
| `packages/codeblitz/` | `packages/codeblitz/AGENTS.md` | 前端交互层: 分层架构 / 跨平台路径 / opencode 跨进程通信 / gate 门控 |
| `packages/opencode/` | `packages/opencode/AGENTS.md` | opencode 引擎: 上游 fork 约定 / 代码风格 / 类型检查 / 测试 / V2 Session / 版本号 |
| `packages/tauri/` | `packages/tauri/AGENTS.md` | 桌面壳: 托盘 / 无 Dock (LSUIElement) / bundle id / 生命周期 / 打包验证 |
| 其它 | — | 暂未拆分, 遵循本文件全局规范 |

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
7. **测试验收通过** — 跑通预期路径 + 边界 + 错误/降级; 用户拍板"通过"才进步骤 8
8. **总结沉淀积累** — 本次踩坑/模式/隐式偏好 → 补对应子模块 AGENTS.md 避坑 + 必要时 §3.2 长期偏好 (按 §3.1 自查铁律, 不依赖用户催)
9. **`question` 询问是否 git 提交推送** — 列选项: 提交+双远程 / 仅提交 / 暂存 / 不 git; 用户拍板后执行; **任何上一轮的 git 认可仅单次有效, 下轮重新问** (§1.4)
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
- 维护各子模块 AGENTS.md 的避坑/实践 (沉淀自身经验)

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

过程中如果你觉得满足条件可以进入执行, 可以使用 `question` 工具反馈用户进行决策; 同理, 如果条件不满足时也可以使用 `question` 工具反馈用户进行选择, 以更好地推进工作落地.

**所有任务不为交付而着急**, 不做 DEMO 级的事. 要么不做, 要么就一次性做好. 做事时必须先充分讨论/分析后完成设计方案, 由用户决策执行才能推进执行. 挖出执行后, 要使用 `question` 工具反馈用户推进下一步操作, 所有的 git 操作必须由用户下达指示或你提问后得到用户认可后才能执行, **记住提示或认可仅单次有效!**

> 接手**子模块**任务前, 先读对应子模块的 AGENTS.md (见 §0 索引).

### 2.2 全局工程约定 / 禁忌

- **直连无代理**: client → opencode 之间不加 HTTP 中间层 (具体约定见 `packages/codeblitz/AGENTS.md`)
- **单一事实源**: 端口 / CORS / APP_BASE_URL 由 dev.js 控制, 透 process.env 注入. 不要散落
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

> 分层架构铁律 / 跨平台路径铁律 / opencode 跨进程通信约定 → `packages/codeblitz/AGENTS.md`
> 上游 fork 约定 (分支/提交/代码风格/类型检查/测试/V2 Session) → `packages/opencode/AGENTS.md`

---

## 3. AI 自成长机制规范和约束

> 此部分 AI 自主维护. 接受用户的教导和帮助, 一切以用户意志为准.
> 不得替用户做决策, 只能提供建议或方案推荐!

> **🔔 AI 强制自查 (任务收尾必做, 未沉淀 = 任务未完成)**:
> 每次协作/一轮任务结束时, 在最终汇报前自查以下三项并落实:
>   ① 本次踩过的坑 / 排查教训 → 补**对应子模块 AGENTS.md 避坑** (现象 / 复现路径 / 解决方案, 可回归的要标)
>   ② 反复出现的好做法 / 做事模式 → 补对应子模块实践指南
>   ③ 用户给的纠正 / 隐式偏好 → 补 §3.2
> 沉淀必须主动, 不依赖用户催促.

### 3.1 长期记忆维护

- **自主跟进项目迭代**: 每次协作后, 把沉淀的知识/教训同步到对应子模块 AGENTS.md 避坑, 避免同类问题多次出错.
- **沉淀自己的做事方法和习惯**: 反复出现的模式可以总结成实践指南的子项.
- **不替用户决策**: §1 已明确, 自成长过程中遇到需要权衡的方向, 用 `question` 反馈.

### 3.2 接受用户教导

- 用户给的纠正/指引, 当轮即时修正.
- 反复出现的同类纠正, 提炼成避坑指南 (归入对应子模块).
- 用户的隐式偏好 (例如"回答精简", "先看现象再下结论"), 观察到后沉淀.
- **引导下载安装环节不写死版本号 / asset 文件名**: 走 GitHub Releases API latest 机制 (fetch latest release 的 assets[] 按 OS/arch 匹配 asset.name), 不在 buildDownloadLink/Url 类函数里塞写死的 semver / 文件名常量. build-time 配置 (tauri.conf.json / Cargo.toml 等) 的 semver 字段不在此列 (用户 2026-09-17 纠错).

### 3.3 自维护边界

AI **可以自主**做:
- 各子模块 AGENTS.md 避坑/实践指南的增删改
- §3.2 沉淀长期偏好
- 拼写/格式/链接/目录校对
- `git mv` 与文档类 rename (跨文档引用同步)
- 临时文件清理 (.tmp/ stray)

AI **仍需 `question`**:
- §1/§2 任何规则条款的增删改
- 跨文档重组 / AGENTS.md 结构变动
- 与项目事实 (§1/§2) 冲突的修改

---

## 4. 全局实践与避坑

AI 自主维护, 用户可随时指出错误或要求补充. 按 §3.1 自查铁律持续沉淀.
> 模块特定避坑见对应子模块 AGENTS.md (§0 索引): codeblitz / opencode / tauri.

### 4.1 实践指南

- `packages/tauri` 壳构建顺序: 先在 `packages/opencode` 跑 `bun run build --single` (内嵌 codeblitz 的 numas 二进制), 再 `packages/tauri` 的 `scripts/prepare.ts` 同步到 `binaries/numas-<triple>`, 最后 `tauri build`; 缺二进制时 `cargo check` 就会因 externalBin 校验失败. (桌面壳细节见 `packages/tauri/AGENTS.md`)
- **桌面发布规则** (固化在 `packages/tauri/scripts/release.ts`, 后续发版只改 `packages/tauri/version.json` + `CHANGELOG.md`):
  - 版本: 读 `packages/tauri/version.json` (不写死); Release title 只写版本号 `v<semver>`; notes 从 `packages/tauri/CHANGELOG.md` 对应 `## [<semver>]` 段读
  - tag: `numas-v<semver>-<YYYYMMDDHHMM>` (与既有 release 规律一致)
  - asset 命名连字符规范 (平台用 darwin/windows/linux, 不带 Tauri triple 的 apple): `numas-darwin-arm64.dmg` / `numas-darwin-x64.dmg` / `numas-windows-<arch>.msi` / `numas-linux-<arch>.AppImage`
  - **坑**: `gh release upload 文件#label` 的 `#label` 只是显示标签, 不改 asset 文件名; 必须先 cp/rename 成规范名再上传 (release.ts 里已处理)
  - 上传到 `weizuxiao911/numas` 仓库; 幂等 (同 tag 复用); CLI 二进制与桌面包分开 release
  - **替换现有 release 的资产** (不新建 release): `gh release upload <tag> <staged-asset> --clobber` — release.ts 每次生成带时间戳的新 tag, 定位不了旧 release. 上传前先改名成规范 asset 名.
  - **验证 dmg 内 app 版本**: 挂载 → 跑 `<mount>/numas.app/Contents/MacOS/numas --version` → `hdiutil detach` → `lsregister -u <mount>/numas.app` 清挂载产生的注册残留.

### 4.2 避坑指南

- **仓库布局: 3 个 worktree** (2026-09-23): `~/Documents/numas`=`main`, `~/Documents/numas-dev`=`dev`, `~/Documents/oh-my-buddy`=`oh-my-buddy/main` (共享同一 `.git`). `main` 在独立 worktree 检出, 不能在 numas-dev 里 `git checkout main`; 跨分支操作要去对应 worktree.
- **main = dev (同步稳定分支) 用 reset + force-push** (2026-09-23): `main` 是旧布局 (`opencode/packages/...`), `dev` 是新布局 (`packages/...`), 差异巨大 → 合并会残留/冲突. 严格同步: 去 main worktree `git reset --hard dev` → force-push 双远程.
- **GitLab `main` 是受保护分支, force-push 报 `pre-receive hook declined`** (2026-09-23): GitLab 默认禁止对受保护分支强推. 重写 main 前需先到 GitLab → Settings → Repository → Protected branches 解除保护, 推完可再保护. (GitHub 侧无此限制)
- 提交前先看工作区全貌: `git status` 可能混有上一轮遗留的未提交改动 (如 AGENTS.md / packages/tauri/version.json), 不要默认全量 `git add -A`; 用 `question` 让用户拍板纳入范围与拆分方式.
- **反复挂载 DMG / 跑 debug 构建会在 LaunchServices 累积 numas.app 注册** (指向已删除路径), 导致 `numas://` 报「找不到该文件」. 清理: `lsregister -dump | grep -E '^path:.*numas\.app'` 收集路径后逐条 `lsregister -u <path>` (2026-09-20 实测清了 39 条残留). (托盘/无 Dock 细节见 `packages/tauri/AGENTS.md`)
