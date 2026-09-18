import { chmod, copyFile, mkdir } from "node:fs/promises"
import { join } from "node:path"

const root = join(import.meta.dir, "../../..")
const pkg = join(import.meta.dir, "..")

const targets: Record<string, { dir: string; triple: string }> = {
  "darwin-arm64": { dir: "numas-darwin-arm64", triple: "aarch64-apple-darwin" },
  "darwin-x64": { dir: "numas-darwin-x64", triple: "x86_64-apple-darwin" },
  "win32-arm64": { dir: "numas-windows-arm64", triple: "aarch64-pc-windows-msvc" },
  "win32-x64": { dir: "numas-windows-x64", triple: "x86_64-pc-windows-msvc" },
  "linux-arm64": { dir: "numas-linux-arm64", triple: "aarch64-unknown-linux-gnu" },
  "linux-x64": { dir: "numas-linux-x64", triple: "x86_64-unknown-linux-gnu" },
}

const key = `${process.platform}-${process.arch}`
const target = targets[key]
if (!target) throw new Error(`unsupported host platform: ${key}`)

const exe = process.platform === "win32" ? "numas.exe" : "numas"
const source = join(root, "packages", "opencode", "dist", target.dir, "bin", exe)
if (!(await Bun.file(source).exists())) {
  throw new Error(
    `missing numas CLI binary: ${source}\n先构建: cd packages/opencode && bun run build --single`,
  )
}

const destDir = join(pkg, "binaries")
await mkdir(destDir, { recursive: true })
const dest = join(destDir, `numas-${target.triple}${process.platform === "win32" ? ".exe" : ""}`)
await copyFile(source, dest)
if (process.platform !== "win32") await chmod(dest, 0o755)
console.log(`[numas] sidecar ready: ${dest}`)
