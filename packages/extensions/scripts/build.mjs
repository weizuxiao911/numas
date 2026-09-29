#!/usr/bin/env node
/**
 * packages/extensions/scripts/build.mjs — 聚合构建 numas 内置 vsix 扩展
 *
 * 逐个构建 docx/html/paper/pdf, 产物统一落到 dist-vsix/*.vsix
 * (可 NUMAS_VSIX_OUT 覆盖; opencode 打包时据此目录内嵌进 numas 二进制).
 *
 * 依赖缺失才 npm install (对齐 dev.js 的"已产物则跳过"策略, 避免每次全量重装).
 * 注意: pdf 打包会从 docx 的 node_modules 取 codicon.ttf, 故 docx 优先构建.
 */

import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const OUT = process.env.NUMAS_VSIX_OUT
  ? path.resolve(process.env.NUMAS_VSIX_OUT)
  : path.join(ROOT, 'dist-vsix')

const extensions = [
  { dir: 'docx' },
  { dir: 'html' },
  { dir: 'pdf' },
  { dir: 'paper', installs: [['--prefix', 'webview']] },
]

function run(label, cmd, args, cwd) {
  console.log(`[vsix] ${label}`)
  const result = spawnSync(cmd, args, { cwd, stdio: 'inherit', env: { ...process.env, NUMAS_VSIX_OUT: OUT } })
  if (result.status !== 0) {
    console.error(`[vsix] ${label} 失败 (status=${result.status})`)
    process.exit(result.status ?? 1)
  }
}

function installIfMissing(label, dir, extra = []) {
  const target = path.join(dir, ...extra, 'node_modules')
  if (fs.existsSync(target)) return
  // --workspaces=false: 不走 root workspaces (否则 npm 读 root package.json 的 catalog: protocol 报错)
  run(label, 'npm', ['install', '--no-audit', '--no-fund', '--workspaces=false', ...extra], dir)
}

fs.mkdirSync(OUT, { recursive: true })

// packages/extensions 级依赖 (adm-zip, 供各扩展 scripts/package.js require)
installIfMissing('extensions npm install', ROOT)

for (const { dir, installs = [] } of extensions) {
  const extDir = path.join(ROOT, dir)
  for (const extra of installs) installIfMissing(`${dir} install ${extra.join(' ')}`, extDir, extra)
  installIfMissing(`${dir} npm install`, extDir)
  run(`${dir} package`, 'npm', ['run', 'package'], extDir)
}

const produced = fs.readdirSync(OUT).filter((f) => f.endsWith('.vsix'))
console.log(`[vsix] done (${produced.length}) → ${OUT}`)
