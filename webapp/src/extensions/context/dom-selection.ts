/**
 * 自定义编辑器 / webview iframe 里的原生文本选区.
 * Monaco / xterm 有自己的选区, 这里只处理 #workbench-editor 内的 DOM 选区.
 *
 * OpenSumi webview 是两层 iframe: 外层 srcdoc host + 内层 #active-frame (docx/html 正文).
 * 选区在内层, 必须递归进同源 iframe 才能读到.
 */
import { ADD_CTX_FLOAT_CLASS } from './float';

const IGNORE_SEL = `.${ADD_CTX_FLOAT_CLASS}, .monaco-editor, .xterm, .chat, .ab-annot-popover, .ab-pdf-selection-rect`;

export function isFloatButton(el: EventTarget | null): boolean {
  return !!(el instanceof Element && el.closest(`.${ADD_CTX_FLOAT_CLASS}`));
}

export function workbenchEditorRoot(): HTMLElement | null {
  return document.getElementById('workbench-editor');
}

export function isInsideWorkbench(node: Node | null): boolean {
  const root = workbenchEditorRoot();
  return !!(root && node && root.contains(node));
}

export function isIgnoredHost(el: Element | null): boolean {
  return !!el?.closest(IGNORE_SEL);
}

export interface DomSelectionHit {
  text: string;
  x: number;
  y: number;
}

function hitFromSelection(sel: Selection | null): DomSelectionHit | null {
  if (!sel || sel.isCollapsed || sel.rangeCount < 1) return null;
  const text = String(sel.toString() || '').trim();
  if (!text) return null;
  const node = sel.anchorNode;
  const el = node instanceof Element ? node : node?.parentElement || null;
  if (isIgnoredHost(el)) return null;
  const range = sel.getRangeAt(0);
  const rect = range.getBoundingClientRect();
  if (rect.width < 1 && rect.height < 1) return null;
  return { text, x: rect.right, y: rect.bottom + 6 };
}

/** iframe 元素相对顶层 viewport 的偏移 (含嵌套 iframe). */
function iframeTopOffset(iframe: HTMLIFrameElement): { left: number; top: number } {
  let left = 0;
  let top = 0;
  let el: Element | null = iframe;
  while (el) {
    const r = el.getBoundingClientRect();
    left += r.left;
    top += r.top;
    const win = el.ownerDocument.defaultView;
    if (!win || win === window) break;
    el = win.frameElement;
  }
  return { left, top };
}

/** 当前窗口里、落在编辑器主区的 DOM 选区. */
export function readWorkbenchDomSelection(): DomSelectionHit | null {
  const sel = window.getSelection();
  const node = sel?.anchorNode || null;
  if (!isInsideWorkbench(node)) return null;
  return hitFromSelection(sel);
}

/** 同源 iframe 内选区, 坐标换算到父窗口 viewport. */
export function readIframeSelection(iframe: HTMLIFrameElement): DomSelectionHit | null {
  let doc: Document | null = null;
  try { doc = iframe.contentDocument; } catch { return null; }
  if (!doc) return null;
  const hit = hitFromSelection(doc.getSelection());
  if (!hit) return null;
  const off = iframeTopOffset(iframe);
  return { text: hit.text, x: off.left + hit.x, y: off.top + hit.y };
}

function iframeForDocument(doc: Document | null): HTMLIFrameElement | null {
  if (!doc || doc === document) return null;
  for (const iframe of collectAccessibleIframes()) {
    try {
      if (iframe.contentDocument === doc) return iframe;
    } catch { /* cross-origin */ }
  }
  return null;
}

/** mouseup 的 client 坐标 → 顶层 viewport. 内层 iframe 的 clientX/Y 只相对自己. */
export function eventPointToTop(e: MouseEvent): { x: number; y: number } {
  const doc = (e.target instanceof Node ? e.target.ownerDocument : null) || e.view?.document || null;
  if (!doc || doc === document) return { x: e.clientX, y: e.clientY };
  const iframe = iframeForDocument(doc);
  if (!iframe) return { x: e.clientX, y: e.clientY };
  const off = iframeTopOffset(iframe);
  return { x: off.left + e.clientX, y: off.top + e.clientY };
}

/**
 * workbench 内所有能读到的 iframe, 含 webview 内层 #active-frame.
 * 先外后内, 读选区时从后往前找 (内层优先).
 */
export function collectAccessibleIframes(root?: ParentNode | null): HTMLIFrameElement[] {
  const start = root || workbenchEditorRoot();
  const out: HTMLIFrameElement[] = [];
  if (!start) return out;
  const walk = (node: ParentNode) => {
    let frames: HTMLIFrameElement[] = [];
    try { frames = Array.from(node.querySelectorAll('iframe')); } catch { return; }
    for (const iframe of frames) {
      out.push(iframe);
      let doc: Document | null = null;
      try { doc = iframe.contentDocument; } catch { continue; }
      if (doc) walk(doc);
    }
  };
  walk(start);
  return out;
}

export function listWorkbenchIframes(): HTMLIFrameElement[] {
  return collectAccessibleIframes();
}

/** 内层优先: docx 正文在 webview #active-frame, 外层 host 没有选区. */
export function readAnyAccessibleSelection(): DomSelectionHit | null {
  const frames = collectAccessibleIframes();
  for (let i = frames.length - 1; i >= 0; i--) {
    const hit = readIframeSelection(frames[i]);
    if (hit) return hit;
  }
  return readWorkbenchDomSelection();
}
