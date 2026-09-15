export * as FileSystemSearch from "./search"

import { makeLocationNode } from "../effect/app-node"
import path from "path"
import { Context, Effect, Layer, Scope } from "effect"
import { Fff } from "#fff"
import fuzzysort from "fuzzysort"
import { FileSystem } from "../filesystem"
import { FSUtil } from "../fs-util"
import { Location } from "../location"
import { Ripgrep } from "../ripgrep"
import { RelativePath } from "../schema"
import { Flag } from "../flag/flag"

export interface Interface {
  readonly find: (input: FileSystem.FindInput) => Effect.Effect<FileSystem.Entry[]>
  readonly glob: (input: FileSystem.GlobInput) => Effect.Effect<readonly FileSystem.Entry[]>
  readonly grep: (input: FileSystem.GrepInput) => Effect.Effect<readonly FileSystem.Match[]>
}

export class Service extends Context.Service<Service, Interface>()("@opencode/v2/FileSystem/Search") {}

export const ripgrepLayer = Layer.effect(
  Service,
  Effect.gen(function* () {
    const fs = yield* FSUtil.Service
    const location = yield* Location.Service
    const ripgrep = yield* Ripgrep.Service
    const scope = yield* Scope.Scope
    const state = {
      files: [] as string[],
      directories: [] as string[],
    }
    const directories = new Set<string>()
    // numas: ripgrep cwd 必须用 real path (location.directory 已是 FSUtil.resolve 物理化)
    // — 容器内 /home/community/222 -> /app/222 走 symlink 时, inotify 跟着 symlink 容易 miss
    // (跟 watcher 同模式, AGENTS.md #21/24). 但 ripgrep 输出的 entry.path 是 real-relative
    // (基于 cwd), 与前端 logical 文件树对不上. 在 caller 层把 real-relative 转 logical-relative:
    //   1) state.files / state.directories (供 find 用)
    //   2) glob/grep 返回的 entry.path / match.entry.path
    // 共享 FSUtil.realToLogical 工具, 跟 watcher 同一个安全检测 (path.relative + startsWith("..")).
    // 转换链路: ripgrep output (cwd-relative) → path.resolve(cwd, rel) (real abs) →
    //   realToLogical (logical abs) → path.relative(logicalDirectory, abs) (logical-relative).
    // 子目录查询时 cwd 是 location.directory 的子目录, 多一步 join.
    // find 的 cwd 固定是 location.directory, 它的 toLogicalRelative 走 locationDirectoryBase 这个
    // 专门函数, 不跟 glob/grep 共享可变 cwd 变量, 避免闭包陷阱.
    const realRoot = location.directory
    const logicalRoot = location.logicalDirectory ?? realRoot
    const toLogicalRelativeFrom = (cwdAbs: string, cwdRel: string) => {
      const realAbs = path.resolve(cwdAbs, cwdRel)
      const logicalAbs = FSUtil.realToLogical(realAbs, realRoot, logicalRoot)
      return path.relative(logicalRoot, logicalAbs)
    }
    const toLocationLogicalRelative = (cwdRel: string) =>
      toLogicalRelativeFrom(realRoot, cwdRel)
    yield* ripgrep
      .find({
        cwd: realRoot,
        pattern: "*",
        limit: location.vcs ? Number.MAX_SAFE_INTEGER : 100_000,
        onEntry: (entry) =>
          Effect.sync(() => {
            const logical = toLocationLogicalRelative(entry.path)
            state.files.push(logical)
            const parts = logical.split("/")
            parts.slice(0, -1).forEach((_, index) => directories.add(parts.slice(0, index + 1).join("/") + path.sep))
            state.directories = Array.from(directories)
          }),
      })
      .pipe(Effect.orDie, Effect.asVoid, Effect.forkIn(scope))
    return Service.of({
      glob: (input) =>
        Effect.gen(function* () {
          const target = path.resolve(location.directory, input.path ?? ".")
          const info = yield* fs.stat(target).pipe(Effect.orDie)
          const cwd = info.type === "File" ? path.dirname(target) : target
          return yield* ripgrep
            .glob({
              cwd,
              pattern: input.pattern,
              limit: input.limit ?? Number.MAX_SAFE_INTEGER,
            })
            .pipe(
              Effect.map((result) =>
                result.map((entry) =>
                  FileSystem.Entry.make({
                    ...entry,
                    // numas: ripgrep cwd 是 real, entry.path 是 real-relative. 转 logical-relative
                    // 才能跟 /api/fs/list 输出的 logical 文件树对齐 (filesystem.ts:resolve 走 logical,
                    // AGENTS.md #21). 子目录下的查询结果 (info.type === "Directory") 也要走相同转换.
                    path: RelativePath.make(toLogicalRelativeFrom(cwd, entry.path)),
                  }),
                ),
              ),
              Effect.orDie,
            )
        }),
      grep: (input) =>
        Effect.gen(function* () {
          const target = path.resolve(location.directory, input.path ?? ".")
          const info = yield* fs.stat(target).pipe(Effect.orDie)
          const cwd = info.type === "File" ? path.dirname(target) : target
          return yield* ripgrep
            .grep({
              cwd,
              pattern: input.pattern,
              file: info.type === "File" ? path.basename(target) : undefined,
              include: input.include,
              limit: input.limit ?? Number.MAX_SAFE_INTEGER,
            })
            .pipe(
              Effect.map((result) =>
                result.map((match) =>
                  FileSystem.Match.make({
                    ...match,
                    entry: FileSystem.Entry.make({
                      ...match.entry,
                      // numas: 同 glob, match.entry.path 是 cwd-relative; 先 resolve 回 real abs,
                      // 再走 realToLogical 整段映射到 logical abs, 最后 relative 到 logicalDirectory.
                      path: RelativePath.make(toLogicalRelativeFrom(cwd, match.entry.path)),
                    }),
                  }),
                ),
              ),
              Effect.orDie,
            )
        }),
      find: (input) =>
        Effect.gen(function* () {
          // numas: state.files / state.directories 已经在 onEntry 阶段做了 real→logical 转换
          // (上面 onEntry 块), 这里直接用就行. fuzzysort 对 logical path 字符串排序, 与
          // explorer 文件树匹配.
          const items =
            input.type === "file"
              ? state.files
              : input.type === "directory"
                ? state.directories
                : [...state.files, ...state.directories]
          return fuzzysort.go(input.query, items, { limit: input.limit ?? 50 }).map((item) => {
            const relative = item.target
            const type = relative.endsWith(path.sep) ? ("directory" as const) : ("file" as const)
            return FileSystem.Entry.make({
              path: RelativePath.make(relative),
              type,
            })
          })
        }),
    })
  }),
)

export const fffLayer = Layer.effect(
  Service,
  Effect.gen(function* () {
    const location = yield* Location.Service
    const result = yield* Effect.try({
      try: () =>
        Fff.create({
          basePath: location.directory,
          aiMode: true,
          disableMmapCache: true,
          disableContentIndexing: true,
        }),
      catch: (cause) => cause,
    }).pipe(
      Effect.catch((error) => Effect.logWarning("failed to initialize fff", { error }).pipe(Effect.as(undefined))),
    )
    if (!result?.ok) {
      if (result) yield* Effect.logWarning("failed to initialize fff", { error: result.error })
      return Service.of({
        find: () => Effect.succeed([]),
        glob: () => Effect.succeed([]),
        grep: () => Effect.succeed([]),
      })
    }
    yield* Effect.addFinalizer(() => Effect.sync(() => result.value.destroy()).pipe(Effect.ignore))
    return Service.of({
      glob: (input) =>
        Effect.sync(() => {
          const prefix = input.path?.replaceAll("\\", "/").replace(/\/$/, "")
          const found = result.value.glob(prefix ? `${prefix}/${input.pattern}` : input.pattern, {
            pageIndex: 0,
            pageSize: input.limit,
          })
          if (!found.ok) throw found.error
          return found.value.items.map((item) =>
            FileSystem.Entry.make({
              path: RelativePath.make(item.relativePath.replaceAll("\\", "/")),
              type: "file",
            }),
          )
        }),
      grep: (input) =>
        Effect.sync(() => {
          const prefix = input.path?.replaceAll("\\", "/").replace(/\/$/, "")
          const found = result.value.grep(
            [prefix ? `${prefix}/**` : undefined, input.include, input.pattern]
              .filter((value) => value !== undefined)
              .join(" "),
            { mode: "regex", pageSize: input.limit, timeBudgetMs: 1_500 },
          )
          if (!found.ok) throw found.error
          return found.value.items.map((match) => {
            const bytes = Buffer.from(match.lineContent)
            return FileSystem.Match.make({
              entry: FileSystem.Entry.make({
                path: RelativePath.make(match.relativePath.replaceAll("\\", "/")),
                type: "file",
              }),
              line: match.lineNumber,
              offset: match.byteOffset,
              text: match.lineContent.length > 2_000 ? match.lineContent.slice(0, 2_000) + "..." : match.lineContent,
              submatches: match.matchRanges.map(([start, end]) => ({
                text: bytes.subarray(start, end).toString("utf8"),
                start,
                end,
              })),
            })
          })
        }),
      find: (input) =>
        Effect.sync(() => {
          const options = { pageIndex: 0, pageSize: input.limit ?? 50 }
          const items = (() => {
            if (input.type === "file") {
              const found = result.value.fileSearch(input.query.trim(), options)
              if (!found.ok) throw found.error
              return found.value.items.map((item, index) => ({
                path: item.relativePath,
                type: "file" as const,
                score: found.value.scores[index]?.total ?? 0,
              }))
            }
            if (input.type === "directory") {
              const found = result.value.directorySearch(input.query.trim(), options)
              if (!found.ok) throw found.error
              return found.value.items.map((item, index) => ({
                path: item.relativePath,
                type: "directory" as const,
                score: found.value.scores[index]?.total ?? 0,
              }))
            }
            const found = result.value.mixedSearch(input.query.trim(), options)
            if (!found.ok) throw found.error
            return found.value.items.map((item, index) => ({
              path: item.item.relativePath,
              type: item.type,
              score: found.value.scores[index]?.total ?? 0,
            }))
          })()
          return items
            .sort((a, b) => b.score - a.score || a.path.length - b.path.length)
            .map((item) => {
              const relative = item.path.replaceAll("\\", "/").replace(/\/$/, "")
              return FileSystem.Entry.make({
                path: RelativePath.make(relative + (item.type === "directory" ? path.sep : "")),
                type: item.type,
              })
            })
        }),
    })
  }),
)

const layer = Layer.unwrap(Effect.sync(() => (Flag.OPENCODE_DISABLE_FFF || !Fff.available() ? ripgrepLayer : fffLayer)))

export const locationLayer = layer

export const node = makeLocationNode({ service: Service, layer, deps: [FSUtil.node, Location.node, Ripgrep.node] })
