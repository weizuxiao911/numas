# opencode database guide

## Database

- **Schema**: Drizzle schema lives in `packages/core/src/**/*.sql.ts`.
- **Migrations**: database migrations live in `packages/core` and are applied by core.

## Development server

- Running `bun dev` from `packages/opencode` starts the live interactive TUI. Do not run it as a blocking foreground command when you need to inspect the result.
- Start it in `tmux` instead: `tmux new-session -d -s opencode-dev 'bun dev'`.
- Capture the current TUI output with: `tmux capture-pane -pt opencode-dev`.
- Stop the session explicitly when done: `tmux kill-session -t opencode-dev`.

# Module shape

Do not use `export namespace Foo { ... }` for module organization. It is not
standard ESM, it prevents tree-shaking, and it breaks Node's native TypeScript
runner. Use flat top-level exports combined with a self-reexport at the bottom
of the file:

```ts
// src/foo/foo.ts
export interface Interface { ... }
export class Service extends Context.Service<Service, Interface>()("@opencode/Foo") {}
export const layer = Layer.effect(Service, ...)
export const defaultLayer = layer.pipe(...)

export * as Foo from "./foo"
```

Consumers import the namespace projection:

```ts
import { Foo } from "@/foo/foo"

yield * Foo.Service
Foo.layer
Foo.defaultLayer
```

Namespace-private helpers stay as non-exported top-level declarations in the
same file — they remain inaccessible to consumers (they are not projected by
`export * as`) but are usable by the file's own code.

## When the file is an `index.ts`

If the module is `foo/index.ts` (single-namespace directory), use `"."` for
the self-reexport source rather than `"./index"`:

```ts
// src/foo/index.ts
export const thing = ...

export * as Foo from "."
```

## Multi-sibling directories

For directories with several independent modules (e.g. `src/session/`,
`src/config/`), keep each sibling as its own file with its own self-reexport,
and do not add a barrel `index.ts`. Consumers import the specific sibling:

```ts
import { SessionRetry } from "@/session/retry"
import { SessionStatus } from "@/session/status"
```

Barrels in multi-sibling directories force every import through the barrel to
evaluate every sibling, which defeats tree-shaking and slows module load.

# opencode Effect rules

Use these rules when writing or migrating Effect code.

See `specs/effect/migration.md` for the compact pattern reference and examples.

## Core

- Use `Effect.gen(function* () { ... })` for composition.
- Use `Effect.fn("Domain.method")` for named/traced effects and `Effect.fnUntraced` for internal helpers.
- `Effect.fn` / `Effect.fnUntraced` accept pipeable operators as extra arguments, so avoid unnecessary outer `.pipe()` wrappers.
- Use `Effect.callback` for callback-based APIs.
- Use `Effect.void` instead of `Effect.succeed(undefined)` or `Effect.succeed(void 0)`.
- Prefer `DateTime.nowAsDate` over `new Date(yield* Clock.currentTimeMillis)` when you need a `Date`.

## Module conventions

- In `src/config`, follow the existing self-export pattern at the top of the file (for example `export * as ConfigAgent from "./agent"`) when adding a new config module.

## Schemas and errors

- Use `Schema.Class` for multi-field data.
- Use branded schemas (`Schema.brand`) for single-value types.
- Use `Schema.TaggedErrorClass` for typed errors.
- Use `Schema.Defect` instead of `unknown` for defect-like causes.
- In `Effect.gen` / `Effect.fn`, prefer `yield* new MyError(...)` over `yield* Effect.fail(new MyError(...))` for direct early-failure branches.

## Runtime vs InstanceState

- Use `makeRuntime` (from `src/effect/run-service.ts`) for all services. It returns `{ runPromise, runFork, runCallback }` backed by a shared `memoMap` that deduplicates layers.
- Use `InstanceState` (from `src/effect/instance-state.ts`) for per-directory or per-project state that needs per-instance cleanup. It uses `ScopedCache` keyed by directory — each open project gets its own state, automatically cleaned up on disposal.
- If two open directories should not share one copy of the service, it needs `InstanceState`.
- Do the work directly in the `InstanceState.make` closure — `ScopedCache` handles run-once semantics. Don't add fibers, `ensure()` callbacks, or `started` flags on top.
- Use `Effect.addFinalizer` or `Effect.acquireRelease` inside the `InstanceState.make` closure for cleanup (subscriptions, process teardown, etc.).
- Use `Effect.forkScoped` inside the closure for background stream consumers — the fiber is interrupted when the instance is disposed.
- To make a service's `init()` non-blocking, fork `InstanceState.get(state)` at the `init()` call site (e.g. `Effect.forkIn(scope)`), not by forking work inside the `InstanceState.make` closure. Forking inside the closure leaves state incomplete for other methods that read it.
- `src/project/bootstrap.ts` already wraps every service `init()` in `Effect.forkDetach`, so `init()` is fire-and-forget in production. Keep `init()` methods synchronous internally; the caller controls concurrency.

## Effect v4 beta API

- `Effect.fork` and `Effect.forkDaemon` do not exist. Use `Effect.forkIn(scope)` to fork a fiber into a specific scope.

## Preferred Effect services

- In effectified services, prefer yielding existing Effect services over dropping down to ad hoc platform APIs.
- Prefer `FileSystem.FileSystem` instead of raw `fs/promises` for effectful file I/O.
- Prefer `ChildProcessSpawner.ChildProcessSpawner` with `ChildProcess.make(...)` instead of custom process wrappers.
- Prefer `HttpClient.HttpClient` instead of raw `fetch`.
- Prefer `Path.Path`, `Config`, `Clock`, and `DateTime` when those concerns are already inside Effect code.
- For background loops or scheduled tasks, use `Effect.repeat` or `Effect.schedule` with `Effect.forkScoped` in the layer definition.

## Effect.cached for deduplication

Use `Effect.cached` when multiple concurrent callers should share a single in-flight computation rather than storing `Fiber | undefined` or `Promise | undefined` manually. See `specs/effect/migration.md` for the full pattern.

## Callback boundaries

Use `EffectBridge` for native or external callbacks (`@parcel/watcher`, `node-pty`, native `fs.watch`, plugin callbacks, etc.) that need to re-enter Effect services with instance/workspace context.

Plain async code should pass explicit context or stay inside an Effect fiber; do not add ambient instance context shims.

---

# 上游 fork 约定 (opencode fork 继承)

> numas fork 自 upstream opencode, 以下是 numas 必须继续遵守的上游约束 (有删减/中文化).
> 与 numas 自有约定冲突时, 以本节为准 + 在避坑沉淀修正记录, 不得静默偏离.

## 分支命名

- 短横线分隔 ≤3 词, **不**使用 `feat/` / `fix/` 之类前缀
- 示例: `session-recovery`, `fix-scroll-state`, `regenerate-sdk`

## 提交与 PR 标题

- **conventional commit 风格**: `type(scope): summary`
- **type 合法集**: `feat` / `fix` / `docs` / `chore` / `refactor` / `test`
- **scope 可选**: 涉及包名/模块名时添加, 如 `core` / `opencode` / `tui` / `app` / `desktop` / `sdk` / `plugin`
- 示例: `fix(tui): simplify thinking toggle styling`, `docs: update contributing guide`, `chore(sdk): regenerate types`

## 代码风格 (TypeScript / Effect)

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

## 类型检查

- 从 **package dir** 跑 `bun typecheck`, **不**直接 `tsc`
- 例: `cd packages/opencode && bun run typecheck`
- CI 必须从 package dir 跑, 不允许从 repo root 触发 (历史教训: root 跑会污染上下文导致漏报)

## 测试

- **避免 mocks**, `globalThis.*` 不到万不得已不用
- **测真实实现**, 不把逻辑复制到测试里再"测一遍"
- **tests 不能从 repo root 跑** (guard: `do-not-run-tests-from-root`)
- 必须从 package dir 跑, 例 `cd packages/opencode && bun test`

## V2 Session Core 架构约束 (核心)

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

# 本子工程避坑

- **opencode 打包版本号固定官方 `1.18.30`** (`packages/script/src/index.ts` 的 `NUMAS_VERSION`):
  UA = `opencode/${InstallationVersion}` (`src/session/llm/request.ts`), opencode Console 免费模型按 UA
  校验来源, `numas-v<...>` 定制版本号会被拒. 打包不再自动 bump 根 `version.json` (桌面发版人工改);
  `bun run build` 仍可能改写 `bun.lock` (平台包), 提交前逐项甄别, 不要无脑全量 add.
- 删除/重命名子包后, 提交前全仓 grep 包名 (含 `.html` / `.md` / 脚本), 清残留引用再提交.
  本次删 `packages/desktop-tauri` 后 `test/launch.html` 仍有安装说明残留.
- 提交前先看工作区全貌: `git status` 可能混有上一轮遗留的未提交改动, 不要默认全量 `git add -A`;
  用 `question` 让用户拍板纳入范围与拆分方式.
- **服务层别 `console.log`** (2026-09-23): TUI 内嵌 server 会构建实例层服务 (如 `ports/ports.ts` 的
  `setInterval` 周期 scan), 服务里直接 `console.log` 会持续往 stdout 刷屏、冲掉 TUI 画面 (现象:
  运行 `numas` 只见一堆日志、无 TUI). 调试日志默认静默 + env 开关 (如 `NUMAS_PORTS_DEBUG=1`),
  或走文件 logger; 不要裸 `console.log`.
- **构建 `packages/opencode` 需联网拉 models.dev** (`script/generate.ts`): 代理下 TLS 校验失败会中断
  build. 解法: 用本地快照 `MODELS_DEV_API_JSON=<api.json路径> bun run build ...` (快照可从
  `~/.cache/opencode/models.json` 取). 另: `--skip-install` 防 `bun run build` 改写 `bun.lock`.
- **两个版本号必须分清** (2026-09-24): ① **UA 版本** `InstallationVersion` (构建注入 `OPENCODE_VERSION`,
  现固定 `1.18.30`) — 用于发给 provider 的 `opencode/<channel>/<version>` UA, **绝不能改** (opencode Console
  免费模型按 UA 校验来源, 非官方版本号会被拒). ② **numas 应用版本** `InstallationAppVersion` (构建注入
  `OPENCODE_APP_VERSION`, 源 = `packages/tauri/version.json`, 如 `0.1.17`) — 用于升级判断 + `--version` 展示.
  版本生成 (`packages/script/src/index.ts` 的 `Script.version`): numas 固定用 UA 版本, **不再拉上游 npm**
  (避免网络依赖 + 上游变动). `Script.appVersion` = 我们自己的版本.
- **自升级必须按我们自己的规则, 且只提示不安装** (2026-09-24): 曾经的 bug —— `InstallationChannel="dev"`
  让自动升级去查 npm `opencode-ai@dev` (`0.0.0-dev-<ts>`), `getReleaseType` 只判断 `>` 对**更低**版本
  落到 `"patch"` → 真执行 `npm i -g`, **把用户的 opencode 覆盖成上游 dev 版**. 现修:
  `Installation.latest` 有 `InstallationAppVersion` 时取 `weizuxiao911/numas` 的 `releases/latest`
  (`name` `v0.1.17` / tag `numas-v0.1.17-<ts>`); `cli/upgrade.ts` 对 numas 仅 `semver.gt(latest, appVersion)`
  时发 update-available 事件, **绝不自动安装** (numas 无 npm 分发通道). 改动前务必确认不会再碰上游 dist-tag.

