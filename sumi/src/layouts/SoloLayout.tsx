/**
 * SoloLayout — SOLO 模式布局 (chat 风格, 自己实现 2 大卡片 + 拖动条)
 *
 * 不用 codeblitz BoxPanel/SplitPanel (SlotRenderer + isTabbar 跟 SplitPanel sash 互相打架,
 *  拖不了). 自己用 React state 管 sidebar 宽度, 渲染 2 个 card + 中间拖动手柄.
 *
 * 卡片样式: 在 sumi/src/styles/app-shell.css 由 App 顶层装配 (全局唯一来源).
 * WorkspacePicker / FilePicker 是 codeblitz DI 内的全局浮层, 必须在 Layout 内部渲染.
 */
import React, { useState, useCallback, useRef, useEffect } from 'react';
import { SlotRenderer } from '@opensumi/ide-core-browser/lib/react-providers/slot';

import { WorkspacePicker } from '../extensions/workspace/WorkspacePicker';
import { FilePicker } from '../extensions/filepicker/FilePicker';
import { SOLO_SLOTS } from '../config/slots';

const DEFAULT_SIDEBAR_W = 256;
const MIN_SIDEBAR_W = 1;
const MAX_SIDEBAR_W = 480;

export function SoloLayout(): React.ReactElement {
  const [sidebarW, setSidebarW] = useState<number>(() => {
    const saved = localStorage.getItem('numas.solo.sidebarWidth');
    const n = saved ? parseInt(saved, 10) : DEFAULT_SIDEBAR_W;
    return Number.isFinite(n) ? Math.max(MIN_SIDEBAR_W, Math.min(MAX_SIDEBAR_W, n)) : DEFAULT_SIDEBAR_W;
  });
  const dragRef = useRef<{ startX: number; startW: number } | null>(null);

  useEffect(() => {
    localStorage.setItem('numas.solo.sidebarWidth', String(sidebarW));
  }, [sidebarW]);

  const onResizerDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      dragRef.current = { startX: e.clientX, startW: sidebarW };
      const onMove = (ev: MouseEvent) => {
        if (!dragRef.current) return;
        const dx = ev.clientX - dragRef.current.startX;
        const next = Math.max(
          MIN_SIDEBAR_W,
          Math.min(MAX_SIDEBAR_W, dragRef.current.startW + dx),
        );
        setSidebarW(next);
      };
      const onUp = () => {
        dragRef.current = null;
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onUp);
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
      };
      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
    },
    [sidebarW],
  );

  return (
    <div className="app-solo">
      <div
        className="app-solo__sidebar"
        style={{ flex: `0 0 ${sidebarW}px`, minWidth: 0, maxWidth: `${sidebarW}px` }}
      >
        <SlotRenderer slot={SOLO_SLOTS.Sidebar} />
      </div>
      {sidebarW > 0 && (
        <div className="app-solo__resizer" onMouseDown={onResizerDown} role="separator" aria-orientation="vertical" />
      )}
      <div className="app-solo__composer" style={{ flex: 1, minWidth: 0 }}>
        <SlotRenderer slot={SOLO_SLOTS.Composer} />
      </div>
      <WorkspacePicker />
      <FilePicker />
    </div>
  );
}
