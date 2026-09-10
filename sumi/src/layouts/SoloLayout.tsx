/**
 * SoloLayout — SOLO 模式布局 (三列 sidebar | main | aside, 自绘拖动条)
 *
 * 不用 codeblitz BoxPanel/SplitPanel (SlotRenderer + isTabbar 跟 SplitPanel sash 互相打架,
 *  拖不了). 布局状态 (sidebar 折叠/宽度 + aside 开合/宽度) 由 service/layout 单例持有,
 *  本组件只读状态渲染 + 把拖拽/联动动作委托给 service — 不再自持 state / 不再 api owner.
 *
 * 结构 (slot 见 config/slots.ts):
 *   ┌──────────────┬──────────────────┬─────────────────────────────┐
 *   │ sidebar      │ main             │ aside                       │
 *   │  ├ action    │  ├ action        │  ├ action                   │
 *   │  ├ container │  ├ container     │  ├ middle: sidebar│container │
 *   │  └ footer    │  └ footer        │  └ footer                   │
 *   └──────────────┴──────────────────┴─────────────────────────────┘
 *
 * 状态流转 (service/layout, 与跨拓展 executeCommand 一致):
 *   - sidebar 折叠 = collapsed boolean (折叠时不渲染, 不用 1px 占位)
 *   - aside 打开 → service.openAside() 内部自动折叠 sidebar 让出空间
 *   - 拖拽改宽 → service.setSidebarWidth / setAsideWidth (单例广播)
 */
import React, { useRef, useEffect } from 'react';
import { SlotRenderer } from '@opensumi/ide-core-browser/lib/react-providers/slot';
import { useInjectable } from '@opensumi/ide-core-browser/lib/react-hooks/injectable-hooks';

import { WorkspacePicker } from '../extensions/workspace/WorkspacePicker';
import { FilePicker } from '../extensions/filepicker/FilePicker';
import { SOLO_SLOTS } from '../config/slots';
import { LayoutToken, type ILayoutService } from '../service/layout';

export function SoloLayout(): React.ReactElement {
  const layout = useInjectable<ILayoutService>(LayoutToken);
  // 每次渲染取最新状态 (service 广播 → 本组件 subscribe 触发重渲染)
  const { sidebar, aside } = layout.state;
  const sidebarCollapsed = sidebar.collapsed;
  const sidebarW = sidebar.width;
  const asideOpen = aside.open;
  const asideW = aside.width;

  // aside 打开时: 视口变化同步到 50% (resize 由 service 处理)
  useEffect(() => {
    if (!asideOpen) return;
    const onResize = () => layout.syncAsideToViewport();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [asideOpen]);

  // 订阅状态变化 → 重渲染 (拖拽 / 命令 / 联动)
  const [, setRev] = React.useState(0);
  useEffect(() => {
    return layout.subscribe(() => setRev((n) => n + 1));
  }, [layout]);

  /* ─────────────── sidebar 拖拽 ─────────────── */
  const dragRef = useRef<{ startX: number; startW: number } | null>(null);
  const onResizerDown = (e: React.MouseEvent) => {
    e.preventDefault();
    dragRef.current = { startX: e.clientX, startW: sidebarW };
    const onMove = (ev: MouseEvent) => {
      if (!dragRef.current) return;
      const dx = ev.clientX - dragRef.current.startX;
      layout.setSidebarWidth(dragRef.current.startW + dx);
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
  };

  /* ─────────────── aside 拖拽 ─────────────── */
  const asideDragRef = useRef<{ startX: number; startW: number } | null>(null);
  const onAsideResizerDown = (e: React.MouseEvent) => {
    e.preventDefault();
    asideDragRef.current = { startX: e.clientX, startW: asideW };
    const onMove = (ev: MouseEvent) => {
      if (!asideDragRef.current) return;
      const dx = asideDragRef.current.startX - ev.clientX;
      layout.setAsideWidth(asideDragRef.current.startW + dx);
    };
    const onUp = () => {
      asideDragRef.current = null;
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  };

  return (
    <div className="app-solo">
      {/* 左列: sidebar (action / container / footer) */}
      {!sidebarCollapsed && (
        <div
          className="app-solo__sidebar"
          style={{ ['--sidebar-w' as any]: `${sidebarW}px` }}
        >
          <div className="app-solo__sidebar-action">
            <SlotRenderer slot={SOLO_SLOTS.SidebarAction} />
          </div>
          <div className="app-solo__sidebar-container">
            <SlotRenderer slot={SOLO_SLOTS.SidebarContainer} />
          </div>
          <div className="app-solo__sidebar-footer">
            <SlotRenderer slot={SOLO_SLOTS.SidebarFooter} />
          </div>
        </div>
      )}
      {!sidebarCollapsed && (
        <div className="app-solo__resizer" onMouseDown={onResizerDown} role="separator" aria-orientation="vertical" />
      )}
      {/* 中列: main (action / container / footer) */}
      <div className="app-solo__main">
        <div className="app-solo__main-action">
          <SlotRenderer slot={SOLO_SLOTS.MainAction} />
        </div>
        <div className="app-solo__main-container">
          <SlotRenderer slot={SOLO_SLOTS.MainContainer} />
        </div>
        <div className="app-solo__main-footer">
          <SlotRenderer slot={SOLO_SLOTS.MainFooter} />
        </div>
      </div>
      {/* 右列: aside (action / middle: sidebar|container / footer), 关闭 0px */}
      <div
        className={`app-solo__aside${asideOpen ? ' is-open' : ''}`}
        style={{ ['--aside-w' as any]: `${asideOpen ? asideW : 0}px` }}
      >
        {asideOpen && (
          <div
            className="app-solo__aside-resizer"
            onMouseDown={onAsideResizerDown}
            role="separator"
            aria-orientation="vertical"
          />
        )}
        <div className="app-solo__aside-body">
          <div className="app-solo__aside-action">
            <SlotRenderer slot={SOLO_SLOTS.AsideAction} />
          </div>
          <div className="app-solo__aside-middle">
            <div className="app-solo__aside-sidebar">
              <SlotRenderer slot={SOLO_SLOTS.AsideSidebar} />
            </div>
            <div className="app-solo__aside-container">
              <SlotRenderer slot={SOLO_SLOTS.AsideContainer} />
            </div>
          </div>
          <div className="app-solo__aside-footer">
            <SlotRenderer slot={SOLO_SLOTS.AsideFooter} />
          </div>
        </div>
      </div>
      <WorkspacePicker />
      <FilePicker />
    </div>
  );
}
