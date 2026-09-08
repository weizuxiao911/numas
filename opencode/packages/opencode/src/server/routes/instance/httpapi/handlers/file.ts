import * as InstanceState from "@/effect/instance-state"
import { FileSystem } from "@opencode-ai/core/filesystem"
import { LocationServiceMap, locationServiceMapLayer } from "@opencode-ai/core/location-services"
import { Ripgrep } from "@opencode-ai/core/ripgrep"
import { FSUtil } from "@opencode-ai/core/fs-util"
import { Location } from "@opencode-ai/core/location"
import { AbsolutePath, RelativePath } from "@opencode-ai/core/schema"
import { LogicalDirectoryRegistry } from "@/project/logical-directory-registry"
import { Effect, Layer, Option } from "effect"
import ignore from "ignore"
import path from "path"
import { HttpApiBuilder } from "effect/unstable/httpapi"
import { InstanceHttpApi } from "../api"

export const fileHandlers = HttpApiBuilder.group(InstanceHttpApi, "file", (handlers) =>
  Effect.gen(function* () {
    const ripgrep = yield* Ripgrep.Service
    const locations = yield* LocationServiceMap.Service

    const filesystem = Effect.fnUntraced(function* <A, E, R>(effect: Effect.Effect<A, E, R>) {
      return yield* effect.pipe(
        Effect.provide(
          locations.get(Location.Ref.make({ directory: AbsolutePath.make((yield* InstanceState.context).directory) })),
        ),
      )
    })

    // numas: workspace 是 symlink (real -> logical) 时, 把 instance 物理目录反查回 logical 路径
    // 用于边界校验 + absolute 字段, 跟 /api/fs/list (logical) 和 explorer 路径一致. 查不到时
    // (workspace 不是 symlink) fallback 到 real, 行为不变. 跟 handlers/pty.ts:create 同模式
    // (LogicalDirectoryRegistry 反查, AGENTS.md #21/24).
    const logicalInstanceDir = (realDir: string) =>
      LogicalDirectoryRegistry.get(realDir) ?? path.resolve(FSUtil.windowsPath(realDir))

    const findText = Effect.fn("FileHttpApi.findText")(function* (ctx: { query: { pattern: string } }) {
      const realInstanceDir = (yield* InstanceState.context).directory
      const logicalInstance = logicalInstanceDir(realInstanceDir)
      // numas: ripgrep cwd 必须用 real (跟 FileSystemSearch 同模式, AGENTS.md #21/24),
      // 但输出的 match.entry.path 是 cwd-relative, 与 logical 文件树对不上. 用 realToLogical
      // 共享工具把 match.entry.path 从 real-cwd-relative 映射到 logical-relative.
      return (yield* ripgrep
        .grep({ cwd: realInstanceDir, pattern: ctx.query.pattern, limit: 10 })
        .pipe(Effect.orDie))
        .map((match) => {
          const realRel = match.entry.path
          const logicalRel = path.relative(
            logicalInstance,
            FSUtil.realToLogical(path.resolve(realInstanceDir, realRel), realInstanceDir, logicalInstance),
          )
          return {
            path: { text: logicalRel },
            lines: { text: match.text },
            line_number: match.line,
            absolute_offset: match.offset,
            submatches: match.submatches.map((submatch) => ({
              match: { text: submatch.text },
              start: submatch.start,
              end: submatch.end,
            })),
          }
        })
    })

    const findFile = Effect.fn("FileHttpApi.findFile")(function* (ctx: {
      query: { query: string; dirs?: "true" | "false"; type?: "file" | "directory"; limit?: number }
    }) {
      const directory = (yield* InstanceState.context).directory
      const limit = ctx.query.limit ?? 10
      const type = ctx.query.type ?? (ctx.query.dirs === "false" ? "file" : undefined)
      const started = performance.now()
      const found = yield* filesystem(FileSystem.Service.use((fs) => fs.find({ query: ctx.query.query, limit, type })))
      yield* Effect.logInfo("find file", {
        query: ctx.query.query,
        type,
        directory,
        limit,
        results: found.length,
        duration: Math.round(performance.now() - started),
      })
      return found.map((item) => item.path)
    })

    const findSymbol = Effect.fn("FileHttpApi.findSymbol")(function* () {
      return []
    })

    const list = Effect.fn("FileHttpApi.list")(function* (ctx: { query: { path: string } }) {
      const realInstanceDir = (yield* InstanceState.context).directory
      // numas: logical base 算 absolute 字段 (跟 explorer 看到的路径一致), ignored 字段的
      // path.relative 也用 logical base, 否则 hybrid 路径 (real base + logical rel) 在
      // symlink workspace 下算出 ../xxx, gitignore 匹配全错.
      const logicalInstance = logicalInstanceDir(realInstanceDir)
      // numas: gitignore/ignore 用 logical base 读, 因为 .gitignore 模式匹配按字符串;
      // 实际 git 在该 workspace 看到的也是 logical 路径 (symlink 是工作目录入口). non-git
      // workspace 下 location.project.directory 退化成 path.parse(...).root = "/", 反查
      // logicalProject 也不可靠, 直接用 logicalInstance (workspace 根) 更稳.
      const logicalProject = logicalInstance
      return yield* filesystem(
        Effect.gen(function* () {
          const fs = yield* FileSystem.Service
          const raw = yield* FSUtil.Service
          const ignored = ignore()
          const gitignore = yield* raw
            .readFileString(path.join(logicalProject, ".gitignore"))
            .pipe(Effect.catch(() => Effect.succeed("")))
          if (gitignore) ignored.add(gitignore)
          const ignorefile = yield* raw
            .readFileString(path.join(logicalProject, ".ignore"))
            .pipe(Effect.catch(() => Effect.succeed("")))
          if (ignorefile) ignored.add(ignorefile)
          return (yield* fs.list({ path: RelativePath.make(ctx.query.path) })).map((item) => {
            // numas: item.path 是 logical-relative (filesystem.ts:resolve 走 logical,
            // AGENTS.md #21). absolute 字段拼 logical base, 跟 explorer tree 一致.
            const logicalAbs = path.resolve(logicalInstance, item.path)
            return {
              name: path.basename(item.path),
              path: item.path,
              absolute: logicalAbs,
              type: item.type,
              ignored: ignored.ignores(
                path.relative(logicalProject, logicalAbs) + (item.type === "directory" ? "/" : ""),
              ),
            }
          })
        }),
      )
    })

    const content = Effect.fn("FileHttpApi.content")(function* (ctx: { query: { path: string } }) {
      const realInstanceDir = (yield* InstanceState.context).directory
      // numas: 边界校验用 logical 路径 (跟 pty.ts:create 同模式, AGENTS.md #21/24). 拦截
      // ../ 逃逸, 但放行 workspace 内 symlink 指向 workspace 外的展开/读取.
      const logicalInstance = logicalInstanceDir(realInstanceDir)
      const logicalFile = path.resolve(logicalInstance, ctx.query.path)
      if (!FSUtil.contains(logicalInstance, logicalFile)) return yield* Effect.die(new Error("Path escapes the location"))
      if (!(yield* FSUtil.Service.use((fs) => fs.existsSafe(logicalFile))))
        return { type: "text" as const, content: "" }
      return yield* filesystem(
        FileSystem.Service.use((fs) => fs.read({ path: RelativePath.make(ctx.query.path) })),
      ).pipe(
        Effect.flatMap((item) =>
          Effect.gen(function* () {
            const text = item.content.includes(0)
              ? Option.none<string>()
              : yield* Effect.sync(() => new TextDecoder("utf-8", { fatal: true }).decode(item.content)).pipe(
                  Effect.option,
                )
            return { item, text }
          }),
        ),
        Effect.map(({ item, text }) =>
          Option.isSome(text)
            ? { type: "text" as const, content: text.value }
            : {
                type: "binary" as const,
                content: Buffer.from(item.content).toString("base64"),
                encoding: "base64" as const,
                mimeType: item.mime,
              },
        ),
      )
    })

    const status = Effect.fn("FileHttpApi.status")(function* () {
      return []
    })

    return handlers
      .handle("findText", findText)
      .handle("findFile", findFile)
      .handle("findSymbol", findSymbol)
      .handle("list", list)
      .handle("content", content)
      .handle("status", status)
  }),
).pipe(Layer.provide(locationServiceMapLayer))
