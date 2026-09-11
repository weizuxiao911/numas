/**
 * annotate 拓展 — PDF 阅读器适配器
 *
 * 纯外挂: 不改 extensions/pdf vsix, 通过同源 iframe 访问其 DOM:
 *   - codeblitz webview 是「外层壳 iframe → 内层应用 iframe」两层, 需递归查找
 *   - 滚动容器: .ab-pdf__viewerContainer
 *   - 页面 div:  .ab-pdf-page[data-page="N"] (1 起)
 * 蒙层坐标用页内归一化 [0,1], 跟随滚动/容器变化重算.
 */
import type { PdfTarget } from './types';

const MAX_IFRAME_DEPTH = 4;

/** 在顶层 document 里递归找 PDF 阅读器 iframe (其 document 内含 .ab-pdf__viewerContainer) */
export function findPdfTarget(hostPath: string): PdfTarget | null {
  return findInDoc(document, hostPath, 0);
}

function findInDoc(doc: Document, hostPath: string, depth: number): PdfTarget | null {
  if (depth > MAX_IFRAME_DEPTH) return null;
  const iframes = Array.from(doc.querySelectorAll('iframe')) as HTMLIFrameElement[];
  for (const iframe of iframes) {
    let inner: Document | null = null;
    try {
      inner = iframe.contentDocument;
    } catch {
      continue;
    }
    if (!inner) continue;
    const viewer = inner.querySelector<HTMLElement>('.ab-pdf__viewerContainer');
    if (viewer) {
      return { iframe, doc: inner, viewer, hostPath };
    }
    const nested = findInDoc(inner, hostPath, depth + 1);
    if (nested) return nested;
  }
  return null;
}

/** iframe 链在顶层 document 中的累计偏移 (嵌套 iframe 需逐层累加) */
export function iframeChainOffset(iframe: HTMLIFrameElement): { left: number; top: number } {
  let left = 0;
  let top = 0;
  let current: HTMLIFrameElement | null = iframe;
  let guard = 0;
  while (current && guard++ < MAX_IFRAME_DEPTH + 1) {
    const r = current.getBoundingClientRect();
    left += r.left;
    top += r.top;
    const win = current.ownerDocument?.defaultView;
    current = (win?.frameElement as HTMLIFrameElement | null) ?? null;
  }
  return { left, top };
}

/**
 * 页面 div 在 viewer 内容坐标系中的几何 (offsetLeft/Top 相对 viewer 的 padding box,
 * 即滚动内容坐标 — 蒙层放 viewer 内 absolute 后天然随滚动跟随, 无需滚动重算).
 */
export function pageContentRect(target: PdfTarget, page: number): { left: number; top: number; width: number; height: number } | null {
  const el = pageEl(target, page);
  if (!el) return null;
  return {
    left: el.offsetLeft,
    top: el.offsetTop,
    width: el.offsetWidth,
    height: el.offsetHeight,
  };
}

/** iframe 视口坐标 → 页内归一化 [0,1] (用 viewer 滚动偏移换算内容坐标) */
export function viewportPointToNormalized(
  target: PdfTarget,
  page: number,
  clientX: number,
  clientY: number,
): { x: number; y: number } | null {
  const el = pageEl(target, page);
  if (!el || el.offsetWidth <= 0 || el.offsetHeight <= 0) return null;
  // iframe 视口坐标 + viewer 滚动 = 内容坐标; 页面在内容坐标中的 offset 已知
  const contentX = clientX + target.viewer.scrollLeft;
  const contentY = clientY + target.viewer.scrollTop;
  return {
    x: clamp01((contentX - el.offsetLeft) / el.offsetWidth),
    y: clamp01((contentY - el.offsetTop) / el.offsetHeight),
  };
}

/** iframe 视口坐标严格命中哪一页 (必须在画布内; 画布外返回 null — 标注不得超出画布) */
export function pageAtViewportPoint(target: PdfTarget, clientX: number, clientY: number): number | null {
  const count = pageCount(target);
  if (!count) return null;
  const contentX = clientX + target.viewer.scrollLeft;
  const contentY = clientY + target.viewer.scrollTop;
  for (let page = 1; page <= count; page++) {
    const rect = pageContentRect(target, page);
    if (!rect) continue;
    if (contentX >= rect.left && contentX <= rect.left + rect.width && contentY >= rect.top && contentY <= rect.top + rect.height) {
      return page;
    }
  }
  return null;
}

/** 页面 div (1 起页码) */
export function pageEl(target: PdfTarget, page: number): HTMLElement | null {
  return target.doc.querySelector<HTMLElement>(`.ab-pdf-page[data-page="${page}"]`);
}

/** 页面 div 在顶层 document 中的矩形 (iframe 链偏移 + 页内 rect, 无缩放) */
export function pageTopRect(target: PdfTarget, page: number): { left: number; top: number; width: number; height: number } | null {
  const el = pageEl(target, page);
  if (!el) return null;
  const offset = iframeChainOffset(target.iframe);
  const r = el.getBoundingClientRect();
  return {
    left: offset.left + r.left,
    top: offset.top + r.top,
    width: r.width,
    height: r.height,
  };
}

/** 页数 (页面 div 的最大 data-page) */
export function pageCount(target: PdfTarget): number {
  const els = target.doc.querySelectorAll<HTMLElement>('.ab-pdf-page[data-page]');
  let max = 0;
  els.forEach((el) => {
    const n = Number(el.dataset.page);
    if (Number.isFinite(n)) max = Math.max(max, n);
  });
  return max;
}

/** 顶层坐标 → 页内归一化 [0,1] (clamp 到页内) */
export function topPointToNormalized(
  target: PdfTarget,
  page: number,
  x: number,
  y: number,
): { x: number; y: number } | null {
  const rect = pageTopRect(target, page);
  if (!rect || rect.width <= 0 || rect.height <= 0) return null;
  return {
    x: clamp01((x - rect.left) / rect.width),
    y: clamp01((y - rect.top) / rect.height),
  };
}

/** 顶层坐标命中哪个页 (优先包含点, 否则最近页) */
export function pageAtPoint(target: PdfTarget, x: number, y: number): number | null {
  const count = pageCount(target);
  if (!count) return null;
  let nearest: number | null = null;
  let nearestDist = Number.POSITIVE_INFINITY;
  for (let page = 1; page <= count; page++) {
    const rect = pageTopRect(target, page);
    if (!rect) continue;
    const inside = x >= rect.left && x <= rect.left + rect.width && y >= rect.top && y <= rect.top + rect.height;
    if (inside) return page;
    const dx = Math.max(rect.left - x, 0, x - (rect.left + rect.width));
    const dy = Math.max(rect.top - y, 0, y - (rect.top + rect.height));
    const dist = dx * dx + dy * dy;
    if (dist < nearestDist) {
      nearestDist = dist;
      nearest = page;
    }
  }
  return nearest;
}

/** 监听滚动/尺寸/布局变化 → 重绘回调 (返回 dispose) */
export function observeTarget(target: PdfTarget, onChange: () => void): () => void {
  const disposers: Array<() => void> = [];
  const handler = () => onChange();
  target.viewer.addEventListener('scroll', handler, { passive: true });
  disposers.push(() => target.viewer.removeEventListener('scroll', handler));
  window.addEventListener('resize', handler);
  disposers.push(() => window.removeEventListener('resize', handler));
  let ro: ResizeObserver | null = null;
  try {
    ro = new ResizeObserver(handler);
    ro.observe(target.viewer);
    // 布局变化 (aside 开合/目录栏开合/窗口缩放) 会让 iframe 尺寸/位置变化 → 重绘
    ro.observe(target.iframe);
  } catch { /* ignore */ }
  if (ro) disposers.push(() => ro?.disconnect());
  return () => disposers.forEach((d) => d());
}

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.min(1, Math.max(0, n));
}
