/**
 * 打包 docx extension 为 .vsix (模式对齐 extensions/pdf/scripts/package.js)
 * vsix = zip, 结构:
 *   extension/
 *     package.json
 *     dist/extension.js + dist/webview/**
 *     media/icon.png
 *     LICENSE + THIRD-PARTY-NOTICES.md  (fork 自 show-docx 1.2.1, MIT, 保留 attribution)
 *   [Content_Types].xml
 */
const fs = require('fs')
const path = require('path')
const AdmZip = require('../../../registry/node_modules/adm-zip')

const ROOT = path.resolve(__dirname, '..')
const SRC_DIST = path.join(ROOT, 'dist')
const PKG_PATH = path.join(ROOT, 'package.json')
const STAGE = path.join(ROOT, '.vsix-stage')
const PKG = JSON.parse(fs.readFileSync(PKG_PATH, 'utf-8'))
const OUT = path.resolve(
  __dirname,
  '../../../registry/vsix',
  `${PKG.publisher || 'numas'}.${PKG.name}-${PKG.version}.vsix`,
)

console.log('[docx] packaging:', OUT)

fs.rmSync(STAGE, { recursive: true, force: true })
fs.mkdirSync(path.join(STAGE, 'extension'), { recursive: true })

// package.json + dist
fs.copyFileSync(PKG_PATH, path.join(STAGE, 'extension', 'package.json'))
function copyDir(src, dst) {
  fs.mkdirSync(dst, { recursive: true })
  for (const e of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, e.name)
    const d = path.join(dst, e.name)
    if (e.isDirectory()) copyDir(s, d)
    else fs.copyFileSync(s, d)
  }
}
copyDir(SRC_DIST, path.join(STAGE, 'extension', 'dist'))

// media: 只带 icon.png (package.json icon 字段引用; 其余 banner/源图不打进 vsix)
const MEDIA_SRC = path.join(ROOT, 'media', 'icon.png')
if (fs.existsSync(MEDIA_SRC)) {
  fs.mkdirSync(path.join(STAGE, 'extension', 'media'), { recursive: true })
  fs.copyFileSync(MEDIA_SRC, path.join(STAGE, 'extension', 'media', 'icon.png'))
}
for (const f of ['LICENSE', 'THIRD-PARTY-NOTICES.md']) {
  const src = path.join(ROOT, f)
  if (fs.existsSync(src)) fs.copyFileSync(src, path.join(STAGE, 'extension', f))
}

fs.writeFileSync(
  path.join(STAGE, '[Content_Types].xml'),
  '<?xml version="1.0" encoding="utf-8"?>\n' +
    '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">\n' +
    '  <Default Extension="json" ContentType="application/json"/>\n' +
    '  <Default Extension="js" ContentType="application/javascript"/>\n' +
    '  <Default Extension="css" ContentType="text/css"/>\n' +
    '  <Default Extension="png" ContentType="image/png"/>\n' +
    '</Types>\n',
)

fs.mkdirSync(path.dirname(OUT), { recursive: true })
const zip = new AdmZip()
zip.addLocalFolder(STAGE)
zip.writeZip(OUT)

fs.rmSync(STAGE, { recursive: true, force: true })

console.log('[docx] packaged:', OUT, '(' + (fs.statSync(OUT).size / 1024).toFixed(1) + ' KB)')
