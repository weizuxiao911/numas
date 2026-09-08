export * as Watcher from "./watcher"

// @ts-ignore
import { createWrapper } from "@parcel/watcher/wrapper"
import type ParcelWatcher from "@parcel/watcher"
import { makeLocationNode } from "../effect/app-node"
import { Cause, Context, Effect, Layer } from "effect"
import { FileSystemWatcher } from "@opencode-ai/schema/filesystem-watcher"
import path from "path"
import { Config } from "../config"
import { EventV2 } from "../event"
import { Flag } from "../flag/flag"
import { FSUtil } from "../fs-util"
import { Git } from "../git"
import { Location } from "../location"
import { lazy } from "../util/lazy"
import { Ignore } from "./ignore"
import { Protected } from "./protected"

declare const OPENCODE_LIBC: string | undefined

const SUBSCRIBE_TIMEOUT_MS = 10_000

export const Event = FileSystemWatcher.Event

const watcher = lazy((): typeof import("@parcel/watcher") | undefined => {
  try {
    const libc = typeof OPENCODE_LIBC === "undefined" ? undefined : OPENCODE_LIBC
    const binding = require(
      `@parcel/watcher-${process.platform}-${process.arch}${process.platform === "linux" ? `-${libc || "glibc"}` : ""}`,
    )
    return createWrapper(binding) as typeof import("@parcel/watcher")
  } catch {
    return
  }
})

function getBackend() {
  if (process.platform === "win32") return "windows"
  if (process.platform === "darwin") return "fs-events"
  if (process.platform === "linux") return "inotify"
}

function protecteds(dir: string) {
  return Protected.paths().filter((item) => {
    const relative = path.relative(dir, item)
    return relative !== "" && !relative.startsWith("..") && !path.isAbsolute(relative)
  })
}

// numas: real→logical 转换工具见 FSUtil.realToLogical (fs-util.ts). watcher callback
// 拿 parcel 的 real path 事件还原成 logical path 走它; 同样供 FileSystemSearch (ripgrep
// 输出 real-relative → logical-relative) 与 V1 file handler (findText/list/content
// 边界校验和路径展示) 共享.

export const hasNativeBinding = () => !!watcher()

export function subscribe(
  directory: string,
  callback: ParcelWatcher.SubscribeCallback,
  options?: { ignore?: string[]; backend?: string },
): Effect.Effect<ParcelWatcher.AsyncSubscription | undefined> {
  const backend = options?.backend ?? getBackend()
  if (!backend) return Effect.succeed(undefined)
  const w = watcher()
  if (!w) return Effect.succeed(undefined)
  return Effect.promise(() =>
    w.subscribe(directory, callback, { ignore: options?.ignore ?? [], backend: backend as any }),
  ).pipe(Effect.timeout(SUBSCRIBE_TIMEOUT_MS), Effect.orElseSucceed(() => undefined))
}

export interface Interface {}

export class Service extends Context.Service<Service, Interface>()("@opencode/v2/FileWatcher") {}

const layer = Layer.effect(
  Service,
  Effect.gen(function* () {
    if (yield* Flag.OPENCODE_EXPERIMENTAL_DISABLE_FILEWATCHER) return Service.of({})

    const backend = getBackend()
    const location = yield* Location.Service
    if (!backend) {
      yield* Effect.logError("watcher backend not supported", {
        directory: location.directory,
        platform: process.platform,
      })
      return Service.of({})
    }

    const w = watcher()
    if (!w) return Service.of({})

    yield* Effect.logInfo("watcher backend", { directory: location.directory, logicalDirectory: location.logicalDirectory, platform: process.platform, backend })
    const events = yield* EventV2.Service
    const fs = yield* FSUtil.Service
    const git = yield* Git.Service
    const context = yield* Effect.context()
    const runFork = Effect.runForkWith(context)
    const subscriptions: ParcelWatcher.AsyncSubscription[] = []
    yield* Effect.addFinalizer(() =>
      Effect.promise(() => Promise.allSettled(subscriptions.map((subscription) => subscription.unsubscribe()))),
    )

    const callback: ParcelWatcher.SubscribeCallback = (_error, updates) => {
      for (const update of updates) {
        // numas: workspace 是 symlink 时, FSUtil.resolve 把 logical (/home/community/222)
        // 转成 real (/app/222), watcher 订阅 real, parcel 内部归一化使 update.path
        // 也是 real. 但客户端 /api/fs/list 返回 logical 路径 (filesystem.ts:resolve 走
        // logical, AGENTS.md #21), real path 事件无法匹配 → UI 不更新.
        // 这里把 real prefix 替换回 logical prefix, 让事件路径与文件树一致.
        const file = FSUtil.realToLogical(update.path, location.directory, location.logicalDirectory)
        if (update.type === "create") runFork(events.publish(Event.Updated, { file, event: "add" }))
        if (update.type === "update") runFork(events.publish(Event.Updated, { file, event: "change" }))
        if (update.type === "delete") runFork(events.publish(Event.Updated, { file, event: "unlink" }))
      }
    }

    const subscribe = (directory: string, ignore: string[]) => {
      const pending = w.subscribe(directory, callback, { ignore, backend })
      return Effect.promise(() => pending).pipe(
        Effect.tap((subscription) => Effect.sync(() => subscriptions.push(subscription))),
        Effect.timeout(SUBSCRIBE_TIMEOUT_MS),
        Effect.catchCause((cause) => {
          pending.then((subscription) => subscription.unsubscribe()).catch(() => {})
          return Effect.logError("failed to subscribe", { directory, cause: Cause.pretty(cause) })
        }),
      )
    }

    const config = (yield* (yield* Config.Service).entries())
      .filter((entry): entry is Config.Document => entry.type === "document")
      .flatMap((item) => item.info.watcher?.ignore ?? [])
    // numas: 总是启 fs watcher (不论是否 git 仓库, 不需 experimental flag)
    // 原来条件: location.vcs && OPENCODE_EXPERIMENTAL_FILEWATCHER — numas 本地 IDE,
    // 用户工作目录常非 git 仓库, 改文件需要实时同步到 IDE, 必须总启
    yield* Effect.forkScoped(
      subscribe(location.directory, [...Ignore.PATTERNS, ...config, ...protecteds(location.directory)]),
    )

    if (location.vcs?.type === "git") {
      const resolved = (yield* git.repo.discover(location.directory))?.gitDirectory
      const vcs = resolved ? yield* fs.realPath(resolved).pipe(Effect.catch(() => Effect.succeed(resolved))) : undefined
      if (vcs && !config.includes(".git") && !config.includes(vcs) && (!resolved || !config.includes(resolved))) {
        const ignore = (yield* fs.readDirectoryEntries(vcs).pipe(Effect.catch(() => Effect.succeed([])))).flatMap(
          (entry) => (entry.name === "HEAD" ? [] : [entry.name]),
        )
        yield* Effect.forkScoped(subscribe(vcs, ignore))
      }
    }

    return Service.of({})
  }).pipe(
    Effect.catchCause((cause) => {
      return Effect.logError("failed to init watcher service", { cause: Cause.pretty(cause) }).pipe(
        Effect.as(Service.of({})),
      )
    }),
  ),
)

export const node = makeLocationNode({
  service: Service,
  layer,
  deps: [FSUtil.node, Location.node, Config.node, Git.node, EventV2.node],
})
