/**
 * 选区悬浮条 — 编辑器 / 终端 / 自定义编辑器共用一颗「添加到对话」按钮.
 * 用 viewport 坐标定位 (position:fixed), mousedown preventDefault 以免冲掉选区.
 *
 * 跟 PDF 标注条同一套 editorWidget 变量, 并带 --ai-* / 硬编码兜底, 亮暗都能看清.
 */

const STYLE_ID = 'numas-add-ctx-float-style';
export const ADD_CTX_FLOAT_CLASS = 'numas-add-ctx-float';

let btn: HTMLButtonElement | null = null;
let onPick: (() => void) | null = null;

function ensureStyle(): void {
  if (typeof document === 'undefined') return;
  const existed = document.getElementById(STYLE_ID);
  if (existed) existed.remove();
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
.${ADD_CTX_FLOAT_CLASS} {
  position: fixed;
  z-index: 10050;
  display: none;
  align-items: center;
  gap: 6px;
  height: 32px;
  padding: 0 12px 0 8px;
  box-sizing: border-box;
  font-family: inherit;
  font-size: 12px;
  font-weight: 500;
  letter-spacing: 0.01em;
  line-height: 1;
  color: var(--ai-fg, var(--editor-foreground, var(--vscode-editor-foreground, #111827)));
  background: var(--ai-bg-elev, var(--editorWidget-background, var(--vscode-editorWidget-background, #ffffff)));
  border: 1px solid var(--ai-border, var(--panel-border, var(--vscode-widget-border, rgba(17,24,39,0.10))));
  border-radius: 10px;
  box-shadow:
    0 1px 2px rgba(17,24,39,0.06),
    0 8px 24px rgba(17,24,39,0.10);
  backdrop-filter: blur(16px) saturate(140%);
  -webkit-backdrop-filter: blur(16px) saturate(140%);
  cursor: pointer;
  white-space: nowrap;
  user-select: none;
  -webkit-user-select: none;
  transform-origin: top left;
}
.${ADD_CTX_FLOAT_CLASS}.is-in {
  animation: numas-add-ctx-in 160ms cubic-bezier(0.16, 1, 0.3, 1) both;
}
.${ADD_CTX_FLOAT_CLASS}__ic {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  border-radius: 6px;
  color: var(--ai-accent, #2675EE);
  background: var(--ai-accent-50, rgba(38,117,238,0.12));
  flex-shrink: 0;
}
.${ADD_CTX_FLOAT_CLASS}__ic svg {
  display: block;
}
.${ADD_CTX_FLOAT_CLASS}__txt {
  padding-bottom: 1px;
}
.${ADD_CTX_FLOAT_CLASS}:hover {
  color: var(--ai-accent, #2675EE);
  border-color: color-mix(in srgb, var(--ai-accent, #2675EE) 38%, transparent);
  background: color-mix(in srgb, var(--ai-accent, #2675EE) 10%, var(--ai-bg-elev, #ffffff));
}
.${ADD_CTX_FLOAT_CLASS}:hover .${ADD_CTX_FLOAT_CLASS}__ic {
  background: var(--ai-accent, #2675EE);
  color: var(--ai-accent-fg, #ffffff);
}
.${ADD_CTX_FLOAT_CLASS}:active {
  transform: scale(0.98);
}
body.design-dark .${ADD_CTX_FLOAT_CLASS},
body.vs-dark .${ADD_CTX_FLOAT_CLASS} {
  color: var(--ai-fg, #E8EDF4);
  background: color-mix(in srgb, var(--ai-bg-elev, #1A2029) 88%, transparent);
  border-color: var(--ai-border, rgba(255,255,255,0.10));
  box-shadow:
    0 1px 2px rgba(0,0,0,0.28),
    0 12px 32px rgba(0,0,0,0.36);
}
body.design-dark .${ADD_CTX_FLOAT_CLASS}:hover,
body.vs-dark .${ADD_CTX_FLOAT_CLASS}:hover {
  color: var(--ai-accent, #4C8DFF);
  background: color-mix(in srgb, var(--ai-accent, #4C8DFF) 16%, var(--ai-bg-elev, #1A2029));
  border-color: color-mix(in srgb, var(--ai-accent, #4C8DFF) 42%, transparent);
}
@keyframes numas-add-ctx-in {
  from { opacity: 0; transform: translateY(5px) scale(0.98); }
  to { opacity: 1; transform: translateY(0) scale(1); }
}
@media (prefers-reduced-motion: reduce) {
  .${ADD_CTX_FLOAT_CLASS}.is-in { animation: none; }
}
`;
  document.head.appendChild(style);
}

function ensureBtn(): HTMLButtonElement {
  ensureStyle();
  if (btn && document.body.contains(btn)) return btn;
  const el = document.createElement('button');
  el.type = 'button';
  el.className = ADD_CTX_FLOAT_CLASS;
  el.setAttribute('aria-label', '添加到对话');
  el.innerHTML =
    `<span class="${ADD_CTX_FLOAT_CLASS}__ic" aria-hidden="true">` +
    `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">` +
    `<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>` +
    `<line x1="12" y1="8" x2="12" y2="14"/>` +
    `<line x1="9" y1="11" x2="15" y2="11"/>` +
    `</svg></span>` +
    `<span class="${ADD_CTX_FLOAT_CLASS}__txt">添加到对话</span>`;
  el.addEventListener('mousedown', (e) => {
    e.preventDefault();
    e.stopPropagation();
  });
  el.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    const fn = onPick;
    hideAddToChatFloat();
    fn?.();
  });
  document.body.appendChild(el);
  btn = el;
  return el;
}

function clamp(x: number, y: number, w: number, h: number): { left: number; top: number } {
  const pad = 8;
  return {
    left: Math.min(Math.max(x, pad), Math.max(pad, window.innerWidth - w - pad)),
    top: Math.min(Math.max(y, pad), Math.max(pad, window.innerHeight - h - pad)),
  };
}

/** 在 viewport (x, y) 处显示按钮. 再次调用会挪位置. */
export function showAddToChatFloat(x: number, y: number, pick: () => void): void {
  onPick = pick;
  const el = ensureBtn();
  el.style.display = 'flex';
  el.classList.remove('is-in');
  const r = el.getBoundingClientRect();
  const pos = clamp(x, y, r.width || 128, r.height || 32);
  el.style.left = `${pos.left}px`;
  el.style.top = `${pos.top}px`;
  void el.offsetWidth;
  el.classList.add('is-in');
}

export function hideAddToChatFloat(): void {
  onPick = null;
  if (!btn) return;
  btn.classList.remove('is-in');
  btn.style.display = 'none';
}
