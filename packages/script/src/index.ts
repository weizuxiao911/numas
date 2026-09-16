import { $ } from "bun"
import semver from "semver"
import path from "path"

const rootPkgPath = path.resolve(import.meta.dir, "../../../package.json")
const rootPkg = await Bun.file(rootPkgPath).json()
const expectedBunVersion = rootPkg.packageManager?.split("@")[1]

if (!expectedBunVersion) {
  throw new Error("packageManager field not found in root package.json")
}

// relax version requirement
const expectedBunVersionRange = `^${expectedBunVersion}`

if (!semver.satisfies(process.versions.bun, expectedBunVersionRange)) {
  throw new Error(`This script requires bun@${expectedBunVersionRange}, but you are using bun@${process.versions.bun}`)
}

const env = {
  OPENCODE_CHANNEL: process.env["OPENCODE_CHANNEL"],
  OPENCODE_BUMP: process.env["OPENCODE_BUMP"],
  OPENCODE_VERSION: process.env["OPENCODE_VERSION"],
  OPENCODE_RELEASE: process.env["OPENCODE_RELEASE"],
}
const CHANNEL = await (async () => {
  if (env.OPENCODE_CHANNEL) return env.OPENCODE_CHANNEL
  if (env.OPENCODE_BUMP) return "latest"
  if (env.OPENCODE_VERSION && !env.OPENCODE_VERSION.startsWith("0.0.0-")) return "latest"
  return await $`git branch --show-current`.text().then((x) => x.trim())
})()
const IS_PREVIEW = CHANNEL !== "latest"

// numas fork 版本命名: numas-v<major>.<minor>.<patch>-<UTC yyyyMMddHHmm>.
// version.json 在 numas 根 (上溯 4 层), 维护 major/minor (人工) + patch (构建时自增, 每次构建 +1, 持久化回写).
// 读不到兜底 0.0.0. 时间戳取构建瞬间 UTC, 保证每次构建可追溯.
const VERSION_FILE = path.resolve(import.meta.dir, "../../../version.json")
const NUMAS_VERSION = await (async () => {
  try {
    const v = (await Bun.file(VERSION_FILE).json()) as { major?: number; minor?: number; patch?: number }
    const major = typeof v.major === "number" ? v.major : 0
    const minor = typeof v.minor === "number" ? v.minor : 0
    const patch = (typeof v.patch === "number" ? v.patch : 0) + 1
    await Bun.write(VERSION_FILE, JSON.stringify({ major, minor, patch }, null, 2) + "\n")
    return `${major}.${minor}.${patch}`
  } catch {
    return "0.0.0"
  }
})()

const VERSION = await (async () => {
  if (env.OPENCODE_VERSION) return env.OPENCODE_VERSION
  if (IS_PREVIEW) {
    const ts = new Date().toISOString().slice(0, 16).replace(/[-:T]/g, "")
    // numas: 覆盖 upstream 的 0.0.0-<channel>-<ts>, 用 numas-标识 + v<仓库版本>-<ts> (fork 产物可识别)
    return `numas-v${NUMAS_VERSION}-${ts}`
  }
  const version = await fetch("https://registry.npmjs.org/opencode-ai/latest")
    .then((res) => {
      if (!res.ok) throw new Error(res.statusText)
      return res.json()
    })
    .then((data: any) => data.version)
  const [major, minor, patch] = version.split(".").map((x: string) => Number(x) || 0)
  const t = env.OPENCODE_BUMP?.toLowerCase()
  if (t === "major") return `${major + 1}.0.0`
  if (t === "minor") return `${major}.${minor + 1}.0`
  return `${major}.${minor}.${patch + 1}`
})()

const bot = ["actions-user", "opencode", "opencode-agent[bot]"]
const teamPath = path.resolve(import.meta.dir, "../../../.github/TEAM_MEMBERS")
// numas fork: numas 把 .github/ 整目录 gitignore 掉了, 文件可能不存在.
// 读不到时兜底为空数组, 不影响主流程 (team 只用于 release metadata).
const team = [
  ...(await Bun.file(teamPath)
    .text()
    .then((x) => x.split(/\r?\n/).map((x) => x.trim()))
    .then((x) => x.filter((x) => x && !x.startsWith("#")))
    .catch(() => [])),
  ...bot,
]

export const Script = {
  get channel() {
    return CHANNEL
  },
  get version() {
    return VERSION
  },
  get preview() {
    return IS_PREVIEW
  },
  get release(): boolean {
    return !!env.OPENCODE_RELEASE
  },
  get team() {
    return team
  },
}
console.log(`opencode script`, JSON.stringify(Script, null, 2))
