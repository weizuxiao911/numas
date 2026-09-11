/**
 * PDF 标注层 (webview 内实现, 与阅读器同文档 — 无跨 frame 复杂度)
 *
 * 生成标注: 画布内拖动释放 → 立即完成标注 (默认色) + popover [生成动画][生成代码][颜色][取消标注];
 *           双击标注 → 同 popover
 * 标注交互: 加载渲染标注 (随画布缩放) → hover [动画演示]/[运行代码]/[✕] → 点击执行
 *
 * 坐标: 页面 div 的 viewport rect (iframe 视口坐标) + 归一化 [0,1]; 滚动/尺寸 rAF 节流重绘.
 */
import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';

export interface AnnoRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface AnnoCapability {
  status: 'generating' | 'ready' | 'failed';
  file?: string;
  command?: string;
  error?: string;
}

export interface Annotation {
  id: string;
  page: number;
  rect: AnnoRect;
  color: string;
  text: string;
  createdAt: number;
  animation?: AnnoCapability;
  code?: AnnoCapability;
}

export const DEFAULT_ANNO_COLOR = 'rgba(250, 204, 21, 0.28)';

export interface AnnotateLayerProps {
  /** 可见性 (顶部「标注信息」toggle) */
  visible: boolean;
  annotations: Annotation[];
  /** 取页面 div (1 起页码) */
  getPageEl: (page: number) => HTMLElement | null;
  /** 滚动容器 (viewer): 仅用于拖动命中判定 */
  scrollHost: HTMLElement | null;
  /** 生成标注: 释放即完成 (返回新标注 id, 用于直接弹 popover) */
  onCreateRegion: (page: number, rect: AnnoRect, color: string) => Promise<string | null>;
  onGenerate: (id: string, action: 'animation' | 'code') => void;
  onRecolor: (id: string, color: string) => void;
  onDelete: (id: string) => void;
  /** 标注交互 */
  onPlayAnimation: (id: string) => void;
  onRunCode: (id: string) => void;
  /** 页面骨架重建计数 (rebuild 后蒙层需重新挂载) */
  renderTick?: number;
  /** 页面总数 (0 → N 变化表示骨架就绪; 标注先于骨架加载时需重挂) */
  pageCount?: number;
  /** 骨架构建完成计数 (rebuild 末尾递增; 子 effect 先于父 rebuild 执行, 靠它触发重挂) */
  pagesBuilt?: number;
}

interface PopoverState {
  annoId: string;
  color: string;
}

const MIN_SIZE = 5;

export const AnnotateLayer: React.FC<AnnotateLayerProps> = (props) => {
  const { visible, annotations, getPageEl, scrollHost, renderTick, pageCount, pagesBuilt } = props;
  const rootRef = useRef<HTMLDivElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const [popover, setPopover] = useState<PopoverState | null>(null);

  /** popover 实时锚定标注区域 (跟随滚动/缩放, 命令式更新零延迟) */
  const positionPopover = useCallback(() => {
    const el = popoverRef.current;
    if (!el) return;
    const id = el.dataset['annoId'];
    if (!id) return;
    const doc = getPageEl(1)?.ownerDocument || document;
    const mark = doc.querySelector<HTMLElement>(`.pdf-anno-mark[data-id="${id}"]`);
    if (!mark) return;
    const r = mark.getBoundingClientRect();
    const left = Math.max(8, Math.min(r.left, window.innerWidth - 340));
    const top = Math.min(r.bottom + 6, window.innerHeight - 44);
    el.style.left = `${left}px`;
    el.style.top = `${Math.max(8, top)}px`;
  }, [getPageEl]);

  useLayoutEffect(() => {
    positionPopover();
  }, [popover, positionPopover]);

  // 点击 popover 外部 → 关闭
  useEffect(() => {
    if (!popover) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as HTMLElement;
      if (t.closest?.('.pdf-anno-popover') || t.closest?.('.pdf-anno-mark')) return;
      setPopover(null);
    };
    document.addEventListener('mousedown', onDown, true);
    return () => document.removeEventListener('mousedown', onDown, true);
  }, [popover]);

  useEffect(() => {
    if (!popover) return;
    const onMove = () => positionPopover();
    scrollHost?.addEventListener('scroll', onMove, { passive: true });
    window.addEventListener('resize', onMove);
    return () => {
      scrollHost?.removeEventListener('scroll', onMove);
      window.removeEventListener('resize', onMove);
    };
  }, [popover, scrollHost, positionPopover]);
  const dragRef = useRef<{ startX: number; startY: number; page: number; box: HTMLDivElement | null } | null>(null);
  useEffect(() => {
    if (!scrollHost) return;
    scrollHost.addEventListener('mousedown', onMouseDownRef.current!);
    return () => scrollHost.removeEventListener('mousedown', onMouseDownRef.current!);
  }, [scrollHost]);

  /* ─────────── 生成标注: 拖动圈选 ─────────── */

  const onMouseDownRef = useRef<((e: MouseEvent) => void) | null>(null);
  const onMouseDown = useCallback((e: MouseEvent) => {
    if (e.button !== 0) return;
    const t = e.target as HTMLElement;
    if (t.closest('.pdf-anno-mark, .pdf-anno-popover')) return;
    const root = rootRef.current;
    if (!root) return;
    // 命中页面 (严格画布内; 允许在画布内起拖)
    let hit: { page: number; el: HTMLElement } | null = null;
    for (let p = 1; p <= 2000; p++) {
      const el = getPageEl(p);
      if (!el) break;
      const r = el.getBoundingClientRect();
      if (e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom) {
        hit = { page: p, el };
        break;
      }
    }
    if (!hit) return;
    e.preventDefault();
    const box = document.createElement('div');
    box.className = 'pdf-anno-dragbox';
    root.appendChild(box);
    dragRef.current = { startX: e.clientX, startY: e.clientY, page: hit.page, box };
  }, [getPageEl]);
  onMouseDownRef.current = onMouseDown;

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      const d = dragRef.current;
      if (!d || !d.box) return;
      const left = Math.min(d.startX, e.clientX);
      const top = Math.min(d.startY, e.clientY);
      d.box.style.left = `${left}px`;
      d.box.style.top = `${top}px`;
      d.box.style.width = `${Math.abs(e.clientX - d.startX)}px`;
      d.box.style.height = `${Math.abs(e.clientY - d.startY)}px`;
    };
    const onUp = (e: MouseEvent) => {
      const d = dragRef.current;
      dragRef.current = null;
      if (!d) return;
      d.box?.remove();
      const x1 = Math.min(d.startX, e.clientX);
      const y1 = Math.min(d.startY, e.clientY);
      const x2 = Math.max(d.startX, e.clientX);
      const y2 = Math.max(d.startY, e.clientY);
      if (x2 - x1 < MIN_SIZE || y2 - y1 < MIN_SIZE) return;
      const el = getPageEl(d.page);
      if (!el) return;
      const r = el.getBoundingClientRect();
      if (r.width <= 0 || r.height <= 0) return;
      const clamp01 = (n: number) => Math.min(1, Math.max(0, n));
      const rect: AnnoRect = {
        x: clamp01((x1 - r.left) / r.width),
        y: clamp01((y1 - r.top) / r.height),
        w: Math.abs(clamp01((x2 - r.left) / r.width) - clamp01((x1 - r.left) / r.width)),
        h: Math.abs(clamp01((y2 - r.top) / r.height) - clamp01((y1 - r.top) / r.height)),
      };
      // 释放即完成标注 → 拿到新 id 直接弹 popover
      void props.onCreateRegion(d.page, rect, DEFAULT_ANNO_COLOR).then((id) => {
        if (id) setPopover({ annoId: id, color: DEFAULT_ANNO_COLOR });
      });
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [getPageEl, props]);

  /* ─────────── 渲染: 命令式同步蒙层进页面 div (页内百分比, 零漂移) ─────────── */

  useEffect(() => {
    const doc = getPageEl(1)?.ownerDocument || document;
    // 清掉旧蒙层 (每次全量重建, 逻辑简单可靠)
    doc.querySelectorAll('.pdf-anno-mark').forEach((el) => el.remove());
    if (!visible) return;
    for (const anno of annotations) {
      const pageEl = getPageEl(anno.page);
      if (!pageEl) continue;
      const mark = doc.createElement('div');
      mark.className = 'pdf-anno-mark';
      mark.dataset.id = anno.id;
      mark.title = anno.text || '';
      mark.style.cssText = `left:${anno.rect.x * 100}%;top:${anno.rect.y * 100}%;width:${anno.rect.w * 100}%;height:${anno.rect.h * 100}%;background:${anno.color};`;

      const actions: Array<{ label: string; icon?: string; busy?: boolean; onClick: () => void }> = [];
      if (anno.animation?.status === 'ready') actions.push({ label: '动画演示', icon: 'play', onClick: () => props.onPlayAnimation(anno.id) });
      else if (anno.animation?.status === 'generating') actions.push({ label: '动画生成中', busy: true, onClick: () => {} });
      if (anno.code?.status === 'ready') actions.push({ label: '运行代码', icon: 'code', onClick: () => props.onRunCode(anno.id) });
      else if (anno.code?.status === 'generating') actions.push({ label: '代码生成中', busy: true, onClick: () => {} });

      if (actions.length > 0) {
        const bar = doc.createElement('div');
        bar.className = 'pdf-anno-actions';
        for (const a of actions) {
          const btn = doc.createElement('button');
          btn.type = 'button';
          btn.className = a.busy ? 'pdf-anno-action is-busy' : 'pdf-anno-action';
          if (a.icon) {
            const ic = doc.createElement('span');
            ic.className = `codicon codicon-${a.icon}`;
            btn.appendChild(ic);
          }
          const tx = doc.createElement('span');
          tx.textContent = a.label;
          btn.appendChild(tx);
          btn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (!a.busy) a.onClick();
          });
          // 交互按钮不得触发标注的 dblclick (popover 编辑态)
          btn.addEventListener('dblclick', (e) => e.stopPropagation());
          bar.appendChild(btn);
        }
        mark.appendChild(bar);
      }

      mark.addEventListener('dblclick', (e) => {
        e.stopPropagation();
        setPopover({ annoId: anno.id, color: anno.color });
      });
      pageEl.appendChild(mark);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [annotations, visible, renderTick, pageCount, pagesBuilt]);

  return (
    <div ref={rootRef} className="pdf-anno-layer" style={{ pointerEvents: 'none' }}>
      {popover && popover.annoId && (
        <div
          ref={popoverRef}
          className="pdf-anno-popover"
          data-anno-id={popover.annoId}
          onMouseDown={(e) => e.stopPropagation()}
        >
          <input
            type="color"
            className="pdf-anno-picker"
            value={rgbaToHex(popover.color)}
            title="标注颜色"
            onChange={(e) => {
              const color = hexToRgba(e.target.value);
              setPopover({ ...popover, color });
              props.onRecolor(popover.annoId, color);
            }}
          />
          <button type="button" className="pdf-anno-create" onClick={() => { const id = popover.annoId; setPopover(null); props.onGenerate(id, 'animation'); }}>生成动画</button>
          <button type="button" className="pdf-anno-create" onClick={() => { const id = popover.annoId; setPopover(null); props.onGenerate(id, 'code'); }}>生成代码</button>
          <button type="button" className="pdf-anno-cancel" onClick={() => { const id = popover.annoId; setPopover(null); props.onDelete(id); }}>取消标注</button>
        </div>
      )}
    </div>
  );
};

/* ─────────── 颜色转换 (color input 只吃 hex; 蒙层固定透明度 0.28) ─────────── */

function rgbaToHex(color: string): string {
  const m = /rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i.exec(color);
  if (m) {
    const to2 = (n: string) => Number(n).toString(16).padStart(2, '0');
    return `#${to2(m[1])}${to2(m[2])}${to2(m[3])}`;
  }
  if (/^#[0-9a-f]{6}$/i.test(color)) return color;
  return '#facc15';
}

function hexToRgba(hex: string): string {
  const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex);
  if (!m) return DEFAULT_ANNO_COLOR;
  return `rgba(${parseInt(m[1], 16)}, ${parseInt(m[2], 16)}, ${parseInt(m[3], 16)}, 0.28)`;
}

/** 标注层样式 (docx 风格: 玻璃/主题变量 + 硬编码兜底) */
export const ANNO_STYLES = `
.pdf-anno-layer {
  position: absolute;
  left: 0;
  top: 0;
  right: 0;
  bottom: 0;
  z-index: 30;
  pointer-events: none;
}
.pdf-anno-mark {
  pointer-events: auto;
  position: absolute;
  border-radius: 2px;
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--vscode-charts-blue, #3794ff) 55%, transparent);
  cursor: default;
}
.pdf-anno-mark:hover,
.pdf-anno-mark.is-open {
  box-shadow: inset 0 0 0 1.5px var(--vscode-charts-blue, #3794ff);
}
.pdf-anno-actions {
  /* 交互工具条: 标注区域内右下角, 深色 widget 风格, 淡入出现 */
  position: absolute;
  right: 3px;
  bottom: 3px;
  z-index: 6;
  display: inline-flex;
  align-items: center;
  gap: 2px;
  height: 24px;
  padding: 0 2px;
  white-space: nowrap;
  background: var(--vscode-editorWidget-background, #252526);
  border: 1px solid var(--vscode-editorWidget-border, rgba(255, 255, 255, 0.12));
  border-radius: 999px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.35);
  opacity: 0;
  transition: opacity 0.1s ease;
  pointer-events: none;
}
.pdf-anno-mark:hover .pdf-anno-actions {
  opacity: 1;
  pointer-events: auto;
}
.pdf-anno-action {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  height: 19px;
  padding: 0 6px;
  font-size: 11px;
  font-family: inherit;
  color: var(--vscode-editorWidget-foreground, #cccccc);
  background: transparent;
  border: 0;
  border-radius: 999px;
  cursor: pointer;
}
.pdf-anno-action .codicon { font-size: 13px; line-height: 1; }
.pdf-anno-action:hover { background: var(--vscode-toolbar-hoverBackground, rgba(255, 255, 255, 0.08)); }
.pdf-anno-action.is-busy { opacity: 0.6; cursor: default; }
.pdf-anno-action.is-busy:hover { background: transparent; }
.pdf-anno-dragbox {
  position: fixed;
  z-index: 10045;
  pointer-events: none;
  background: color-mix(in srgb, var(--vscode-charts-blue, #3794ff) 16%, transparent);
  border: 1px dashed var(--vscode-charts-blue, #3794ff);
  border-radius: 2px;
}
.pdf-anno-popover {
  position: fixed;
  z-index: 10060;
  display: flex;
  align-items: center;
  gap: 6px;
  height: 34px;
  padding: 0 8px;
  pointer-events: auto;
  background: #ffffff;
  border: 1px solid rgba(17,24,39,0.12);
  border-radius: 10px;
  box-shadow: 0 1px 2px rgba(17,24,39,0.06), 0 8px 24px rgba(17,24,39,0.12);
}
.pdf-anno-create {
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
.pdf-anno-create:hover { filter: brightness(1.06); }
.pdf-anno-picker {
  width: 26px;
  height: 24px;
  padding: 0;
  border: 1px solid rgba(17,24,39,0.14);
  border-radius: 6px;
  background: transparent;
  cursor: pointer;
}
.pdf-anno-cancel {
  height: 24px;
  padding: 0 8px;
  font-size: 12px;
  font-family: inherit;
  color: var(--vscode-editor-foreground, #1f2329);
  background: transparent;
  border: 1px solid rgba(17,24,39,0.14);
  border-radius: 6px;
  cursor: pointer;
}
.pdf-anno-cancel:hover { background: color-mix(in srgb, #ef4444 12%, transparent); color: #ef4444; }
`;
