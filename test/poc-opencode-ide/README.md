# poc-opencode-ide

> 开源贡献 AI 工作台 POC — 验证交互链路技术可行性
>
> 对应规格文档:`specs/开源项目贡献AI工作台功能需求规格书.md`

## 路由

```
/                       活动页(任务卡片列表,hover 显示领取)
/workspace/:taskId      AI 工作台(本地服务检测 → 唤起 → 任务载入 → 引导)
```

## 工作台阶段机

```
service_probe ─→ service_install ─→ service_wake ─→ loading_task ─→ extension_mount ─→ briefing
                                          ↓
                                       (POC 逃生口 mockLaunch 跳过 scheme 唤起)
```

每个阶段在 `useWorkbench` 内部驱动,事件实时写入日志面板。

## 唤起本地服务 — 参考 test/launch.html

> 浏览器无 JS API 直接启动进程,真实机制:

1. **健康探测**: `GET http://localhost:4096/health` (no-cors 模式)
2. **唤起**: 通过 iframe 触发 `numas://serve?port=4096` scheme,已注册的本地 numas 应用接管
3. **轮询**: 服务起来后跳转到 `http://localhost:4096/` (numas serve 内置 Web IDE)
4. **若未安装**: 显示当前平台 (os/arch) 的下载链接与安装指引

实现见 `src/lib/opencode.ts`。`ServiceProbePanel` 暴露 3 个入口:
- 唤起本地 numas(真实路径)
- 下载 numas (检测当前 os/arch)
- 模拟就绪 (POC 逃生口,跳过 scheme 直接进入工作台)

## 内置拓展(后续迁移 vsix)

`CodeblitzWorkbench` 内置 3 个最小拓展:
- 📋 issue 面板(读取任务上下文)
- 🔀 git 操作(mock fork/commit/PR)
- 🤖 AI 引导(`mock-ai.ts` 根据问题关键词返回模拟回复)

后续步骤是把这些内嵌 UI 抽离为 vsix 拓展,以 codeblitz 的 SlotLocation 体系挂载。

## 跑起来

```bash
cd test/poc-opencode-ide
bun install
bun run dev
```

打开 `http://localhost:5173/`,点击任意任务卡片的"领取任务"按钮进入工作台。

## 验证场景

| 场景 | 步骤 |
| --- | --- |
| **Happy Path** | 活动页 hover 任务卡 → 领取 → 工作台 → 模拟就绪 → 任务载入 → 引导 |
| **真实唤起** | 工作台 → 唤起本地 numas(浏览器触发 scheme,等待 health 可达) |
| **未安装** | 工作台 → 唤起超时 → 显示下载指引 → 提供 os/arch 适配的下载链接 |
| **AI 多轮** | 工作台引导就绪 → 在 AI 面板问"根因在哪" / "给我修复方案" / "测试结果" |

## 与 codeblitz 的关系

`packages/codeblitz/dist` 是 OpenSumi-based Web IDE 框架的构建产物(标题 "Numas AI")。本 POC 的三栏布局(文件树 + 编辑器 + AI 面板)参考其结构,后续集成步骤:

1. 在 `Workbench` 阶段机到达 `extension_mount` 后,通过 iframe 加载 `http://localhost:4096/` (codeblitz serve 输出)
2. 通过 URL query 把任务上下文传入 codeblitz
3. 用 vsix 拓展机制替换当前的 `CodeblitzWorkbench` 内嵌组件

## 文件结构

```
test/poc-opencode-ide/
├── package.json
├── tsconfig.json
├── vite.config.ts
├── index.html
└── src/
    ├── main.tsx               路由入口
    ├── App.tsx                顶栏 + Outlet
    ├── styles.css
    ├── types.ts
    ├── pages/
    │   ├── ActivityFeed.tsx   活动页(任务卡片)
    │   └── Workbench.tsx      AI 工作台(阶段机外壳)
    ├── components/
    │   ├── ServiceProbePanel.tsx   阶段 1:本地服务检测/唤起
    │   └── CodeblitzWorkbench.tsx  阶段 2+:内置拓展三栏布局
    ├── hooks/
    │   └── useWorkbench.ts    工作台状态机
    └── lib/
        ├── opencode.ts        唤起本地 numas (参考 launch.html)
        ├── tasks.ts           任务数据 + Task Context 构造
        └── mock-ai.ts         AI 引导 mock
```
