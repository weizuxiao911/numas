/**
 * PDF webview (React) — pdf.js 渲染 + 工具栏
 *
 * 与 extension host 通信 (postMessage):
 *   webview → host: { type: 'ready' }                     请求 PDF 字节
 *   host → webview: { type: 'pdf-bytes', bytes, name }    PDF 字节 (Uint8Array)
 *                   { type: 'pdf-error', message }        读取失败
 *
 * pdf.js 静态资源从 registry (vsix 包内 pdfjs/ 目录) 加载, 不依赖 CDN.
 * host 通过 shell HTML 注入 window.__PDF_CFG__ = { registryBase, name }.
 */
import React from 'react'
import { createRoot } from 'react-dom/client'

type VsCodeApi = { postMessage(msg: unknown): void }
declare function acquireVsCodeApi(): VsCodeApi

const vscode = acquireVsCodeApi()
const CFG = ((window as any).__PDF_CFG__ || {}) as { registryBase?: string; name?: string }
const PDFJS_BASE = `${String(CFG.registryBase || '').replace(/\/+$/, '')}/numas.pdf-0.1.0/pdfjs`

/* ===== pdf.js 加载 (module script → window.pdfjsLib; worker 走 blob 规避跨域) ===== */
function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const s = document.createElement('script')
    s.type = 'module'
    s.src = src
    s.onload = () => resolve()
    s.onerror = () => reject(new Error(`script load fail: ${src}`))
    document.head.appendChild(s)
  })
}

let pdfjsPromise: Promise<any> | null = null
function loadPdfJs(): Promise<any> {
  if (pdfjsPromise) return pdfjsPromise
  pdfjsPromise = (async () => {
    const w = window as any
    if (!w.pdfjsLib) await loadScript(`${PDFJS_BASE}/pdf.min.mjs`)
    if (!w.pdfjsLib) throw new Error(`pdf.js 主库加载失败: ${PDFJS_BASE}/pdf.min.mjs`)
    const workerUrl = `${PDFJS_BASE}/pdf.worker.min.mjs`
    const r = await fetch(workerUrl)
    if (!r.ok) throw new Error(`pdf.js worker 加载失败: HTTP ${r.status}`)
    const blob = new Blob([await r.text()], { type: 'text/javascript' })
    w.pdfjsLib.GlobalWorkerOptions.workerSrc = URL.createObjectURL(blob)
    return w.pdfjsLib
  })()
  return pdfjsPromise
}

/* ===== 单页: 骨架尺寸 → 懒渲染 canvas ===== */
const PdfPage: React.FC<{
  doc: any
  pageNo: number
  scale: number
  fitWidth: number | null
  onSize: (pageNo: number, h: number) => void
}> = ({ doc, pageNo, scale, fitWidth, onSize }) => {
  const wrapRef = React.useRef<HTMLDivElement | null>(null)
  const canvasRef = React.useRef<HTMLCanvasElement | null>(null)
  const [size, setSize] = React.useState<{ w: number; h: number } | null>(null)
  const [shown, setShown] = React.useState(false)

  const effectiveScale = React.useCallback(
    async (page: any) => {
      const base = page.getViewport({ scale: 1 })
      return fitWidth ? fitWidth / base.width : scale
    },
    [fitWidth, scale],
  )

  // 骨架: 按 scale/fitWidth 计算页面尺寸
  React.useEffect(() => {
    let cancelled = false
    void (async () => {
      const page = await doc.getPage(pageNo)
      const s = await effectiveScale(page)
      if (cancelled) return
      const vp = page.getViewport({ scale: s })
      setSize({ w: vp.width, h: vp.height })
      onSize(pageNo, vp.height)
    })()
    return () => { cancelled = true }
  }, [doc, pageNo, effectiveScale, onSize])

  // 懒渲染: 进入视口 (含 600px 预取) 才画 canvas; scale 变化重画
  React.useEffect(() => {
    const el = wrapRef.current
    if (!el || !size) return
    let cancelled = false
    const render = async () => {
      const page = await doc.getPage(pageNo)
      const s = await effectiveScale(page)
      const vp = page.getViewport({ scale: s })
      const canvas = canvasRef.current
      if (!canvas || cancelled) return
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      canvas.width = Math.floor(vp.width * dpr)
      canvas.height = Math.floor(vp.height * dpr)
      const ctx = canvas.getContext('2d')
      if (!ctx) return
      setShown(false)
      await page.render({
        canvasContext: ctx,
        viewport: vp,
        ...(dpr !== 1 ? { transform: [dpr, 0, 0, dpr, 0, 0] } : {}),
      }).promise
      if (!cancelled) setShown(true)
    }
    const io = new IntersectionObserver((entries) => {
      if (!entries.some((e) => e.isIntersecting)) return
      io.disconnect()
      void render()
    }, { rootMargin: '600px 0px' })
    io.observe(el)
    return () => { cancelled = true; io.disconnect() }
  }, [doc, pageNo, size, effectiveScale])

  return (
    <div
      ref={wrapRef}
      className="pdf-page"
      style={{ width: size?.w ?? '100%', height: size?.h ?? 420 }}
    >
      <canvas ref={canvasRef} className="pdf-canvas" style={{ opacity: shown ? 1 : 0 }} />
    </div>
  )
}

/* ===== App: 工具栏 + 页面列表 ===== */
const App: React.FC = () => {
  const [doc, setDoc] = React.useState<any>(null)
  const [numPages, setNumPages] = React.useState(0)
  const [page, setPage] = React.useState(1)
  const [zoom, setZoom] = React.useState(1.2)
  const [fit, setFit] = React.useState(true)
  const [fitWidth, setFitWidth] = React.useState<number | null>(null)
  const [error, setError] = React.useState<string | null>(null)
  const viewportRef = React.useRef<HTMLDivElement | null>(null)
  const heightsRef = React.useRef<Map<number, number>>(new Map())

  // host 推 bytes / 错误
  React.useEffect(() => {
    const onMsg = async (e: MessageEvent) => {
      const m = e.data
      if (!m || typeof m !== 'object') return
      if (m.type === 'pdf-bytes') {
        try {
          const pdfjs = await loadPdfJs()
          const bytes = m.bytes instanceof Uint8Array ? m.bytes : new Uint8Array(m.bytes)
          const d = await pdfjs.getDocument({
            data: bytes,
            cMapUrl: `${PDFJS_BASE}/cmaps/`,
            cMapPacked: true,
          }).promise
          setDoc(d)
          setNumPages(d.numPages)
          setPage(1)
        } catch (err: any) {
          setError(String(err?.message || err))
        }
      } else if (m.type === 'pdf-error') {
        setError(String(m.message || 'unknown'))
      }
    }
    window.addEventListener('message', onMsg)
    vscode.postMessage({ type: 'ready' })
    return () => window.removeEventListener('message', onMsg)
  }, [])

  // 适应宽度: 视口宽度变化重算
  React.useEffect(() => {
    if (!fit) { setFitWidth(null); return }
    const el = viewportRef.current
    if (!el) return
    const compute = () => setFitWidth(Math.max(200, el.clientWidth - 24))
    compute()
    const ro = new ResizeObserver(compute)
    ro.observe(el)
    return () => ro.disconnect()
  }, [fit, doc])

  // 当前页跟踪 (滚动)
  const onScroll = React.useCallback(() => {
    const el = viewportRef.current
    if (!el) return
    const mid = el.scrollTop + el.clientHeight * 0.4
    let acc = 0
    let current = 1
    for (let i = 1; i <= numPages; i++) {
      const h = (heightsRef.current.get(i) ?? 420) + 10
      if (mid < acc + h) { current = i; break }
      acc += h
      current = i
    }
    setPage(current)
  }, [numPages])

  const goto = React.useCallback((n: number) => {
    const target = Math.min(Math.max(1, n), numPages || 1)
    const el = viewportRef.current
    if (!el) return
    let acc = 0
    for (let i = 1; i < target; i++) acc += (heightsRef.current.get(i) ?? 420) + 10
    el.scrollTo({ top: acc, behavior: 'auto' })
    setPage(target)
  }, [numPages])

  const onSize = React.useCallback((pageNo: number, h: number) => {
    heightsRef.current.set(pageNo, h)
  }, [])

  return (
    <div className="pdf-app">
      <div className="pdf-toolbar">
        <button type="button" disabled={!numPages || page <= 1} onClick={() => goto(page - 1)}>‹ 上一页</button>
        <span className="pdf-pg">
          <span>{numPages ? page : '-'}</span> / <span>{numPages || '-'}</span>
        </span>
        <button type="button" disabled={!numPages || page >= numPages} onClick={() => goto(page + 1)}>下一页 ›</button>
        <span className="pdf-sep" />
        <button type="button" onClick={() => { setFit(false); setZoom((z) => Math.max(0.4, +(z - 0.2).toFixed(2))) }}>−</button>
        <span className="pdf-pg">{Math.round(zoom * 100)}%</span>
        <button type="button" onClick={() => { setFit(false); setZoom((z) => Math.min(4, +(z + 0.2).toFixed(2))) }}>+</button>
        <button type="button" className={fit ? 'is-active' : ''} onClick={() => setFit(true)}>适应宽度</button>
        <span className="pdf-info">{CFG.name || ''}</span>
      </div>
      <div className="pdf-viewport" ref={viewportRef} onScroll={onScroll}>
        {error && <div className="pdf-err">读取失败: {error}</div>}
        {!error && !doc && <div className="pdf-loading">加载中…</div>}
        {doc && Array.from({ length: numPages }, (_, i) => (
          <PdfPage key={i + 1} doc={doc} pageNo={i + 1} scale={zoom} fitWidth={fitWidth} onSize={onSize} />
        ))}
      </div>
    </div>
  )
}

/* ===== 样式 (随 webview 一起, 不额外发 CSS 文件) ===== */
const style = document.createElement('style')
style.textContent = `
*{box-sizing:border-box}
body,html{margin:0;padding:0;height:100%;background:#525659;color:#eee;font-family:system-ui,-apple-system,sans-serif;overflow:hidden}
.pdf-app{height:100%;display:flex;flex-direction:column}
.pdf-toolbar{display:flex;align-items:center;gap:8px;padding:6px 12px;background:#323639;border-bottom:1px solid #1a1a1a;flex-shrink:0;font-size:12px}
.pdf-toolbar button{background:#3c3d3e;border:1px solid #555;color:#eee;padding:3px 8px;border-radius:4px;cursor:pointer;font-size:12px;font-family:inherit}
.pdf-toolbar button:hover:not(:disabled){background:#4a4c4d}
.pdf-toolbar button:disabled{opacity:.4;cursor:default}
.pdf-toolbar button.is-active{background:#4a6b8a;border-color:#5f7fa0}
.pdf-pg{font-variant-numeric:tabular-nums;min-width:54px;text-align:center}
.pdf-sep{width:1px;height:16px;background:#555;margin:0 2px}
.pdf-info{margin-left:auto;color:#aaa;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:40%}
.pdf-viewport{flex:1;overflow:auto;padding:12px}
.pdf-page{margin:0 auto 10px;background:#fff;box-shadow:0 2px 8px rgba(0,0,0,.4);position:relative}
.pdf-canvas{width:100%;height:100%;display:block;transition:opacity .12s ease}
.pdf-err{color:#faa;padding:20px;font-family:ui-monospace,Menlo,monospace;white-space:pre-wrap;word-break:break-word;font-size:12px}
.pdf-loading{display:flex;align-items:center;justify-content:center;height:100%;color:#aaa;font-size:13px}
`
document.head.appendChild(style)

const el = document.getElementById('root')
if (el) createRoot(el).render(<App />)
