/**
 * annotate 拓展 — 生成标注 / 标注交互 的蒙层与手势
 *
 * 生命周期严格限定在 PDF 阅读器 iframe 内 (顶层 document 零元素, 不影响全局 UI):
 *   - 蒙层 layer 挂在 viewer (position:relative) 内, 绝对定位于滚动内容坐标 → 滚动天然跟随
 *   - 拖动圈选监听挂 iframe document; 拖拽框/popover 也在 iframe 内
 *   - 生成标注: 拖动圈定释放即完成标注 (默认色落盘), popover 设置交互行为 [生成动画][生成代码][色板][取消标注];
 *     双击标注 → 同 popover
 *   - 标注交互: 加载即渲染标注; hover → 蒙层内右下角 [动画演示][运行代码]; 点击执行
 */
import type { Annotation, AnnoRect, PdfTarget } from './types';
import { DEFAULT_ANNO_COLOR } from './types';
import { pageAtViewportPoint, viewportPointToNormalized } from './pdf-target';

export interface OverlayCallbacks {
  /** 生成标注: 圈定释放即完成标注 (返回新标注 id; 失败返回 null) */
  onCreateRegion(page: number, rect: AnnoRect, color: string): string | null;
  /** 生成标注: popover 里发起内容生成 */
  onGenerate(id: string, action: 'animation' | 'code'): void;
  /** 生成标注: popover 里改色 */
  onRecolor(id: string, color: string): void;
  /** 标注交互: 已有标注的交互 */
  onPlayAnimation(id: string): void;
  onRunCode(id: string): void;
  onDelete(id: string): void;
}

const STYLE_ID = 'numas-annotate-style';
const MIN_SIZE = 5;

export class AnnotateOverlay {
  private layer: HTMLElement | null = null;
  private popover: HTMLElement | null = null;
  private target: PdfTarget | null = null;
  private annotations: Annotation[] = [];
  private dragging: { startX: number; startY: number; page: number } | null = null;
  private dragBox: HTMLElement | null = null;
  private disposers: Array<() => void> = [];
  private rafPending = false;

  public constructor(private readonly cb: OverlayCallbacks) {}

  public mount(target: PdfTarget): void {
    this.unmount();
    this.target = target;
    ensureStyle(target.doc);

    // layer 挂 iframe body (fixed 覆盖 iframe 视口): PDF 重建会清空 viewer, 不能挂 viewer 内
    const layer = target.doc.createElement('div');
    layer.className = 'numas-anno-layer';
    target.doc.body.appendChild(layer);
    this.layer = layer;

    // 拖动圈选: 监听挂 PDF iframe 的 document (layer 全穿透, 不挡 PDF 滚动/点击)
    target.doc.addEventListener('mousedown', this.onDocMouseDown, true);
    this.disposers.push(() => target.doc.removeEventListener('mousedown', this.onDocMouseDown, true));
    layer.addEventListener('click', this.onLayerClick, true);
    layer.addEventListener('dblclick', this.onLayerDblClick, true);
    this.disposers.push(() => layer.removeEventListener('click', this.onLayerClick, true));
    this.disposers.push(() => layer.removeEventListener('dblclick', this.onLayerDblClick, true));

    this.render();
  }

  public unmount(): void {
    this.closePopover();
    this.disposers.forEach((d) => d());
    this.disposers = [];
    this.layer?.remove();
    this.layer = null;
    this.target = null;
    this.annotations = [];
    this.dragging = null;
    this.dragBox = null;
  }

  /** rAF 节流重绘 (尺寸变化高频回调用) */
  public renderThrottled(): void {
    if (this.rafPending) return;
    this.rafPending = true;
    requestAnimationFrame(() => {
      this.rafPending = false;
      this.render();
    });
  }

  /** 重绘全部标注 (target/annotations 变化时调用) */
  public render(annotations?: Annotation[]): void {
    if (annotations) this.annotations = annotations;
    const layer = this.layer;
    const target = this.target;
    if (!layer || !target) return;
    Array.from(layer.querySelectorAll('.numas-anno-mark')).forEach((el) => el.remove());
    for (const anno of this.annotations) {
      // iframe 视口坐标 (fixed layer 覆盖视口; 滚动/尺寸变化由 observeTarget 触发重绘)
      const pageEl = target.doc.querySelector(`.ab-pdf-page[data-page="${anno.page}"]`) as HTMLElement | null;
      if (!pageEl) continue;
      const pageRect = pageEl.getBoundingClientRect();
      const mark = target.doc.createElement('div');
      mark.className = 'numas-anno-mark';
      mark.dataset.id = anno.id;
      mark.style.left = `${pageRect.left + anno.rect.x * pageRect.width}px`;
      mark.style.top = `${pageRect.top + anno.rect.y * pageRect.height}px`;
      mark.style.width = `${anno.rect.w * pageRect.width}px`;
      mark.style.height = `${anno.rect.h * pageRect.height}px`;
      mark.style.background = anno.color;
      mark.title = anno.text || '';

      // 标注交互: 右下角交互按钮行 (hover / 点击后展开) — 只显示已生成内容的回放按钮
      const actions = target.doc.createElement('div');
      actions.className = 'numas-anno-actions';
      if (anno.animation?.status === 'ready') {
        actions.appendChild(this.actionButton(target, '动画演示', () => this.cb.onPlayAnimation(anno.id)));
      } else if (anno.animation?.status === 'generating') {
        actions.appendChild(this.actionButton(target, '动画生成中…', () => { /* busy */ }, true));
      }
      if (anno.code?.status === 'ready') {
        actions.appendChild(this.actionButton(target, '运行代码', () => this.cb.onRunCode(anno.id)));
      } else if (anno.code?.status === 'generating') {
        actions.appendChild(this.actionButton(target, '代码生成中…', () => { /* busy */ }, true));
      }
      actions.appendChild(this.actionButton(target, '✕', () => this.cb.onDelete(anno.id)));
      if (actions.children.length > 1) {
        mark.appendChild(actions);
      }
      layer.appendChild(mark);
    }
  }

  private actionButton(doc: Document, label: string, onClick: () => void, busy = false): HTMLButtonElement {
    const b = doc.createElement('button');
    b.type = 'button';
    b.className = busy ? 'numas-anno-action is-busy' : 'numas-anno-action';
    b.textContent = label;
    b.addEventListener('click', (e) => {
      e.stopPropagation();
      if (!busy) onClick();
    });
    return b;
  }

  /* ─────────── 生成标注: 拖动圈选 (iframe 内坐标) ─────────── */

  private onDocMouseDown = (e: MouseEvent): void => {
    if (e.button !== 0 || !this.target) return;
    if (this.popover) return;
    const targetEl = e.target as HTMLElement | null;
    if (targetEl && targetEl.closest && targetEl.closest('.numas-anno-mark')) return;
    const page = pageAtViewportPoint(this.target, e.clientX, e.clientY);
    if (!page) return;
    e.preventDefault();
    this.dragging = { startX: e.clientX, startY: e.clientY, page };
    const box = this.target.doc.createElement('div');
    box.className = 'numas-anno-dragbox';
    this.target.doc.body.appendChild(box);
    this.dragBox = box;
    const win = this.target.doc.defaultView || window;
    win.addEventListener('mousemove', this.onMouseMove, true);
    win.addEventListener('mouseup', this.onMouseUp, true);
  };

  private onMouseMove = (e: MouseEvent): void => {
    if (!this.dragging || !this.dragBox) return;
    const { startX, startY } = this.dragging;
    const left = Math.min(startX, e.clientX);
    const top = Math.min(startY, e.clientY);
    this.dragBox.style.left = `${left}px`;
    this.dragBox.style.top = `${top}px`;
    this.dragBox.style.width = `${Math.abs(e.clientX - startX)}px`;
    this.dragBox.style.height = `${Math.abs(e.clientY - startY)}px`;
  };

  private onMouseUp = (e: MouseEvent): void => {
    const win = this.target?.doc.defaultView || window;
    win.removeEventListener('mousemove', this.onMouseMove, true);
    win.removeEventListener('mouseup', this.onMouseUp, true);
    const drag = this.dragging;
    this.dragging = null;
    this.dragBox?.remove();
    this.dragBox = null;
    if (!drag || !this.target) return;
    const x1 = Math.min(drag.startX, e.clientX);
    const y1 = Math.min(drag.startY, e.clientY);
    const x2 = Math.max(drag.startX, e.clientX);
    const y2 = Math.max(drag.startY, e.clientY);
    if (x2 - x1 < MIN_SIZE || y2 - y1 < MIN_SIZE) return;
    // 归一化自带 clamp01: 拖出画布的部分被收进画布边界 (标注不得超出画布)
    const p1 = viewportPointToNormalized(this.target, drag.page, x1, y1);
    const p2 = viewportPointToNormalized(this.target, drag.page, x2, y2);
    if (!p1 || !p2) return;
    const rect: AnnoRect = {
      x: Math.min(p1.x, p2.x),
      y: Math.min(p1.y, p2.y),
      w: Math.abs(p2.x - p1.x),
      h: Math.abs(p2.y - p1.y),
    };
    // 释放即完成标注 (默认色), popover 用于设置交互行为
    const id = this.cb.onCreateRegion(drag.page, rect, DEFAULT_ANNO_COLOR);
    if (id) this.showPopover(x2, y2, id);
  };

  /* ─────────── 生成标注: popover (iframe 内, 一行) ─────────── */

  private showPopover(x: number, y: number, annoId: string): void {
    const target = this.target;
    if (!target || !annoId) return;
    this.closePopover();
    const doc = target.doc;
    const pop = doc.createElement('div');
    pop.className = 'numas-anno-popover';
    const current = this.annotations.find((a) => a.id === annoId);
    let chosenColor = current?.color || DEFAULT_ANNO_COLOR;
    // 设置交互行为: 生成动画 / 生成代码 (不生成也可, 标注已完成)
    for (const [label, action] of [['生成动画', 'animation'], ['生成代码', 'code']] as const) {
      const b = doc.createElement('button');
      b.type = 'button';
      b.className = 'numas-anno-create';
      b.textContent = label;
      b.addEventListener('click', () => {
        this.closePopover();
        this.cb.onGenerate(annoId, action);
      });
      pop.appendChild(b);
    }
    // 颜色选择器 (原生 color input; 固定透明度做蒙层)
    const picker = doc.createElement('input');
    picker.type = 'color';
    picker.className = 'numas-anno-picker';
    picker.value = hexFromRgba(chosenColor);
    picker.title = '标注颜色';
    picker.addEventListener('input', () => {
      chosenColor = rgbaFromHex(picker.value);
      this.cb.onRecolor(annoId, chosenColor);
    });
    pop.appendChild(picker);
    // 取消标注 (文字按钮, 点击删除该标注)
    const cancel = doc.createElement('button');
    cancel.type = 'button';
    cancel.className = 'numas-anno-cancel';
    cancel.textContent = '取消标注';
    cancel.addEventListener('click', () => {
      this.closePopover();
      this.cb.onDelete(annoId);
    });
    pop.appendChild(cancel);
    doc.body.appendChild(pop);
    const pw = pop.offsetWidth || 300;
    const ph = pop.offsetHeight || 34;
    const win = doc.defaultView || window;
    pop.style.left = `${Math.min(x + 6, win.innerWidth - pw - 8)}px`;
    pop.style.top = `${Math.min(y + 6, win.innerHeight - ph - 8)}px`;
    this.popover = pop;
  }

  private closePopover(): void {
    this.popover?.remove();
    this.popover = null;
  }

  /* ─────────── 手势: 单击空白关 popover; 双击标注 → 生成标注 popover ─────────── */

  private onLayerClick = (e: MouseEvent): void => {
    const mark = (e.target as HTMLElement).closest('.numas-anno-mark') as HTMLElement | null;
    if (!mark) {
      if (this.popover) this.closePopover();
      return;
    }
  };

  private onLayerDblClick = (e: MouseEvent): void => {
    const mark = (e.target as HTMLElement).closest('.numas-anno-mark') as HTMLElement | null;
    if (!mark) return;
    const id = mark.dataset.id;
    const anno = this.annotations.find((a) => a.id === id);
    if (!anno) return;
    const r = mark.getBoundingClientRect();
    this.showPopover(r.right, r.bottom, anno.id);
  };
}

/** rgba/hex → hex (color input 只吃 hex) */
function hexFromRgba(color: string): string {
  const m = /rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i.exec(color);
  if (m) {
    const to2 = (n: string) => Number(n).toString(16).padStart(2, '0');
    return `#${to2(m[1])}${to2(m[2])}${to2(m[3])}`;
  }
  if (/^#[0-9a-f]{6}$/i.test(color)) return color;
  return '#facc15';
}

/** hex → rgba 蒙层色 (固定透明度 0.28) */
function rgbaFromHex(hex: string): string {
  const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex);
  if (!m) return DEFAULT_ANNO_COLOR;
  return `rgba(${parseInt(m[1], 16)}, ${parseInt(m[2], 16)}, ${parseInt(m[3], 16)}, 0.28)`;
}

/* ─────────── 样式 (注入 PDF iframe 的 head; 主题变量带硬编码兜底) ─────────── */

function ensureStyle(doc: Document): void {
  if (!doc) return;
  const existed = doc.getElementById(STYLE_ID);
  if (existed) existed.remove();
  const style = doc.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
.numas-anno-layer {
  position: fixed;
  left: 0;
  top: 0;
  right: 0;
  bottom: 0;
  z-index: 30;
  pointer-events: none;
}
.numas-anno-mark {
  pointer-events: auto;
  position: absolute;
  border-radius: 2px;
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--focusBorder, #6d5ef5) 55%, transparent);
}
.numas-anno-mark:hover,
.numas-anno-mark.is-open {
  box-shadow: inset 0 0 0 1.5px var(--focusBorder, #6d5ef5);
}
.numas-anno-actions {
  position: absolute;
  right: 2px;
  bottom: 2px;
  display: none;
  align-items: center;
  gap: 4px;
  white-space: nowrap;
}
.numas-anno-mark:hover .numas-anno-actions,
.numas-anno-mark.is-open .numas-anno-actions {
  display: inline-flex;
}
.numas-anno-action {
  height: 20px;
  padding: 0 7px;
  font-size: 11px;
  font-family: inherit;
  color: var(--editor-foreground, #1f2329);
  background: var(--editorWidget-background, #ffffff);
  border: 1px solid var(--panel-border, rgba(17,24,39,0.14));
  border-radius: 6px;
  box-shadow: 0 1px 2px rgba(17,24,39,0.08);
  cursor: pointer;
}
.numas-anno-action:hover {
  background: color-mix(in srgb, var(--focusBorder, #6d5ef5) 12%, var(--editorWidget-background, #fff));
}
.numas-anno-action.is-busy {
  opacity: 0.6;
  cursor: default;
}
.numas-anno-dragbox {
  position: fixed;
  z-index: 10045;
  pointer-events: none;
  background: color-mix(in srgb, var(--focusBorder, #6d5ef5) 16%, transparent);
  border: 1px dashed var(--focusBorder, #6d5ef5);
  border-radius: 2px;
}
.numas-anno-popover {
  position: fixed;
  z-index: 10060;
  display: flex;
  align-items: center;
  gap: 6px;
  height: 34px;
  padding: 0 8px;
  background: var(--editorWidget-background, #ffffff);
  border: 1px solid var(--panel-border, rgba(17,24,39,0.12));
  border-radius: 10px;
  box-shadow: 0 1px 2px rgba(17,24,39,0.06), 0 8px 24px rgba(17,24,39,0.12);
}
.numas-anno-create {
  height: 24px;
  padding: 0 9px;
  font-size: 12px;
  font-family: inherit;
  font-weight: 500;
  color: #fff;
  background: var(--button-background, #6d5ef5);
  border: 0;
  border-radius: 6px;
  cursor: pointer;
}
.numas-anno-create:hover {
  filter: brightness(1.06);
}
.numas-anno-picker {
  width: 26px;
  height: 24px;
  padding: 0;
  border: 1px solid var(--panel-border, rgba(17,24,39,0.14));
  border-radius: 6px;
  background: transparent;
  cursor: pointer;
}
.numas-anno-cancel {
  height: 24px;
  padding: 0 8px;
  margin-left: 2px;
  font-size: 12px;
  font-family: inherit;
  color: var(--editor-foreground, #1f2329);
  background: transparent;
  border: 1px solid var(--panel-border, rgba(17,24,39,0.14));
  border-radius: 6px;
  cursor: pointer;
}
.numas-anno-cancel:hover {
  background: color-mix(in srgb, #ef4444 12%, transparent);
  color: #ef4444;
}
`;
  doc.head.appendChild(style);
}
