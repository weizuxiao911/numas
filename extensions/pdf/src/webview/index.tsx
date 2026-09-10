/**
 * PDF 阅读器 webview (React) — 移植自 sumi/src/extensions/pdf/PdfReaderView (去标注)
 *
 * 模式 (全量骨架重建 + 单页按需渲染):
 *   1. 加载 PDF 后: rebuildViewer 全量创建所有页 div (骨架), 滚动条由 div 高度撑开.
 *   2. 懒加载可见页 ±5: pdf.getPage + canvas 渲染 (透明度 0→1 渐显), 离开不释放.
 *   3. 缩放档位 0..4 (50/75/100/125/150%), 高度主导: div 高 = viewer 视口高 × 档位,
 *      宽按 PDF aspect-ratio; 缩放只重建骨架 + 重懒加载 (并发守卫 buildId).
 *   4. 目录侧边栏 (pdf.getOutline 嵌套书签, 可折叠) + 页码显示 + 键盘翻页 (←/→/PgUp/PgDn/空格).
 *
 * 与 extension host 通信: 无 (host 只在 shell HTML 里注入 fetch 地址 + headers).
 * webview 自己 fetch opencode /api/fs/read 拿原始字节 (裸二进制) → pdf.js 直接吃,
 * 大文件不经过 postMessage 结构化克隆 (30MB+ 会卡主线程).
 * pdf.js 静态资源从 registry (vsix 内 pdfjs/) 加载, 不依赖 CDN.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';

const CFG = ((window as any).__PDF_CFG__ || {}) as {
  registryBase?: string;
  name?: string;
  fetch?: { rel?: string; headerDir?: string; error?: string };
};
const PDFJS_BASE = `${String(CFG.registryBase || '').replace(/\/+$/, '')}/numas.pdf-0.1.0/pdfjs`;

/* ===== pdf.js 加载 (module script → window.pdfjsLib; worker 走 blob 规避跨域) ===== */
function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.type = 'module';
    s.src = src;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error(`script load fail: ${src}`));
    document.head.appendChild(s);
  });
}

let pdfjsPromise: Promise<any> | null = null;
function loadPdfJs(): Promise<any> {
  if (pdfjsPromise) return pdfjsPromise;
  pdfjsPromise = (async () => {
    const w = window as any;
    if (!w.pdfjsLib) await loadScript(`${PDFJS_BASE}/pdf.min.mjs`);
    if (!w.pdfjsLib) throw new Error(`pdf.js 主库加载失败: ${PDFJS_BASE}/pdf.min.mjs`);
    if (!w.pdfjsLib.GlobalWorkerOptions.workerSrc) {
      const r = await fetch(`${PDFJS_BASE}/pdf.worker.min.mjs`);
      if (!r.ok) throw new Error(`pdf.js worker 加载失败: HTTP ${r.status}`);
      const blob = new Blob([await r.text()], { type: 'text/javascript' });
      w.pdfjsLib.GlobalWorkerOptions.workerSrc = URL.createObjectURL(blob);
    }
    return w.pdfjsLib;
  })();
  return pdfjsPromise;
}

async function openPdfFromBytes(bytes: Uint8Array): Promise<any> {
  const pdfjsLib = await loadPdfJs();
  // 直接移交 buffer (pdf.js 会 transfer 到 worker; 调用方不再复用)
  return await pdfjsLib.getDocument({
    data: bytes,
    cMapUrl: `${PDFJS_BASE}/cmaps/`,
    cMapPacked: true,
    isEvalSupported: false,
    // 禁用内嵌 annotation 渲染: canvas 只画内容
    annotationMode: 0,
  }).promise;
}

/* ========== 主组件 ========== */
const PdfViewer: React.FC = () => {
  const viewerRef = useRef<HTMLDivElement>(null);
  const pdfDocRef = useRef<any>(null);
  /** 已渲染完成的 page idx 集合 */
  const renderedRef = useRef<Set<number>>(new Set());
  /** 每页占位 div 引用 */
  const pageElsRef = useRef<Map<number, HTMLDivElement>>(new Map());
  /** 懒加载防抖 timer */
  const lazyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** rebuildViewer 并发守卫: 每次入口 +1, await 后检查; 不一致 → 旧 build bail (连续点缩放防撞车) */
  const buildIdRef = useRef(0);
  /** 用户缩放档位: 0..4 对应 [50%, 75%, 100%, 125%, 150%]; 高度主导缩放 */
  const [userScaleIdx, setUserScaleIdx] = useState(2);
  const USER_SCALES = [0.5, 0.75, 1.0, 1.25, 1.5];

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [numPages, setNumPages] = useState(0);
  /** 当前页码 (ref, 避免放入 rebuildViewer deps 触发死循环) */
  const currentPageRef = useRef<number>(1);
  /** 缩放锚点页: 点击缩放按钮瞬间记录真实页 (rebuild 异步触发, 期间 onScroll 会污染 currentPageRef 成 1) */
  const zoomAnchorPageRef = useRef<number | null>(null);
  /** rebuild 进行中 (计数): 期间 onScroll 不更新 currentPageRef (防 innerHTML='' 后 scrollTop 归零污染成 1) */
  const rebuildingRef = useRef(0);
  const [currentPage, _setCurrentPage] = useState(1);
  /** PDF 目录树 (pdf.getOutline() 嵌套结构) */
  const [outline, setOutline] = useState<any[]>([]);
  /** 目录面板是否展开 */
  const [tocOpen, setTocOpen] = useState(true);
  /** resize/缩放触发重建的 tick */
  const [rebuildTick, setRebuildTick] = useState(0);
  /** 页码输入框 (非受控, 输入时不被滚动同步抢走) */
  const pageInputRef = useRef<HTMLInputElement>(null);
  const inputFocusedRef = useRef(false);

  /** 同步页码显示 (滚动/跳转时更新输入框, 但聚焦中不抢) */
  const syncPageDisplay = useCallback((n: number) => {
    if (inputFocusedRef.current) return;
    const el = pageInputRef.current;
    if (el) el.value = String(n);
  }, []);

  // ---------- 加载 PDF: webview 自己 fetch 裸字节 (不走 host postMessage 大 buffer) ----------
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        setError('');
        const cfg = CFG.fetch;
        if (!cfg || cfg.error || !cfg.rel || !cfg.headerDir) throw new Error(cfg?.error || '缺少 fetch 配置 (shell 未注入)');
        // 同源相对地址 (webview 与 app 同源; dev 走 webpack proxy, 生产同源)
        const url = `/api/fs/read/${encodeURIComponent(cfg.rel)}`;
        const r = await fetch(url, { headers: { 'x-opencode-directory': encodeURI(cfg.headerDir) } });
        if (!r.ok) throw new Error(`读取 PDF 失败: HTTP ${r.status}`);
        const buf = await r.arrayBuffer();
        if (!buf.byteLength) throw new Error('读取 PDF 失败: 空内容');
        if (cancelled) return;
        const pdf = await openPdfFromBytes(new Uint8Array(buf));
        if (cancelled) return;
        pdfDocRef.current = pdf;
        setNumPages(pdf.numPages);
        // 目录: pdf.getOutline() 拿嵌套书签树
        try {
          const o = await (pdf as any).getOutline();
          if (!cancelled) setOutline(Array.isArray(o) ? o : []);
        } catch {
          if (!cancelled) setOutline([]);
        }
      } catch (err: any) {
        if (!cancelled) setError(String(err?.message || err));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
      try { pdfDocRef.current?.destroy?.(); } catch { /* */ }
    };
  }, []);

  // ---------- 懒加载单页真实内容 (canvas) ----------
  // 骨架已建 page div; 此函数只在 div 上补 canvas (幂等: 已渲染过直接返回).
  const rebuildSinglePage = useCallback(async (pageIdx: number, myBuildId?: number) => {
    const viewer = viewerRef.current;
    if (!viewer) return;
    const pdf = pdfDocRef.current;
    if (!pdf) return;
    if (pageIdx < 1 || pageIdx > numPages) return;
    if (renderedRef.current.has(pageIdx)) return;

    const div = pageElsRef.current.get(pageIdx);
    if (!div || div.parentNode !== viewer) return;

    // 高度主导缩放: 视口高 × 档位
    const viewBaseH = Math.max(viewer.clientHeight || 1, 1);
    const dpr = window.devicePixelRatio || 1;

    const p = await pdf.getPage(pageIdx);
    if (myBuildId !== undefined && buildIdRef.current !== myBuildId) return;
    const pb = p.getViewport({ scale: 1 });

    const pageW = div.clientWidth || div.offsetWidth;
    const renderScale = (pageW / pb.width) * dpr;
    const viewport = p.getViewport({ scale: renderScale });
    const canvas = document.createElement('canvas');
    canvas.className = 'ab-pdf-canvas';
    canvas.width = Math.floor(viewport.width);
    canvas.height = Math.floor(viewport.height);
    canvas.style.cssText = 'width:100%;height:100%;display:block;opacity:0;transition:opacity 0.12s ease;';
    div.appendChild(canvas);
    const ctx = canvas.getContext('2d');
    if (ctx) await p.render({ canvasContext: ctx, viewport }).promise;
    if (myBuildId !== undefined && buildIdRef.current !== myBuildId) return;
    canvas.style.opacity = '1';
    div.classList.remove('ab-pdf-page--skeleton');
    renderedRef.current.add(pageIdx);
  }, [numPages]);

  // ---------- 懒加载可见页 ±5 (滚动/缩放后调度) ----------
  const lazyLoadRange = useCallback(async (centerPage: number, myBuildId?: number) => {
    if (!numPages) return;
    const LOAD_RADIUS = 5;
    const from = Math.max(1, centerPage - LOAD_RADIUS);
    const to = Math.min(numPages, centerPage + LOAD_RADIUS);
    for (let i = from; i <= to; i++) {
      try {
        await rebuildSinglePage(i, myBuildId);
      } catch (e) {
        console.warn('[pdf] lazy render failed, page=', i, e);
      }
    }
  }, [numPages, rebuildSinglePage]);

  // ---------- 全量骨架重建 (缩放/初始加载) ----------
  const rebuildViewer = useCallback(async () => {
    if (!numPages) return;
    const viewer = viewerRef.current;
    if (!viewer) return;
    const pdf = pdfDocRef.current;
    if (!pdf) return;
    const myBuildId = ++buildIdRef.current;

    // 高度主导缩放: div 高 = viewer 视口高 × userScale, 宽按 PDF aspect-ratio
    const viewBaseH = Math.max(viewer.clientHeight || 1, 1);
    const viewH = viewBaseH * USER_SCALES[userScaleIdx];
    const pageGap = 8;

    // 用局部变量记当前页: 优先缩放锚点 (点击瞬间真实页), 否则 currentPageRef
    const prevPage = zoomAnchorPageRef.current ?? currentPageRef.current;
    zoomAnchorPageRef.current = null;
    // 记"页内偏移", 重建后精确恢复
    const prevPageEl = pageElsRef.current.get(prevPage);
    const prevOffset = prevPageEl ? viewer.scrollTop - prevPageEl.offsetTop : 0;
    // 重建期间屏蔽 onScroll 页码更新
    rebuildingRef.current++;
    try {
      viewer.innerHTML = '';
      pageElsRef.current.clear();
      renderedRef.current.clear();

      // 骨架: 第一页拿真实宽高比 (所有页同比例), 其余页直接复用 → 不用逐页 getPage
      let aspect: number | null = null;
      for (let i = 1; i <= numPages; i++) {
        if (aspect === null) {
          try {
            const p0 = await pdf.getPage(1);
            const pb0 = p0.getViewport({ scale: 1 });
            aspect = pb0.width / pb0.height;
          } catch {
            aspect = 0.75; // A4 兜底
          }
        }
        const pageH = viewH;
        const pageW = viewH * aspect;
        const div = document.createElement('div');
        div.className = 'ab-pdf-page ab-pdf-page--skeleton';
        div.dataset['page'] = String(i);
        div.style.cssText = `width:${pageW}px;height:${pageH}px;margin:0 auto ${pageGap}px;`;
        viewer.appendChild(div);
        pageElsRef.current.set(i, div);
      }

      // 懒加载当前可见页 ±5 (重建后立即渲染视口附近, 不空白)
      await lazyLoadRange(prevPage, myBuildId);
    } finally {
      rebuildingRef.current--;
    }

    // 重建后恢复滚动位置
    if (prevPage > 1) {
      requestAnimationFrame(() => {
        if (buildIdRef.current !== myBuildId) return; // 期间又有新 build → 放弃
        const target = pageElsRef.current.get(prevPage);
        if (target) viewer.scrollTop = target.offsetTop + prevOffset;
      });
    }
  }, [numPages, rebuildTick, userScaleIdx, lazyLoadRange]);

  // ---------- 滚动同步当前页码 ----------
  useEffect(() => {
    if (!numPages) return;
    const viewer = viewerRef.current;
    if (!viewer) return;
    const onScroll = () => {
      if (rebuildingRef.current > 0) return;
      // 用 viewer 可视区中点的 y 找当前页: 中点下方第一页 = 当前页
      const midY = viewer.scrollTop + viewer.clientHeight / 2;
      // 按 DOM 顺序 (offsetTop) 遍历, 不依赖 Map 插入序
      const pages = Array.from(pageElsRef.current.entries())
        .filter(([, el]) => !!el)
        .sort((a, b) => (a[1] as HTMLElement).offsetTop - (b[1] as HTMLElement).offsetTop);
      let current = 1;
      for (const [idx, el] of pages) {
        if (midY >= el.offsetTop) current = idx;
      }
      if (currentPageRef.current !== current) {
        currentPageRef.current = current;
        _setCurrentPage(current);
        // 懒加载: 当前页 ±5 (防抖, 快速滚动只渲染最终页附近)
        if (lazyTimerRef.current) clearTimeout(lazyTimerRef.current);
        lazyTimerRef.current = setTimeout(() => {
          void lazyLoadRange(current);
        }, 120);
      }
      syncPageDisplay(current);
    };
    viewer.addEventListener('scroll', onScroll);
    return () => {
      viewer.removeEventListener('scroll', onScroll);
      if (lazyTimerRef.current) clearTimeout(lazyTimerRef.current);
    };
  }, [numPages, syncPageDisplay, lazyLoadRange]);

  // ---------- 初始加载 / 缩放重建 ----------
  useEffect(() => {
    if (!numPages) return;
    const viewer = viewerRef.current;
    if (!viewer) return;
    let disposed = false;
    (async () => {
      await rebuildViewer();
      if (disposed) return;
      setLoading(false);
    })();
    return () => { disposed = true; };
  }, [numPages, rebuildViewer]);

  // ---------- 页宽变化 (窗口 resize) → 重建 ----------
  useEffect(() => {
    const onResize = () => setRebuildTick((t) => t + 1);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const jumpToPage = useCallback((n: number) => {
    const clamped = Math.min(numPages, Math.max(1, n));
    currentPageRef.current = clamped;
    _setCurrentPage(clamped);
    syncPageDisplay(clamped);
    const el = pageElsRef.current.get(clamped);
    if (el) el.scrollIntoView({ behavior: 'auto', block: 'start' });
  }, [numPages, syncPageDisplay]);

  // ---------- 目录项点击: 解析 dest → 页号 → 跳转 ----------
  const jumpToOutlineDest = useCallback(async (dest: any) => {
    const pdf = pdfDocRef.current;
    if (!pdf || !dest) return;
    try {
      let resolved: any = dest;
      if (typeof dest === 'string') {
        const explicit = (pdf as any).getDestination ? await (pdf as any).getDestination(dest) : null;
        if (explicit) resolved = explicit;
      }
      if (Array.isArray(resolved) && resolved[0]) {
        const pageIndex = (pdf as any).getPageIndex ? await (pdf as any).getPageIndex(resolved[0]) : -1;
        if (pageIndex >= 0) jumpToPage(pageIndex + 1);
      }
    } catch { /* 解析失败静默 */ }
  }, [jumpToPage]);

  // ---------- 键盘翻页 ----------
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target && /^(input|textarea|select)$/i.test(target.tagName)) return;
      if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
        e.preventDefault();
        jumpToPage(currentPageRef.current - 1);
      } else if (e.key === 'ArrowRight' || e.key === 'PageDown' || e.key === ' ') {
        e.preventDefault();
        jumpToPage(currentPageRef.current + 1);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [jumpToPage]);

  return (
    <div className="ab-pdf">
      <style>{STYLES}</style>
      <div className="ab-pdf__body">
        {/* 目录侧边栏 (可折叠); 折叠时 width:0 完全隐藏 */}
        {!loading && !error && (
          <div className={tocOpen ? 'ab-pdf__toc ab-pdf__toc--open' : 'ab-pdf__toc'}>
            <div className="ab-pdf__toc-head">
              <span className="ab-pdf__toc-title">目录</span>
              <span className="ab-pdf__toc-pageno">{currentPage} / {numPages}</span>
              <button className="ab-pdf__toc-toggle" title="折叠目录" onClick={() => setTocOpen(false)}>‹</button>
            </div>
            {tocOpen && (
              <div className="ab-pdf__toc-tree">
                {outline.length === 0
                  ? <div className="ab-pdf__toc-empty">暂无目录</div>
                  : <TocTree items={outline} depth={0} defaultCollapsed={new Set<string>()} onJump={jumpToOutlineDest} />}
              </div>
            )}
          </div>
        )}
        {/* viewer div: 永不包含 React children, page DOM 全部手动插入 */}
        <div className="ab-pdf__viewerContainer" ref={viewerRef} />
        {/* 折叠后的展开入口: viewer 左上角浮动按钮 */}
        {!tocOpen && !loading && !error && (
          <button className="ab-pdf__toc-open-btn" title="展开目录" onClick={() => setTocOpen(true)}>☰ 目录</button>
        )}
        {/* 缩放档位: 右下角浮动按钮 (-/100%/+), 切 userScaleIdx */}
        {!loading && !error && (
          <div className="ab-pdf__zoom">
            <button
              className="ab-pdf__zoom-btn"
              title="缩小"
              disabled={userScaleIdx === 0}
              onClick={() => {
                zoomAnchorPageRef.current = currentPageRef.current;
                setUserScaleIdx((prev) => Math.max(0, prev - 1));
                setRebuildTick((t) => t + 1);
              }}
            >−</button>
            <button className="ab-pdf__zoom-btn ab-pdf__zoom-btn--current" title="当前缩放比例" disabled>
              {Math.round(USER_SCALES[userScaleIdx] * 100)}%
            </button>
            <button
              className="ab-pdf__zoom-btn"
              title="放大"
              disabled={userScaleIdx === USER_SCALES.length - 1}
              onClick={() => {
                zoomAnchorPageRef.current = currentPageRef.current;
                setUserScaleIdx((prev) => Math.min(USER_SCALES.length - 1, prev + 1));
                setRebuildTick((t) => t + 1);
              }}
            >+</button>
          </div>
        )}
      </div>

      {loading && (
        <div className="ab-pdf__loading">
          <div className="ab-pdf__loadingText">加载 PDF 中…</div>
          <div className="ab-pdf__progress">
            <div className="ab-pdf__progressBar" style={{ width: '40%', animation: 'ab-pdf-indet 1.2s ease-in-out infinite' }} />
          </div>
        </div>
      )}

      {error && <div className="ab-pdf__error">无法加载: {error}</div>}
    </div>
  );
};

/* ========== 目录树 (TOC) 递归组件 ========== */
function TocTree({ items, depth, defaultCollapsed, onJump }: {
  items: any[];
  depth: number;
  defaultCollapsed: Set<string>;
  onJump: (dest: any) => void;
}): React.ReactElement {
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set(defaultCollapsed));
  const toggle = (title: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(title)) next.delete(title); else next.add(title);
      return next;
    });
  };
  return (
    <ul className="ab-pdf__toc-list" style={{ paddingLeft: depth * 12 }}>
      {items.map((item, i) => {
        const key = `${depth}-${i}-${item.title || ''}`;
        const hasChildren = Array.isArray(item.items) && item.items.length > 0;
        const isCollapsed = hasChildren && collapsed.has(item.title || key);
        return (
          <li key={key} className="ab-pdf__toc-item">
            <div className="ab-pdf__toc-row" style={{ paddingLeft: hasChildren ? 0 : 14 }}>
              {hasChildren ? (
                <button className="ab-pdf__toc-caret" onClick={() => toggle(item.title || key)} title={isCollapsed ? '展开' : '折叠'}>
                  {isCollapsed ? '▸' : '▾'}
                </button>
              ) : <span className="ab-pdf__toc-dot" />}
              <button className="ab-pdf__toc-label" title={item.title || ''} onClick={() => { if (item.dest) onJump(item.dest); }}>
                {item.title || '(无标题)'}
              </button>
            </div>
            {hasChildren && !isCollapsed && (
              <TocTree items={item.items} depth={depth + 1} defaultCollapsed={defaultCollapsed} onJump={onJump} />
            )}
          </li>
        );
      })}
    </ul>
  );
}

const STYLES = `
.ab-pdf {
  position: absolute; inset: 0;
  display: flex; flex-direction: column;
  background: transparent;
  color: var(--editor-foreground);
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "PingFang SC", sans-serif;
  overflow: hidden;
}
.ab-pdf__body {
  flex: 1; min-height: 0;
  display: flex; flex-direction: row;
  overflow: hidden;
  position: relative;
}
/* ===== 目录侧边栏 ===== */
.ab-pdf__toc {
  flex-shrink: 0;
  display: flex; flex-direction: column;
  width: 0;
  background: transparent;
  overflow: hidden;
  transition: width .18s ease;
}
.ab-pdf__toc--open { width: 240px; }
.ab-pdf__toc-head {
  display: flex; align-items: center; gap: 6px;
  padding: 6px 8px;
  font-size: 12.5px; font-weight: 600;
  white-space: nowrap; overflow: hidden;
  box-shadow: 0 2px 8px rgba(0,0,0,0.15);
}
.ab-pdf__toc-toggle {
  width: 22px; height: 22px;
  background: var(--button-secondaryBackground, rgba(128,128,128,0.15));
  color: inherit;
  border: none; border-radius: 5px;
  cursor: pointer; font-size: 13px; line-height: 1;
  flex-shrink: 0;
}
.ab-pdf__toc-toggle:hover { background: var(--button-secondaryHoverBackground, rgba(128,128,128,0.3)); }
.ab-pdf__toc-title { flex: 1; text-align: left; }
.ab-pdf__toc-pageno {
  font-size: 11px; font-weight: 400;
  color: var(--descriptionForeground, var(--vscode-descriptionForeground, #9ca3af));
  white-space: nowrap;
}
.ab-pdf__toc-tree {
  flex: 1; min-height: 0;
  overflow-y: auto; overflow-x: hidden;
  padding: 4px 0;
}
.ab-pdf__toc-empty { padding: 12px 10px; font-size: 12px; color: var(--descriptionForeground, #888); }
.ab-pdf__toc-list { list-style: none; margin: 0; padding: 0; }
.ab-pdf__toc-item { margin: 0; }
.ab-pdf__toc-row { display: flex; align-items: center; min-height: 24px; }
.ab-pdf__toc-caret {
  width: 20px; height: 24px;
  background: none; border: none; color: inherit;
  cursor: pointer; font-size: 10px; line-height: 1;
  flex-shrink: 0; padding: 0;
}
.ab-pdf__toc-dot { width: 20px; flex-shrink: 0; }
.ab-pdf__toc-label {
  flex: 1; min-width: 0;
  background: none; border: none; color: inherit;
  text-align: left; font: inherit; font-size: 12.5px;
  cursor: pointer; padding: 3px 6px;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  border-radius: 4px;
}
.ab-pdf__toc-label:hover { background: var(--list-hoverBackground, rgba(128,128,128,0.2)); }
.ab-pdf__toc-open-btn {
  position: absolute;
  top: 8px; left: 8px;
  z-index: 10;
  padding: 4px 10px;
  background: var(--button-secondaryBackground, rgba(128,128,128,0.15));
  color: inherit;
  border: 1px solid var(--panel-border, var(--vscode-panel-border, rgba(128,128,128,0.2)));
  border-radius: 6px;
  font-size: 12px; cursor: pointer;
}
.ab-pdf__toc-open-btn:hover { background: var(--button-secondaryHoverBackground, rgba(128,128,128,0.3)); }
.ab-pdf__viewerContainer {
  flex: 1; min-height: 0;
  position: relative;
  overflow-x: hidden;
  overflow-y: auto;
  padding: 8px 0;
  display: block;
  background: transparent;
}
.ab-pdf-page {
  position: relative;
  background: #fff;
  box-shadow: 0 2px 8px rgba(0,0,0,0.5);
  flex-shrink: 0;
  overflow: hidden;
}
.ab-pdf-canvas {
  display: block;
  width: 100% !important;
  height: 100% !important;
}
.ab-pdf__error {
  position: absolute; inset: 0;
  margin: auto;
  color: var(--errorForeground, var(--vscode-errorForeground, #f87171)); font-size: 14px; padding: 20px;
  text-align: center;
  display: flex; align-items: center; justify-content: center;
}
.ab-pdf__loading {
  position: absolute; inset: 0;
  margin: auto;
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  gap: 14px;
  color: var(--descriptionForeground, var(--vscode-descriptionForeground, #9ca3af)); font-size: 13px;
  background: var(--editor-background, var(--vscode-editor-background));
  z-index: 5;
}
.ab-pdf__loadingText { font-variant-numeric: tabular-nums; }
.ab-pdf__progress { width: min(360px, 60%); height: 4px; background: var(--progressBar-inactiveBackground, rgba(128,128,128,0.2)); border-radius: 2px; overflow: hidden; }
.ab-pdf__progressBar { height: 100%; background: var(--progressBar-background, var(--vscode-progressBar-background, #2563eb)); transition: width .12s linear; }
@keyframes ab-pdf-indet { 0% { margin-left: -40%; } 100% { margin-left: 100%; } }
/* ===== 缩放控件 (浮在 viewer 右下角) ===== */
.ab-pdf__zoom {
  position: absolute;
  right: 16px;
  bottom: 16px;
  z-index: 30;
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 2px;
  padding: 3px;
  background: var(--editorWidget-background, var(--vscode-editorWidget-background, #2d2d30));
  border-radius: 10px;
  box-shadow:
    0 1px 2px rgba(0, 0, 0, 0.06),
    0 4px 12px rgba(0, 0, 0, 0.12),
    0 16px 40px rgba(0, 0, 0, 0.20),
    0 0 0 1px rgba(0, 0, 0, 0.04);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
}
.ab-pdf__zoom-btn {
  width: 26px;
  height: 24px;
  padding: 0;
  background: transparent;
  color: var(--editor-foreground, var(--vscode-editor-foreground, #e5e7eb));
  border: none;
  border-radius: 5px;
  cursor: pointer;
  font-size: 12px;
  font-weight: 500;
  font-variant-numeric: tabular-nums;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.12s ease, transform 0.12s ease, color 0.12s ease;
}
.ab-pdf__zoom-btn:hover:not(:disabled) {
  background: var(--button-hoverBackground, var(--vscode-button-hoverBackground, rgba(255, 255, 255, 0.1)));
  transform: scale(1.05);
}
.ab-pdf__zoom-btn:active:not(:disabled) {
  background: var(--button-activeBackground, var(--vscode-button-activeBackground, rgba(255, 255, 255, 0.18)));
  transform: scale(0.94);
}
.ab-pdf__zoom-btn:disabled {
  opacity: 0.35;
  cursor: not-allowed;
}
.ab-pdf__zoom-btn--current {
  width: 42px;
  height: 24px;
  font-size: 11px;
  font-weight: 600;
  color: var(--textLink-foreground, var(--vscode-textLink-foreground, #3794ff));
  position: relative;
  margin: 0 2px;
}
.ab-pdf__zoom-btn--current::before,
.ab-pdf__zoom-btn--current::after {
  content: '';
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  width: 1px;
  height: 60%;
  background: var(--panel-border, var(--vscode-panel-border, rgba(128,128,128,0.2)));
}
.ab-pdf__zoom-btn--current::before { left: -2px; }
.ab-pdf__zoom-btn--current::after { right: -2px; }
.ab-pdf__zoom-btn--current:hover:not(:disabled) {
  background: var(--textLink-foreground, var(--vscode-textLink-foreground, #3794ff));
  color: var(--editor-background, var(--vscode-editor-background, #1e1e1e));
  transform: scale(1.05);
}
.ab-pdf__zoom-btn--current:hover:not(:disabled)::before,
.ab-pdf__zoom-btn--current:hover:not(:disabled)::after {
  background: transparent;
}
`;

const el = document.getElementById('root');
if (el) createRoot(el).render(<PdfViewer />);
