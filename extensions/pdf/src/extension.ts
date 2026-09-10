import * as vscode from 'vscode'

export const PDF_VIEW_TYPE = 'pdfViewer'

/** vsix 包 id (registry 静态分发路径: <registryBase>/<id>/<file>) */
const VSIX_ID = 'numas.pdf-0.1.0'

/**
 * PDF 阅读器 (vsix)
 *
 * 架构:
 *   extension host (本文件): custom editor 壳 + 读 PDF 字节 (vscode.workspace.fs → opencode /file/content 兜底)
 *   webview (dist/webview.js, React): pdf.js 渲染 + 工具栏; 与 host 走 postMessage
 *
 * 关键问题 + 解决:
 *   1. opensumi webview listening 有空窗期 → shell HTML 多档延迟重发
 *   2. 大文件 vscode.workspace.fs 在 ext host worker 可能不可用 → fetch opencode /file/content 兜底
 *   3. pdf.js 静态资源随 vsix 打包 (pdfjs/), 从 registry 加载, 不依赖 CDN
 */
export function activate(context: vscode.ExtensionContext) {
  const provider: vscode.CustomTextEditorProvider = {
    async resolveCustomTextEditor(document, webviewPanel, _token) {
      webviewPanel.webview.options = { enableScripts: true, retainContextWhenHidden: true }

      const name = (document.uri?.fsPath || '').split(/[\\/]/).pop() || 'document.pdf'
      const shell = buildShell(name)

      // opensumi webview 监听空窗期: 一次 set html 会丢 → 多档重发
      const sendShell = () => { try { webviewPanel.webview.html = shell } catch { /* ignore */ } }
      sendShell()
      const timers = [120, 400, 1000].map((ms) => setTimeout(sendShell, ms))

      // webview 就绪 → 推 PDF 字节
      const sub = webviewPanel.webview.onDidReceiveMessage(async (msg: any) => {
        if (!msg || msg.type !== 'ready') return
        const result = await readPdfBytes(document)
        if (result.ok) {
          webviewPanel.webview.postMessage({ type: 'pdf-bytes', bytes: result.data, name })
        } else {
          webviewPanel.webview.postMessage({ type: 'pdf-error', message: result.error })
        }
      })

      webviewPanel.onDidDispose(() => {
        timers.forEach((t) => clearTimeout(t))
        sub.dispose()
      })
    },
  }

  context.subscriptions.push(
    vscode.window.registerCustomEditorProvider(PDF_VIEW_TYPE, provider, {
      webviewOptions: { retainContextWhenHidden: true },
    }),
  )

  context.subscriptions.push(
    vscode.commands.registerCommand('pdf.open', () => {
      const ed = vscode.window.activeTextEditor
      if (!ed) return
      void vscode.commands.executeCommand('vscode.openWith', ed.document.uri, PDF_VIEW_TYPE)
    }),
  )
}

/** 读 PDF 字节: 1) vscode.workspace.fs 2) opencode /file/content 兜底 */
async function readPdfBytes(
  document: vscode.TextDocument,
): Promise<{ ok: true; data: Uint8Array } | { ok: false; error: string }> {
  try {
    const bytes = await vscode.workspace.fs.readFile(document.uri)
    if (bytes && bytes.byteLength) return { ok: true, data: bytes }
  } catch { /* fallback */ }

  try {
    const w = window as any
    const ocBase = (w.__APP_OPENCODE_RUNTIME__?.baseUrl as string | undefined) || ''
    if (!ocBase) throw new Error('opencode baseUrl 未注入 (缺 __APP_OPENCODE_RUNTIME__)')
    const cwd = (() => { try { return localStorage.getItem('APP_CWD') || '' } catch { return '' } })()
    const fsPath = document.uri?.fsPath || ''
    const rootName = cwd.split('/').pop() || ''
    const pathParam = (() => {
      if (rootName && fsPath.includes(`/workspace/${rootName}/`)) return fsPath.split(`/workspace/${rootName}/`)[1] || ''
      if (cwd && fsPath.startsWith(cwd + '/')) return fsPath.slice(cwd.length + 1)
      return fsPath.split('/').pop() || ''
    })()
    const r = await fetch(`${ocBase}/file/content?path=${encodeURIComponent(pathParam)}&directory=${encodeURIComponent(cwd)}`)
    if (!r.ok) throw new Error(`opencode /file/content HTTP ${r.status}`)
    const data: any = await r.json()
    if (data.type === 'binary' && data.encoding === 'base64') {
      const bin = atob(String(data.content || ''))
      const arr = new Uint8Array(bin.length)
      for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i)
      return { ok: true, data: arr }
    }
    throw new Error(`文件不是 PDF 二进制 (type=${data.type})`)
  } catch (e: any) {
    return { ok: false, error: e?.message || String(e) }
  }
}

function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string))
}

/** shell HTML: 只挂 root + 配置 + webview bundle (内容走 postMessage, 避免大字符串序列化).
 *  registry 基址在 webview 侧解析 (ext host 拿不到 __APP_CONFIG__):
 *    window.parent.__APP_CONFIG__.registryBaseUrl → 相对 '/extensions' 兜底 (同源, 生产/开发都成立). */
function buildShell(name: string): string {
  const safeName = JSON.stringify(name)
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${esc(name)}</title>
</head>
<body>
<div id="root"><div style="display:flex;align-items:center;justify-content:center;height:100vh;color:#aaa;font-family:system-ui,sans-serif;font-size:13px;background:#525659">加载中…</div></div>
<script>
(function(){
  var base = '/extensions';
  try {
    var c = window.parent && window.parent.__APP_CONFIG__;
    if (c && c.registryBaseUrl) base = c.registryBaseUrl;
  } catch (e) { /* 跨域/沙箱 → 同源相对路径兜底 */ }
  base = String(base).replace(/\\/+$/, '');
  window.__PDF_CFG__ = { registryBase: base, name: ${safeName} };
  var s = document.createElement('script');
  s.src = base + '/${VSIX_ID}/dist/webview.js';
  s.onerror = function () {
    var el = document.getElementById('root');
    if (el) el.innerHTML = '<div style="padding:20px;color:#faa;font-family:ui-monospace,monospace;font-size:12px">webview bundle 加载失败: ' + s.src + '</div>';
  };
  document.body.appendChild(s);
})();
</script>
</body>
</html>`
}

export function deactivate() { }
