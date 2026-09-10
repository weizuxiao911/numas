/**
 * 打包后把 .vsix 复制到运行时扩展目录 ~/.numas/extensions
 *
 * 背景: opencode 自带扩展市场 (/extensions 控制器), 运行时扫描 ~/.numas/extensions;
 * 仓库 registry/vsix 仍保留产物 (dev.js 的 --extensions-dir 指向它).
 *
 * 用法 (extensions/<name>/scripts/package.js):
 *   const { copyVsixToHome } = require('../../scripts/copy-vsix-to-home')
 *   copyVsixToHome(OUT, '<tag>')
 *
 * best-effort: 家目录不可写 (CI/容器构建) 只告警, 不影响打包结果.
 */
const fs = require('fs')
const os = require('os')
const path = require('path')

function copyVsixToHome(vsixPath, tag) {
  try {
    const dir = path.join(os.homedir(), '.numas', 'extensions')
    fs.mkdirSync(dir, { recursive: true })
    const dest = path.join(dir, path.basename(vsixPath))
    fs.copyFileSync(vsixPath, dest)
    console.log(`[${tag}]   copied to ~/.numas/extensions: ${path.basename(vsixPath)}`)
    return dest
  } catch (e) {
    console.warn(`[${tag}]   copy to ~/.numas/extensions failed (ignored):`, e && e.message)
    return null
  }
}

module.exports = { copyVsixToHome }
