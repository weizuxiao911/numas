import { $ } from "bun"
import { join } from "node:path"

import { prepare } from "./prepare"

const index = process.argv.indexOf("--target")
const target = index === -1 ? undefined : process.argv[index + 1]

await prepare(target)

const version = (await Bun.file(join(import.meta.dir, "../../../version.json")).json()) as {
  major: number
  minor: number
  patch: number
}
const semver = `${version.major}.${version.minor}.${version.patch}`

await $`bunx @tauri-apps/cli build ${target ? ["--target", target] : []} --config ${JSON.stringify({ version: semver })}`.cwd(
  join(import.meta.dir, ".."),
)
