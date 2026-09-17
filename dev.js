#!/usr/bin/env node
/**
 * numas-dev dev.js — 集成模式入口
 *
 * 流程:
 *   1. packages/codeblitz npm install (--workspaces=false 跳过 root workspaces)
 *      → build → dist/
 *   2. 启 opencode serve --web-ui packages/codeblitz/dist (detached)
 *   3. /global/health 探活 → 打印 URL → spawn 'open' 开浏览器
 *   4. SIGINT/SIGTERM → kill 整组 process group
 *
 * CLI:
 *   --port <n>     opencode 端口 (默认 24096, env NUMAS_DEV_PORT)
 *   --no-open      不自动开浏览器
 *   --fast         跳过 codeblitz install + build (复用现有产物)
 *
 * 注: 浏览器只开根 URL, 不塞 ?directory=. codeblitz 自己负责项目选择 (URL 一次性入口
 *     + localStorage 兜底, 见 packages/codeblitz/src/infra/url.ts). dev.js 越权选项目
 *     会绕开 codeblitz 的选择 UI.
 */

import { spawn, spawnSync } from "node:child_process"
import crypto from "node:crypto"
import fs from "node:fs"
import http from "node:http"
import path from "node:path"

const ROOT = import.meta.dirname
const CODEBLITZ = path.join(ROOT, "packages", "codeblitz")
const CODEBLITZ_DIST = path.join(CODEBLITZ, "dist")

function parseFlag(flag, fallback) {
  const i = process.argv.indexOf(flag)
  if (i >= 0 && process.argv[i + 1]) return process.argv[i + 1]
  return fallback
}
function parseFlagInt(flag, fallback) {
  const v = parseFlag(flag, null)
  if (v == null) {
    const n = parseInt(fallback, 10)
    return isNaN(n) ? NaN : n
  }
  const n = parseInt(v, 10)
  return isNaN(n) || n <= 0 ? NaN : n
}

const PORT = parseFlagInt("--port", process.env.NUMAS_DEV_PORT || "24096")
const FAST = process.argv.includes("--fast")
const NO_OPEN = process.argv.includes("--no-open")

if (isNaN(PORT)) {
  console.error(`[dev] --port 必须是正整数: ${parseFlag("--port", "")}`)
  process.exit(1)
}

const isWin = process.platform === "win32"

function fileSha256(p) {
  try {
    return crypto.createHash("sha256").update(fs.readFileSync(p)).digest("hex")
  } catch {
    return ""
  }
}
function readMarker(p) {
  try {
    return fs.readFileSync(p, "utf8").trim()
  } catch {
    return ""
  }
}

function runStep(label, cmd, args, opts = {}) {
  console.log(`[dev] ${label}`)
  const t0 = Date.now()
  const r = spawnSync(cmd, args, { stdio: "inherit", ...opts })
  if (r.status !== 0) {
    console.error(`[dev] ${label} 失败 (status=${r.status})`)
    process.exit(r.status ?? 1)
  }
  console.log(`[dev]   ${label} 完成 (${((Date.now() - t0) / 1000).toFixed(1)}s)`)
}

// --------------------------------------------------------------------------
// 1. codeblitz install + build → dist/  (都已产物则跳过, 默认不重跑)
// --------------------------------------------------------------------------
const installMarker = path.join(CODEBLITZ, "node_modules", ".numas-dev-install-hash")
const buildMarker = path.join(CODEBLITZ_DIST, ".numas-dev-build-hash")
const installHash = ["package.json", "package-lock.json"]
  .map((f) => fileSha256(path.join(CODEBLITZ, f)))
  .join("|")

function walkSrc(root) {
  const out = []
  function recur(dir) {
    let entries
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true })
    } catch {
      return
    }
    for (const e of entries) {
      if (e.name === "node_modules" || e.name === "dist" || e.name.startsWith(".")) continue
      const p = path.join(dir, e.name)
      if (e.isDirectory()) recur(p)
      else out.push(p)
    }
  }
  recur(root)
  return out
}
function buildHash() {
  const h = crypto.createHash("sha256")
  for (const f of ["package.json", "package-lock.json", "webpack.config.js", "tsconfig.json"]) {
    try {
      h.update(fs.readFileSync(path.join(CODEBLITZ, f)))
    } catch {
      h.update(f)
    }
  }
  for (const f of walkSrc(CODEBLITZ)) {
    try {
      h.update(fs.readFileSync(f))
    } catch {
      /* */
    }
  }
  return h.digest("hex")
}

if (FAST) {
  console.log("[dev] codeblitz install: --fast, 跳过")
} else if (readMarker(installMarker) === installHash && fs.existsSync(path.join(CODEBLITZ, "node_modules"))) {
  console.log("[dev] codeblitz install: 已产物, 跳过 (rm packages/codeblitz/node_modules/.numas-dev-install-hash 重跑)")
} else {
  // --workspaces=false: 不走 root workspaces (否则 npm 看 root package.json 的 catalog: protocol 报错)
  runStep(
    "codeblitz npm install",
    "npm",
    ["install", "--no-audit", "--no-fund", "--workspaces=false"],
    { cwd: CODEBLITZ },
  )
  try {
    fs.mkdirSync(path.join(CODEBLITZ, "node_modules"), { recursive: true })
    fs.writeFileSync(installMarker, installHash)
  } catch {
    /* */
  }
}

if (FAST) {
  console.log("[dev] codeblitz build: --fast, 跳过")
} else if (readMarker(buildMarker) === buildHash() && fs.existsSync(path.join(CODEBLITZ_DIST, "index.html"))) {
  console.log("[dev] codeblitz build: 已产物, 跳过 (rm packages/codeblitz/dist/.numas-dev-build-hash 重跑)")
} else {
  runStep("codeblitz build", "npm", ["run", "build"], { cwd: CODEBLITZ })
  try {
    fs.mkdirSync(CODEBLITZ_DIST, { recursive: true })
    fs.writeFileSync(buildMarker, buildHash())
  } catch {
    /* */
  }
}

if (!fs.existsSync(path.join(CODEBLITZ_DIST, "index.html"))) {
  console.error(`[dev] codeblitz 产物缺 index.html: ${CODEBLITZ_DIST}`)
  console.error("[dev] 去掉 --fast 跑一次完整 build")
  process.exit(1)
}

// --------------------------------------------------------------------------
// 2. kill 占用端口 → 启 opencode serve (detached)
// --------------------------------------------------------------------------
function killPort(port) {
  try {
    let pids = []
    if (isWin) {
      const out = spawnSync("netstat", ["-ano"])
      for (const line of String(out.stdout || "").split("\n")) {
        const m = line.trim().split(/\s+/)
        if (m.length >= 5 && m[1].endsWith(`:${port}`) && /LISTENING/i.test(m[3])) {
          const pid = parseInt(m[4], 10)
          if (pid && !pids.includes(pid)) pids.push(pid)
        }
      }
    } else {
      const out = spawnSync("lsof", ["-ti", `:${port}`])
      pids = String(out.stdout || "")
        .split("\n")
        .map((s) => s.trim())
        .filter(Boolean)
        .map(Number)
    }
    for (const pid of pids) {
      if (pid === process.pid) continue
      try {
        process.kill(pid, "SIGKILL")
      } catch {
        /* */
      }
    }
    if (pids.length) console.log(`[dev] 清理端口 ${port} (${pids.length} 个 pid)`)
  } catch {
    /* ignore */
  }
}

console.log(`[dev] 启 opencode serve (port=${PORT}, web-ui=${CODEBLITZ_DIST})`)
killPort(PORT)

const opencodeProc = spawn(
  "bun",
  [
    "run",
    "--cwd",
    "packages/opencode",
    "--conditions",
    "browser",
    "src/index.ts",
    "serve",
    "--port",
    String(PORT),
    "--hostname",
    "127.0.0.1",
    "--web-ui",
    "../codeblitz/dist",
  ],
  { cwd: ROOT, stdio: "inherit", detached: true, shell: false },
)
if (!opencodeProc.pid) {
  console.error("[dev] opencode 启动失败 (no pid)")
  process.exit(1)
}
opencodeProc.on("error", (e) => console.warn("[dev] opencode spawn error:", e.message))
opencodeProc.on("exit", (code, sig) => {
  if (code !== 0 || sig) console.error(`[dev] opencode 异常退出 (code=${code}, signal=${sig})`)
})
console.log(`[dev] opencode pid=${opencodeProc.pid} (pgid=${opencodeProc.pid})`)

const cleanup = (signal) => {
  console.log(`[dev] cleanup (${signal || "exit"}) → kill opencode`)
  try {
    process.kill(-opencodeProc.pid, signal || "SIGTERM")
  } catch {
    /* */
  }
  setTimeout(() => process.exit(0), 3000)
}
process.on("SIGINT", () => cleanup("SIGINT"))
process.on("SIGTERM", () => cleanup("SIGTERM"))
process.on("exit", () => {
  try {
    process.kill(-opencodeProc.pid, "SIGTERM")
  } catch {
    /* */
  }
})

// --------------------------------------------------------------------------
// 3. /global/health 探活 → 开浏览器
// --------------------------------------------------------------------------
const targetUrl = `http://localhost:${PORT}/`
console.log(`[dev] 等待 server ready → ${targetUrl}`)
const t0 = Date.now()
const TIMEOUT = 30000
const POLL_MS = 200
let browserOpened = false
const probe = () => {
  if (browserOpened) return
  if (Date.now() - t0 > TIMEOUT) {
    console.error(`[dev] server 没起来 (${TIMEOUT}ms 超时), 手动访问: ${targetUrl}`)
    return
  }
  const req = http.get(`http://127.0.0.1:${PORT}/global/health`, (res) => {
    res.resume()
    if (res.statusCode === 200) {
      console.log(`[dev] server ready (${((Date.now() - t0) / 1000).toFixed(1)}s)`)
      browserOpened = true
      if (NO_OPEN) return
      try {
        spawn("open", [targetUrl], { detached: true, stdio: "ignore" }).unref()
      } catch {
        /* */
      }
    } else {
      setTimeout(probe, POLL_MS)
    }
  })
  req.on("error", () => setTimeout(probe, POLL_MS))
  req.setTimeout(POLL_MS, () => {
    req.destroy()
  })
}
probe()