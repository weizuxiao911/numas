// 浏览器端唤起本地 numas 服务的真实机制 (参考 test/launch.html):
//   1. 健康探测 GET http://localhost:4096/health (no-cors)
//   2. 若 down:通过 iframe 触发 numas://serve?port=4096 scheme
//   3. 轮询直到服务起来或超时
//   4. 服务起来后跳转到 http://localhost:4096/ (numas serve 内置 Web IDE)
//
// POC 环境无法真的唤起 numas 应用,所以保留真实逻辑 + 提供「模拟就绪」逃生口。

import type { ServiceHealth } from "@/types"

export const NUMAS_PORT = 4096
export const NUMAS_URL = `http://localhost:${NUMAS_PORT}`
export const NUMAS_SCHEME = `numas://serve?port=${NUMAS_PORT}`
export const HEALTH_URL = `${NUMAS_URL}/health`
const LAUNCH_TIMEOUT_MS = 8000
const POLL_INTERVAL_MS = 500

/** no-cors 健康探测:不读 body,只验 HTTP 可达性 */
export async function ping(timeoutMs = 1500): Promise<boolean> {
  const ctl = new AbortController()
  const t = setTimeout(() => ctl.abort(), timeoutMs)
  try {
    await fetch(HEALTH_URL, { mode: "no-cors", cache: "no-store", signal: ctl.signal })
    return true
  } catch {
    return false
  } finally {
    clearTimeout(t)
  }
}

export async function probe(): Promise<ServiceHealth> {
  const up = await ping()
  if (up) return { status: "up", url: NUMAS_URL }
  return { status: "down" }
}

/** 通过 iframe 触发 numas:// scheme,浏览器无 JS API 直接启动 app */
export function fireScheme() {
  try {
    const iframe = document.createElement("iframe")
    iframe.style.cssText = "display:none;width:0;height:0;border:0;"
    iframe.src = NUMAS_SCHEME
    document.body.appendChild(iframe)
    setTimeout(() => {
      try {
        iframe.remove()
      } catch {}
    }, 3000)
  } catch (e) {
    console.warn("[launch] scheme failed", e)
  }
}

export async function pollUntilUp(maxAttempts = LAUNCH_TIMEOUT_MS / POLL_INTERVAL_MS, intervalMs = POLL_INTERVAL_MS) {
  for (let i = 0; i < maxAttempts; i++) {
    if (await ping()) return i
    await new Promise((r) => setTimeout(r, intervalMs))
  }
  return -1
}

/** 真实唤起流程:fire scheme + 轮询健康探测 */
export async function launchAndWait(): Promise<{ ok: boolean; elapsedMs: number }> {
  const before = Date.now()
  fireScheme()
  const attempts = await pollUntilUp()
  return { ok: attempts >= 0, elapsedMs: Date.now() - before }
}

/** OS/arch 识别 (匹配 launch.html) */
export function detectOS(): { os: "macos" | "linux" | "windows"; arch: "arm64" | "x64" } {
  const ua = navigator.userAgent
  const platform = navigator.platform || ""
  let os: "macos" | "linux" | "windows" = "macos"
  let arch: "arm64" | "x64" = "arm64"
  if (/Windows/i.test(platform) || /Win64/i.test(ua)) {
    os = "windows"
    arch = "x64"
  } else if (/Linux/i.test(platform) || /Linux/i.test(ua)) {
    os = "linux"
    arch = "x64"
    if (/aarch64|arm64/i.test(ua)) arch = "arm64"
  } else {
    if (/Mac OS X/i.test(ua) && /Intel/.test(platform)) arch = "x64"
    if (/Mac OS X/i.test(ua) && /arm64/i.test(ua)) arch = "arm64"
  }
  return { os, arch }
}

export function buildDownloadUrl(det = detectOS()): string {
  const repo = "weizuxiao911/numas"
  if (det.os === "macos") {
    return det.arch === "arm64"
      ? `https://github.com/${repo}/releases/latest/download/numas-darwin-arm64.zip`
      : `https://github.com/${repo}/releases/latest/download/numas-darwin-x64.zip`
  }
  if (det.os === "windows") {
    return `https://github.com/${repo}/releases/latest/download/numas-windows-x64.zip`
  }
  return det.arch === "arm64"
    ? `https://github.com/${repo}/releases/latest/download/numas-linux-arm64.tar.gz`
    : `https://github.com/${repo}/releases/latest/download/numas-linux-x64.zip`
}

/** POC 逃生口:本地没装 numas 时,直接标记为就绪并继续流程 */
export function mockUp(): ServiceHealth {
  return { status: "up", url: NUMAS_URL, version: "poc-mock" }
}
