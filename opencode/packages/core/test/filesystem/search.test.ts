import { describe, expect, test } from "bun:test"
import fs from "fs/promises"
import path from "path"
import { Effect } from "effect"
import { LayerNode } from "@opencode-ai/core/effect/layer-node"
import { FSUtil } from "@opencode-ai/core/fs-util"
import { Ripgrep } from "@opencode-ai/core/ripgrep"
import { AbsolutePath, RelativePath } from "@opencode-ai/core/schema"
import { tmpdir } from "../fixture/tmpdir"
import { testEffect } from "../lib/effect"

const it = testEffect(LayerNode.compile(Ripgrep.node))

const withTmp = <A, E, R>(f: (directory: AbsolutePath) => Effect.Effect<A, E, R>) =>
  Effect.acquireRelease(
    Effect.promise(() => tmpdir()),
    (tmp) => Effect.promise(() => tmp[Symbol.asyncDispose]()),
  ).pipe(Effect.flatMap((tmp) => f(AbsolutePath.make(tmp.path))))

describe("Ripgrep", () => {
  it.live("globs files as an array", () =>
    withTmp((cwd) =>
      Effect.gen(function* () {
        yield* Effect.promise(() => fs.mkdir(path.join(cwd, "src")))
        yield* Effect.promise(() => fs.writeFile(path.join(cwd, "src", "match.ts"), "needle\n"))
        const result = yield* (yield* Ripgrep.Service).glob({ cwd, pattern: "**/*.ts", limit: 10 })
        expect(result.map((item) => item.path)).toEqual([RelativePath.make("src/match.ts")])
      }),
    ),
  )

  it.live("greps files with include filtering", () =>
    withTmp((cwd) =>
      Effect.gen(function* () {
        yield* Effect.promise(() => fs.mkdir(path.join(cwd, "src")))
        yield* Effect.promise(() => fs.writeFile(path.join(cwd, "src", "match.ts"), "needle\n"))
        yield* Effect.promise(() => fs.writeFile(path.join(cwd, "src", "skip.txt"), "needle\n"))
        const result = yield* (yield* Ripgrep.Service).grep({ cwd, pattern: "needle", include: "*.ts", limit: 10 })
        expect(result).toHaveLength(1)
        expect(result[0]?.entry.path).toBe(RelativePath.make("src/match.ts"))
        expect(result[0]?.submatches[0]?.text).toBe("needle")
      }),
    ),
  )
})

// numas: FSUtil.realToLogical 是 shared real→logical 路径转换工具, 给 watcher callback
// (filesystem/watcher.ts) 和 FileSystemSearch (ripgrep cwd-relative 输出 → logical-relative
// 转换) 共用. 行为:
//   - logicalRoot 缺省 / 与 realRoot 相等 → 原样返回 (无 symlink)
//   - file 不在 realRoot 子树内 → 原样返回 (避免越界)
//   - 字符串前缀误匹配 (e.g. /app/222 vs /app/222x) → 用 path.relative + startsWith("..") 兜底
// FSUtil.realToLogical 是纯函数, 不依赖 Effect 上下文, 用 bun:test 的 test() 跑.
describe("FSUtil.realToLogical", () => {
  test("returns the file unchanged when no logical root is provided", () => {
    expect(FSUtil.realToLogical("/app/222/foo", "/app/222", undefined)).toBe("/app/222/foo")
  })

  test("returns the file unchanged when logical and real roots are equal", () => {
    expect(FSUtil.realToLogical("/app/222/foo", "/app/222", "/app/222")).toBe("/app/222/foo")
  })

  test("rewrites the prefix when file is inside the real root", () => {
    expect(FSUtil.realToLogical("/app/222/foo/bar.txt", "/app/222", "/home/community/222")).toBe(
      "/home/community/222/foo/bar.txt",
    )
  })

  test("leaves files outside the real root unchanged", () => {
    // 不同根目录的同名前缀不能误替换
    expect(FSUtil.realToLogical("/app/222x/foo", "/app/222", "/home/community/222")).toBe("/app/222x/foo")
    expect(FSUtil.realToLogical("/other/foo", "/app/222", "/home/community/222")).toBe("/other/foo")
  })

  test("rewrites the real root itself (file === realRoot)", () => {
    expect(FSUtil.realToLogical("/app/222", "/app/222", "/home/community/222")).toBe("/home/community/222")
  })

  test("rewrites nested real-root children", () => {
    expect(FSUtil.realToLogical("/app/222/sub/deep.txt", "/app/222", "/home/community/222")).toBe(
      "/home/community/222/sub/deep.txt",
    )
  })
})

