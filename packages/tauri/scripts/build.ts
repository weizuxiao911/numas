import { $ } from "bun"
import { join } from "node:path"

await import("./prepare")

const version = (await Bun.file(join(import.meta.dir, "../../../version.json")).json()) as {
  major: number
  minor: number
  patch: number
}
const semver = `${version.major}.${version.minor}.${version.patch}`

await $`bunx @tauri-apps/cli build --config ${JSON.stringify({ version: semver })}`.cwd(
  join(import.meta.dir, ".."),
)
