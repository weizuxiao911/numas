import { afterEach, describe, expect, test } from "bun:test"
import { Context, Effect } from "effect"
import path from "path"
import { HttpApiApp } from "../../src/server/routes/instance/httpapi/server"
import { FilePaths } from "../../src/server/routes/instance/httpapi/groups/file"
import { resetDatabase } from "../fixture/db"
import { disposeAllInstances, tmpdir } from "../fixture/fixture"
import { pollWithTimeout } from "../lib/effect"

const context = Context.empty() as Context.Context<unknown>

function request(route: string, directory: string, query?: Record<string, string>) {
  const url = new URL(`http://localhost${route}`)
  for (const [key, value] of Object.entries(query ?? {})) {
    url.searchParams.set(key, value)
  }
  return HttpApiApp.webHandler().handler(
    new Request(url, {
      headers: {
        "x-opencode-directory": directory,
      },
    }),
    context,
  )
}

afterEach(async () => {
  await disposeAllInstances()
  await resetDatabase()
})

describe("file HttpApi", () => {
  test("serves read endpoints", async () => {
    await using tmp = await tmpdir({ git: true })
    await Bun.write(path.join(tmp.path, "hello.txt"), "hello")

    const [list, content, status] = await Promise.all([
      request(FilePaths.list, tmp.path, { path: "." }),
      request(FilePaths.content, tmp.path, { path: "hello.txt" }),
      request(FilePaths.status, tmp.path),
    ])

    expect(list.status).toBe(200)
    expect(await list.json()).toContainEqual(
      expect.objectContaining({ name: "hello.txt", path: "hello.txt", type: "file" }),
    )

    expect(content.status).toBe(200)
    expect(await content.json()).toMatchObject({ type: "text", content: "hello" })

    expect(status.status).toBe(200)
    expect(await status.json()).toEqual([])
  })

  test("serves search endpoints", async () => {
    await using tmp = await tmpdir({ git: true })
    await Bun.write(path.join(tmp.path, "hello.txt"), "needle")

    const [text, symbols] = await Promise.all([
      request(FilePaths.findText, tmp.path, { pattern: "needle" }),
      request(FilePaths.findSymbol, tmp.path, { query: "hello" }),
    ])
    const files = await Effect.runPromise(
      pollWithTimeout(
        Effect.promise(async () => {
          const response = await request(FilePaths.findFile, tmp.path, { query: "hello", type: "file" })
          const body = await response.json()
          return body.includes("hello.txt") ? { response, body } : undefined
        }),
        "file search index was not ready",
      ),
    )

    expect(text.status).toBe(200)
    expect(await text.json()).toContainEqual(expect.objectContaining({ line_number: 1 }))

    expect(files.response.status).toBe(200)
    expect(files.body).toContain("hello.txt")

    expect(symbols.status).toBe(200)
    expect(await symbols.json()).toEqual([])
  })

  // numas: symlink workspace 端到端: x-opencode-directory 传 logical 路径, 服务端物理化
  // 后建立 real→logical 映射. V1 handler 必须正确走 logical 维度.
  // 注: 直接 in-process 测 real 物理路径 + 手动注入 LogicalDirectoryRegistry, 不创建
  // 真实 symlink. 原因是 in-process webHandler + tmpdir fixture 之间存在 symlink 生命
  // 周期不一致 (request 处理期间 logical symlink 会被某 cleanup 路径误删, 详见排查笔记).
  // handler 行为只依赖 LogicalDirectoryRegistry 反查 + 字符串拼接, 不需要真 symlink.
  describe("logical path semantics", () => {
    test("list returns absolute paths joined with logical instance dir", async () => {
      await using tmp = await tmpdir({ git: true })
      // numas: 手动注入 logicalDirectory 反查映射, 模拟 symlink workspace 行为
      const real = tmp.path
      const logical = path.join(path.dirname(real), `logical_${path.basename(real)}`)
      const { LogicalDirectoryRegistry } = await import(
        "../../src/project/logical-directory-registry"
      )
      LogicalDirectoryRegistry.set(real, logical)
      try {
        await Bun.write(path.join(real, "hello.txt"), "hello")
        const response = await request(FilePaths.list, real, { path: "." })
        expect(response.status).toBe(200)
        const items = (await response.json()) as Array<{ name: string; absolute: string }>
        const hello = items.find((i) => i.name === "hello.txt")
        // numas: absolute 字段必须用 logical base 拼 (LogicalDirectoryRegistry 反查)
        // 而不是 real path, 跟 explorer tree 一致
        expect(hello?.absolute).toBe(path.join(logical, "hello.txt"))
        // 不能是 real path
        expect(hello?.absolute).not.toBe(path.join(real, "hello.txt"))
      } finally {
        LogicalDirectoryRegistry.delete(real)
      }
    })

    test("content rejects path escape via logical boundary", async () => {
      await using tmp = await tmpdir({ git: true })
      const real = tmp.path
      const logical = path.join(path.dirname(real), `logical_${path.basename(real)}`)
      const { LogicalDirectoryRegistry } = await import(
        "../../src/project/logical-directory-registry"
      )
      LogicalDirectoryRegistry.set(real, logical)
      try {
        // 越界: 试图从 logical 路径逃逸, 旧实现 (boundary check 走 real) 会通过,
        // 新实现 (boundary check 走 logical) 应拒绝
        const response = await request(FilePaths.content, real, { path: "../../../etc/passwd" })
        // 越界 → 5xx, 不应 200
        expect(response.status).not.toBe(200)
      } finally {
        LogicalDirectoryRegistry.delete(real)
      }
    })

    test("findText returns match path as logical-relative when logical differs from real", async () => {
      await using tmp = await tmpdir({ git: true })
      const real = tmp.path
      const logical = path.join(path.dirname(real), `logical_${path.basename(real)}`)
      const { LogicalDirectoryRegistry } = await import(
        "../../src/project/logical-directory-registry"
      )
      LogicalDirectoryRegistry.set(real, logical)
      try {
        await Bun.write(path.join(real, "needle.txt"), "needle in haystack")
        const response = await request(FilePaths.findText, real, { pattern: "needle" })
        expect(response.status).toBe(200)
        const matches = (await response.json()) as Array<{ path: { text: string } }>
        expect(matches.length).toBeGreaterThan(0)
        // numas: match.path.text 必须是 cwd-relative 转 logical 后的结果
        // 旧实现: 直接用 ripgrep 输出 (cwd-relative = "needle.txt"), 跟 logical
        // 反查拼不出区别; 新实现: 拼 real abs → realToLogical(real, logical) → "needle.txt"
        // 两者恰好都是 "needle.txt" 因为文件在 workspace 根, 但调用路径不同
        // 关键验证: 必须不报 5xx, 必须有 match
        expect(matches[0]?.path.text).toBe("needle.txt")
      } finally {
        LogicalDirectoryRegistry.delete(real)
      }
    })

    test("non-symlink workspace (no logical registered) falls back to real", async () => {
      // numas: LogicalDirectoryRegistry 没设时 (非 symlink workspace), logicalInstanceDir
      // fallback 到 real, 行为与原版一致
      await using tmp = await tmpdir({ git: true })
      await Bun.write(path.join(tmp.path, "hello.txt"), "hello")
      const response = await request(FilePaths.content, tmp.path, { path: "hello.txt" })
      expect(response.status).toBe(200)
      expect(await response.json()).toMatchObject({ type: "text", content: "hello" })
    })
  })
})
