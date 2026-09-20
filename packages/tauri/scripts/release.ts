#!/usr/bin/env bun
/**
 * release.ts — numas Tauri 桌面壳打包分发 (全平台 arm/amd)
 *
 * 规则 (单一事实源, 升级版本只改 version.json, 本脚本自动适配):
 *   1. 版本号:  读 ../version.json (major.minor.patch), 不写死.
 *   2. tag:     `numas-v<semver>-<YYYYMMDDHHMM>` (与现有 release 规律一致).
 *   3. 产物定位: target/<triple>/release/bundle/<type>/... (Tauri `bundle.targets=all`).
 *   4. asset 命名: 连字符规范, 平台用 darwin/windows/linux (与现有 CLI 资产
 *                numas-darwin-arm64.zip 命名一致), 架构 arm64/x64, 无版本号:
 *                  darwin : numas-darwin-arm64.dmg / numas-darwin-x64.dmg
 *                  windows: numas-windows-arm64.msi / numas-windows-x64.msi
 *                           (+ numas-windows-arm64.exe / numas-windows-x64.exe, 若产出)
 *                  linux  : numas-linux-arm64.AppImage / numas-linux-x64.AppImage
 *                           (+ .deb / .rpm, 若产出)
 *   注意: Tauri 内部 triple 是 aarch64-apple-darwin / x86_64-... (含 apple), 发布
 *         asset 一律用 darwin/windows/linux, 不把 apple 带进文件名.
 *   5. 发布:   新建 release + 上传; 同 tag 已存在则追加/更新资产 (幂等).
 *              Release title = 只写版本号 (v<semver>); notes 从 CHANGELOG.md 对应段读.
 *
 * 用法:
 *   bun run scripts/release.ts               # 发布本机可构建的所有已存在产物 (默认)
 *   bun run scripts/release.ts --platform mac|win|linux   # 只发指定平台
 *   bun run scripts/release.ts --arm64 / --x64            # 只发指定架构
 *   bun run scripts/release.ts --dry-run      # 只打印将上传文件, 不上传
 *
 * 前置: 已先跑 `bun run build[:<target>]` 产出安装包; gh CLI 已登录.
 * 注: POC 阶段仅本机 (macOS) 能构建 darwin dmg; win/linux 产物依赖对应 OS 或 CI 构建.
 */

import { $ } from "bun"
import { copyFile, mkdir, readdir, stat } from "node:fs/promises"
import { join } from "node:path"

const root = join(import.meta.dir, "../../..")
const pkg = join(import.meta.dir, "..")

const args = process.argv.slice(2)
const ONLY_ARM64 = args.includes("--arm64")
const ONLY_X64 = args.includes("--x64")
const ONLY_PLATFORM = ["mac", "win", "linux"].find((p) => args.includes(`--platform ${p}`)) ?? null
const DRY_RUN = args.includes("--dry-run")

/** 各平台 × 架构 → 产物定位 (glob 相对 bundle 目录) + 连字符 asset 名.
 *  Tauri 2 产物类型: darwin=dmg; windows=msi(+nsis exe); linux=appimage/deb/rpm. */
const INSTALLERS = [
  {
    platform: "mac", triple: "aarch64-apple-darwin", arch: "arm64",
    bundles: ["dmg"],
    assets: (t: string, ver: string) => [
      { name: "numas-darwin-arm64.dmg", glob: `**/numas_${ver}_aarch64.dmg` },
    ],
  },
  {
    platform: "mac", triple: "x86_64-apple-darwin", arch: "x64",
    bundles: ["dmg"],
    assets: (t: string, ver: string) => [
      { name: "numas-darwin-x64.dmg", glob: `**/numas_${ver}_x64.dmg` },
    ],
  },
  {
    platform: "win", triple: "aarch64-pc-windows-msvc", arch: "arm64",
    bundles: ["msi", "nsis"],
    assets: (t: string, ver: string) => [
      { name: "numas-windows-arm64.msi", glob: `**/*${t}*arm64*.msi` },
      { name: "numas-windows-arm64.exe", glob: `**/*${t}*arm64*.exe` },
    ],
  },
  {
    platform: "win", triple: "x86_64-pc-windows-msvc", arch: "x64",
    bundles: ["msi", "nsis"],
    assets: (t: string, ver: string) => [
      { name: "numas-windows-x64.msi", glob: `**/*${t}*x64*.msi` },
      { name: "numas-windows-x64.exe", glob: `**/*${t}*x64*.exe` },
    ],
  },
  {
    platform: "linux", triple: "aarch64-unknown-linux-gnu", arch: "arm64",
    bundles: ["appimage", "deb", "rpm"],
    assets: (t: string, ver: string) => [
      { name: "numas-linux-arm64.AppImage", glob: `**/*${t}*arm64*.AppImage` },
      { name: "numas-linux-arm64.deb", glob: `**/*${t}*arm64*.deb` },
    ],
  },
  {
    platform: "linux", triple: "x86_64-unknown-linux-gnu", arch: "x64",
    bundles: ["appimage", "deb", "rpm"],
    assets: (t: string, ver: string) => [
      { name: "numas-linux-x64.AppImage", glob: `**/*${t}*x64*.AppImage` },
      { name: "numas-linux-x64.deb", glob: `**/*${t}*x64*.deb` },
    ],
  },
] as const

function nowStamp(): string {
  const d = new Date()
  const p = (n: number) => String(n).padStart(2, "0")
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}${p(d.getHours())}${p(d.getMinutes())}`
}

/** 从 packages/tauri/CHANGELOG.md 读 `## [<semver>]` 段正文 (不含标题行), 供 Release notes 用. */
async function readChangelogSection(semver: string): Promise<string> {
  const file = join(pkg, "CHANGELOG.md")
  const content = await Bun.file(file).text().catch(() => "")
  const lines = content.split(/\r?\n/)
  const start = lines.findIndex((l) => l.startsWith(`## [${semver}]`))
  if (start === -1) return ""
  let end = lines.length
  for (let i = start + 1; i < lines.length; i++) {
    if (lines[i].startsWith("## [")) {
      end = i
      break
    }
  }
  return lines.slice(start + 1, end).join("\n").trim()
}

/** 在 target/<triple>/release/bundle/<type> 下按 glob 递归找唯一文件 */
async function locateAsset(triple: string, glob: string): Promise<string | null> {
  const base = join(pkg, "target", triple, "release", "bundle")
  const dir = await stat(base).catch(() => null)
  if (!dir?.isDirectory()) return null
  const matches = await Array.fromAsync(
    new Bun.Glob(glob).scan({ cwd: base, absolute: true, onlyFiles: true }),
  )
  return matches[0] ?? null
}

interface Found {
  asset: string
  src: string
  size: number
  platform: string
  arch: string
}

async function main() {
  const version = (await Bun.file(join(pkg, "version.json")).json()) as {
    major: number
    minor: number
    patch: number
  }
  const semver = `${version.major}.${version.minor}.${version.patch}`
  const tag = `numas-v${semver}-${nowStamp()}`
  /** Release title: 只写版本号 (用户规范) */
  const title = `v${semver}`
  /** Release notes: 从 CHANGELOG.md 读当前版本段 (§ 段内容) */
  const notes = await readChangelogSection(semver)

  if (!notes) {
    console.warn(`[release] 警告: CHANGELOG.md 无 [${semver}] 段, notes 留空 (记得维护)`)
  }

  const found: Found[] = []
  const missing: string[] = []

  for (const inst of INSTALLERS) {
    if (ONLY_PLATFORM && inst.platform !== ONLY_PLATFORM) continue
    if (ONLY_ARM64 && inst.arch !== "arm64") continue
    if (ONLY_X64 && inst.arch !== "x64") continue
    for (const asset of inst.assets(inst.triple, semver)) {
      const src = await locateAsset(inst.triple, asset.glob)
      if (src) {
        const s = await stat(src)
        found.push({ asset: asset.name, src, size: s.size, platform: inst.platform, arch: inst.arch })
        console.log(`[release] 找到: ${asset.name} (${(s.size / 1024 / 1024).toFixed(1)} MB)`)
      } else {
        missing.push(`${inst.platform}-${inst.arch} ${asset.name}`)
      }
    }
  }

  if (missing.length) {
    console.log(`\n[release] 缺失 (跳过): ${missing.join(", ")}`)
  }
  if (!found.length) {
    throw new Error("没有可发布的安装包 (请先构建)")
  }

  console.log(`\n[release] version: ${semver}`)
  console.log(`[release] tag:     ${tag}`)
  console.log(`[release] title:   ${title}`)
  console.log(`[release] notes:   ${notes ? notes.split("\n").length + " 行 (来自 CHANGELOG.md)" : "(空)"}`)
  console.log(`[release] 将上传: ${found.map((f) => f.asset).join(", ")}`)

  if (DRY_RUN) {
    console.log("\n[dry-run] 以上为将上传内容, 未执行发布")
    return
  }

  const repo = "weizuxiao911/numas"
  const existing = await $`gh release view ${tag} --repo ${repo} --json tagName --jq .tagName`.nothrow()
  if (existing.exitCode !== 0) {
    console.log(`\n[release] 创建 release ${tag} (title: ${title}) ...`)
    if (notes) {
      await $`gh release create ${tag} --repo ${repo} --title ${title} --notes ${notes}`.cwd(root)
    } else {
      await $`gh release create ${tag} --repo ${repo} --title ${title}`.cwd(root)
    }
  } else {
    console.log(`\n[release] tag ${tag} 已存在, 追加资产 ...`)
  }

  // 注意: gh release upload 的 `file#label` 只是显示标签, 不改 asset 文件名.
  // 必须先把产物复制/重命名为规范 asset 名再上传, 否则 asset 会保留 Tauri 原名.
  const stageDir = join(root, ".tmp", "numas-release")
  await mkdir(stageDir, { recursive: true })
  for (const f of found) {
    const staged = join(stageDir, f.asset)
    await copyFile(f.src, staged)
    console.log(`[release] 上传 ${f.asset} ...`)
    await $`gh release upload ${tag} ${staged} --repo ${repo} --clobber`
  }

  console.log("\n[release] 完成 ✅")
  console.log(`查看: https://github.com/${repo}/releases/tag/${tag}`)
}

void main().catch((e) => {
  console.error(`[release] 失败: ${e.message}`)
  process.exit(1)
})
