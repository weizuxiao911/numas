import { appendFileSync, mkdirSync } from "node:fs"
import path from "node:path"
import { Global } from "@opencode-ai/core/global"

// TUI 诊断日志 → 文件, 绝不写 stdout/stderr.
// 原因: TUI 是全屏界面, 任何 stdout/stderr 输出都会冲掉画面 (历史上 ports 的 console.log 就干过).
// 排查 TUI 问题看 `~/.local/share/opencode/log/tui.log`.
function fmt(value: unknown): string {
  if (typeof value === "string") return value
  if (value instanceof Error) return value.stack ?? value.message
  try {
    return JSON.stringify(value)
  } catch {
    return String(value)
  }
}

function write(level: string, args: unknown[]): void {
  try {
    mkdirSync(Global.Path.log, { recursive: true })
    appendFileSync(path.join(Global.Path.log, "tui.log"), `${new Date().toISOString()} ${level} ${args.map(fmt).join(" ")}\n`)
  } catch {
    // 日志失败不影响主流程
  }
}

export const tuiLog = {
  debug: (...args: unknown[]) => write("DEBUG", args),
  info: (...args: unknown[]) => write("INFO", args),
  warn: (...args: unknown[]) => write("WARN", args),
  error: (...args: unknown[]) => write("ERROR", args),
}
