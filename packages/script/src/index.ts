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

// numas fork: 版本号固定用官方 opencode 版本号, 使发给 provider 的 UA 呈官方形态.
//   原因: UA 构造见 packages/opencode/src/session/llm/request.ts (`opencode/${InstallationVersion}`);
//   opencode Console 免费模型按 UA 判定请求来源, numas-v<...> 这类定制版本号会被拒:
//   "OpenCode's free tier can only be used from within OpenCode".
//   (原逻辑为 numas-v<仓库版本>-<UTC时间戳>, 便于 fork 产物识别/追溯; 如需回滚恢复该段即可.)
const NUMAS_VERSION = "1.18.30"

const VERSION = await (async () => {
  // numas fork: 版本生成按我们自己的规则 —— UA 声称的版本由我们固定 (NUMAS_VERSION),
  //   不再拉上游 npm / 不按上游 bump (避免网络依赖 + 上游变动影响构建 + 自升级到上游).
  //   我们自己的应用版本见 APP_VERSION (packages/tauri/version.json), 用于升级判断/展示.
  if (env.OPENCODE_VERSION) return env.OPENCODE_VERSION
  return NUMAS_VERSION
})()

// numas fork: numas 应用版本 (读 packages/tauri/version.json), 与 UA 用的官方版本号分离.
//   用途: 升级判断 (对比我们自己的 release), 不用官方 opencode 版本号 (避免自升级到上游).
const APP_VERSION = await Bun.file(path.resolve(import.meta.dir, "../../tauri/version.json"))
  .json()
  .then((v: any) => (typeof v?.major === "number" ? `${v.major}.${v.minor}.${v.patch}` : ""))
  .catch(() => "")

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
  /** numas 应用版本 (packages/tauri/version.json), 升级判断用; 空 = 非 numas 构建 */
  get appVersion() {
    return APP_VERSION
  },
  get release(): boolean {
    return !!env.OPENCODE_RELEASE
  },
  get team() {
    return team
  },
}
console.log(`opencode script`, JSON.stringify(Script, null, 2))
