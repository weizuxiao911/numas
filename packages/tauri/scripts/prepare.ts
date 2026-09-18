import { $ } from "bun"
import { chmod, copyFile, mkdir } from "node:fs/promises"
import { join } from "node:path"

const root = join(import.meta.dir, "../../..")
const pkg = join(import.meta.dir, "..")

const targets = {
  "aarch64-apple-darwin": { dir: "numas-darwin-arm64", exe: "numas" },
  "x86_64-apple-darwin": { dir: "numas-darwin-x64", exe: "numas" },
  "aarch64-pc-windows-msvc": { dir: "numas-windows-arm64", exe: "numas.exe" },
  "x86_64-pc-windows-msvc": { dir: "numas-windows-x64", exe: "numas.exe" },
  "aarch64-unknown-linux-gnu": { dir: "numas-linux-arm64", exe: "numas" },
  "x86_64-unknown-linux-gnu": { dir: "numas-linux-x64", exe: "numas" },
} as const

function hostTriple() {
  if (process.platform === "darwin") return process.arch === "arm64" ? "aarch64-apple-darwin" : "x86_64-apple-darwin"
  if (process.platform === "win32") return process.arch === "arm64" ? "aarch64-pc-windows-msvc" : "x86_64-pc-windows-msvc"
  if (process.platform === "linux") return process.arch === "arm64" ? "aarch64-unknown-linux-gnu" : "x86_64-unknown-linux-gnu"
  throw new Error(`unsupported host platform: ${process.platform}-${process.arch}`)
}

async function copySidecar(triple: string, dest: string) {
  const entry = targets[triple as keyof typeof targets]
  if (!entry) throw new Error(`unsupported target: ${triple}`)
  const source = join(root, "packages", "opencode", "dist", entry.dir, "bin", entry.exe)
  if (!(await Bun.file(source).exists())) {
    throw new Error(`missing numas CLI binary: ${source}\n先构建: cd packages/opencode && NUMAS_TARGET=... bun run script/build.ts`)
  }
  await copyFile(source, dest)
  if (!dest.endsWith(".exe")) await chmod(dest, 0o755)
}

export async function prepare(target?: string) {
  const triple = target ?? hostTriple()
  const destDir = join(pkg, "binaries")
  await mkdir(destDir, { recursive: true })

  if (triple === "universal-apple-darwin") {
    const archs = [
      ["aarch64-apple-darwin", join(destDir, "numas-aarch64-apple-darwin")],
      ["x86_64-apple-darwin", join(destDir, "numas-x86_64-apple-darwin")],
    ] as const
    for (const [arch, dest] of archs) {
      if (!(await Bun.file(dest).exists())) await copySidecar(arch, dest)
    }
    const dest = join(destDir, "numas-universal-apple-darwin")
    await $`lipo -create ${archs[0][1]} ${archs[1][1]} -output ${dest}`
    await chmod(dest, 0o755)
    console.log(`[numas] universal sidecar ready: ${dest}`)
    return
  }

  const dest = join(destDir, `numas-${triple}${triple.includes("windows") ? ".exe" : ""}`)
  await copySidecar(triple, dest)
  console.log(`[numas] sidecar ready: ${dest}`)
}

if (import.meta.main) {
  const index = process.argv.indexOf("--target")
  await prepare(index === -1 ? undefined : process.argv[index + 1])
}
