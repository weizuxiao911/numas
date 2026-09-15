import { FileSystem } from "@opencode-ai/core/filesystem"
import { Watcher } from "@opencode-ai/core/filesystem/watcher"
import { FSUtil } from "@opencode-ai/core/fs-util"
import { Location } from "@opencode-ai/core/location"
import { RelativePath } from "@opencode-ai/core/schema"
import path from "path"
import { Cause, Effect, Queue, Ref, Stream } from "effect"
import { HttpServerResponse } from "effect/unstable/http"
import { HttpApiBuilder } from "effect/unstable/httpapi"
import * as Sse from "effect/unstable/encoding/Sse"
import { WatchEvent } from "@opencode-ai/protocol/groups/fs"
import { FileNotFoundError } from "@opencode-ai/protocol/errors"
import { PlatformError } from "effect/PlatformError"
import { Api } from "../api"
import { response } from "../location"

const DEBOUNCE_MS = 200
const TICK_MS = 100

/** Map filesystem NotFound (surfaced as a die via `Effect.orDie` in core) to a typed 404.
 *  effect v4 beta 下 orDie 抛出的 not-found defect 形状不固定: 可能是 PlatformError
 *  (reason._tag==='NotFound'), 也可能带 code='ENOENT' 或 message 含 ENOENT. 逐一识别,
 *  避免文件/目录不存在时漏成裸 500 (前端只能当未知错误, 控制台刷 500 红字). */
const fileSystem = <A, R>(self: Effect.Effect<A, never, R>) =>
  self.pipe(
    Effect.catchCause((cause) => {
      const die = cause.reasons.find(Cause.isDieReason)
      const error = die?.defect as { reason?: { _tag?: string; pathOrDescriptor?: unknown }; code?: string } | undefined
      const reason = error?.reason
      const msg = error instanceof Error ? error.message : String(error ?? "")
      const notFound =
        (error instanceof PlatformError && reason?._tag === "NotFound") ||
        reason?._tag === "NotFound" ||
        error?.code === "ENOENT" ||
        /ENOENT|no such file|not found/i.test(msg)
      if (notFound) {
        const p = typeof reason?.pathOrDescriptor === "string" ? reason.pathOrDescriptor : ""
        return Effect.fail(new FileNotFoundError({ path: p, message: msg }))
      }
      return Effect.failCause(cause)
    }),
  )

export const FileSystemHandler = HttpApiBuilder.group(Api, "server.fs", (handlers) =>
  Effect.gen(function* () {
    return handlers
      .handleRaw("fs.read", (ctx) =>
        Effect.gen(function* () {
          const file = yield* (yield* FileSystem.Service).read({
            path: RelativePath.make(
              decodeURIComponent(new URL(ctx.request.url, "http://localhost").pathname.slice(13)),
            ),
          })
          return HttpServerResponse.uint8Array(file.content, { contentType: file.mime })
        }).pipe(fileSystem),
      )
      .handle("fs.list", (ctx) =>
        // fileSystem 必须在 response() 外层: response 经 LocationMiddleware provide, 其内层
        // fail 的 typed error (FileNotFoundError) 无法被 HttpApi 正确序列化成 404 (漏成 500);
        // 放到 response 外与 fs.read (handleRaw .pipe(fileSystem)) 同位才生效.
        response(
          Effect.gen(function* () {
            const fs = yield* FileSystem.Service
            return yield* fs.list(ctx.query)
          }),
        ).pipe(fileSystem),
      )
      .handle("fs.find", (ctx) =>
        response(
          Effect.gen(function* () {
            const fs = yield* FileSystem.Service
            return yield* fs.find(ctx.query)
          }),
        ),
      )
      .handle("fs.stat", (ctx) =>
        response(
          Effect.gen(function* () {
            const fs = yield* FileSystem.Service
            return yield* fs.stat({ path: ctx.query.path })
          }),
        ).pipe(fileSystem),
      )
      .handle("fs.write", (ctx) =>
        Effect.gen(function* () {
          const fs = yield* FileSystem.Service
          const { path, content, mode } = ctx.payload
          const bytes = new Uint8Array(Buffer.from(content, "base64"))
          yield* fs.write({ path, content: bytes, mode })
        }).pipe(fileSystem),
      )
      .handle("fs.mkdir", (ctx) =>
        Effect.gen(function* () {
          const fs = yield* FileSystem.Service
          yield* fs.mkdir(ctx.payload)
        }),
      )
      .handle("fs.remove", (ctx) =>
        Effect.gen(function* () {
          const fs = yield* FileSystem.Service
          yield* fs.remove(ctx.payload)
        }).pipe(fileSystem),
      )
      .handle("fs.rename", (ctx) =>
        Effect.gen(function* () {
          const fs = yield* FileSystem.Service
          yield* fs.rename(ctx.payload)
        }).pipe(fileSystem),
      )
      .handle("fs.copy", (ctx) =>
        Effect.gen(function* () {
          const fs = yield* FileSystem.Service
          yield* fs.copy(ctx.payload)
        }).pipe(fileSystem),
      )
      .handleRaw("fs.watch", (ctx) =>
        Effect.gen(function* () {
          const fs = yield* FSUtil.Service
          const location = yield* Location.Service
          // numas: workspace 路径是 symlink 时 (e.g. /home/community/222 -> /app/222),
          // location.directory 是 logical path. parcel/watcher 订阅 logical (symlink)
          // 在 Linux 上 inotify_add_watch 报 "Not a directory" 失败, 整个 fs.watch
          // 流不工作, 客户端 explorer 收不到更新. 必须用 real path 订阅.
          const rootReal = yield* fs.realPath(location.directory).pipe(Effect.orElseSucceed(() => location.directory))
          const subpath = ctx.query.path
          // numas: subpath 也要基于 rootReal 解析, 防止 location.directory 是 symlink 时
          // path.resolve(logical, subpath) 落到错的物理路径.
          const watchRoot = subpath ? path.resolve(rootReal, FSUtil.windowsPath(subpath)) : rootReal
          const filterRootReal = subpath
            ? yield* fs.realPath(watchRoot).pipe(Effect.orElseSucceed(() => watchRoot))
            : rootReal
          // numas: 客户端 file tree 是 logical 路径 (filesystem.ts:resolve 走 logical,
          // AGENTS.md #21). 用 real 做 base 算出的 rel 是 real-relative (e.g.
          // "symlink-test-real/new.txt") 而客户端 tree 显示的是 logical (e.g.
          // "symlink-test/new.txt"), fire 给 codeblitz 后 explorer 不刷新. 用 logical
          // 做 base 算 rel, 让 path 与客户端 tree 一致. 没 logical 时 fallback 到 real,
          // 行为与之前一样.
          const filterRootLogical =
            location.logicalDirectory && location.logicalDirectory !== location.directory
              ? subpath
                ? path.resolve(location.logicalDirectory, FSUtil.windowsPath(subpath))
                : location.logicalDirectory
              : filterRootReal

          const out = yield* Queue.unbounded<{
            readonly path: string
            readonly type: "add" | "change" | "unlink"
            readonly timestamp: number
          }>()
          const buffer = yield* Ref.make(new Map<string, { path: string; type: "add" | "change" | "unlink" }>())
          const lastUpdate = yield* Ref.make(0)

          const subscription = yield* Watcher.subscribe(
            watchRoot,
            (_err, updates) => {
              const now = Date.now()
              for (const u of updates) {
                const t: "add" | "change" | "unlink" =
                  u.type === "create" ? "add" : u.type === "delete" ? "unlink" : "change"
                // numas: 用 logical base 算 rel, 客户端 tree 是 logical 路径; 非 symlink
                // workspace 时 filterRootLogical === filterRootReal, 行为不变.
                const rel = path.relative(filterRootLogical, u.path)
                // numas debug: 关键诊断 — rel 应该是 logical-relative 才能匹配客户端 tree
                Effect.runSync(
                  Effect.logInfo("[numas debug] fs.watch", {
                    watchRoot,
                    filterRootReal,
                    filterRootLogical,
                    updatePath: u.path,
                    rel,
                    skip: rel.startsWith("..") || path.isAbsolute(rel),
                  }),
                )
                if (rel.startsWith("..") || path.isAbsolute(rel)) continue
                Effect.runSync(
                  Effect.gen(function* () {
                    yield* Ref.update(buffer, (m) => {
                      const next = new Map(m)
                      next.set(u.path, { path: rel, type: t })
                      return next
                    })
                    yield* Ref.set(lastUpdate, now)
                  }),
                )
              }
            },
            { ignore: [".git", "node_modules"] },
          )
          if (subscription) {
            yield* Effect.addFinalizer(() =>
              Effect.promise(() => subscription.unsubscribe()).pipe(Effect.ignore),
            )
          }

          const flusher = Stream.tick(`${TICK_MS} millis`).pipe(
            Stream.runForEach(() =>
              Effect.gen(function* () {
                const last = yield* Ref.get(lastUpdate)
                if (last === 0) return
                if (Date.now() - last < DEBOUNCE_MS) return
                const drained = yield* Ref.getAndSet(buffer, new Map())
                yield* Ref.set(lastUpdate, 0)
                if (drained.size === 0) return
                const ts = Date.now()
                for (const ev of drained.values()) {
                  yield* Queue.offer(out, { ...ev, timestamp: ts })
                }
              }),
            ),
          )
          yield* Effect.forkScoped(flusher)

          const sseStream = Stream.fromQueue(out).pipe(
            Stream.map((ev) => ({
              _tag: "Event" as const,
              event: "message",
              id: undefined,
              data: JSON.stringify(ev),
            })),
            Stream.pipeThroughChannel(Sse.encode()),
          )
          const heartbeat = Stream.tick("15 seconds").pipe(Stream.map(() => ": heartbeat\n\n"))
          return HttpServerResponse.stream(
            sseStream.pipe(Stream.merge(heartbeat, { haltStrategy: "left" }), Stream.encodeText),
            {
              contentType: "text/event-stream; charset=utf-8",
              headers: {
                "Cache-Control": "no-cache, no-transform",
                "X-Accel-Buffering": "no",
                "X-Content-Type-Options": "nosniff",
              },
            },
          )
        }),
      )
  }),
)
