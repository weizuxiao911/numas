import { $ } from "bun"
import { join } from "node:path"

import { prepare } from "./prepare"

const index = process.argv.indexOf("--target")
const target = index === -1 ? undefined : process.argv[index + 1]

await prepare(target)

if (process.platform === "darwin" && !process.env.APPLE_SIGNING_IDENTITY) {
  process.env.APPLE_SIGNING_IDENTITY = "-"
}

const version = (await Bun.file(join(import.meta.dir, "../version.json")).json()) as {
  major: number
  minor: number
  patch: number
}
const semver = `${version.major}.${version.minor}.${version.patch}`

// bundle id 固定 dev.numas.app (见 tauri.conf.json); 无 Dock 靠 Info.plist 静态
// LSUIElement=true, 不依赖运行时 Accessory 切换, 无需每版换 id (2026-09-20 决策).
const configOverride = {
  version: semver,
}

await $`bunx @tauri-apps/cli build ${target ? ["--target", target] : []} --config ${JSON.stringify(configOverride)}`.cwd(
  join(import.meta.dir, ".."),
)
