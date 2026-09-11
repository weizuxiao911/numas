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

import { AnnotateLayer, ANNO_STYLES, type Annotation, type AnnoCapability, type AnnoRect } from './annotate';

/** vscode webview API (与 pdf 拓展宿主通信: 标注读写/AI 生成/终端执行) */
const vscode = (window as any).acquireVsCodeApi ? (window as any).acquireVsCodeApi() : null;

const CFG = ((window as any).__PDF_CFG__ || {}) as {
  registryBase?: string;
  name?: string;
  pdfjsBase?: string;
  fetch?: { rel?: string; headerDir?: string; error?: string };
  distBase?: string;
};
// pdfjs 基址由 extension host 用 asWebviewUri 解析 (自适应内置/网关市场路径);
// 兜底: 老 shell 无 pdfjsBase 时按 registryBase 拼 (内置市场形态).
const PDFJS_BASE = String(
  CFG.pdfjsBase || `${String(CFG.registryBase || '').replace(/\/+$/, '')}/numas.pdf-0.1.0/pdfjs`,
).replace(/\/+$/, '');

/* ===== codicon 图标字体 (docx 同款; 字体 URL 由 host asWebviewUri 注入) ===== */
const DIST_BASE = String((CFG as any).distBase || '.').replace(/\/+$/, '');
if (typeof document !== 'undefined' && !document.getElementById('pdf-codicon-styles')) {
  const el = document.createElement('style');
  el.id = 'pdf-codicon-styles';
  el.textContent = `
@font-face { font-family: codicon; font-display: block; src: url('${DIST_BASE}/codicon.ttf') format('truetype'); }
.codicon {
  font: normal normal normal 16px/1 codicon;
  display: inline-block;
  text-decoration: none;
  text-rendering: auto;
  text-align: center;
  text-transform: none;
  -webkit-font-smoothing: antialiased;
  user-select: none;
}
.codicon-zoom-out:before { content: '\\eb82'; }
.codicon-zoom-in:before { content: '\\eb81'; }
`;
  document.head.appendChild(el);
}

/* ===== 标注样式注入 (module 加载时; webview 文档内) ===== */
if (typeof document !== 'undefined' && !document.getElementById('pdf-anno-styles')) {
  const annoStyleEl = document.createElement('style');
  annoStyleEl.id = 'pdf-anno-styles';
  annoStyleEl.textContent = ANNO_STYLES;
  document.head.appendChild(annoStyleEl);
}

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
  /** 缩放百分比 (50-200, step 5; 与 docx 缩放条一致); 高度主导缩放 */
  const [zoomPct, setZoomPct] = useState(100);
  /** 最新缩放 (rebuild/懒渲染读 ref, 避免 zoomPct 进 rebuildViewer deps 触发重建) */
  const zoomPctRef = useRef(100);
  // 与 docx ZoomController 对齐: 25-400, 步进 10, 任意整数
  const MIN_ZOOM = 25;
  const MAX_ZOOM = 400;
  const ZOOM_STEP = 10;
  const clampZoom = (n: number) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, Math.round(n)));
  /**
   * 缩放 (docx 同款: CSS `zoom` 属性缩放布局盒, 不重建 DOM).
   * 视觉锚点: 记录当前页视觉 top, 缩放后恢复 → 视野不跳.
   */
  const applyZoom = (n: number) => {
    const viewer = viewerRef.current;
    const anchor = viewer ? pageElsRef.current.get(currentPageRef.current) : null;
    const beforeTop = anchor ? anchor.getBoundingClientRect().top : null;
    const v = clampZoom(n);
    setZoomPct(v);
    // docx updateZoom 同款: 非聚焦时同步 slider (聚焦中不抢拖动)
    const slider = viewer?.parentElement?.querySelector<HTMLInputElement>('.ab-pdf__zoombar-slider');
    if (slider && document.activeElement !== slider) slider.value = String(v);
    if (viewer && beforeTop !== null) {
      requestAnimationFrame(() => {
        const el = pageElsRef.current.get(currentPageRef.current);
        if (el) viewer.scrollTop += el.getBoundingClientRect().top - beforeTop;
      });
    }
  };
  const zoomIn = () => applyZoom(zoomPctRef.current + ZOOM_STEP);
  const zoomOut = () => applyZoom(zoomPctRef.current - ZOOM_STEP);
  const zoomReset = () => applyZoom(100);

  // Ctrl/Cmd + 滚轮缩放 (docx handleWheel 同款)
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer) return;
    const onWheel = (e: WheelEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      e.preventDefault();
      applyZoom(zoomPctRef.current - e.deltaY * 0.1);
    };
    viewer.addEventListener('wheel', onWheel, { passive: false });
    return () => viewer.removeEventListener('wheel', onWheel);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ─────────── 标注: anno 文件 I/O (同源 /api/fs/*, 宿主不碰 fs) ───────────

  const fsHeaders = useCallback(() => ({ 'x-opencode-directory': encodeURI(CFG.fetch?.headerDir || '') }), []);
  const hostDir = () => {
    const p = CFG.hostPath || '';
    const i = Math.max(p.lastIndexOf('/'), p.lastIndexOf('\\'));
    return i > 0 ? p.slice(0, i) : p;
  };
  const relDir = () => {
    const rel = CFG.fetch?.rel || '';
    const i = rel.lastIndexOf('/');
    return i >= 0 ? rel.slice(0, i + 1) : '';
  };
  const hash8 = async (name: string): Promise<string> => {
    try {
      const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(name));
      return Array.from(new Uint8Array(digest)).slice(0, 4).map((b) => b.toString(16).padStart(2, '0')).join('');
    } catch {
      let h = 5381;
      for (let i = 0; i < name.length; i++) h = ((h << 5) + h + name.charCodeAt(i)) | 0;
      return (h >>> 0).toString(16).padStart(8, '0');
    }
  };
  const annoRel = useCallback(async () => `${relDir()}.${await hash8(CFG.name || 'document.pdf')}.anno`, []);
  const productAbs = useCallback(async (id: string, ext: string) => `${hostDir()}/.${await hash8(CFG.name || 'document.pdf')}.anno.${id}.${ext}`, []);

  const readAnnoRemote = useCallback(async (): Promise<Annotation[]> => {
    try {
      const res = await fetch(`/api/fs/read/${encodeURIComponent(await annoRel())}`, { headers: fsHeaders() });
      if (!res.ok) return [];
      const parsed = await res.json();
      return Array.isArray(parsed?.annotations) ? parsed.annotations : [];
    } catch {
      return [];
    }
  }, [annoRel, fsHeaders]);

  const writeAnnoRemote = useCallback(async (list: Annotation[]): Promise<void> => {
    try {
      const text = `${JSON.stringify({ version: 1, file: CFG.name || '', annotations: list }, null, 2)}\n`;
      // 服务端 /api/fs/write 约定 content 为 base64 (与 sumi filesystem.service 一致)
      const bytes = new TextEncoder().encode(text);
      let bin = '';
      const CHUNK = 0x8000;
      for (let i = 0; i < bytes.length; i += CHUNK) {
        bin += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
      }
      const b64 = btoa(bin);
      await fetch('/api/fs/write', {
        method: 'POST',
        headers: { ...fsHeaders(), 'content-type': 'application/json' },
        body: JSON.stringify({ path: await annoRel(), content: b64 }),
      });
    } catch { /* ignore */ }
  }, [annoRel, fsHeaders]);

  const productExistsRemote = useCallback(async (id: string, ext: string): Promise<boolean> => {
    try {
      const res = await fetch(`/api/fs/read/${encodeURIComponent(`${relDir()}.${await hash8(CFG.name || 'document.pdf')}.anno.${id}.${ext}`)}`, { headers: fsHeaders() });
      return res.ok;
    } catch {
      return false;
    }
  }, [fsHeaders]);

  // 初始加载 anno
  useEffect(() => {
    void readAnnoRemote().then((list) => {
      setAnnotations(list);
      // 恢复 generating 状态的产物监听 (页面刷新/重开后轮询不丢, 否则状态永久卡 generating)
      for (const a of list) {
        if (a.animation?.status === 'generating') watchProductRef.current?.(a.id, 'animation');
        if (a.code?.status === 'generating') {
          const ext = (a.code.file || '').split('.').pop() || detectLang(a.text).ext;
          watchProductRef.current?.(a.id, 'code', ext);
        }
      }
    });
  }, [readAnnoRemote]);

  /** 提取页内 rect 区域的文本 (pdf.js textContent, 归一化坐标重叠过滤) */
  const extractTextForRect = useCallback(async (page: number, rect: AnnoRect): Promise<string> => {
    const pdf = pdfDocRef.current;
    if (!pdf) return '';
    try {
      const p = await pdf.getPage(page);
      const vp = p.getViewport({ scale: 1 });
      const content = await p.getTextContent();
      const parts: string[] = [];
      for (const item of content.items as any[]) {
        const tr = item.transform || [];
        const ix = (tr[4] || 0) / vp.width;
        const iy = 1 - (tr[5] || 0) / vp.height - Math.abs(item.height || 10) / vp.height;
        const iw = Math.abs(item.width || 0) / vp.width;
        const ih = Math.abs(item.height || 10) / vp.height;
        const overlap = ix < rect.x + rect.w && ix + iw > rect.x && iy < rect.y + rect.h && iy + ih > rect.y;
        if (overlap && item.str) parts.push(item.str);
      }
      return parts.join(' ').replace(/\s+/g, ' ').trim().slice(0, 2000);
    } catch {
      return '';
    }
  }, []);

  /** 生成标注: 释放即完成 (默认色, 提取文本后立即落盘); 返回新标注 id */
  const onCreateRegion = useCallback(async (page: number, rect: AnnoRect, color: string): Promise<string | null> => {
    const list = await readAnnoRemote();
    const maxId = list.reduce((m, a) => {
      const mm = /^a(\d+)$/.exec(a.id);
      return mm ? Math.max(m, Number(mm[1])) : m;
    }, 0);
    const id = `a${maxId + 1}`;
    const text = await extractTextForRect(page, rect);
    const next = [...list, { id, page, rect, color, text, createdAt: Date.now() }];
    setAnnotations(next);
    await writeAnnoRemote(next);
    return id;
  }, [readAnnoRemote, writeAnnoRemote, extractTextForRect]);

  const onRecolor = useCallback((id: string, color: string) => {
    void (async () => {
      const list = await readAnnoRemote();
      const a = list.find((x) => x.id === id);
      if (!a) return;
      a.color = color;
      setAnnotations([...list]);
      await writeAnnoRemote(list);
    })();
  }, [readAnnoRemote, writeAnnoRemote]);

  const onDelete = useCallback((id: string) => {
    void (async () => {
      const list = (await readAnnoRemote()).filter((x) => x.id !== id);
      setAnnotations(list);
      await writeAnnoRemote(list);
    })();
  }, [readAnnoRemote, writeAnnoRemote]);

  /** 圈选内容 → 编程语言 (关键字识别; 未命中默认 Python) */
  const detectLang = useCallback((text: string): { lang: string; ext: string } => {
    const t = text || '';
    if (/\b(java|jdk|jvm|spring|maven|gradle)\b/i.test(t)) return { lang: 'Java', ext: 'java' };
    if (/\b(c\+\+|cpp|stl|gcc|g\+\+)\b/i.test(t)) return { lang: 'C++', ext: 'cpp' };
    if (/\b(c#|csharp|\.net|dotnet)\b/i.test(t)) return { lang: 'C#', ext: 'cs' };
    if (/\b(golang|goroutine)\b|\bgo\b/i.test(t)) return { lang: 'Go', ext: 'go' };
    if (/\b(rust|cargo)\b/i.test(t)) return { lang: 'Rust', ext: 'rs' };
    if (/\b(typescript)\b/i.test(t)) return { lang: 'TypeScript', ext: 'ts' };
    if (/\b(javascript|node\.?js|npm|es6)\b/i.test(t)) return { lang: 'JavaScript', ext: 'js' };
    if (/\b(sql|mysql|postgres|sqlite)\b/i.test(t)) return { lang: 'SQL', ext: 'sql' };
    return { lang: 'Python', ext: 'py' };
  }, []);

  /** AI 生成 prompt (标注信息 + 能力指令 + 产物确定性路径) */
  const buildPrompt = useCallback((kind: 'animation' | 'code', a: Annotation, productAbsPath: string): string => {
    const rect = [a.rect.x, a.rect.y, a.rect.w, a.rect.h].map((n) => n.toFixed(4)).join(', ');
    const head = [
      'PDF 圈选标注:',
      `- 源文件: ${CFG.hostPath || ''}`,
      `- 页码: ${a.page}`,
      `- 圈选区域(页内归一化 x,y,w,h): [${rect}]`,
      a.text ? `- 圈选内容: ${a.text}` : '- 圈选内容: (未能自动提取, 请依据源文件与页码位置自行读取)',
    ].join('\n');
    const task = kind === 'animation'
      ? [
          '任务: 为该区域内容生成一个"可交互的 HTML5 动画讲解"页面.',
          '要求:',
          '1. 单文件自包含 (所有 CSS/JS 内联, 不引用任何外部资源/CDN)',
          '2. 提供数据输入框 (如逗号分隔数字/文本), 用户可输入任意数据',
          '3. 点击「开始演示」后用动画逐步演示算法/概念过程 (每一步有高亮与说明)',
          '4. 控制按钮: 开始 / 暂停 / 重置',
          '5. 界面美观 (深色/浅色自适应), 中文文案',
        ].join('\n')
      : [
          '任务: 为该区域内容生成一个可直接运行的代码示例文件.',
          '要求:',
          `1. 编程语言必须与圈选内容涉及的编程语言一致 (初步判定: ${detectLang(a.text).lang}; 若内容明确提到其它语言, 以内容为准)`,
          '2. 代码自包含, 不依赖外部服务 (需要三方库时在文件头注释安装命令)',
          '3. 关键逻辑有中文注释; 运行后打印清晰结果',
          '4. 文件首行必须是运行命令注释, 格式 `<语言注释符> run: <完整运行命令>` (例: `# run: python3 /abs/xxx.py`; `// run: javac /abs/Main.java && java -cp /abs Main`)',
          '5. 只输出代码文件内容, 不要解释',
        ].join('\n');
    return [head, '', task, '', `产物要求: 直接写入文件 ${productAbsPath} (不要创建其它文件, 不要输出解释文字)`].join('\n');
  }, []);

  /** 产物首行约定 `run: <cmd>` 提取运行命令 (语言无关); 缺失时按扩展名兜底 */
  const extractRunCommand = useCallback(async (id: string, ext: string, abs: string): Promise<string | undefined> => {
    try {
      const name = `.${await hash8(CFG.name || 'document.pdf')}.anno.${id}.${ext}`;
      const res = await fetch(`/api/fs/read/${encodeURIComponent(`${relDir()}${name}`)}`, { headers: fsHeaders() });
      if (res.ok) {
        const head = (await res.text()).slice(0, 800);
        const m = /(?:#|\/\/|\/\*|--|;)\s*run:\s*(.+)/i.exec(head);
        if (m) return m[1].trim();
      }
    } catch { /* ignore */ }
    return ext === 'py' ? `python3 "${abs}"` : undefined;
  }, [fsHeaders]);

  /** 轮询产物出现 → ready; 超时 → failed (生成入口 + 刷新恢复共用) */
  const watchProduct = useCallback((id: string, action: 'animation' | 'code', extArg?: string) => {
    void (async () => {
      const ext = extArg || (action === 'animation' ? 'html' : 'py');
      const abs = await productAbs(id, ext);
      const deadline = Date.now() + 5 * 60 * 1000;
      while (Date.now() < deadline) {
        await new Promise((r) => setTimeout(r, 2000));
        if (await productExistsRemote(id, ext)) {
          const l2 = await readAnnoRemote();
          const a2 = l2.find((x) => x.id === id);
          if (!a2) return;
          const done: AnnoCapability = { status: 'ready', file: abs };
          if (action === 'code') done.command = await extractRunCommand(id, ext, abs);
          if (action === 'animation') a2.animation = done;
          else a2.code = done;
          setAnnotations([...l2]);
          await writeAnnoRemote(l2);
          return;
        }
      }
      const l3 = await readAnnoRemote();
      const a3 = l3.find((x) => x.id === id);
      if (!a3) return;
      const failed: AnnoCapability = { status: 'failed', error: '生成超时 (5 分钟)' };
      if (action === 'animation') a3.animation = failed;
      else a3.code = failed;
      setAnnotations([...l3]);
      await writeAnnoRemote(l3);
    })();
  }, [readAnnoRemote, writeAnnoRemote, productAbs, productExistsRemote]);
  const watchProductRef = useRef<typeof watchProduct | null>(null);
  watchProductRef.current = watchProduct;

  /** 生成动画/代码: 置 generating → chatbot.send → 轮询产物 → ready */
  const onGenerate = useCallback((id: string, action: 'animation' | 'code') => {
    void (async () => {
      const list = await readAnnoRemote();
      const a = list.find((x) => x.id === id);
      if (!a) return;
      const ext = action === 'animation' ? 'html' : detectLang(a.text).ext;
      const abs = await productAbs(id, ext);
      const cap: AnnoCapability = { status: 'generating' };
      if (action === 'animation') a.animation = cap;
      else a.code = cap;
      setAnnotations([...list]);
      await writeAnnoRemote(list);
      vscode?.postMessage({ type: 'ai.send', prompt: buildPrompt(action, a, abs) });
      watchProduct(id, action, ext);
    })();
  }, [readAnnoRemote, writeAnnoRemote, productAbs, buildPrompt, watchProduct]);

  /** 动画演示: 宿主 vscode.open 打开产物 HTML */
  const onPlayAnimation = useCallback((id: string) => {
    void (async () => {
      const a = (await readAnnoRemote()).find((x) => x.id === id);
      if (a?.animation?.file) vscode?.postMessage({ type: 'openFile', path: a.animation.file });
    })();
  }, [readAnnoRemote]);

  /** 运行代码: 打开代码文件 + 终端执行 */
  const onRunCode = useCallback((id: string) => {
    void (async () => {
      const a = (await readAnnoRemote()).find((x) => x.id === id);
      if (!a?.code) return;
      if (a.code.file) vscode?.postMessage({ type: 'openFile', path: a.code.file });
      if (a.code.command) vscode?.postMessage({ type: 'runCommand', command: a.code.command });
    })();
  }, [readAnnoRemote]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [numPages, setNumPages] = useState(0);
  /** 当前页码 (ref, 避免放入 rebuildViewer deps 触发死循环) */
  const currentPageRef = useRef<number>(1);
  /** rebuild 进行中 (计数): 期间 onScroll 不更新 currentPageRef (防 innerHTML='' 后 scrollTop 归零污染成 1) */
  const rebuildingRef = useRef(0);
  const [currentPage, _setCurrentPage] = useState(1);
  /** PDF 目录树 (pdf.getOutline() 嵌套结构) */
  const [outline, setOutline] = useState<any[]>([]);
  /** 侧栏模式: none | toc(目录) | activity(交互活动) — 互斥切换 */
  const [sidebarMode, setSidebarMode] = useState<'none' | 'toc' | 'activity'>('none');
  const tocOpen = sidebarMode === 'toc';
  const setTocOpen = (v: boolean | ((prev: boolean) => boolean)) => {
    setSidebarMode((prev) => {
      const next = typeof v === 'function' ? (v as any)(prev === 'toc') : v;
      return next ? 'toc' : 'none';
    });
  };
  /** 标注信息 (默认显示) */
  const [annoVisible, setAnnoVisible] = useState(true);
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const hostPathRef = useRef<string>(CFG.hostPath || '');
  /** resize/缩放触发重建的 tick */
  const [rebuildTick, setRebuildTick] = useState(0);
  /** 骨架构建完成计数 (rebuild 末尾递增; 标注蒙层依赖它触发重挂) */
  const [pagesBuilt, setPagesBuilt] = useState(0);
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
    if (!div || !div.parentNode) return;

    // 高度主导缩放: 视口高 × 档位
    const viewBaseH = Math.max(viewer.clientHeight || 1, 1);
    const dpr = window.devicePixelRatio || 1;

    const p = await pdf.getPage(pageIdx);
    if (myBuildId !== undefined && buildIdRef.current !== myBuildId) return;
    const pb = p.getViewport({ scale: 1 });

    const pageW = div.clientWidth || div.offsetWidth;
    const renderScale = (pageW / pb.width) * dpr * (zoomPctRef.current / 100);
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

    // 宽度适配 (与 docx 一致): 页面基准宽 = viewer 视口宽; 缩放走 surface 的 CSS `zoom` 属性
    const viewW = Math.max(viewer.clientWidth || 1, 1);
    const pageGap = 8;

    // 重建前记当前页 + 页顶相对视口的视觉偏移 (兼容 CSS zoom)
    const prevPage = currentPageRef.current;
    const prevPageEl = pageElsRef.current.get(prevPage);
    const prevOffset = prevPageEl
      ? prevPageEl.getBoundingClientRect().top - viewer.getBoundingClientRect().top
      : 0;
    // 重建期间屏蔽 onScroll 页码更新
    rebuildingRef.current++;
    try {
      viewer.innerHTML = '';
      // surface: 内容承载 + CSS zoom (布局盒缩放, 滚动条正确; 与 docx .zoom-surface 同款)
      const surface = document.createElement('div');
      surface.className = 'ab-pdf__surface';
      surface.style.zoom = String(zoomPctRef.current / 100);
      viewer.appendChild(surface);
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
        const pageW = viewW;
        const pageH = aspect > 0 ? pageW / aspect : pageW / 0.75;
        const div = document.createElement('div');
        div.className = 'ab-pdf-page ab-pdf-page--skeleton';
        div.dataset['page'] = String(i);
        div.style.cssText = `position:relative;width:${pageW}px;height:${pageH}px;margin:0 auto ${pageGap}px;`;
        surface.appendChild(div);
        pageElsRef.current.set(i, div);
      }

      // 懒加载当前可见页 ±5 (重建后立即渲染视口附近, 不空白)
      await lazyLoadRange(prevPage, myBuildId);
    } finally {
      rebuildingRef.current--;
      setPagesBuilt((v) => v + 1);
    }

    // 重建后恢复滚动位置
    if (prevPage > 1) {
      requestAnimationFrame(() => {
        if (buildIdRef.current !== myBuildId) return; // 期间又有新 build → 放弃
        const target = pageElsRef.current.get(prevPage);
        if (target) {
          const delta = target.getBoundingClientRect().top - viewer.getBoundingClientRect().top;
          viewer.scrollTop = viewer.scrollTop + delta - prevOffset;
        }
      });
    }
  }, [numPages, rebuildTick, lazyLoadRange]);

  // ---------- 滚动同步当前页码 ----------
  useEffect(() => {
    if (!numPages) return;
    const viewer = viewerRef.current;
    if (!viewer) return;
    const onScroll = () => {
      if (rebuildingRef.current > 0) return;
      // 用 viewer 可视区中点的 y 找当前页 (视觉坐标, 兼容 CSS zoom)
      const midY = viewer.getBoundingClientRect().top + viewer.clientHeight / 2;
      const pages = Array.from(pageElsRef.current.entries()).filter(([, el]) => !!el);
      let current = 1;
      for (const [idx, el] of pages) {
        if (midY >= el.getBoundingClientRect().top) current = idx;
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

  // ---------- 缩放同步: surface 的 CSS zoom (docx 同款, 不重建 DOM) ----------
  React.useLayoutEffect(() => {
    zoomPctRef.current = zoomPct;
    const surface = viewerRef.current?.querySelector('.ab-pdf__surface') as HTMLElement | null;
    if (surface) surface.style.zoom = String(zoomPct / 100);
  }, [zoomPct]);

  // 缩放稳定后重渲染可见页 (位图分辨率跟上新缩放, 防糊)
  useEffect(() => {
    if (!numPages) return;
    const timer = setTimeout(() => {
      renderedRef.current.clear();
      void lazyLoadRange(currentPageRef.current);
    }, 220);
    return () => clearTimeout(timer);
  }, [zoomPct, numPages, lazyLoadRange]);

  // ---------- 页宽变化 (窗口 resize) → 重建 ----------
  useEffect(() => {
    const onResize = () => setRebuildTick((t) => t + 1);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  /** 交互活动列表: 按页码+位置排序 */
  const sortedAnno = React.useMemo(
    () => [...annotations].sort((a, b) => a.page - b.page || a.rect.y - b.rect.y || a.rect.x - b.rect.x),
    [annotations],
  );

  /** 跳转到标注区域 (滚动 + 视觉居中偏上) */
  const jumpToAnno = useCallback((a: Annotation) => {
    const viewer = viewerRef.current;
    const el = pageElsRef.current.get(a.page);
    if (!viewer || !el) return;
    const er = el.getBoundingClientRect();
    const vr = viewer.getBoundingClientRect();
    const top = viewer.scrollTop + (er.top - vr.top) + a.rect.y * er.height - vr.height * 0.3;
    viewer.scrollTo({ top: Math.max(0, top), behavior: 'smooth' });
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
      {/* 顶部功能区 (与 docx 阅读器统一: 白底/无边框/34px) */}
      <header className="ab-pdf__toolbar">
        <span className="ab-pdf__toolbar-file" title={CFG.name || ''}>{CFG.name || 'PDF'}</span>
        <span className="ab-pdf__toolbar-spacer" />
        {!loading && !error && (
          <>
            <button
              className={sidebarMode === 'toc' ? 'ab-pdf__toolbar-btn is-on' : 'ab-pdf__toolbar-btn'}
              title="目录"
              onClick={() => setSidebarMode((m) => (m === 'toc' ? 'none' : 'toc'))}
            >
              <svg viewBox="0 0 16 16" width="15" height="15" fill="none" aria-hidden="true">
                <path d="M2.5 4.5h11M4.5 8h9M6.5 11.5h7" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
              </svg>
            </button>
            <button
              className={sidebarMode === 'activity' ? 'ab-pdf__toolbar-btn is-on' : 'ab-pdf__toolbar-btn'}
              title="交互活动"
              onClick={() => setSidebarMode((m) => (m === 'activity' ? 'none' : 'activity'))}
            >
              <svg viewBox="0 0 16 16" width="15" height="15" fill="none" aria-hidden="true">
                <circle cx="8" cy="8" r="5.75" stroke="currentColor" strokeWidth="1.3" />
                <path d="M6.6 5.9l4 2.1-4 2.1z" fill="currentColor" />
              </svg>
            </button>
            <button
              className={annoVisible ? 'ab-pdf__toolbar-btn is-on' : 'ab-pdf__toolbar-btn'}
              title={annoVisible ? '隐藏标注' : '显示标注'}
              onClick={() => setAnnoVisible((v) => !v)}
            >
              <svg viewBox="0 0 16 16" width="15" height="15" fill="none" aria-hidden="true">
                <path d="M1.6 8s2.3-4 6.4-4 6.4 4 6.4 4-2.3 4-6.4 4S1.6 8 1.6 8z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
                <circle cx="8" cy="8" r="1.9" stroke="currentColor" strokeWidth="1.3" />
              </svg>
            </button>
          </>
        )}
      </header>
      <div className="ab-pdf__body">
        {/* 目录侧边栏 (可折叠); 折叠时 width:0 完全隐藏 */}
        {!loading && !error && sidebarMode !== 'none' && (
          <div className="ab-pdf__toc ab-pdf__toc--open">
            <div className="ab-pdf__toc-head">
              <span className="ab-pdf__toc-title">{sidebarMode === 'toc' ? '目录' : '交互活动'}</span>
              <span className="ab-pdf__toc-pageno">{currentPage} / {numPages}</span>
              <button className="ab-pdf__toc-toggle" title="收起" onClick={() => setSidebarMode('none')}>‹</button>
            </div>
            {sidebarMode === 'toc' ? (
              <div className="ab-pdf__toc-tree">
                {outline.length === 0
                  ? <div className="ab-pdf__toc-empty">暂无目录</div>
                  : <TocTree items={outline} depth={0} defaultCollapsed={new Set<string>()} onJump={jumpToOutlineDest} />}
              </div>
            ) : (
              <div className="ab-pdf__toc-tree">
                {sortedAnno.length === 0
                  ? <div className="ab-pdf__toc-empty">暂无标注</div>
                  : sortedAnno.map((a) => (
                    <button
                      key={a.id}
                      className="ab-pdf__activity-item"
                      title={a.text || `第 ${a.page} 页标注`}
                      onClick={() => jumpToAnno(a)}
                    >
                      <span className="ab-pdf__activity-page">P{a.page}</span>
                      <span className="ab-pdf__activity-text">{a.text || '(无文本)'}</span>
                      <span className="ab-pdf__activity-badges">
                        {a.animation?.status === 'ready' && <span title="动画已就绪">🎬</span>}
                        {a.code?.status === 'ready' && <span title="代码已就绪">▶</span>}
                      </span>
                      <span className="ab-pdf__activity-dot" style={{ background: a.color }} />
                    </button>
                  ))}
              </div>
            )}
          </div>
        )}
        {/* 标注层: 蒙层 + 手势 + 弹层 (全在阅读器内) */}
        {!loading && !error && (
          <AnnotateLayer
            visible={annoVisible}
            annotations={annotations}
            getPageEl={(p) => pageElsRef.current.get(p) || null}
            scrollHost={viewerRef.current}
            onCreateRegion={onCreateRegion}
            onGenerate={onGenerate}
            onRecolor={onRecolor}
            onDelete={onDelete}
            onPlayAnimation={onPlayAnimation}
            onRunCode={onRunCode}
            renderTick={rebuildTick}
            pageCount={numPages}
            pagesBuilt={pagesBuilt}
          />
        )}
        {/* viewer div: 永不包含 React children, page DOM 全部手动插入 */}
        <div className="ab-pdf__viewerContainer" ref={viewerRef} />
        {/* 底部缩放条 (与 docx 统一: −/滑块/+/百分比, 右下角悬浮) */}
        {!loading && !error && (
          <div className="ab-pdf__zoombar">
            <button className="ab-pdf__zoombar-btn" title="缩小" onClick={zoomOut}><span className="codicon codicon-zoom-out" /></button>
            <input
              className="ab-pdf__zoombar-slider"
              type="range"
              min={MIN_ZOOM}
              max={MAX_ZOOM}
              step={1}
              defaultValue={zoomPct}
              title="缩放"
              onChange={(e) => applyZoom(Number(e.target.value))}
            />
            <button className="ab-pdf__zoombar-btn" title="放大" onClick={zoomIn}><span className="codicon codicon-zoom-in" /></button>
            <button className="ab-pdf__zoombar-value" title="点击恢复 100%" onClick={zoomReset}>{zoomPct}%</button>
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
/* 顶部功能区 (与 docx 阅读器统一: 白底/无边框/34px) */
.ab-pdf__toolbar {
  display: flex;
  flex: none;
  min-height: 34px;
  align-items: center;
  gap: 6px;
  padding: 2px 10px;
  background: #fff;
  color: var(--vscode-editor-foreground, #1f2329);
}
.ab-pdf__toolbar-file {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 13px;
  font-weight: 600;
}
.ab-pdf__toolbar-spacer { flex: 1; }
.ab-pdf__toolbar-btn {
  height: 24px;
  padding: 0 10px;
  font-size: 12px;
  font-family: inherit;
  color: var(--vscode-editor-foreground, #1f2329);
  background: transparent;
  border: 1px solid var(--panel-border, rgba(17,24,39,0.14));
  border-radius: 6px;
  cursor: pointer;
}
.ab-pdf__toolbar-btn:hover { background: color-mix(in srgb, var(--vscode-charts-blue, #3794ff) 10%, transparent); }
.ab-pdf__toolbar-btn.is-on {
  color: #fff;
  background: var(--button-background, #6d5ef5);
  border-color: transparent;
}
/* 底部缩放条 (与 docx 统一: −/滑块/+/百分比, 右下角悬浮) */
.ab-pdf__zoombar {
  position: absolute;
  right: 14px;
  bottom: 14px;
  z-index: 20;
  display: flex;
  align-items: center;
  gap: 1px;
  padding: 0 4px;
  border-radius: 999px;
  background: #fff;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.18);
  color: var(--vscode-editor-foreground, #1f2329);
}
.ab-pdf__zoombar-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
  padding: 0;
  font-size: 11px;
  line-height: 1;
  color: var(--vscode-editor-foreground, #1f2329);
  background: transparent;
  border: 0;
  border-radius: 3px;
  cursor: pointer;
}
.ab-pdf__zoombar-btn:hover { background: color-mix(in srgb, var(--vscode-editor-foreground, #1f2329) 10%, transparent); }
.ab-pdf__zoombar-btn:focus,
.ab-pdf__zoombar-btn:focus-visible { outline: none; }
.ab-pdf__zoombar,
.ab-pdf__zoombar * { user-select: none; -webkit-user-select: none; }
.ab-pdf__zoombar-slider {
  width: 90px;
  height: 10px;
  margin: 0;
  -webkit-appearance: none;
  appearance: none;
  background: transparent;
  cursor: pointer;
  outline: none;
}
.ab-pdf__zoombar-slider::-webkit-slider-runnable-track {
  height: 3px;
  border-radius: 2px;
  background: rgba(17, 24, 39, 0.18);
}
.ab-pdf__zoombar-slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  width: 10px;
  height: 10px;
  margin-top: -3.5px;
  border-radius: 50%;
  background: var(--vscode-charts-blue, #3794ff);
}
.ab-pdf__zoombar-slider:focus,
.ab-pdf__zoombar-slider:focus-visible,
.ab-pdf__zoombar-slider:active {
  outline: none;
  box-shadow: none;
}
.ab-pdf__zoombar-value {
  min-width: 30px;
  padding: 0 2px;
  text-align: right;
  font-size: 10px;
  font-family: inherit;
  font-variant-numeric: tabular-nums;
  color: var(--vscode-descriptionForeground, #8f8f8f);
  background: transparent;
  border: 0;
  border-radius: 3px;
  cursor: pointer;
}
.ab-pdf__zoombar-value:hover { background: color-mix(in srgb, var(--vscode-editor-foreground, #1f2329) 10%, transparent); }
.ab-pdf {
  position: absolute; inset: 0;
  display: flex; flex-direction: column;
  background: transparent;
  color: var(--vscode-editor-foreground);
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
  color: var(--vscode-descriptionForeground, #8f8f8f);
  white-space: nowrap;
}
.ab-pdf__toc-tree {
  flex: 1; min-height: 0;
  overflow-y: auto; overflow-x: hidden;
  padding: 4px 0;
}
.ab-pdf__activity-item {
  display: flex;
  align-items: center;
  gap: 6px;
  width: 100%;
  padding: 5px 8px;
  font-size: 12px;
  font-family: inherit;
  text-align: left;
  color: var(--vscode-editor-foreground, #1f2329);
  background: transparent;
  border: 0;
  border-radius: 6px;
  cursor: pointer;
}
.ab-pdf__activity-item:hover { background: color-mix(in srgb, var(--vscode-charts-blue, #3794ff) 10%, transparent); }
.ab-pdf__activity-page {
  flex-shrink: 0;
  font-size: 11px;
  color: var(--vscode-descriptionForeground, #8f8f8f);
  font-variant-numeric: tabular-nums;
}
.ab-pdf__activity-text {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.ab-pdf__activity-badges { flex-shrink: 0; font-size: 11px; }
.ab-pdf__activity-dot {
  flex-shrink: 0;
  width: 10px;
  height: 10px;
  border-radius: 3px;
  box-shadow: inset 0 0 0 1px rgba(17, 24, 39, 0.12);
}
.ab-pdf__toc-empty { padding: 12px 10px; font-size: 12px; color: var(--vscode-descriptionForeground, #8f8f8f); }
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
.ab-pdf__surface {
  /* 内容承载 + CSS zoom 缩放 (与 docx .zoom-surface 同款: 布局盒缩放, 滚动条正确) */
  min-height: 100%;
  padding: 0 0 8px;
}
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
  color: var(--vscode-descriptionForeground, #8f8f8f); font-size: 13px;
  background: var(--editor-background, var(--vscode-editor-background));
  z-index: 5;
}
.ab-pdf__loadingText { font-variant-numeric: tabular-nums; }
.ab-pdf__progress { width: min(360px, 60%); height: 4px; background: var(--progressBar-inactiveBackground, rgba(128,128,128,0.2)); border-radius: 2px; overflow: hidden; }
.ab-pdf__progressBar { height: 100%; background: var(--progressBar-background, var(--vscode-progressBar-background, #2563eb)); transition: width .12s linear; }
@keyframes ab-pdf-indet { 0% { margin-left: -40%; } 100% { margin-left: 100%; } }
/* ===== 缩放控件 (浮在 viewer 右下角) ===== */
`;

const el = document.getElementById('root');
if (el) createRoot(el).render(<PdfViewer />);
