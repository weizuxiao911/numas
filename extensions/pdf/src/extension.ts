import * as vscode from 'vscode'

export const PDF_VIEW_TYPE = 'pdfViewer'

/**
 * PDF 阅读器 (vsix)
 *
 * 架构 (大文件友好):
 *   extension host (本文件): custom editor 壳; 只算 webview 端要用的 fetch URL + headers (几 KB),
 *     不读文件字节、不传大 buffer (30MB+ postMessage 结构化克隆会卡死主线程).
 *   webview (dist/webview.js, React): 自己 fetch opencode /api/fs/read 拿原始字节 (裸二进制,
 *     无 base64) → 直接交给 pdf.js (transfer 进 worker, 不额外拷贝).
 *
 * 关键问题 + 解决:
 *   1. opensumi webview listening 有空窗期 → shell HTML 多档延迟重发
 *   2. webview 是 srcdoc 同源 iframe → fetch 同源 API (dev 走 webpack proxy, 生产同源), 无 CORS 问题
 *   3. pdf.js 静态资源随 vsix 打包 (pdfjs/), 经 asWebviewUri 从市场加载 (内置/网关两种路径形态自适应), 不依赖 CDN
 */
export function activate(context: vscode.ExtensionContext) {
  const provider: vscode.CustomTextEditorProvider = {
    async resolveCustomTextEditor(document, webviewPanel, _token) {
      // 标准 vscode webview 资源解析: asWebviewUri 走 codeblitz 静态资源服务,
      // 自动适配市场来源 (内置 /extensions/<id>/... 或网关 <base>/<id>/file/...);
      // 不能手拼 registryBase + 路径 — 网关与内置路径形态不同, 手拼在网关下必 404.
      const localRoots = [
        vscode.Uri.joinPath(context.extensionUri, 'dist'),
        vscode.Uri.joinPath(context.extensionUri, 'pdfjs'),
      ]
      webviewPanel.webview.options = {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: localRoots,
      }

      const name = (document.uri?.fsPath || '').split(/[\\/]/).pop() || 'document.pdf'
      const target = resolveFetchTarget(document)
      const webviewJsUri = webviewPanel.webview
        .asWebviewUri(vscode.Uri.joinPath(context.extensionUri, 'dist', 'webview.js'))
        .toString()
      const pdfjsBase = webviewPanel.webview
        .asWebviewUri(vscode.Uri.joinPath(context.extensionUri, 'pdfjs'))
        .toString()
        .replace(/\/+$/, '')
      const shell = buildShell(name, target, webviewJsUri, pdfjsBase)

      // opensumi webview 监听空窗期: 一次 set html 会丢 → 多档重发
      const sendShell = () => { try { webviewPanel.webview.html = shell } catch { /* ignore */ } }
      sendShell()
      const timers = [120, 400, 1000].map((ms) => setTimeout(sendShell, ms))
      webviewPanel.onDidDispose(() => timers.forEach((t) => clearTimeout(t)))
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

type FetchTarget = { rel?: string; headerDir?: string; error?: string }

/**
 * 算 webview 端拉 PDF 字节的相对地址参数: /api/fs/read/<rel> + x-opencode-directory header.
 * 工作区内: header=workspace 根, rel=相对路径; 区外/取不到 cwd: header=文件所在目录, rel=basename.
 * (对齐 sumi fs provider 的 apiReadBytes: 裸字节 arrayBuffer, 无 base64/JSON)
 * 注意: ext host 拿不到 __APP_OPENCODE_RUNTIME__ (同 __APP_CONFIG__), 所以只传相对参数,
 * base URL 由 webview 侧用同源相对路径解析.
 */
function resolveFetchTarget(document: vscode.TextDocument): FetchTarget {
  try {
    const cwd = (() => { try { return localStorage.getItem('APP_CWD') || '' } catch { return '' } })()
    const fsPath = document.uri?.fsPath || ''
    const norm = (p: string) => p.replace(/\/+$/, '')
    const underCwd = !!cwd && (fsPath === norm(cwd) || fsPath.startsWith(norm(cwd) + '/'))
    const headerDir = underCwd ? norm(cwd) : fsPath.slice(0, Math.max(fsPath.lastIndexOf('/'), 0))
    const rel = underCwd ? fsPath.slice(norm(cwd).length + 1) : (fsPath.split(/[\\/]/).pop() || '')
    if (!rel) return { error: `无法解析相对路径: ${fsPath}` }
    if (!headerDir) return { error: `无法解析目录: ${fsPath}` }
    return { rel, headerDir }
  } catch (e: any) {
    return { error: e?.message || String(e) }
  }
}

function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string))
}

/** shell HTML: 只挂 root + 配置 (webview bundle URL + pdfjs 基址 + fetch 地址/headers).
 *  webviewJsUri / pdfjsBase 由 host 侧 asWebviewUri 解析成绝对 URL (自动适配市场来源:
 *  内置 /extensions/<id>/... 或网关 <base>/<id>/file/...), shell 不再手拼 registryBase. */
function buildShell(name: string, target: FetchTarget, webviewJsUri: string, pdfjsBase: string): string {
  const cfg = JSON.stringify({ name, fetch: target, pdfjsBase })
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
  window.__PDF_CFG__ = Object.assign({}, ${cfg});
  var s = document.createElement('script');
  s.src = ${JSON.stringify(webviewJsUri)};
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
